// A small pool of workers; jobs go to the least-loaded one and replies are routed by id.
import { createWorker } from './workerurl.js';

export class WorkerPool {
  constructor(n, seed, onMessage) {
    this.workers = [];
    this.load = [];
    this.nextId = 1;
    this.onMessage = onMessage;
    this.jobs = new Map();
    for (let i = 0; i < n; i++) {
      const w = createWorker();
      const k = i;
      w.onmessage = (e) => {
        const m = e.data;
        if (m.id !== undefined && this.jobs.has(m.id)) { this.jobs.delete(m.id); this.load[k]--; }
        if (m.type === 'error') console.error('[worker]', m.message);
        this.onMessage(m);
      };
      w.onerror = (e) => console.error('[worker error]', e.message || e);
      w.postMessage({ type: 'init', seed });
      this.workers.push(w);
      this.load.push(0);
    }
  }
  get busy() { let s = 0; for (const l of this.load) s += l; return s; }
  post(msg, transfer = []) {
    let best = 0;
    for (let i = 1; i < this.load.length; i++) if (this.load[i] < this.load[best]) best = i;
    msg.id = this.nextId++;
    this.jobs.set(msg.id, best);
    this.load[best]++;
    this.workers[best].postMessage(msg, transfer);
    return msg.id;
  }
  terminate() { for (const w of this.workers) w.terminate(); this.workers = []; }
}
