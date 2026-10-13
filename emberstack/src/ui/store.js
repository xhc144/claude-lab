// Persistent data in localStorage: campaign progress, settings, codex, achievements, the AI's
// long-term memory and the autosaved run. Every access is guarded — storage may be unavailable.

const KEY = 'emberstack.v1';

const DEFAULTS = {
  progress: {}, // levelId -> { won, stars, bestDays, plays, aiWon }
  settings: {
    master: 0.8, music: 0.55, sfx: 0.8, lowFx: false, showHand: true, autoNext: true, strategy: 'balanced',
    takeover: true, autoCam: true, tutorial: true, speed: 1, unlockAll: false,
  },
  seen: [], // card ids
  recipes: [], // discovered recipe ids (hidden ones count as found)
  hints: [], // hinted hidden recipe ids
  ach: {}, // id -> timestamp
  ai: { disc: [], tried: [], wins: 0, games: 0 },
  stats: { games: 0, wins: 0, deaths: 0, kills: 0, crafted: 0, days: 0, aiWins: 0, endlessBest: 0, expeditions: 0 },
  run: null, // autosave { levelId, spec, game, ai: {enabled, strategy}, t }
};

let data = null;

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const d = (raw && safeParse(raw)) || {};
  data = {
    ...structuredClone(DEFAULTS), ...d,
    settings: { ...DEFAULTS.settings, ...(d.settings || {}) },
    stats: { ...DEFAULTS.stats, ...(d.stats || {}) },
    ai: { ...DEFAULTS.ai, ...(d.ai || {}) },
  };
  return data;
}

export function store() { return data || load(); }

let saveTimer = null;
export function save(now = false) {
  if (now) return flush();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(store())); } catch { /* quota or blocked */ }
}

export function settings() { return store().settings; }

export function markSeen(ids) {
  const s = store();
  const set = new Set(s.seen);
  let changed = false;
  for (const id of ids) if (!set.has(id)) { set.add(id); changed = true; }
  if (changed) { s.seen = [...set]; save(); }
  return changed;
}

export function addRecipe(id) {
  const s = store();
  if (!s.recipes.includes(id)) { s.recipes.push(id); save(); return true; }
  return false;
}
export function addHint(id) {
  const s = store();
  if (!s.hints.includes(id)) { s.hints.push(id); save(); }
}

export function recordLevel(id, result) {
  const s = store();
  const p = s.progress[id] || { won: false, stars: 0, bestDays: null, plays: 0, aiWon: false };
  p.plays++;
  if (result.won) {
    p.won = true;
    p.stars = Math.max(p.stars, result.stars);
    p.bestDays = p.bestDays ? Math.min(p.bestDays, result.days) : result.days;
    if (result.ai) p.aiWon = true;
  }
  s.progress[id] = p;
  save(true);
  return p;
}

export function unlockAch(id) {
  const s = store();
  if (s.ach[id]) return false;
  s.ach[id] = Date.now();
  save();
  return true;
}

export function aiMemory() {
  const a = store().ai;
  return { disc: new Set(a.disc), tried: new Set(a.tried.slice(-3000)), wins: a.wins, games: a.games };
}
export function saveAiMemory(mem) {
  const s = store();
  s.ai = { disc: [...mem.disc], tried: [...mem.tried].slice(-3000), wins: mem.wins || 0, games: mem.games || 0 };
  save();
}

export function saveRun(run) {
  store().run = run;
  save();
}
export function clearRun() {
  store().run = null;
  save(true);
}

export function exportData() { return JSON.stringify(store()); }
export function importData(text) {
  const d = safeParse(text);
  if (!d || typeof d !== 'object' || !d.progress) return false;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { return false; }
  data = null;
  load();
  return true;
}
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  data = null;
  load();
}
