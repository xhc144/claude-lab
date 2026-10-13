// Saving and loading worlds. `snapshot` produces a structured-clone-friendly object (typed arrays
// kept as is) for in-memory timeline snapshots and IndexedDB; `toJSON`/`fromJSON` produce a
// portable text file with typed arrays packed as base64. Shared relation records between nations
// are re-linked on load.

import { RNG } from '../core/rng.js';

const TRANSIENT = new Set(['fx', 'notices', '_filled', '_order', '_visited', '_links', '_prof', 'borders']);

/** a plain object with the whole world (typed arrays are copied) */
export function snapshot(w) {
  const o = {};
  for (const k in w) {
    if (TRANSIENT.has(k)) continue;
    const v = w[k];
    if (k === 'rng') o.rng = v.s;
    else if (k === 'cityNames') o.cityNames = [...v];
    else if (ArrayBuffer.isView(v)) o[k] = v.slice();
    else if (k === 'life') {
      const L = {};
      for (const kk in v) L[kk] = ArrayBuffer.isView(v[kk]) ? v[kk].slice() : v[kk];
      o.life = L;
    } else o[k] = v;
  }
  // deep copy the object graph (shared references preserved by structuredClone)
  return structuredClone(o);
}

/** rebuild a live world from a snapshot (the snapshot is cloned, so it can be restored again) */
export function restore(snap) {
  const o = structuredClone(snap);
  o.rng = new RNG(1);
  o.rng.s = snap.rng >>> 0;
  o.cityNames = new Set(o.cityNames || []);
  o.fx = [];
  o.notices = [];
  o.impacts = o.impacts || [];
  relink(o);
  return o;
}

/** after JSON round trips, nations' relation records must again be shared objects */
function relink(w) {
  if (!w.nations) return;
  for (const a of w.nations) {
    for (const k in a.rel) {
      const b = w.nations[k];
      if (b && a.id < b.id) b.rel[a.id] = a.rel[k];
    }
  }
}

// ---- portable JSON --------------------------------------------------------------------------------

function b64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

function unb64(str) {
  if (typeof Buffer !== 'undefined') { const b = Buffer.from(str, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); }
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const CTORS = { Float32Array, Float64Array, Int32Array, Int16Array, Uint8Array, Uint32Array, Uint8ClampedArray, Int8Array, Uint16Array };

export function toJSON(w) {
  const snap = snapshot(w);
  return JSON.stringify({ format: 'myriad-world', version: 1, world: snap }, (k, v) => {
    if (ArrayBuffer.isView(v)) return { __ta: v.constructor.name, d: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    return v;
  });
}

export function fromJSON(text) {
  const data = JSON.parse(text, (k, v) => {
    if (v && typeof v === 'object' && v.__ta) {
      const bytes = unb64(v.d);
      const C = CTORS[v.__ta];
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return new C(copy.buffer);
    }
    return v;
  });
  if (!data || data.format !== 'myriad-world') throw new Error('不是万象世界存档');
  return restore(data.world);
}
