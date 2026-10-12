// Saves in IndexedDB: world list, modified chunks (run-length encoded) and player/world state.
// Falls back to an in-memory store when IndexedDB is unavailable (e.g. some private modes).

const DB_NAME = 'echowild';
const DB_VER = 1;

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export function rleEncode(arr) {
  // Uint16Array -> Uint16Array of (value, count) pairs
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let n = 1;
    while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
    out.push(v, n);
    i += n;
  }
  return new Uint16Array(out);
}
export function rleDecode(rle, len = 65536) {
  const out = new Uint16Array(len);
  let o = 0;
  for (let i = 0; i < rle.length; i += 2) { out.fill(rle[i], o, o + rle[i + 1]); o += rle[i + 1]; }
  return out;
}

class MemoryDB {
  constructor() { this.stores = { worlds: new Map(), chunks: new Map(), state: new Map() }; }
  async get(store, key) { return this.stores[store].get(key); }
  async put(store, key, val) { this.stores[store].set(key, val); }
  async del(store, key) { this.stores[store].delete(key); }
  async all(store) { return [...this.stores[store].values()]; }
  async keys(store, prefix) { return [...this.stores[store].keys()].filter((k) => k.startsWith(prefix)); }
  async delPrefix(store, prefix) { for (const k of await this.keys(store, prefix)) this.stores[store].delete(k); }
}

class IDB {
  constructor(db) { this.db = db; }
  tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  get(store, key) { return req(this.tx(store).get(key)); }
  put(store, key, val) { return req(this.tx(store, 'readwrite').put(val, key)); }
  del(store, key) { return req(this.tx(store, 'readwrite').delete(key)); }
  all(store) { return req(this.tx(store).getAll()); }
  keys(store, prefix) { return req(this.tx(store).getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿'))); }
  delPrefix(store, prefix) { return req(this.tx(store, 'readwrite').delete(IDBKeyRange.bound(prefix, prefix + '￿'))); }
}

let dbPromise = null;
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let done = false;
    const fallback = (why) => { if (done) return; done = true; console.warn('IndexedDB unavailable, saves are kept in memory only:', why); resolve(new MemoryDB()); };
    try {
      if (!globalThis.indexedDB) return fallback('no indexedDB');
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of ['worlds', 'chunks', 'state']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      r.onsuccess = () => { if (done) return; done = true; resolve(new IDB(r.result)); };
      r.onerror = () => fallback(r.error);
      r.onblocked = () => fallback('blocked');
      setTimeout(() => fallback('timeout'), 4000);
    } catch (e) { fallback(e); }
  });
  return dbPromise;
}

export const isPersistent = async () => !((await openDB()) instanceof MemoryDB);

// ---- world list
export async function listWorlds() {
  const db = await openDB();
  const ws = await db.all('worlds');
  return (ws || []).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}
export async function saveWorldMeta(meta) { const db = await openDB(); await db.put('worlds', meta.id, meta); }
export async function deleteWorld(id) {
  const db = await openDB();
  await db.del('worlds', id);
  await db.delPrefix('chunks', `${id}|`);
  await db.del('state', id);
}

// ---- per-world storage bound to one world id
export class WorldStore {
  constructor(id) { this.id = id; this.dbp = openDB(); }
  key(cx, cz) { return `${this.id}|${cx}|${cz}`; }
  async savedKeys() {
    const db = await this.dbp;
    const ks = await db.keys('chunks', `${this.id}|`);
    return ks.map((k) => { const [, cx, cz] = k.split('|'); return [Number(cx), Number(cz)]; });
  }
  async saveChunk(c, entities) {
    const db = await this.dbp;
    const be = [];
    for (const [i, data] of c.blockEntities) be.push({ i, data });
    await db.put('chunks', this.key(c.cx, c.cz), {
      blocks: rleEncode(c.blocks), biomes: c.biomes, tints: c.tints, blockEntities: be, entities: entities || [], v: 1,
    });
  }
  async loadChunk(cx, cz) {
    const db = await this.dbp;
    const r = await db.get('chunks', this.key(cx, cz));
    if (!r) return null;
    return { blocks: rleDecode(r.blocks), biomes: r.biomes, tints: r.tints, blockEntities: r.blockEntities, entities: r.entities };
  }
  async saveState(state) { const db = await this.dbp; await db.put('state', this.id, state); }
  async loadState() { const db = await this.dbp; return db.get('state', this.id); }
}

// ---- export / import a whole world as one JSON file
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
const enc = (ta) => b64(new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength));

export async function exportWorld(id) {
  const db = await openDB();
  const meta = await db.get('worlds', id);
  const state = await db.get('state', id);
  const keys = await db.keys('chunks', `${id}|`);
  const chunks = [];
  for (const k of keys) {
    const r = await db.get('chunks', k);
    chunks.push({ k: k.slice(id.length + 1), blocks: enc(r.blocks), biomes: enc(r.biomes), tints: enc(r.tints), blockEntities: r.blockEntities, entities: r.entities });
  }
  return JSON.stringify({ format: 'echowild-world', version: 1, meta, state, chunks });
}

export async function importWorld(text) {
  const o = JSON.parse(text);
  if (o.format !== 'echowild-world') throw new Error('不是回响荒野的存档文件');
  const db = await openDB();
  const id = `w${Date.now().toString(36)}`;
  const meta = { ...o.meta, id, name: `${o.meta.name}（导入）`, lastPlayed: Date.now() };
  await db.put('worlds', id, meta);
  if (o.state) await db.put('state', id, o.state);
  for (const c of o.chunks) {
    const bu = unb64(c.blocks);
    await db.put('chunks', `${id}|${c.k}`, {
      blocks: new Uint16Array(bu.buffer.slice(0)), biomes: unb64(c.biomes), tints: new Uint32Array(unb64(c.tints).buffer.slice(0)),
      blockEntities: c.blockEntities, entities: c.entities, v: 1,
    });
  }
  return meta;
}
