import { purgeResetTokens } from '../utils/resetTokens.js';
import logger from '../utils/logger.js';

export async function purgeResetTokensJob() {
  try {
    await purgeResetTokens(7);
    logger.info({ task: 'purgeResetTokens' }, 'Password reset tokens purged');
  } catch (err) {
    logger.warn({ task: 'purgeResetTokens', err: err?.message }, 'Purge job failed');
  }
}
