import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getForwardingPrefs, updateForwardingPrefs } from '../services/forwardingService.js';

const r = express.Router();

// GET /settings/forwarding
r.get('/forwarding', requireAuth, asyncHandler(async (req, res) => {
  const prefs = await getForwardingPrefs(req.user.id);
  res.json(prefs);
}));

// PATCH /settings/forwarding
r.patch('/forwarding', requireAuth, express.json(), asyncHandler(async (req, res) => {
  const prefs = await updateForwardingPrefs(req.user.id, req.body || {});
  res.json(prefs);
}));

export default r;
