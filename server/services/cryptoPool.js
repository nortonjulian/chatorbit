import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKER_FILE = resolve(__dirname, '../workers/encryptKey.worker.js');
const POOL_SIZE = Math.max(
  1,
  Number(
    process.env.ENCRYPT_POOL_SIZE ||
      Math.min(4, Math.max(2, Math.floor(os.cpus().length / 2)))
  )
);

export class CryptoPool {
  constructor(size = POOL_SIZE) {
    this.size = size;
    this.idle = [];
    this.busy = new Set();
    this.queue = [];
  }

  _spawn() {
    const w = new Worker(WORKER_FILE);
    w.once('exit', () => {
      this.busy.delete(w);
      this.idle = this.idle.filter((x) => x !== w);
    });
    return w;
  }

  _getWorker() {
    let w = this.idle.pop();
    if (!w && this.busy.size < this.size) w = this._spawn();
    return w;
  }

  run(taskData) {
    return new Promise((resolve, reject) => {
      const job = { taskData, resolve, reject };
      const maybeDispatch = () => {
        const w = this._getWorker();
        if (!w) {
          this.queue.push(job);
          return;
        }
        this.busy.add(w);
        const onMsg = (msg) => {
          cleanup();
          this.busy.delete(w);
          this.idle.push(w);
          if (this.queue.length) {
            // dispatch next tick to avoid deep recursion
            setImmediate(() => {
              const nxt = this.queue.shift();
              if (nxt) this.run(nxt.taskData).then(nxt.resolve, nxt.reject);
            });
          }
          if (msg?.ok) resolve(msg);
          else reject(new Error(msg?.err || 'Worker failed'));
        };
        const onErr = (err) => {
          cleanup();
          this.busy.delete(w);
          try {
            w.terminate();
          } catch {}
          reject(err);
        };
        const cleanup = () => {
          w.off('message', onMsg);
          w.off('error', onErr);
        };
        w.on('message', onMsg);
        w.on('error', onErr);
        w.postMessage(taskData);
      };
      maybeDispatch();
    });
  }
}

// singleton
let _pool;
export function getCryptoPool() {
  if (!_pool) _pool = new CryptoPool();
  return _pool;
}
