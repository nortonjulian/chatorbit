// ESM mock for 'node-cron'
export function schedule() {
  // Return a stoppable object but do nothing; no timers created.
  return {
    start() {},
    stop() {},
    destroy() {},
    running: false,
  };
}
export default { schedule };
