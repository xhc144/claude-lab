// Keyboard / mouse / pointer-lock state. Game code reads `input.down(action)` and consumes
// one-shot presses with `input.pressed(action)`.

export const DEFAULT_KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sneak: ['ShiftLeft', 'ShiftRight'], sprint: ['ControlLeft', 'KeyR'],
  inventory: ['KeyE'], drop: ['KeyQ'], camera: ['F5', 'KeyV'], debug: ['F3'], map: ['KeyM'], codex: ['KeyJ'],
  chat: ['KeyT'], command: ['Slash'], pause: ['Escape'], ping: ['KeyF'], offhand: ['KeyX'], hud: ['F1'], screenshot: ['F2'],
  zoom: ['KeyC'],
};

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.justPressed = new Set();
    this.bindings = structuredClone(DEFAULT_KEYS);
    this.mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0, clicked: new Set() };
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.lastTap = {};
    this.doubleTapped = new Set();
    this.onKey = null; // hook for UI (returns true to swallow)

    window.addEventListener('keydown', (e) => {
      if (this.onKey && this.onKey(e)) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F1', 'F3', 'F5', 'Slash', 'KeyF'].includes(e.code) || (e.ctrlKey && e.code === 'KeyW')) e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
        const now = performance.now();
        if (this.lastTap[e.code] && now - this.lastTap[e.code] < 280) this.doubleTapped.add(e.code);
        this.lastTap[e.code] = now;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    el.addEventListener('mousedown', (e) => {
      this.mouse.buttons |= 1 << e.button;
      this.mouse.clicked.add(e.button);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { this.mouse.buttons &= ~(1 << e.button); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) { this.keys.clear(); this.mouse.buttons = 0; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.el.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.el.requestPointerLock(); } catch { /* ignore */ } });
    } catch { try { this.el.requestPointerLock(); } catch { /* ignore */ } }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(action) {
    const ks = this.bindings[action];
    if (!ks) return false;
    for (const k of ks) if (this.keys.has(k)) return true;
    return false;
  }
  pressed(action) {
    const ks = this.bindings[action];
    if (!ks) return false;
    for (const k of ks) if (this.justPressed.has(k)) { this.justPressed.delete(k); return true; }
    return false;
  }
  doubleTap(action) {
    const ks = this.bindings[action];
    for (const k of ks) if (this.doubleTapped.has(k)) { this.doubleTapped.delete(k); return true; }
    return false;
  }
  keyPressed(code) { if (this.justPressed.has(code)) { this.justPressed.delete(code); return true; } return false; }
  clicked(btn) { if (this.mouse.clicked.has(btn)) { this.mouse.clicked.delete(btn); return true; } return false; }
  button(btn) { return !!(this.mouse.buttons & (1 << btn)); }
  takeMouse() { const d = [this.mouse.dx, this.mouse.dy]; this.mouse.dx = this.mouse.dy = 0; return d; }
  takeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; }
  endFrame() { this.justPressed.clear(); this.mouse.clicked.clear(); this.doubleTapped.clear(); }
}
