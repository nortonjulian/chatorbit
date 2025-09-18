import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import requirePremium from '../middleware/requirePremium.js';
import { respondWithUserBackup } from '../services/backupService.js';

const r = Router();

r.get('/export', requireAuth, requirePremium, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.sendStatus(401);

    await respondWithUserBackup(res, userId);
    // NOTE: respondWithUserBackup writes the stream; no res.json after this.
  } catch (err) {
    next(err);
  }
});

export default r;
