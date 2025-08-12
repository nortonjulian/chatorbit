import express from 'express';
import * as Boom from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import { provisionLimiter, deviceOpsLimiter } from '../rateLimit.js';
import { randomBytes, toB64 } from '../utils/cryptoProvision.js';

const prisma = new PrismaClient();
const router = express.Router();

/** OPTIONAL: replace with your real auth middleware */
function ensureAuthed(req, _res, next) {
  if (!req.user?.id) return next(Boom.unauthorized('Auth required'));
  next();
}

const nowPlusMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* -----------------------------
   Devices: list / rename / revoke / heartbeat
--------------------------------*/
router.get(
  '/devices',
  ensureAuthed,
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
    res.json(devices);
  })
);

router.post(
  '/devices/rename/:deviceId',
  ensureAuthed,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const { name } = req.body ?? {};
    if (!name || name.length > 64) throw Boom.badRequest('Invalid name');

    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId: req.user.id },
    });
    if (!device) throw Boom.notFound('Device not found');

    await prisma.device.update({
      where: { id: device.id },
      data: { name },
    });

    res.json({ ok: true });
  })
);

router.post(
  '/devices/revoke/:deviceId',
  ensureAuthed,
  deviceOpsLimiter,
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findFirst({
      where: { id: req.params.deviceId, userId: req.user.id },
    });
    if (!device) throw Boom.notFound('Device not found');
    if (device.revokedAt) return res.json({ ok: true }); // idempotent

    await prisma.device.update({
      where: { id: device.id },
      data: { revokedAt: new Date(), revokedById: req.user.id },
    });

    // Optional: emit websocket "device:revoked"
    // const emitToUser = req.app.get('emitToUser'); emitToUser?.(req.user.id, 'device:revoked', { deviceId: device.id });

    res.json({ ok: true });
  })
);

router.post(
  '/devices/heartbeat',
  ensureAuthed,
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

    res.json({ ok: true });
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
  ensureAuthed,
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
        // optional columns you may have added:
        // clientEPub, serverEPub, relayCiphertext, relayNonce, usedAt, tempDeviceName, tempPlatform
      },
      select: { id: true, secret: true, sasCode: true },
    });

    res.json({
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

// 2) NEW DEVICE: announce ephemeral pubkey + device info
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

    // server ephemeral "pubkey" placeholder (switch to real ECDH if you want)
    const sPub = toB64(randomBytes(32));

    await prisma.provisionLink.update({
      where: { id: linkId },
      data: { serverEPub: sPub },
    });

    res.json({ ok: true, sPub, sasCode: link.sasCode });
  })
);

// 3) PRIMARY: approve + relay ciphertext
router.post(
  '/devices/provision/approve',
  ensureAuthed,
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

    // Optional: notify via WS that payload is ready
    // const emitToUser = req.app.get('emitToUser'); emitToUser?.(req.user.id, 'provision:ready', { linkId });

    res.json({ ok: true });
  })
);

// 4) NEW DEVICE: poll for ciphertext
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

    res.json({
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
  ensureAuthed,
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

    // Optional: emit websocket "device:linked"
    // const emitToUser = req.app.get('emitToUser'); emitToUser?.(req.user.id, 'device:linked', { device: created });

    res.json({ ok: true, device: created });
  })
);

/* -----------------------------
   Error handler (Boom-friendly)
--------------------------------*/
router.use((err, _req, res, _next) => {
  if (Boom.isBoom(err)) {
    const { output } = err;
    return res.status(output.statusCode).json(output.payload);
  }
  console.error(err);
  res.status(500).json({ statusCode: 500, error: 'Internal Server Error' });
});

export default router;
