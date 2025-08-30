import express from 'express';
import Boom from '@hapi/boom';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { provisionLimiter, deviceOpsLimiter } from '../rateLimit.js';
import { randomBytes, toB64 } from '../utils/cryptoProvision.js';
import { assertDeviceLimit } from '../middleware/limits.js';

const router = express.Router();

const nowPlusMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

/* -----------------------------
   Devices: list / rename / revoke / heartbeat
   NOTE: This router is mounted at /devices in index.js,
         so all paths below are RELATIVE (no /devices prefix here).
--------------------------------*/

/** GET /devices  (mounted → GET /devices) */
router.get(
  '/',
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

/** POST /devices/rename/:deviceId  (mounted → POST /devices/rename/:deviceId) */
router.post(
  '/rename/:deviceId',
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

/** POST /devices/revoke/:deviceId  (mounted → POST /devices/revoke/:deviceId) */
router.post(
  '/revoke/:deviceId',
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

/** POST /devices/heartbeat  (mounted → POST /devices/heartbeat) */
router.post(
  '/heartbeat',
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

/** POST /devices/provision/start  (mounted → POST /devices/provision/start) */
router.post(
  '/provision/start',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const secret = toB64(randomBytes(32));
    const sas = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(
      100 + Math.random() * 900
    )}`;

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

/** POST /devices/provision/client-init  (mounted → POST /devices/provision/client-init) */
router.post(
  '/provision/client-init',
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

/** POST /devices/provision/approve  (mounted → POST /devices/provision/approve) */
router.post(
  '/provision/approve',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId, ciphertext, nonce, sPub } = req.body ?? {};
    if (!linkId || !ciphertext || !nonce || !sPub)
      throw Boom.badRequest('Missing fields');

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

/** GET /devices/provision/poll  (mounted → GET /devices/provision/poll) */
router.get(
  '/provision/poll',
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId } = req.query ?? {};
    if (!linkId) throw Boom.badRequest('linkId required');

    const link = await prisma.provisionLink.findUnique({
      where: { id: String(linkId) },
    });
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

/** POST /devices/register  (mounted → POST /devices/register) */
router.post(
  '/register',
  requireAuth,
  provisionLimiter,
  asyncHandler(async (req, res) => {
    const { linkId, publicKey, deviceName, platform } = req.body ?? {};
    if (!linkId || !publicKey) throw Boom.badRequest('Missing fields');

    const link = await prisma.provisionLink.findUnique({ where: { id: linkId } });
    if (!link) throw Boom.notFound('Link not found');
    if (link.usedAt) throw Boom.gone('Link already used');
    if (new Date(link.expiresAt) < new Date()) throw Boom.gone('Link expired');

    // ✅ Premium enforcement: FREE users limited by plan
    try {
      await assertDeviceLimit(req.user.id);
    } catch (err) {
      if (err?.code === 'PREMIUM_REQUIRED' || err?.status === 402) {
        return res.status(402).json({
          code: 'PREMIUM_REQUIRED',
          reason: 'DEVICE_LIMIT',
          message: 'Device limit reached. Upgrade to add more devices.',
        });
      }
      throw err;
    }

    const created = await prisma.device.create({
      data: {
        userId: req.user.id,
        publicKey,
        name: deviceName ?? link.tempDeviceName ?? 'New device',
        platform: platform ?? link.tempPlatform ?? null,
        isPrimary: false, // You can set true if first device, or provide a toggle endpoint
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
