import express from 'express';
import Boom from '@hapi/boom';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { provisionLimiter, deviceOpsLimiter } from '../rateLimit.js';
import { randomBytes, toB64 } from '../utils/cryptoProvision.js';

const router = express.Router();

const nowPlusMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

/* -----------------------------
   Devices: list / rename / revoke / heartbeat
--------------------------------*/
router.get(
  '/devices',
  requireAuth,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const devices = await prisma.device.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        platform: true,
        isPrimary: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
      },
    });
    return res.json(devices);
  })
);

router.post(
  '/devices/rename/:deviceId',
  requireAuth,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || name.length > 64) {
      throw Boom.badRequest('Invalid name');
    }

    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId: req.user.id },
    });
    if (!device) throw Boom.notFound('Device not found');

    await prisma.device.update({
      where: { id: device.id },
      data: { name },
    });

    return res.json({ ok: true });
  })
);

router.post(
  '/devices/revoke/:deviceId',
  requireAuth,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.params;

    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId: req.user.id },
    });
    if (!device) throw Boom.notFound('Device not found');
    if (device.revokedAt) return res.json({ ok: true }); // idempotent

    await prisma.device.update({
      where: { id: device.id },
      data: { revokedAt: new Date(), revokedById: req.user.id },
    });

    // Optionally emit: req.app.get('emitToUser')?.(req.user.id, 'device:revoked', { deviceId: device.id });
    return res.json({ ok: true });
  })
);

router.post(
  '/devices/heartbeat',
  requireAuth,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.body ?? {};
    if (!deviceId) throw Boom.badRequest('deviceId required');

    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId: req.user.id },
    });
    if (!device) throw Boom.notFound('Device not found');
    if (device.revokedAt) throw Boom.forbidden('Device revoked');

    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return res.json({ ok: true });
  })
);

/* -----------------------------
   Provisioning (Phase 1)
   1) start (primary: create link)
   2) client-init (new device announces)
   3) approve (primary relays ciphertext)
   4) poll (new device fetches)
   5) register (new device registers)
--------------------------------*/

// 1) PRIMARY: create link + QR payload
router.post(
  '/devices/provision/start',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const secret = toB64(randomBytes(32));
    const sas = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;

    const link = await prisma.provisionLink.create({
      data: {
        userId: req.user.id,
        createdById: req.user.id,
        secret,
        sasCode: sas,
        expiresAt: nowPlusMinutes(10),
        // optional columns if present:
        // clientEPub, serverEPub, relayCiphertext, relayNonce, usedAt, tempDeviceName, tempPlatform
      },
      select: { id: true, secret: true, sasCode: true },
    });

    return res.json({
      linkId: link.id,
      qrPayload: {
        type: 'chatorbit-provision',
        host: process.env.API_HOST,
        linkId: link.id,
        secret: link.secret,
        sas: link.sasCode,
      },
    });
  })
);

// 2) NEW DEVICE: announce ephemeral pubkey + device info (unauthenticated)
router.post(
  '/devices/provision/client-init',
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId, secret, ePub, deviceName, platform } = req.body ?? {};
    if (!linkId || !secret || !ePub) throw Boom.badRequest('Missing fields');

    const link = await prisma.provisionLink.findUnique({ where: { id: linkId } });
    if (!link) throw Boom.notFound('Link not found');
    if (link.usedAt) throw Boom.gone('Link already used');
    if (new Date(link.expiresAt) < new Date()) throw Boom.gone('Link expired');
    if (link.secret !== secret) throw Boom.forbidden('Secret mismatch');

    await prisma.provisionLink.update({
      where: { id: linkId },
      data: {
        clientEPub: ePub,
        tempDeviceName: deviceName ?? null,
        tempPlatform: platform ?? null,
      },
    });

    // server ephemeral "pubkey" placeholder (swap for real ECDH as needed)
    const sPub = toB64(randomBytes(32));

    await prisma.provisionLink.update({
      where: { id: linkId },
      data: { serverEPub: sPub },
    });

    return res.json({ ok: true, sPub, sasCode: link.sasCode });
  })
);

// 3) PRIMARY: approve + relay ciphertext
router.post(
  '/devices/provision/approve',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId, ciphertext, nonce, sPub } = req.body ?? {};
    if (!linkId || !ciphertext || !nonce || !sPub) throw Boom.badRequest('Missing fields');

    const link = await prisma.provisionLink.findFirst({
      where: { id: linkId, userId: req.user.id },
    });
    if (!link) throw Boom.notFound('Link not found');
    if (link.usedAt) throw Boom.gone('Link already used');
    if (new Date(link.expiresAt) < new Date()) throw Boom.gone('Link expired');

    if (link.serverEPub && link.serverEPub !== sPub) {
      throw Boom.forbidden('Server pubkey mismatch');
    }

    await prisma.provisionLink.update({
      where: { id: linkId },
      data: { relayCiphertext: ciphertext, relayNonce: nonce },
    });

    // Optionally notify: req.app.get('emitToUser')?.(req.user.id, 'provision:ready', { linkId });
    return res.json({ ok: true });
  })
);

// 4) NEW DEVICE: poll for ciphertext (unauthenticated)
router.get(
  '/devices/provision/poll',
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId } = req.query ?? {};
    if (!linkId) throw Boom.badRequest('linkId required');

    const link = await prisma.provisionLink.findUnique({ where: { id: String(linkId) } });
    if (!link) throw Boom.notFound('Link not found');
    if (new Date(link.expiresAt) < new Date()) throw Boom.gone('Link expired');

    if (!link.relayCiphertext || !link.relayNonce) {
      return res.json({ ready: false });
    }

    return res.json({
      ready: true,
      ciphertext: link.relayCiphertext,
      nonce: link.relayNonce,
      sPub: link.serverEPub ?? null,
      sasCode: link.sasCode,
    });
  })
);

// 5) NEW DEVICE: register device
router.post(
  '/devices/register',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId, publicKey, deviceName, platform } = req.body ?? {};
    if (!linkId || !publicKey) throw Boom.badRequest('Missing fields');

    const link = await prisma.provisionLink.findUnique({ where: { id: linkId } });
    if (!link) throw Boom.notFound('Link not found');
    if (link.usedAt) throw Boom.gone('Link already used');
    if (new Date(link.expiresAt) < new Date()) throw Boom.gone('Link expired');

    const created = await prisma.device.create({
      data: {
        userId: req.user.id,
        publicKey,
        name: deviceName ?? link.tempDeviceName ?? 'New device',
        platform: platform ?? link.tempPlatform ?? null,
        isPrimary: false,
      },
      select: { id: true, name: true, platform: true, createdAt: true },
    });

    await prisma.provisionLink.update({
      where: { id: linkId },
      data: { usedAt: new Date() },
    });

    // Optionally emit: req.app.get('emitToUser')?.(req.user.id, 'device:linked', { device: created });
    return res.json({ ok: true, device: created });
  })
);

export default router;
