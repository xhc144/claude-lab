// Adaptive quality: picks a starting particle tier from the GPU name, calibrates with a short
// stress probe, then trades render resolution and particle count against frame time.
import { TIERS } from './particles.js';

export function guessTier(gpu) {
  const s = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(s)) return 0;
  if (/rtx\s*(40[6-9]0|50\d0)|rx\s*(7[7-9]00|90[67]0)|rtx\s*(a5000|a6000|[456]000 ada)/.test(s)) return 4;
  if (/rtx\s*(20|30|40)\d0|rtx\s*a[2-4]000|rx\s*(6[6-9]00|7[6-9]00)|arc\s*a7|titan/.test(s)) return 3;
  if (/gtx\s*(1[06-9]\d0|10[6-8]0)|rx\s*(5[5-7]00|6[4-6]00|vega|5[78]0|480)|arc|quadro|radeon pro|apple m\d (pro|max|ultra)/.test(s)) return 3;
  if (/(780m|680m|890m|880m)|iris xe|arc\(tm\) graphics|intel\(r\) arc|apple m\d|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/.test(s)) return 2;
  if (/intel|uhd|hd graphics|mali|adreno|powervr/.test(s)) return 1;
  return 2;
}

export class QualityManager {
  constructor(engine, settings) {
    this.engine = engine;
    this.settings = settings;
    this.samples = [];
    this.ema = 16.7;
    this.vsync = 16.7;
    this.phase = 'warmup';
    this.phaseT = 0;
    this.cooldown = 0;
    this.slowT = 0;
    this.fastT = 0;
    this.probes = 0;
    this.history = [];
    this.onChange = null;
  }

  get auto() { return this.settings.quality.auto; }

  initialTier() {
    const g = guessTier(this.engine.gpu);
    return Math.min(g, this.settings.quality.maxTier ?? 4);
  }

  // Pixel budget for the internal HDR buffers (devicePixelRatio aware).
  defaultScale(outW, outH, tier) {
    const budget = [1.0e6, 1.5e6, 2.2e6, 3.7e6, 5.0e6, 8.3e6][tier] || 3.7e6;
    return Math.min(1, Math.sqrt(budget / Math.max(1, outW * outH)));
  }

  restartCalibration() {
    this.phase = 'warmup'; this.phaseT = 0; this.samples = []; this.probes = 0; this.engine.stress = 1;
  }

  update(intervalMs) {
    if (!this.auto || intervalMs <= 0 || intervalMs > 250) return;
    const e = this.engine;
    this.ema += (intervalMs - this.ema) * 0.08;
    this.samples.push(intervalMs);
    if (this.samples.length > 240) this.samples.shift();
    const dt = intervalMs / 1000;
    this.phaseT += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const target = Math.max(this.vsync, 16.7);
    if (this.phase === 'warmup') {
      if (this.phaseT > 1.6) {
        const sorted = [...this.samples].sort((a, b) => a - b);
        this.vsync = Math.max(5.5, sorted[Math.floor(sorted.length * 0.25)] || 16.7);
        this.phase = 'measure'; this.phaseT = 0; this.samples = [];
      }
      return;
    }
    if (this.phase === 'measure') {
      if (this.phaseT > 1.4) {
        const avg = median(this.samples);
        if (avg > target * 1.25) { this._down('calibrate'); this.phaseT = 0; this.samples = []; return; }
        const gpu = e.stats.gpuMs;
        if (gpu != null && gpu < target * 0.4 && e.tierIndex < this._maxTier()) { this._up('gpu-headroom'); this.phaseT = 0; this.samples = []; return; }
        if (gpu == null && this.probes < 2 && e.tierIndex < this._maxTier()) {
          this.phase = 'probe'; this.phaseT = 0; this.samples = []; e.stress = 2; return;
        }
        this.phase = 'run'; this.phaseT = 0;
      }
      return;
    }
    if (this.phase === 'probe') {
      if (this.phaseT > 1.6) {
        e.stress = 1;
        this.probes++;
        const avg = median(this.samples.slice(20));
        if (avg <= target * 1.1) { this._up('probe'); this.phase = 'measure'; }
        else this.phase = 'run';
        this.phaseT = 0; this.samples = [];
      }
      return;
    }
    // steady state: react to sustained slowdowns, cautiously recover
    if (this.ema > target * 1.22) { this.slowT += dt; this.fastT = 0; }
    else if (this.ema < target * 1.05) { this.fastT += dt; this.slowT = Math.max(0, this.slowT - dt); }
    if (this.slowT > 1.5 && this.cooldown <= 0) { this._down('slow'); this.slowT = 0; }
    const gpu = e.stats.gpuMs;
    if (this.fastT > 6 && this.cooldown <= 0) {
      if (e.renderScale < this.baseScale - 0.01) { e.setRenderScale(Math.min(this.baseScale, e.renderScale + 0.1)); this.cooldown = 4; this.fastT = 0; this._notify('scale-up'); }
      else if (gpu != null && gpu < target * 0.42 && e.tierIndex < this._maxTier()) { this._up('steady'); this.fastT = 0; }
    }
  }

  _maxTier() { return Math.min(TIERS.length - 1, this.settings.quality.maxTier ?? 4); }

  _down(reason) {
    const e = this.engine;
    const minScale = Math.max(0.5, this.baseScale * 0.6);
    if (e.renderScale > minScale + 0.01 && reason !== 'calibrate') {
      e.setRenderScale(Math.max(minScale, e.renderScale - 0.1));
    } else if (e.tierIndex > 0) {
      e.setTier(e.tierIndex - 1);
    } else if (e.renderScale > 0.5) {
      e.setRenderScale(Math.max(0.5, e.renderScale - 0.1));
    }
    this.cooldown = 2.5;
    this._notify(reason);
  }

  _up(reason) {
    const e = this.engine;
    e.setTier(e.tierIndex + 1);
    this.cooldown = 6;
    this._notify(reason);
  }

  _notify(reason) {
    this.history.push({ t: performance.now(), reason, tier: this.engine.tierIndex, scale: this.engine.renderScale });
    if (this.onChange) this.onChange(reason);
  }
}

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
