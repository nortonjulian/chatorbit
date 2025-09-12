import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../utils/prismaClient.js';

const router = Router();

/**
 * POST /follows/:userId  → follow (auto-accepted for now)
 */
router.post('/:userId', requireAuth, async (req, res) => {
  const followerId = Number(req.user.id);
  const followeeId = Number(req.params.userId);

  if (!Number.isInteger(followeeId) || followeeId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (followeeId === followerId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const existing = await prisma.follow.findFirst({
    where: { followerId, followeeId },
    select: { id: true, accepted: true },
  });

  if (existing?.accepted) {
    return res.status(409).json({ error: 'Already following' });
  }

  if (existing && !existing.accepted) {
    await prisma.follow.update({
      where: { id: existing.id },
      data: { accepted: true },
    });
  } else {
    await prisma.follow.create({
      data: { followerId, followeeId, accepted: true },
    });
  }

  // notify followee (best-effort)
  req.app.get('io')?.to(`user:${followeeId}`).emit('user:followed', { followerId });

  return res.status(201).json({ ok: true });
});

/**
 * DELETE /follows/:userId → unfollow
 */
router.delete('/:userId', requireAuth, async (req, res) => {
  const followerId = Number(req.user.id);
  const followeeId = Number(req.params.userId);

  if (!Number.isInteger(followeeId) || followeeId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  await prisma.follow.deleteMany({ where: { followerId, followeeId } });
  return res.json({ ok: true });
});

/**
 * GET /follows/me/followers
 * GET /follows/me/following
 * Supports ?limit & ?cursor=id
 */
async function pagedFollows({ where, includeUser, limit, cursor }) {
  const items = await prisma.follow.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      ...(includeUser === 'followers'
        ? { follower: { select: { id: true, username: true, avatarUrl: true } } }
        : includeUser === 'following'
        ? { followee: { select: { id: true, username: true, avatarUrl: true } } }
        : {}),
    },
  });

  const total = await prisma.follow.count({ where });
  const nextCursor = items.length === limit ? items[items.length - 1].id : null;

  return { items, nextCursor, total };
}

router.get('/me/followers', requireAuth, async (req, res) => {
  const followeeId = Number(req.user.id);
  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 100);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const payload = await pagedFollows({
    where: { followeeId, accepted: true },
    includeUser: 'followers',
    limit,
    cursor,
  });
  res.json(payload);
});

router.get('/me/following', requireAuth, async (req, res) => {
  const followerId = Number(req.user.id);
  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 100);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const payload = await pagedFollows({
    where: { followerId, accepted: true },
    includeUser: 'following',
    limit,
    cursor,
  });
  res.json(payload);
});

/**
 * GET /follows/:userId/followers
 * GET /follows/:userId/following
 * GET /follows/:userId/status  → { following, mutual, accepted }
 */
router.get('/:userId/followers', requireAuth, async (req, res) => {
  const followeeId = Number(req.params.userId);
  if (!Number.isInteger(followeeId) || followeeId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 100);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const payload = await pagedFollows({
    where: { followeeId, accepted: true },
    includeUser: 'followers',
    limit,
    cursor,
  });
  res.json(payload);
});

router.get('/:userId/following', requireAuth, async (req, res) => {
  const followerId = Number(req.params.userId);
  if (!Number.isInteger(followerId) || followerId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 100);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const payload = await pagedFollows({
    where: { followerId, accepted: true },
    includeUser: 'following',
    limit,
    cursor,
  });
  res.json(payload);
});

router.get('/:userId/status', requireAuth, async (req, res) => {
  const me = Number(req.user.id);
  const other = Number(req.params.userId);
  if (!Number.isInteger(other) || other <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const relA = await prisma.follow.findFirst({
    where: { followerId: me, followeeId: other },
    select: { accepted: true },
  });
  const relB = await prisma.follow.findFirst({
    where: { followerId: other, followeeId: me, accepted: true },
    select: { id: true },
  });

  res.json({
    following: !!relA?.accepted,
    accepted: !!relA?.accepted,
    mutual: !!relA?.accepted && !!relB,
  });
});

export default router;
