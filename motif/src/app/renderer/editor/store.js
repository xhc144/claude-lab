// Editor state. Edits are ops: applied locally first (instant canvas feedback), then replayed onto
// the on-disk project by the main process. Because ops are semantic, a human editing while the AI
// (CLI / MCP / in-app assistant) also edits merges naturally instead of clobbering whole files.
import { useSyncExternalStore, useRef, useCallback } from 'react';
import { applyOps } from '../../../core/ops.js';
import { MotifEngine } from '../../../engine/index.js';
import { uid, clone } from '../../../core/util/misc.js';
import { call, on } from '../api.js';
import { toast } from '../ui.jsx';

export function fileUrl(abs) {
  const p = String(abs).replace(/\\/g, '/');
  return 'motif://app/@file/' + p.split('/').map(encodeURIComponent).join('/').replace(/^\/+/, '');
}

const stripMeta = (d) => { const { meta, ...rest } = d; return JSON.stringify(rest); };

/** Give new scenes/blocks explicit ids so local and on-disk documents stay in step. */
function prepareOps(doc, ops) {
  const out = [];
  for (const o0 of ops) {
    const o = clone(o0);
    if (o.op === 'add_scene') {
      o.scene = o.scene && typeof o.scene === 'object' ? o.scene : { blocks: [] };
      if (!o.scene.id) o.scene.id = uid('s', 6);
      if (Array.isArray(o.scene.blocks)) o.scene.blocks = o.scene.blocks.map((b) => (b && typeof b === 'object' && !b.id ? { ...b, id: uid('b', 6) } : b));
    } else if (o.op === 'add_block') {
      if (o.block && typeof o.block === 'object' && !o.block.id) o.block = { ...o.block, id: uid('b', 6) };
    } else if (o.op === 'duplicate_scene') {
      const s = doc.scenes.find((x) => x.id === o.scene) || doc.scenes[Number(o.scene) - 1];
      if (s) {
        const c = clone(s);
        c.id = uid('s', 6);
        c.blocks.forEach((b) => { b.id = uid('b', 6); });
        out.push({ op: 'add_scene', scene: c, after: s.id });
        continue;
      }
    }
    out.push(o);
  }
  return out;
}

export class EditorStore {
  constructor() {
    this.subs = new Set();
    this.s = {
      status: 'idle', error: null, project: null, doc: null, rev: 0,
      sel: { scene: null, block: null }, time: 0, playing: false, loop: false,
      timing: { duration: 0, scenes: [] }, issues: [], lint: null,
      save: 'saved', canUndo: false, canRedo: false, version: 0, frame: 0,
      inlineEdit: null,
    };
    this.undoStack = [];
    this.redoStack = [];
    this.pending = [];
    this.pendingMsg = [];
    this.chain = Promise.resolve();
    this.flushTimer = null;
    this.localSeq = 0;
    this.lastCoalesce = null;
    this.engine = null;
    this.offs = [];
  }

  // ── subscription ──
  get() { return this.s; }
  set(patch) { this.s = { ...this.s, ...patch }; for (const f of this.subs) f(); }
  subscribe = (f) => { this.subs.add(f); return () => this.subs.delete(f); };

  // ── lifecycle ──
  async open(id) {
    this.close();
    this.set({ status: 'loading', error: null });
    try {
      const r = await call('project.open', id);
      this.project = { id: r.id, dir: r.dir, assetBase: r.assetBase };
      this.engine = new MotifEngine({
        resolveUrl: (a) => {
          const f = a.file || a.src;
          if (!f) return null;
          if (/^(https?:|data:|blob:|motif:)/.test(f)) return f;
          if (/^([a-zA-Z]:[\\/]|\/)/.test(f)) return fileUrl(f);
          return r.assetBase + f.replace(/^\/+/, '');
        },
        userThemes: r.userThemes || {},
        onInvalidate: () => { this.refreshTiming(); this.set({ frame: this.s.frame + 1 }); },
      });
      await this.engine.setDocument(r.doc, { normalized: true });
      this.undoStack = []; this.redoStack = [];
      const first = r.doc.scenes[0]?.id || null;
      this.set({ status: 'ready', project: this.project, doc: r.doc, rev: r.doc.meta?.revision || 0, sel: { scene: first, block: null }, save: 'saved', canUndo: false, canRedo: false, version: this.s.version + 1 });
      this.refreshTiming();
      if (first) this.set({ time: this.timingOf(first)?.settled ?? 0 });
      this.offs.push(on('project-changed', (ev) => this.onExternal(ev)));
      this.scheduleThumb(1500);
    } catch (e) {
      this.set({ status: 'error', error: e });
    }
  }

  close() {
    this.pause();
    if (this.project) { this.flushNow(); call('project.close').catch(() => {}); }
    this.offs.forEach((f) => f()); this.offs = [];
    clearTimeout(this.thumbTimer);
    this.project = null;
    this.engine = null;
  }

  // ── derived timing ──
  refreshTiming() {
    if (!this.engine?.C) return;
    const timing = this.engine.timing();
    this.set({ timing, issues: this.engine.issues });
  }
  timingOf(sceneId) { return this.s.timing.scenes.find((x) => x.id === sceneId); }
  sceneAtTime(t) {
    const list = this.s.timing.scenes;
    let hit = null;
    for (const sc of list) if (t >= sc.start - 1e-6 && t < sc.end) hit = sc;
    return hit || list[list.length - 1] || null;
  }

  // ── selection & time ──
  selectScene(id, { seek = true } = {}) {
    if (!id) return;
    this.set({ sel: { scene: id, block: null }, inlineEdit: null });
    if (seek && !this.s.playing) { const sc = this.timingOf(id); if (sc) this.set({ time: sc.settled }); }
  }
  selectBlock(id, sceneId) {
    if (!id) { this.set({ sel: { ...this.s.sel, block: null }, inlineEdit: null }); return; }
    const scene = sceneId || this.s.doc.scenes.find((s) => s.blocks.some((b) => b.id === id))?.id;
    const cur = this.sceneAtTime(this.s.time);
    this.set({ sel: { scene, block: id } });
    if (!this.s.playing && cur?.id !== scene) { const sc = this.timingOf(scene); if (sc) this.set({ time: sc.settled }); }
  }
  seek(t) {
    const T = Math.max(0, Math.min(this.s.timing.duration || 0, t));
    const sc = this.sceneAtTime(T);
    const patch = { time: T };
    if (sc && sc.id !== this.s.sel.scene) patch.sel = { scene: sc.id, block: null };
    this.set(patch);
  }

  play() {
    if (this.s.playing || !this.s.timing.duration) return;
    let t = this.s.time >= this.s.timing.duration - 0.05 ? 0 : this.s.time;
    this.set({ playing: true, inlineEdit: null });
    let last = performance.now();
    const tick = (now) => {
      if (!this.s.playing) return;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      const D = this.s.timing.duration;
      if (t >= D) { if (this.s.loop) t = 0; else { this.set({ time: D - 0.001, playing: false }); return; } }
      const sc = this.sceneAtTime(t);
      this.set(sc && sc.id !== this.s.sel.scene ? { time: t, sel: { scene: sc.id, block: null } } : { time: t });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  pause() { if (this.s.playing) { cancelAnimationFrame(this.raf); this.set({ playing: false }); } }
  toggle() { this.s.playing ? this.pause() : this.play(); }
  playScene(id) { const sc = this.timingOf(id); if (!sc) return; this.pause(); this.set({ time: sc.start + 0.001, sel: { scene: id, block: null } }); this.play(); }

  // ── editing ──
  /**
   * Apply ops. o: { message, coalesce (key: merges rapid edits into one undo step), base (doc the
   * ops apply to — used by drags), transient (preview only: not saved, no undo) }
   */
  edit(ops, o = {}) {
    if (!this.s.doc) return null;
    const list = prepareOps(this.s.doc, Array.isArray(ops) ? ops : [ops]);
    const base = o.base || this.s.doc;
    const r = applyOps(base, list, { author: 'human' });
    if (!r.ok) {
      const bad = r.results.find((x) => !x.ok);
      if (!o.transient) toast.error({ message: bad?.error || '修改失败', hint: bad?.hint });
      return null;
    }
    // a commit that changes nothing (e.g. blur after typing) must not create an undo step or a write
    if (!o.transient && !o.base && stripMeta(r.doc) === stripMeta(this.s.doc)) return r;
    if (!o.transient) {
      const now = performance.now();
      const merge = o.coalesce && this.lastCoalesce && this.lastCoalesce.key === o.coalesce && now - this.lastCoalesce.t < 1500;
      if (!merge) { this.undoStack.push({ doc: base, label: o.message || '编辑' }); if (this.undoStack.length > 200) this.undoStack.shift(); }
      this.lastCoalesce = o.coalesce ? { key: o.coalesce, t: now } : null;
      this.redoStack = [];
      this.pending.push(...list);
      if (o.message) this.pendingMsg.push(o.message);
      this.localSeq++;
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flushNow(), o.coalesce ? 500 : 60);
    }
    this.setDoc(r.doc, { transient: o.transient });
    if (!o.transient) this.set({ canUndo: this.undoStack.length > 0, canRedo: false, save: 'saving' });
    return r;
  }

  setDoc(doc, { transient } = {}) {
    if (!this.engine) return;
    this.engine.update(doc);
    this.set({ doc, version: this.s.version + 1 });
    this.refreshTiming();
    // keep selection valid
    const { sel } = this.s;
    if (sel.scene && !doc.scenes.some((s) => s.id === sel.scene)) this.set({ sel: { scene: doc.scenes[0]?.id || null, block: null } });
    else if (sel.block && !doc.scenes.some((s) => s.blocks.some((b) => b.id === sel.block))) this.set({ sel: { ...this.s.sel, block: null } });
    if (!transient) this.scheduleThumb();
  }

  flushNow() {
    clearTimeout(this.flushTimer);
    if (!this.pending.length || !this.project) return this.chain;
    const ops = this.pending.splice(0);
    const msg = this.pendingMsg.splice(0);
    const id = this.project.id;
    const seq = this.localSeq;
    this.chain = this.chain.then(async () => {
      try {
        const r = await call('project.apply', id, ops, { message: [...new Set(msg)].join('；') || undefined });
        if (!r.ok) throw Object.assign(new Error(r.results?.find((x) => !x.ok)?.error || '保存失败'), { hint: r.results?.find((x) => !x.ok)?.hint });
        this.s.rev = r.revision;
        // adopt the merged on-disk document when nothing newer happened locally
        if (seq === this.localSeq && !this.pending.length && r.doc && stripMeta(r.doc) !== stripMeta(this.s.doc)) this.setDoc(r.doc);
        else if (seq === this.localSeq && r.doc) this.s.doc = { ...this.s.doc, meta: r.doc.meta };
        if (!this.pending.length) this.set({ save: 'saved', rev: r.revision });
      } catch (e) {
        this.set({ save: 'error' });
        toast.error(e, { action: { label: '重新载入', run: () => this.reload() } });
      }
    });
    return this.chain;
  }

  async reload() {
    if (!this.project) return;
    const r = await call('project.open', this.project.id);
    this.pending = [];
    this.setDoc(r.doc);
    this.set({ rev: r.doc.meta?.revision || 0, save: 'saved' });
  }

  async undo() {
    if (!this.undoStack.length) return;
    await this.flushNow();
    const prev = this.undoStack.pop();
    this.redoStack.push({ doc: this.s.doc, label: prev.label });
    this.setDoc(prev.doc);
    this.set({ canUndo: this.undoStack.length > 0, canRedo: true });
    this.persistWhole(`撤销：${prev.label}`);
  }
  async redo() {
    if (!this.redoStack.length) return;
    await this.flushNow();
    const next = this.redoStack.pop();
    this.undoStack.push({ doc: this.s.doc, label: next.label });
    this.setDoc(next.doc);
    this.set({ canUndo: true, canRedo: this.redoStack.length > 0 });
    this.persistWhole(`重做：${next.label}`);
  }
  persistWhole(message) {
    const id = this.project.id;
    const doc = this.s.doc;
    this.set({ save: 'saving' });
    this.chain = this.chain.then(async () => {
      try { const r = await call('project.replace', id, doc, { message }); this.set({ save: 'saved', rev: r.revision }); }
      catch (e) { this.set({ save: 'error' }); toast.error(e); }
    });
  }

  /** Project changed on disk by someone else (CLI, MCP, in-app AI). */
  onExternal(ev) {
    if (!this.project || ev.id !== this.project.id) return;
    if (ev.revision <= this.s.rev && ev.author === 'human') return;
    if (this.pending.length) return; // our next flush replays onto it and adopts the merge
    const before = this.s.doc;
    this.undoStack.push({ doc: before, label: ev.author === 'ai' ? 'AI 修改' : '外部修改' });
    this.redoStack = [];
    this.setDoc(ev.doc);
    this.set({ rev: ev.revision, canUndo: true, canRedo: false });
    if (ev.author === 'ai' && !this.aiActive) toast(`AI 更新了作品（修订 ${ev.revision}）`, { action: { label: '撤销', run: () => this.undo() } });
  }

  // ── convenience edits ──
  updateBlock(id, set, o = {}) { return this.edit([{ op: 'update_block', block: id, set }], { message: o.message || '修改内容', coalesce: o.coalesce ?? `blk:${id}:${Object.keys(set).join(',')}`, ...o }); }
  updateScene(id, set, o = {}) { return this.edit([{ op: 'update_scene', scene: id, set }], { message: o.message || '修改场景', coalesce: o.coalesce ?? `scn:${id}:${Object.keys(set).join(',')}`, ...o }); }
  addScene(scene, after) {
    const r = this.edit([{ op: 'add_scene', scene, ...(after ? { after } : {}) }], { message: '添加场景' });
    if (r) { const id = r.results[0].id; this.selectScene(id); }
    return r;
  }
  addBlock(block, sceneId = this.s.sel.scene) {
    if (!sceneId) { toast('先添加一个场景'); return null; }
    const r = this.edit([{ op: 'add_block', scene: sceneId, block }], { message: `添加${block.type}` });
    if (r) this.selectBlock(r.results[0].id, sceneId);
    return r;
  }
  removeBlock(id) { this.edit([{ op: 'remove_block', block: id }], { message: '删除块' }); this.set({ sel: { ...this.s.sel, block: null } }); }
  removeScene(id) {
    const idx = this.s.doc.scenes.findIndex((s) => s.id === id);
    this.edit([{ op: 'remove_scene', scene: id }], { message: '删除场景' });
    const next = this.s.doc.scenes[Math.min(idx, this.s.doc.scenes.length - 1)];
    if (next) this.selectScene(next.id);
  }
  duplicateScene(id) { const r = this.edit([{ op: 'duplicate_scene', scene: id }], { message: '复制场景' }); if (r) this.selectScene(r.results[0].id); }
  moveScene(id, position) { this.edit([{ op: 'move_scene', scene: id, position }], { message: '调整场景顺序' }); }
  duplicateBlock(id) {
    const s = this.s.doc.scenes.find((x) => x.blocks.some((b) => b.id === id));
    const b = s?.blocks.find((x) => x.id === id);
    if (!b) return;
    const c = clone(b); delete c.id;
    if (c.frame) c.frame = { ...c.frame, x: Math.min(0.9, (c.frame.x || 0) + 0.02), y: Math.min(0.9, (c.frame.y || 0) + 0.02) };
    const r = this.edit([{ op: 'add_block', scene: s.id, block: c, after: id }], { message: '复制块' });
    if (r) this.selectBlock(r.results[0].id, s.id);
  }

  // ── library thumbnail (first scene, settled) ──
  scheduleThumb(ms = 4000) { clearTimeout(this.thumbTimer); this.thumbTimer = setTimeout(() => this.writeThumb(), ms); }
  async writeThumb() {
    if (!this.engine?.C || !this.project) return;
    const sc = this.s.timing.scenes[0];
    if (!sc) return;
    try {
      await this.engine.assets.whenReady();
      const W = this.engine.C.env.W, H = this.engine.C.env.H;
      const scale = 480 / Math.max(W, H) * (W >= H ? 1 : 0.75);
      const c = document.createElement('canvas');
      c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      this.engine.render(sc.settled, c.getContext('2d'), { scale, noCamera: true });
      await call('project.thumb', this.project.id, c.toDataURL('image/jpeg', 0.86));
    } catch { /* non-critical */ }
  }
}

export const editor = new EditorStore();

/** Select a slice of editor state; re-renders only when the slice changes (shallow). */
export function useEditor(selector = (s) => s) {
  const last = useRef({ v: undefined, has: false });
  const get = useCallback(() => {
    const v = selector(editor.get());
    const prev = last.current;
    if (prev.has && shallowEqual(prev.v, v)) return prev.v;
    last.current = { v, has: true };
    return v;
  }, [selector]);
  return useSyncExternalStore(editor.subscribe, get);
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}

export function findBlock(doc, id) {
  if (!doc || !id) return null;
  for (const s of doc.scenes) { const b = s.blocks.find((x) => x.id === id); if (b) return { scene: s, block: b }; }
  return null;
}
