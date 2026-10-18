// In-memory response cache bounded by TOTAL SIZE, not just entry count: varied queries (e.g. from many clients)
// can't grow memory without limit. Oldest entries are evicted first; oversized values are never cached.
export class SizedCache {
  constructor({ maxBytes = 64 * 1024 * 1024, maxEntryBytes = 2 * 1024 * 1024 } = {}) {
    this.maxBytes = maxBytes;
    this.maxEntryBytes = maxEntryBytes;
    this.map = new Map();          // key -> { value, size }
    this.bytes = 0;
  }

  get(key) {
    const e = this.map.get(key);
    return e ? e.value : undefined;
  }

  has(key) { return this.map.has(key); }

  /** Stores the value if it fits; returns true when cached. */
  set(key, value) {
    const size = Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8') + key.length;
    if (size > this.maxEntryBytes) return false;
    this.delete(key);
    while (this.bytes + size > this.maxBytes && this.map.size) {
      const oldest = this.map.keys().next().value;
      this.delete(oldest);
    }
    this.map.set(key, { value, size });
    this.bytes += size;
    return true;
  }

  delete(key) {
    const e = this.map.get(key);
    if (e) { this.bytes -= e.size; this.map.delete(key); }
  }

  clear() { this.map.clear(); this.bytes = 0; }
  get size() { return this.map.size; }
}
