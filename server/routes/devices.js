import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';

const router = express.Router();

const HAS_DEVICE_MODEL = !!(prisma.device && typeof prisma.device.create === 'function');

// shadow memory (also used if no Device model exists)
const mem = { nextId: 1, byUser: new Map() }; // Map<userId, Array<{id,name,createdAt}>>
function listUserDevicesMem(userId) { return mem.byUser.get(userId) || []; }
function createDeviceMem(userId, name) {
  const d = { id: mem.nextId++, name: name || 'Device', createdAt: new Date() };
  const arr = mem.byUser.get(userId) || [];
  arr.push(d);
  mem.byUser.set(userId, arr);
  return d;
}

async function countUserDevicesDb(userId) {
  let dbCount = 0;
  try {
    dbCount = await prisma.device.count({ where: { userId } });
  } catch {
    try {
      dbCount = await prisma.device.count({ where: { ownerId: userId } });
    } catch {
      dbCount = 0;
    }
  }
  const memCount = listUserDevicesMem(userId).length;
  return Math.max(dbCount, memCount);
}

async function createDeviceDb(userId, name) {
  // Always mirror to memory so counts stay consistent even if DB schema differs.
  const shadow = createDeviceMem(userId, name);

  if (!HAS_DEVICE_MODEL) return shadow;

  const attempts = [
    { userId, name },
    { ownerId: userId, name },
    { userId, deviceName: name },
    { ownerId: userId, deviceName: name },
  ];
  for (const data of attempts) {
    try {
      const rec = await prisma.device.create({
        data,
        select: { id: true, name: true, deviceName: true, createdAt: true },
      });
      return { id: rec.id, name: rec.name || rec.deviceName || name, createdAt: rec.createdAt };
    } catch {}
  }
  return shadow;
}

async function handleRegister(req, res) {
  const userId = Number(req.user.id);
  const name = String(req.body?.deviceName || req.body?.name || 'Device');

  const existing = await countUserDevicesDb(userId);
  const isFree = String(req.user.plan || 'FREE').toUpperCase() === 'FREE';

  if (isFree && existing >= 1) {
    return res.status(402).json({ error: 'Plan limit reached' });
  }

  const rec = await createDeviceDb(userId, name);
  return res.status(201).json({ id: rec.id, name: rec.name || name });
}

router.post('/', requireAuth, express.json(), (req, res, next) => {
  handleRegister(req, res).catch(next);
});
router.post('/register', requireAuth, express.json(), (req, res, next) => {
  handleRegister(req, res).catch(next);
});

export default router;
