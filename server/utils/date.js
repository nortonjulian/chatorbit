/**
 * Format a date into a human-friendly string.
 * @param {Date|string|number} date - Date object, timestamp, or ISO string.
 * @returns {string} Formatted date string.
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a time into a human-friendly string.
 * @param {Date|string|number} date - Date object, timestamp, or ISO string.
 * @returns {string} Formatted time string.
 */
export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Add days to a given date.
 * @param {Date|string|number} date - Date object, timestamp, or ISO string.
 * @param {number} days - Days to add.
 * @returns {Date} New Date object.
 */
export function addDays(date, days) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + days);
  return d;
}
