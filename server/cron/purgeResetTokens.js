import { purgeResetTokens } from '../utils/resetTokens.js';

export async function purgeResetTokensJob() {
  try { await purgeResetTokens(7); } catch {}
}
