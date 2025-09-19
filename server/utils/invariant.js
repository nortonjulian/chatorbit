export default function invariant(condition, message) {
  if (!condition) {
    const err = new Error(message || 'Invariant failed');
    // Mark as config error to make logs/search easy
    err.code = 'CONFIG_INVARIANT';
    throw err;
  }
}
