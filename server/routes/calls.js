import express from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../utils/prismaClient.js';
import { emitToUser } from '../services/socketBus.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// helper
function ensureParticipant(call, userId) {
  if (!call) return false;
  return call.callerId === userId || call.calleeId === userId;
}

/**
 * POST /calls/invite  { calleeId, mode: 'AUDIO'|'VIDEO', roomId?, offer:{type,sdp} }
 */
router.post('/invite', asyncHandler(async (req, res) => {
  const callerId = Number(req.user.id);
  const { calleeId, mode = 'AUDIO', roomId, offer } = req.body || {};
  if (!calleeId || !offer?.sdp) return res.status(400).json({ error: 'calleeId and offer.sdp required' });
  if (!['AUDIO', 'VIDEO'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });

  const [caller, callee] = await Promise.all([
    prisma.user.findUnique({ where: { id: callerId }, select: { id: true, username: true, name: true, avatarUrl: true } }),
    prisma.user.findUnique({ where: { id: Number(calleeId) }, select: { id: true, username: true, name: true, avatarUrl: true } }),
  ]);
  if (!callee) return res.status(404).json({ error: 'Callee not found' });

  const call = await prisma.call.create({
    data: {
      callerId,
      calleeId: Number(calleeId),
      roomId: roomId ?? null,
      mode,
      status: 'RINGING',
      offerSdp: offer.sdp,
    },
    select: { id: true, callerId: true, calleeId: true, mode: true, status: true, roomId: true, createdAt: true },
  });

  emitToUser(callee.id, 'call:incoming', {
    callId: call.id,
    fromUser: caller,
    mode,
    offer, // { type:'offer', sdp }
    roomId: call.roomId ?? null,
    createdAt: call.createdAt,
  });

  res.status(201).json({ callId: call.id });
}));

/**
 * POST /calls/answer { callId, answer:{type,sdp} }
 */
router.post('/answer', asyncHandler(async (req, res) => {
  const userId = Number(req.user.id);
  const { callId, answer } = req.body || {};
  if (!callId || !answer?.sdp) return res.status(400).json({ error: 'callId and answer.sdp required' });

  const call = await prisma.call.findUnique({ where: { id: Number(callId) } });
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (call.calleeId !== userId) return res.status(403).json({ error: 'Only callee can answer' });
  if (!['RINGING', 'INITIATED'].includes(call.status)) {
    return res.status(409).json({ error: `Cannot answer in status ${call.status}` });
  }

  const updated = await prisma.call.update({
    where: { id: call.id },
    data: { status: 'ANSWERED', answerSdp: answer.sdp, startedAt: new Date() },
    select: { id: true, callerId: true, calleeId: true, mode: true, status: true, startedAt: true },
  });

  emitToUser(updated.callerId, 'call:answer', {
    callId: updated.id,
    answer,
    startedAt: updated.startedAt,
  });

  res.json({ ok: true });
}));

/**
 * POST /calls/candidate { callId, toUserId, candidate }
 */
router.post('/candidate', asyncHandler(async (req, res) => {
  const userId = Number(req.user.id);
  const { callId, toUserId, candidate } = req.body || {};
  if (!callId || !toUserId || !candidate) return res.status(400).json({ error: 'callId,toUserId,candidate required' });

  const call = await prisma.call.findUnique({ where: { id: Number(callId) } });
  if (!ensureParticipant(call, userId)) return res.status(403).json({ error: 'Not a participant' });

  emitToUser(Number(toUserId), 'call:candidate', { callId: Number(callId), candidate });
  res.json({ ok: true });
}));

/**
 * POST /calls/end { callId, reason? ('rejected'|'hangup') }
 */
router.post('/end', asyncHandler(async (req, res) => {
  const userId = Number(req.user.id);
  const { callId, reason } = req.body || {};
  if (!callId) return res.status(400).json({ error: 'callId required' });

  const call = await prisma.call.findUnique({ where: { id: Number(callId) } });
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!ensureParticipant(call, userId)) return res.status(403).json({ error: 'Not a participant' });

  const status = reason === 'rejected' ? 'REJECTED' : 'ENDED';
  const updated = await prisma.call.update({
    where: { id: call.id },
    data: { status, endedAt: new Date() },
    select: { id: true, callerId: true, calleeId: true, status: true, endedAt: true },
  });

  const otherId = userId === updated.callerId ? updated.calleeId : updated.callerId;
  emitToUser(otherId, 'call:ended', { callId: updated.id, status: updated.status, endedAt: updated.endedAt, reason });

  res.json({ ok: true });
}));

export default router;
