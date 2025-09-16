import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import requirePremium from '../middleware/requirePremium.js';

const r = Router();
r.get('/export', requireAuth, requirePremium, async (req, res) => {
  // TODO: build a dataset for the user
  const payload = { exportedAt: new Date().toISOString(), messages: [] }; // minimal stub
  res.json(payload);
});
export default r;
