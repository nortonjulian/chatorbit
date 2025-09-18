import { initDeleteExpired } from './deleteExpiredMessages.js';
import { purgeResetTokensJob } from './purgeResetTokens.js';

export function initCrons() {
  initDeleteExpired(); // existing
  setInterval(() => purgeResetTokensJob(), 60 * 60 * 1000); // hourly
}
