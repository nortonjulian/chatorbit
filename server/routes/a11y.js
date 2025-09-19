import express from 'express';
import prisma from '../utils/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePremium } from '../middleware/requirePremium.js'
import * as stt from '../services/stt/index.js';
import { a11yConfig } from '../config/a11yConfig.js';
import { addUsageSeconds, getUsageSeconds } from '../services/stt/usage.js';

const router = express.Router();

// ---------- helpers ----------
const A11Y_KEYS = new Set([
  'a11yVisualAlerts',
  'a11yVibrate',
  'a11yFlashOnCall',
  'a11yLiveCaptions',
  'a11yVoiceNoteSTT',
  'a11yCaptionFont',
  'a11yCaptionBg',
  // phase 2 extras (optional if you added them to schema)
  'a11yStoreTranscripts',
  'a11yTranscriptRetentionDays',
  'a11yCaptionPosition',
  'a11yCaptionMaxLines',
]);

async function userCanAccessMessage(userId, messageId) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { chatRoomId: true, senderId: true },
  });
  if (!msg) return false;
  if (msg.senderId === userId) return true;
  const part = await prisma.participant.findFirst({
    where: { chatRoomId: msg.chatRoomId, userId },
  });
  return !!part;
}

async function userInCall(userId, callId) {
  const call = await prisma.call.findUnique({
    where: { id: Number(callId) || 0 },
    select: { callerId: true, calleeId: true },
  });
  if (!call) return false;
  return call.callerId === userId || call.calleeId === userId;
}

// In-memory session map for captions (mock accumulation; fine to keep for now)
const liveCaptionSessions = new Map(); // callId -> { userId, startedAt, language, segments: [] }

// Compute quota budget and remaining seconds for current user (FREE vs PREMIUM)
async function computeQuota(userId) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  // Prefer daily minutes if configured, otherwise monthly
  const perDayMin = Number(a11yConfig.FREE_STT_MIN_PER_DAY || 0);
  const perMonthMin = Number(a11yConfig.FREE_STT_MIN_PER_MONTH || 0);
  const period = perDayMin > 0 ? 'day' : 'month';
  const budgetSec =
    (period === 'day' ? perDayMin : perMonthMin) * 60;

  // NOTE: getUsageSeconds() should internally track usage for the same period
  const usedSec = await getUsageSeconds(userId, { period }); // second arg optional if your impl ignores it

  if (me?.plan === 'PREMIUM') {
    return { plan: 'PREMIUM', period, usedSec, remainingSec: Infinity, budgetSec: Infinity };
  }
  return {
    plan: 'FREE',
    period,
    usedSec,
    remainingSec: Math.max(0, budgetSec - usedSec),
    budgetSec,
  };
}

// ---------- routes ----------

// Update accessibility preferences
router.patch('/users/me/a11y', requireAuth, async (req, res) => {
  try {
    const updates = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (A11Y_KEYS.has(k)) updates[k] = v;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid accessibility fields provided' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      select: {
        id: true,
        a11yVisualAlerts: true,
        a11yVibrate: true,
        a11yFlashOnCall: true,
        a11yLiveCaptions: true,
        a11yVoiceNoteSTT: true,
        a11yCaptionFont: true,
        a11yCaptionBg: true,
        a11yStoreTranscripts: true,
        a11yTranscriptRetentionDays: true,
        a11yCaptionPosition: true,
        a11yCaptionMaxLines: true,
      },
    });

    res.json({ ok: true, user });
  } catch (err) {
    console.error('PATCH /users/me/a11y error', err);
    res.status(500).json({ error: 'Failed to update accessibility settings' });
  }
});

// Current STT quota & remaining (FREE vs PREMIUM)
router.get('/users/me/a11y/quota', requireAuth, async (req, res) => {
  try {
    const summary = await computeQuota(req.user.id);
    res.json({ ok: true, quota: summary });
  } catch (err) {
    console.error('GET /users/me/a11y/quota error', err);
    res.status(500).json({ error: 'Failed to fetch quota' });
  }
});

// Transcribe a voice note (Free with quota; Premium unlimited)
router.post('/media/:messageId/transcribe', requireAuth, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId)) return res.status(400).json({ error: 'Invalid messageId' });

    const can = await userCanAccessMessage(req.user.id, messageId);
    if (!can) return res.status(403).json({ error: 'Forbidden' });

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { audioUrl: true, audioDurationSec: true },
    });
    if (!msg || !msg.audioUrl) return res.status(404).json({ error: 'No audio to transcribe' });

    const language = req.body?.language || 'en-US';
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, a11yStoreTranscripts: true },
    });

    // Quota for Free users
    const durationSec = msg.audioDurationSec ?? 60;
    if (me.plan === 'FREE') {
      const perDayMin = Number(a11yConfig.FREE_STT_MIN_PER_DAY || 0);
      const perMonthMin = Number(a11yConfig.FREE_STT_MIN_PER_MONTH || 0);
      const langIsFree = (a11yConfig.FREE_STT_LANGS || []).includes(language);

      if (!langIsFree) {
        return res.status(402).json({ code: 'PREMIUM_REQUIRED', reason: 'LANGUAGE' });
      }

      const period = perDayMin > 0 ? 'day' : 'month';
      const budgetSec = (period === 'day' ? perDayMin : perMonthMin) * 60;
      const usedSec = await getUsageSeconds(req.user.id, { period });

      if (usedSec + durationSec > budgetSec) {
        return res.status(402).json({ code: 'PREMIUM_REQUIRED', reason: 'QUOTA' });
      }
    }

    // Do the transcription
    const { segments } = await stt.transcribeFromUrl(msg.audioUrl, language);

    // Track usage against quota regardless of persistence
    await addUsageSeconds(req.user.id, durationSec);

    // Respect "store transcripts" preference
    if (me?.a11yStoreTranscripts === false) {
      return res.json({
        ok: true,
        transcript: {
          id: null,
          language,
          segments,
          createdAt: new Date().toISOString(),
          ephemeral: true,
        },
      });
    }

    // Persist transcript
    const transcript = await prisma.transcript.create({
      data: {
        userId: req.user.id,
        messageId,
        language,
        segments,
      },
      select: { id: true, language: true, segments: true, createdAt: true },
    });

    res.json({ ok: true, transcript });
  } catch (err) {
    console.error('POST /media/:messageId/transcribe error', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// Fetch transcript for a voice note (current user scope)
router.get('/transcripts/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId)) return res.status(400).json({ error: 'Invalid messageId' });

    const t = await prisma.transcript.findFirst({
      where: { messageId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!t) return res.status(404).json({ error: 'Transcript not found' });
    res.json({ transcript: t });
  } catch (err) {
    console.error('GET /transcripts/:messageId error', err);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// Start live captions (Premium only) — returns wsUrl for client to connect
router.post('/calls/:callId/captions/start', requireAuth, requirePremium, async (req, res) => {
  try {
    const { callId } = req.params;
    const allowed = await userInCall(req.user.id, callId);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    // Ensure user has enabled captions in settings
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { a11yLiveCaptions: true },
    });
    if (!me?.a11yLiveCaptions) return res.status(403).json({ error: 'Captions disabled in settings' });

    const language = req.body?.language || 'en-US';

    // Issue mock wsUrl (your WS server streams captions)
    const wsUrl = `/ws/captions?callId=${encodeURIComponent(callId)}&lang=${encodeURIComponent(language)}`;

    // Track session start (optional: accumulate partials for persistence)
    liveCaptionSessions.set(String(callId), { userId: req.user.id, startedAt: Date.now(), language, segments: [] });

    res.json({ ok: true, wsUrl, language });
  } catch (err) {
    console.error('POST /calls/:callId/captions/start error', err);
    res.status(500).json({ error: 'Failed to start captions' });
  }
});

// Stop live captions, optionally persist transcript snapshot, add usage
router.post('/calls/:callId/captions/stop', requireAuth, requirePremium, async (req, res) => {
  try {
    const { callId } = req.params;
    const sess = liveCaptionSessions.get(String(callId));
    if (!sess) return res.status(404).json({ error: 'No active caption session' });

    if (sess.userId !== req.user.id && !(await userInCall(req.user.id, callId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const me = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: { a11yStoreTranscripts: true },
    });

    // Usage accounting (minutes billed to captions)
    const elapsedSec = Math.max(0, Math.floor((Date.now() - sess.startedAt) / 1000));
    await addUsageSeconds(sess.userId, elapsedSec);

    liveCaptionSessions.delete(String(callId));

    // Respect "store transcripts"
    if (me?.a11yStoreTranscripts === false) {
      return res.json({
        ok: true,
        transcript: {
          id: null,
          language: sess.language,
          segments: sess.segments || [],
          createdAt: new Date().toISOString(),
          ephemeral: true,
        },
      });
    }

    const transcript = await prisma.transcript.create({
      data: {
        userId: sess.userId,
        callId: Number(callId),
        language: sess.language,
        segments: sess.segments || [], // if you later collect partials from WS
      },
      select: { id: true, language: true, segments: true, createdAt: true },
    });

    res.json({ ok: true, transcript });
  } catch (err) {
    console.error('POST /calls/:callId/captions/stop error', err);
    res.status(500).json({ error: 'Failed to stop captions' });
  }
});

// Latest transcript for a call (current user scope)
router.get('/calls/:callId/transcript', requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!(await userInCall(req.user.id, callId))) return res.status(403).json({ error: 'Forbidden' });

    const t = await prisma.transcript.findFirst({
      where: { callId: Number(callId) || 0, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!t) return res.status(404).json({ error: 'Transcript not found' });
    res.json({ transcript: t });
  } catch (err) {
    console.error('GET /calls/:callId/transcript error', err);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

export default router;
