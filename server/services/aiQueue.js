const QUEUE_CONCURRENCY = Number(process.env.AI_MAX_CONCURRENCY ?? 4);
const MIN_DELAY_MS = Number(process.env.AI_MIN_DELAY_MS ?? 150); // soft pacing
const PER_ROOM_COOLDOWN_MS = Number(process.env.AI_ROOM_COOLDOWN_MS ?? 1200);

const queue = [];
let active = 0;
const lastByRoom = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runNext() {
  if (active >= QUEUE_CONCURRENCY) return;
  const task = queue.shift();
  if (!task) return;
  active++;
  try {
    const { fn, resolve, reject, roomKey } = task;

    // per-room cooldown (debounce chattiness)
    const last = lastByRoom.get(roomKey) || 0;
    const now = Date.now();
    const wait = Math.max(0, last + PER_ROOM_COOLDOWN_MS - now);
    if (wait) await sleep(wait);

    const res = await fn();
    lastByRoom.set(roomKey, Date.now());
    resolve(res);
  } catch (e) {
    task.reject(e);
  } finally {
    active--;
    setTimeout(runNext, MIN_DELAY_MS); // gentle pacing between tasks
  }
}

export function enqueueAI({ roomKey, fn, dropIfBusy = false, maxQueue = 50 }) {
  if (dropIfBusy && queue.length >= maxQueue) {
    // Best-effort: drop oldest to keep latency bounded
    queue.shift();
  }
  return new Promise((resolve, reject) => {
    queue.push({ roomKey, fn, resolve, reject });
    runNext();
  });
}
