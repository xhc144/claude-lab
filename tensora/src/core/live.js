// The live simulation engine. One tick per second drives everything that "streams":
// gateway throughput and latency, the request feed, GPU telemetry and running training jobs.
// Pages subscribe with live.on('tick', fn) and unsubscribe on unmount.

import { GPUS, NODES, POOLS, MODELS, KEYS, REGIONS, NOW } from './data.js';
import { state, bus, pushNotification } from './state.js';
import { rng, clamp } from './util.js';

const R = rng(42);
const HISTORY = 90;

const dailyFactor = (t) => 0.62 + 0.38 * Math.sin(((new Date(t).getHours() + new Date(t).getMinutes() / 60 - 9) / 24) * Math.PI * 2);

function seedHistory() {
  const out = [];
  let v = 240 * dailyFactor(NOW);
  for (let i = HISTORY; i > 0; i--) {
    v = clamp(v + R.gauss() * 9 + (240 * dailyFactor(NOW) - v) * 0.08, 60, 900);
    out.push({ t: NOW - i * 1000, v, err: Math.max(0, v * 0.004 + R.gauss() * 0.4) });
  }
  return out;
}

const weightedModels = MODELS.filter((m) => m.calls > 500_000);
const totalCalls = weightedModels.reduce((a, m) => a + m.calls, 0);
function pickModel() {
  let x = R() * totalCalls;
  for (const m of weightedModels) { x -= m.calls; if (x <= 0) return m; }
  return weightedModels[0];
}

let seq = 0x5f2a10;
function makeRequest(t) {
  const m = pickModel();
  const key = R.pick(KEYS.filter((k) => k.enabled));
  const roll = R();
  const status = roll < 0.004 ? 500 : roll < 0.011 ? 429 : roll < 0.016 ? 400 : 200;
  const tin = Math.round(Math.exp(R.range(4.2, 8.4)));
  const tout = m.cat === 'embed' ? 0 : Math.round(Math.exp(R.range(3.5, 6.8)));
  const latency = status === 429 ? R.range(4, 18) : m.ttft + (m.tps ? (tout / m.tps) * 1000 : R.range(10, 80)) * R.range(0.7, 1.2);
  const cost = (tin * m.pin + tout * m.pout) / 1e6;
  const region = R() < 0.4 ? REGIONS[0] : R.pick(REGIONS);
  return { id: `req_${(seq++).toString(16)}`, t, model: m, key, status, latency, tin, tout, cost, region, stream: R() < 0.7 };
}

export const live = {
  running: true,
  t: NOW,
  rps: 0,
  hist: seedHistory(),
  p50: 312, p95: 940, p99: 1780,
  success: 99.62,
  tokS: 0,
  feed: [],
  gpu: { util: 0, temp: 0, power: 0, mem: 0, online: 0 },
  totals: (() => {
    const mid = new Date(NOW); mid.setHours(0, 0, 0, 0);
    let req = 0;
    for (let t = mid.getTime(); t < NOW; t += 600000) req += 240 * dailyFactor(t) * 600;
    return { requestsToday: req, tokensToday: req * 330, costToday: req * 330 * 0.0000015 };
  })(),
  _timer: 0,

  on(fn) { return bus.on('tick', fn); },

  setRunning(on) {
    this.running = on;
    bus.emit('live', on);
    if (on) this.start();
    else clearInterval(this._timer);
  },

  start() {
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (document.hidden) return;
      this.step();
    }, 1000);
  },

  step() {
    const last = this.hist[this.hist.length - 1];
    // Keep one-second samples ordered even when the wall clock repeats or moves backwards.
    this.t = Math.max(Date.now(), last.t + 1000);
    const target = 240 * dailyFactor(this.t);
    let v = clamp(last.v + R.gauss() * 10 + (target - last.v) * 0.12, 60, 900);
    if (R() < 0.025) v *= R.range(1.18, 1.4); // short bursts make the live curve worth watching
    const errSpike = R() < 0.02 ? R.range(3, 7) : 0;
    const err = Math.max(0, v * 0.004 + R.gauss() * 0.5 + errSpike);
    this.hist.push({ t: this.t, v, err });
    if (this.hist.length > HISTORY) this.hist.shift();
    this.rps = v;
    this.success = clamp(100 - (err / v) * 100 - 0.2, 97, 99.99);
    this.p50 = clamp(this.p50 + R.gauss() * 6 + (312 - this.p50) * 0.1, 220, 420);
    this.p95 = clamp(this.p95 + R.gauss() * 18 + (940 - this.p95) * 0.1 + errSpike * 12, 700, 1600);
    this.p99 = clamp(this.p99 + R.gauss() * 40 + (1780 - this.p99) * 0.1 + errSpike * 30, 1300, 3200);
    this.tokS = v * R.range(310, 350);

    const n = Math.max(1, Math.round(v / 90 + R.gauss()));
    for (let i = 0; i < n; i++) this.feed.unshift(makeRequest(this.t - Math.floor(R() * 900)));
    this.feed.length = Math.min(this.feed.length, 80);

    this.totals.requestsToday += v;
    this.totals.tokensToday += this.tokS;
    this.totals.costToday += this.tokS * 0.0000015;

    this.stepGpus();
    this.stepJobs();
    bus.emit('tick', this);
  },

  stepGpus() {
    let u = 0, tp = 0, pw = 0, mem = 0, on = 0;
    for (const g of GPUS) {
      if (g.status === 'crit') continue;
      const busy = g.util > 30 && !g.drain;
      const target = g.drain ? 0 : busy ? 90 : 6;
      g.util = clamp(g.util + R.gauss() * 2.6 + (target - g.util) * 0.05, 0, 100);
      if (g.status === 'warn' && !g.drain) g.util = clamp(g.util, 92, 100);
      const tTarget = 38 + g.util * 0.37 + (g.status === 'warn' ? 13 : 0);
      g.temp += (tTarget - g.temp) * 0.08 + R.gauss() * 0.25;
      const pool = POOLS.find((p) => p.id === g.pool);
      g.power = pool.tdp * (0.18 + 0.78 * g.util / 100) * R.range(0.98, 1.02);
      g.mem = clamp(g.mem + R.gauss() * 0.004, 0.02, 0.98);
      u += g.util; tp += g.temp; pw += g.power; mem += g.mem; on++;
    }
    this.gpu = { util: u / on, temp: tp / on, power: pw / 1000, mem: mem / on, online: on, total: GPUS.length };
  },

  stepJobs() {
    for (const j of state.jobs) {
      if (j.status !== 'running') continue;
      const rate = (1 - j.progress) / Math.max(1, j.eta / 7); // demo clock runs ~7x real time
      j.progress = Math.min(1, j.progress + rate);
      j.eta = Math.max(0, j.eta - 7);
      j.cost += (j.gpus * 21.6) / 3600 * 7;
      j._acc = (j._acc || 0) + 1;
      if (j._acc % 4 === 0 && j.loss.length) {
        const lastLoss = j.loss[j.loss.length - 1];
        // young runs fall fast, mature runs creep toward their floor
        const next = j.loss.length < 40
          ? lastLoss * R.range(0.93, 0.975) + R.gauss() * 0.03
          : lastLoss + (Math.min(...j.loss.slice(-20)) * 0.985 - lastLoss) * 0.15 + R.gauss() * 0.02;
        j.loss.push(Math.max(0.05, next));
        if (j.loss.length % 6 === 0) {
          j.valIdx.push(j.loss.length - 1);
          j.val.push(j.loss[j.loss.length - 1] * 1.05 + 0.04 + R.gauss() * 0.015);
        }
        for (const s of j.gpuUtil) { s.push(clamp(s[s.length - 1] + R.gauss() * 3 + (90 - s[s.length - 1]) * 0.1, 40, 100)); s.shift(); }
      }
      if (j.progress >= 0.9995) {
        j.progress = 1;
        j.status = 'completed';
        j.finished = Date.now();
        j.eta = 0;
        pushNotification({ level: 'good', title: '训练完成', body: `「${j.name}」已完成，验证损失 ${j.val.length ? j.val[j.val.length - 1].toFixed(3) : '—'}，可部署为专属端点。`, link: `jobs/${j.id}` });
        bus.emit('jobs', j);
        bus.emit('toast', { kind: 'good', title: '训练完成', body: `「${j.name}」已生成最终检查点` });
      }
    }
  },
};

live.stepGpus();

export const nodeById = (id) => NODES.find((n) => n.id === id);
