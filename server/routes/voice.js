import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { startAliasCall } from '../services/voiceBridge.js';

const r = express.Router();

// POST /voice/call { to }
r.post('/call', requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { to } = req.body || {};
  const out = await startAliasCall({ userId: req.user.id, to });
  res.status(202).json(out);
}));

export default r;
