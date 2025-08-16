export class LRU {
  constructor(max = 500) {
    this.max = max;
    this.map = new Map();
  }
  get(k) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k);
    this.map.delete(k);
    this.map.set(k, v);
    return v.value;
  }
  set(k, v, ttlMs = 5 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    this.map.set(k, { value: v, expiresAt });
    this._evict();
  }
  has(k) {
    const e = this.map.get(k);
    if (!e) return false;
    if (e.expiresAt && e.expiresAt < Date.now()) {
      this.map.delete(k);
      return false;
    }
    return true;
  }
  _evict() {
    if (this.map.size <= this.max) return;
    const extra = this.map.size - this.max;
    for (let i = 0; i < extra; i++) {
      // delete least recently used (first item)
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
  }
}
