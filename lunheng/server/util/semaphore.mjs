/** FIFO counting semaphore. acquire() resolves to a release function. */
export class Semaphore {
  constructor(limit = 1) {
    this.limit = Math.max(1, limit | 0);
    this.active = 0;
    this.waiters = [];
  }
  setLimit(limit) {
    this.limit = Math.max(1, limit | 0);
    this.#drain();
  }
  acquire(signal) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, onAbort: null };
      if (signal) {
        if (signal.aborted) return reject(signal.reason ?? new Error('aborted'));
        waiter.onAbort = () => {
          const i = this.waiters.indexOf(waiter);
          if (i >= 0) this.waiters.splice(i, 1);
          reject(signal.reason ?? new Error('aborted'));
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }
      this.waiters.push(waiter);
      this.#drain();
    });
  }
  #drain() {
    while (this.active < this.limit && this.waiters.length) {
      const w = this.waiters.shift();
      if (w.signal && w.onAbort) w.signal.removeEventListener('abort', w.onAbort);
      this.active++;
      let released = false;
      w.resolve(() => {
        if (released) return;
        released = true;
        this.active--;
        this.#drain();
      });
    }
  }
}

/** Run async tasks with bounded parallelism, preserving result order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
