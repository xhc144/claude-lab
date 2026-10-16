// Pointer sampling while recording the screen: position, mouse buttons, cursor shape and (for a
// recorded window) the window's rectangle. On Windows this calls user32 / dwmapi through koffi
// (MIT, github.com/Koromix/koffi); elsewhere only the position is available (Electron's screen
// module), so clicks are not recorded there.
import { screen } from 'electron';
import { createRequire } from 'node:module';

let win = null;
let winError = null;

function loadWin32() {
  if (win || winError || process.platform !== 'win32') return win;
  try {
    const req = createRequire(__filename);
    const koffi = req('koffi');
    const user32 = koffi.load('user32.dll');
    const dwm = koffi.load('dwmapi.dll');
    const POINT = koffi.struct('MOTIF_POINT', { x: 'int32', y: 'int32' });
    const RECT = koffi.struct('MOTIF_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
    const CURSORINFO = koffi.struct('MOTIF_CURSORINFO', { cbSize: 'uint32', flags: 'uint32', hCursor: 'void *', ptScreenPos: POINT });
    const GetCursorPos = user32.func('bool __stdcall GetCursorPos(_Out_ MOTIF_POINT *p)');
    const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vKey)');
    const GetCursorInfo = user32.func('bool __stdcall GetCursorInfo(_Inout_ MOTIF_CURSORINFO *ci)');
    const LoadCursorW = user32.func('void * __stdcall LoadCursorW(void *hInstance, uintptr_t name)');
    const GetWindowRect = user32.func('bool __stdcall GetWindowRect(uintptr_t hwnd, _Out_ MOTIF_RECT *r)');
    const IsWindow = user32.func('bool __stdcall IsWindow(uintptr_t hwnd)');
    const IsIconic = user32.func('bool __stdcall IsIconic(uintptr_t hwnd)');
    const DwmGetWindowAttribute = dwm.func('int32 __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32 attr, _Out_ MOTIF_RECT *r, uint32 size)');
    const SWAP = user32.func('int32 __stdcall GetSystemMetrics(int index)');
    const shapes = new Map();
    const ids = { arrow: 32512, text: 32513, wait: 32514, cross: 32515, hand: 32649, resize: [32642, 32643, 32644, 32645, 32646], wait2: 32650 };
    const addr = (p) => (p ? koffi.address(p) : 0n);
    for (const [name, v] of Object.entries(ids)) for (const id of [].concat(v)) {
      const h = LoadCursorW(null, id);
      if (h) shapes.set(addr(h), name === 'wait2' ? 'wait' : name);
    }
    const rectSize = koffi.sizeof(RECT);
    win = {
      cursor() { const p = {}; return GetCursorPos(p) ? [p.x, p.y] : null; },
      // Swapped buttons (left-handed setting): the primary button is VK_RBUTTON.
      buttons() {
        const swapped = SWAP(23) !== 0; // SM_SWAPBUTTON
        const l = (GetAsyncKeyState(swapped ? 2 : 1) & 0x8000) !== 0;
        const r = (GetAsyncKeyState(swapped ? 1 : 2) & 0x8000) !== 0;
        return { left: l, right: r };
      },
      shape() {
        const ci = { cbSize: koffi.sizeof(CURSORINFO), flags: 0, hCursor: null, ptScreenPos: { x: 0, y: 0 } };
        if (!GetCursorInfo(ci)) return null;
        if (!(ci.flags & 1)) return 'hidden';
        return shapes.get(addr(ci.hCursor)) || 'arrow';
      },
      windowRect(hwnd) {
        if (!IsWindow(hwnd) || IsIconic(hwnd)) return null;
        const r = {};
        // DWMWA_EXTENDED_FRAME_BOUNDS = 9: the visible frame (without the invisible resize border)
        if (DwmGetWindowAttribute(hwnd, 9, r, rectSize) === 0 && r.right > r.left) return r;
        return GetWindowRect(hwnd, r) ? r : null;
      },
    };
  } catch (e) {
    winError = e;
    console.warn('pointer: native sampling unavailable', e.message);
  }
  return win;
}

/** What the current platform can record. */
export function pointerCapabilities() {
  const w = loadWin32();
  return { position: true, clicks: !!w, shape: !!w, windows: !!w, error: winError?.message || null };
}

/**
 * Start sampling. target: { kind: 'screen', displayId, area?: {x,y,w,h} (DIP, display-relative) }
 *                       | { kind: 'window', hwnd }
 * Returns { setStart(epochMs), pause(), resume(), stop() → track }.
 */
export function startPointer(target, { rate = 120 } = {}) {
  const w = loadWin32();
  const events = [];
  let t0 = null;
  let pausedAt = null;
  let pausedTotal = 0;
  let last = null;
  let lastShape = null;
  let btn = { left: false, right: false };
  const display = target.kind === 'screen' ? (screen.getAllDisplays().find((d) => String(d.id) === String(target.displayId)) || screen.getPrimaryDisplay()) : null;
  const hwnd = target.kind === 'window' && target.hwnd ? BigInt(target.hwnd) : null;

  const frame = () => {
    if (display) {
      const b = display.bounds;
      const a = target.area;
      return a ? { x: b.x + a.x, y: b.y + a.y, w: a.w, h: a.h, dip: true } : { x: b.x, y: b.y, w: b.width, h: b.height, dip: true };
    }
    if (hwnd != null && w) {
      const r = w.windowRect(hwnd);
      return r ? { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top, dip: false } : null;
    }
    return null;
  };

  const sample = () => {
    if (t0 == null || pausedAt != null) return;
    const t = (Date.now() - t0 - pausedTotal) / 1000;
    if (t < 0) return;
    const f = frame();
    if (!f || f.w <= 0 || f.h <= 0) return;
    let px, py;
    if (f.dip || !w) { const p = screen.getCursorScreenPoint(); px = p.x; py = p.y; } else { const p = w.cursor(); if (!p) return; [px, py] = p; }
    const x = +((px - f.x) / f.w).toFixed(5), y = +((py - f.y) / f.h).toFixed(5);
    const shape = w ? w.shape() : null;
    const b = w ? w.buttons() : btn;
    const tt = +t.toFixed(4);
    const push = (k) => { const e = [tt, x, y, k]; if (shape && shape !== lastShape) { e.push(shape); lastShape = shape; } events.push(e); };
    if (b.left && !btn.left) push(1);
    if (b.right && !btn.right) push(2);
    if ((!b.left && btn.left) || (!b.right && btn.right)) push(3);
    btn = b;
    if (!last || Math.abs(last[0] - x) > 1e-5 || Math.abs(last[1] - y) > 1e-5 || (shape && shape !== lastShape)) { push(0); last = [x, y]; }
  };
  const timer = setInterval(sample, Math.max(4, Math.round(1000 / rate)));
  return {
    setStart(epochMs) { t0 = epochMs; },
    pause() { if (pausedAt == null) pausedAt = Date.now(); },
    resume() { if (pausedAt != null) { pausedTotal += Date.now() - pausedAt; pausedAt = null; } },
    stop() {
      clearInterval(timer);
      const f = frame();
      return { version: 1, width: f ? Math.round(f.w) : 0, height: f ? Math.round(f.h) : 0, clicks: !!w, events };
    },
  };
}
