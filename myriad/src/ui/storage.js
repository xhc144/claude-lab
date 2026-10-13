// Persistence: world saves in IndexedDB (they are several MB), settings and the cross-world codex
// in localStorage. Every access is guarded — private windows and blocked storage just disable it.

const DB = 'myriad';
const STORE = 'saves';
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const r = fn(s);
    t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function saveSlot(key, data) {
  return tx('readwrite', (s) => s.put(data, key));
}

export async function loadSlot(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const r = t.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function deleteSlot(key) {
  return tx('readwrite', (s) => s.delete(key));
}

export async function listSlots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const out = [];
    const r = t.objectStore(STORE).openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) { out.push({ key: c.key, meta: c.value && c.value.meta }); c.continue(); } else resolve(out);
    };
    r.onerror = () => reject(r.error);
  });
}

export function getLocal(key, dflt) {
  try {
    const v = localStorage.getItem('myriad.' + key);
    return v == null ? dflt : JSON.parse(v);
  } catch { return dflt; }
}

export function setLocal(key, value) {
  try { localStorage.setItem('myriad.' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** gzip a string (if the browser supports CompressionStream) → Blob */
export async function gzipBlob(text) {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(cs).arrayBuffer()], { type: 'application/gzip' });
}

/** read a (possibly gzipped) file → string */
export async function readMaybeGzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(ds).text();
  }
  return new TextDecoder().decode(buf);
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
