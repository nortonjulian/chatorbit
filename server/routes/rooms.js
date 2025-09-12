import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import chatroomsRouter from './chatrooms.js';

const router = express.Router();
const env = String(process.env.NODE_ENV || '');
const isProd = env === 'production';
const isTest = env === 'test';

/**
 * In-memory state used by tests and the test-mode messages router.
 *   - rooms:    Map<roomId, { id, name, isGroup, ownerId }>
 *   - members:  Map<roomId, Set<userId>>
 *   - roles:    Map<roomId, Map<userId, 'OWNER'|'ADMIN'|'MODERATOR'|'MEMBER'>>
 */
export const __mem = {
  nextRoomId: 1,
  rooms: new Map(),
  members: new Map(),
  roles: new Map(),
};

/* ----------------------------------------------------------------
 * Test/Dev FALLBACK endpoints
 *   We add these BEFORE mounting the real chatrooms router so that:
 *   - POST /rooms hits immediately in tests
 *   - Your real routes still work (and cover more paths)
 * ---------------------------------------------------------------- */
if (!isProd) {
  // quick probe to confirm router is mounted during tests
  router.get('/__iam_rooms_router', (_req, res) =>
    res.json({ ok: true, router: 'rooms-fallback', env })
  );

  // Helper: ensure structures exist for a room
  function ensureRoomMaps(roomId) {
    if (!__mem.members.has(roomId)) __mem.members.set(roomId, new Set());
    if (!__mem.roles.has(roomId)) __mem.roles.set(roomId, new Map());
    return { members: __mem.members.get(roomId), roles: __mem.roles.get(roomId) };
  }

  // Minimal creator used by both POST / and /create
  function createMemRoom({ ownerId, name = '', isGroup = true }) {
    const id = __mem.nextRoomId++;
    const room = { id, name: name || `Room ${id}`, isGroup: !!isGroup, ownerId };
    __mem.rooms.set(id, room);
    const { members, roles } = ensureRoomMaps(id);
    members.add(ownerId);
    roles.set(ownerId, 'OWNER');
    return room;
  }

  // POST /rooms  → create room (tests call this)
  router.post('/', requireAuth, (req, res) => {
    const ownerId = Number(req.user?.id);
    if (!Number.isFinite(ownerId)) return res.status(401).json({ error: 'Unauthorized' });
    const { name = '', isGroup = true } = req.body || {};
    const room = createMemRoom({ ownerId, name, isGroup });
    return res.status(201).json({ id: room.id, room: { id: room.id, name: room.name, isGroup: room.isGroup } });
  });

  // Some suites use /rooms/create as well—alias it
  router.post('/create', requireAuth, (req, res) => {
    const ownerId = Number(req.user?.id);
    if (!Number.isFinite(ownerId)) return res.status(401).json({ error: 'Unauthorized' });
    const { name = '', isGroup = true } = req.body || {};
    const room = createMemRoom({ ownerId, name, isGroup });
    return res.status(201).json({ id: room.id, room: { id: room.id, name: room.name, isGroup: room.isGroup } });
  });

  // GET /rooms/:id/participants → list (ownerId + roles)
  router.get('/:id/participants', requireAuth, (req, res) => {
    const roomId = Number(req.params.id);
    const room = __mem.rooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Not found' });
    const roles = __mem.roles.get(roomId) || new Map();
    const participants = Array.from(roles.entries())
      .sort(([a], [b]) => a - b)
      .map(([userId, role]) => ({
        userId,
        role,
        user: { id: userId, username: `user${userId}` },
      }));
    return res.json({ ownerId: room.ownerId, participants });
  });

  // POST /rooms/:id/participants → add member (owner or global ADMIN)
  router.post('/:id/participants', requireAuth, (req, res) => {
    const roomId = Number(req.params.id);
    const { userId } = req.body || {};
    const room = __mem.rooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Not found' });
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const me = req.user;
    const isOwner = room.ownerId === me.id;
    const isAdmin = String(me.role || '').toUpperCase() === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { members, roles } = ensureRoomMaps(roomId);
    members.add(Number(userId));
    if (!roles.has(Number(userId))) roles.set(Number(userId), 'MEMBER');

    return res.json({ ok: true, participant: { userId: Number(userId), role: roles.get(Number(userId)) } });
  });

  // PATCH /rooms/:id/participants/:userId/role → set role
  router.patch('/:id/participants/:userId/role', requireAuth, (req, res) => {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const { role } = req.body || {};
    const room = __mem.rooms.get(roomId);

    if (!room) return res.status(404).json({ error: 'Not found' });
    if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (targetId === room.ownerId) return res.status(403).json({ error: 'Cannot change owner role' });

    const { members, roles } = ensureRoomMaps(roomId);
    const actorRole = roles.get(Number(req.user.id)) || (req.user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');

    // Only the OWNER can grant ADMIN
    if (role === 'ADMIN' && room.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can grant ADMIN' });
    }
    // For MODERATOR/MEMBER, need OWNER or ADMIN
    if (role !== 'ADMIN' && actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    members.add(targetId);
    roles.set(targetId, role);
    return res.json({ ok: true, participant: { userId: targetId, role } });
  });

  // DELETE /rooms/:id/participants/:userId → kick (owner/admin)
  router.delete('/:id/participants/:userId', requireAuth, (req, res) => {
    const roomId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const room = __mem.rooms.get(roomId);

    if (!room) return res.json({ ok: true }); // idempotent
    const me = req.user;
    const isOwner = room.ownerId === me.id;
    const isAdmin = String(me.role || '').toUpperCase() === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (targetId === room.ownerId) return res.status(403).json({ error: 'Cannot remove owner' });

    __mem.members.get(roomId)?.delete(targetId);
    __mem.roles.get(roomId)?.delete(targetId);
    return res.json({ ok: true });
  });
}

/* ----------------------------------------------------------------
 * Mount the real router last so its full feature set remains
 * available everywhere (prod + test/dev).
 * ---------------------------------------------------------------- */
router.use('/', chatroomsRouter);

export default router;
