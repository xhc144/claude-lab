// Shared plumbing for the canvas instruments: HiDPI sizing, readouts, little control widgets.
export class Instrument {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.type = host.dataset.instrument;
    this.canvas = host.querySelector('canvas');
    this.controlsEl = host.querySelector('.ins-controls');
    this.large = !!opts.large;
    this.w = 0; this.h = 0; this.dpr = 1;
    this._readouts = new Map();
    this.time = 0;
  }

  get2d() {
    this.ctx = this.canvas.getContext('2d');
    return this.ctx;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.onResize?.();
    return true;
  }

  readout(key, text) {
    let els = this._readouts.get(key);
    if (!els) {
      els = [...this.host.querySelectorAll(`[data-readout="${key}"]`)];
      if (!this.large) els.push(...document.querySelectorAll(`[data-readout-for="${this.type}"][data-readout="${key}"]`));
      this._readouts.set(key, els);
    }
    for (const el of els) if (el.textContent !== text) el.textContent = text;
  }

  // controls: [{ type: 'chips', items: [{label, value}], value, onChange }, { type: 'range', ... }, { type: 'button', label, onClick }]
  controls(spec) {
    if (!this.controlsEl) return;
    this.controlsEl.innerHTML = '';
    for (const c of spec) {
      if (c.type === 'chips') {
        const wrap = document.createElement('div');
        wrap.className = 'chips';
        const btns = c.items.map((it) => {
          const b = document.createElement('button');
          b.className = 'chip mono' + (it.value === c.value ? ' is-on' : '');
          b.textContent = it.label;
          b.addEventListener('click', () => { for (const x of btns) x.classList.toggle('is-on', x === b); c.onChange(it.value); });
          wrap.appendChild(b);
          return b;
        });
        this.controlsEl.appendChild(wrap);
      } else if (c.type === 'button') {
        const b = document.createElement('button');
        b.className = 'chip mono';
        b.textContent = c.label;
        b.addEventListener('click', () => c.onClick(b));
        this.controlsEl.appendChild(b);
      } else if (c.type === 'range') {
        const l = document.createElement('label');
        l.className = 'range mono';
        l.innerHTML = `<span>${c.label}</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" aria-label="${c.label}"><b></b>`;
        const input = l.querySelector('input'), out = l.querySelector('b');
        const fmt = c.format || ((v) => v);
        out.textContent = fmt(c.value);
        input.addEventListener('input', () => { const v = Number(input.value); out.textContent = fmt(v); c.onInput(v); });
        this.controlsEl.appendChild(l);
      }
    }
  }

  // pointer helper: callbacks receive local CSS-pixel coordinates
  pointer({ down, move, up, hover, leave } = {}) {
    const c = this.canvas;
    let dragging = false;
    const local = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => {
      const [x, y] = local(e);
      if (down && down(x, y, e) !== false) { dragging = true; c.setPointerCapture(e.pointerId); }
    });
    c.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      if (dragging && move) move(x, y, e);
      else if (hover) hover(x, y, e);
    });
    const end = (e) => { if (dragging) { dragging = false; up?.(...local(e), e); } };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => leave?.());
  }

  frame() {}
  destroy() { this.destroyed = true; }
}

export const TAU = Math.PI * 2;
export const PAL = { ink: '#ece8e1', ink2: 'rgba(236,232,225,0.62)', ink3: 'rgba(236,232,225,0.32)', line: 'rgba(236,232,225,0.12)', signal: '#ff5b1f', ion: '#4fe3ff', violet: '#9b7bff', acid: '#d4ff3a', bg: '#07070b' };
export const MONO = '"JetBrains Mono", ui-monospace, monospace';
