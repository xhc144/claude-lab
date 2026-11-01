'use strict';
// 整理引擎：生成预览、执行移动、写撤销记录、撤销。只在任务文件夹内部移动，不删除、不覆盖任何文件。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { categorize, prepare, FALLBACK } = require('./classify.cjs');
const { readPdf, isMeaninglessName, titleFromPdf } = require('./pdf.cjs');
const { suggestName, translationSource } = require('./naming.cjs');

const MODES = { DATE: 0, CATEGORY: 1, CATEGORY_DATE: 4, DATE_CATEGORY: 5 };
const MODE_NAMES = { 0: '按日期', 1: '按学科大类', 4: '学科大类 → 日期', 5: '日期 → 学科大类' };
const MAX_ENTRIES = 20000;

const isWin = process.platform === 'win32';
const fold = p => isWin ? p.toLowerCase() : p;
function within(candidate, root) {
  const c = fold(path.resolve(candidate)), r = fold(path.resolve(root));
  return c === r || c.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
}
const samePath = (a, b) => fold(path.resolve(a)) === fold(path.resolve(b));

const ARCHIVE_FOLDER = /^\d{4}-\d{2}(?:-\d{2})?$/;           // 2026-10 或 2026-10-18
const SYSTEM_NAMES = new Set(['desktop.ini', 'thumbs.db', 'ehthumbs.db', '.ds_store', '$recycle.bin', 'system volume information']);
const TEMP_EXT = new Set(['.crdownload', '.download', '.part', '.partial', '.tmp', '.temp', '.opdownload', '.aria2', '.lock', '.filepart', '.!qb', '.bc!']);
function isSystemName(name) {
  const l = name.toLowerCase();
  return SYSTEM_NAMES.has(l) || l.startsWith('.') || l.startsWith('$') || l.startsWith('~$');
}
function isTemporary(name) { const l = name.toLowerCase(); return l.startsWith('.~') || TEMP_EXT.has(path.extname(l)); }

function pad(n) { return String(n).padStart(2, '0'); }
function period(date, granularity) {
  const d = new Date(date);
  const month = d.getFullYear() + '-' + pad(d.getMonth() + 1);
  return granularity === 'day' ? month + '-' + pad(d.getDate()) : month;
}

function messageOf(error) {
  if (!error) return '未知错误';
  if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') return '文件正被其他程序占用或没有权限，稍后会再试';
  if (error.code === 'ENOENT') return '文件已不在原位置';
  if (error.code === 'ENAMETOOLONG') return '路径过长，请缩短文件夹名称';
  return error.message || String(error);
}

function noLinks(target, stopAt) {
  let current = path.resolve(target);
  while (true) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('路径包含快捷链接或联接点，已停止：' + current); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (stopAt && samePath(current, stopAt)) break;
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}

// 文件：大小 + 修改时间；文件夹：遍历（有上限）后的数量、大小与最新时间。
function signature(full, isDirectory) {
  const st = fs.statSync(full);
  if (!isDirectory) return { sig: 'v2:' + st.size + ':' + Math.round(st.mtimeMs), newest: Math.max(st.mtimeMs, st.birthtimeMs || 0) };
  let count = 0, size = 0, newest = Math.max(st.mtimeMs, st.birthtimeMs || 0);
  const walk = (dir, depth) => {
    if (depth > 12) throw new Error('文件夹层级太深');
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (++count > MAX_ENTRIES) throw new Error('文件夹内项目超过 ' + MAX_ENTRIES + ' 个');
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new Error('文件夹内含有链接，保留原位');
      if (isTemporary(e.name)) { const err = new Error('文件夹内还有未下载完的文件：' + e.name); err.waiting = true; throw err; }
      const s = fs.statSync(p);
      newest = Math.max(newest, s.mtimeMs, s.birthtimeMs || 0);
      if (e.isDirectory()) walk(p, depth + 1); else size += s.size;
    }
  };
  walk(full, 0);
  return { sig: 'v2d:' + count + ':' + size + ':' + Math.round(newest), newest };
}

// 文件夹的日期：直接子项修改日期出现最多的那天，平票取较新的。
function folderDate(full) {
  const votes = new Map();
  for (const e of fs.readdirSync(full, { withFileTypes: true })) {
    try { const d = fs.statSync(path.join(full, e.name)).mtime; const key = d.toISOString().slice(0, 10); const v = votes.get(key) || { n: 0, d }; v.n++; votes.set(key, v); } catch {}
  }
  if (!votes.size) return fs.statSync(full).mtime;
  return [...votes.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? 1 : -1))[0][1].d;
}

function uniqueDestination(desired, isDirectory, reserved) {
  const free = p => !fs.existsSync(p) && !reserved.has(fold(p));
  if (free(desired)) return desired;
  const dir = path.dirname(desired), name = path.basename(desired);
  const ext = isDirectory ? '' : path.extname(name), stem = name.slice(0, name.length - ext.length);
  for (let n = 2; n <= 9999; n++) { const c = path.join(dir, stem + ' (' + n + ')' + ext); if (free(c)) return c; }
  throw new Error('同名项目太多，请先检查目标文件夹');
}

class Engine {
  constructor({ dataDirectory, now = () => new Date() }) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.journalDirectory = path.join(this.dataDirectory, 'journal');
    this.now = now;
    this.observations = new Map();
    fs.mkdirSync(this.journalDirectory, { recursive: true });
  }

  validateRoot(rootInput) {
    const root = path.resolve(rootInput);
    let st;
    try { st = fs.statSync(root); } catch { throw new Error('文件夹不存在或暂时无法访问：' + root); }
    if (!st.isDirectory()) throw new Error('所选路径不是文件夹：' + root);
    if (path.parse(root).root === root) throw new Error('不能整理整个磁盘，请选择具体文件夹');
    if (within(root, this.dataDirectory) || within(this.dataDirectory, root)) throw new Error('不能整理文件管家自己的数据目录');
    noLinks(root);
    return root;
  }

  /** 顶层待整理的项目里，需要机器翻译的英文名（内容里找不到中文的）。整理前先翻好放进缓存。 */
  translationCandidates(rule) {
    const root = this.validateRoot(rule.Root);
    const excludes = new Set((rule.Excludes || []).map(x => String(x).trim().toLowerCase()));
    const out = [];
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      const name = e.name, full = path.join(root, name);
      if (isSystemName(name) || isTemporary(name) || excludes.has(name.toLowerCase()) || e.isSymbolicLink()) continue;
      if (e.isDirectory() && (ARCHIVE_FOLDER.test(name) || /[_.]files$/i.test(name) || fs.existsSync(path.join(full, 'desktop.ini')))) continue;
      try { const s = translationSource(full, e.isDirectory()); if (s) out.push(s); } catch {}
      if (out.length >= 200) break;
    }
    return out;
  }

  /** 生成整理计划，不移动任何东西。options.translate：查机器翻译缓存的函数（可选）。 */
  plan(rule, categoriesInput, options = {}) {
    const root = this.validateRoot(rule.Root);
    const categories = prepare(categoriesInput);
    const categoryNames = new Set([...categories.map(c => c.name), FALLBACK].map(n => n.toLowerCase()));
    const excludes = new Set((rule.Excludes || []).map(x => String(x).trim().toLowerCase()).filter(Boolean));
    const mode = Number(rule.Mode);
    const granularity = rule.DateGranularity === 'day' ? 'day' : 'month';
    const stableMs = Math.max(0, Number(rule.StableSeconds) || 30) * 1000;
    const now = this.now().getTime();
    const result = { Moves: [], Skipped: 0, Waiting: 0, Notes: [], Kept: [] };
    const note = text => { if (result.Notes.length < 200) result.Notes.push(text); };

    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); }
    catch (e) { throw new Error('无法读取文件夹：' + messageOf(e)); }
    if (entries.length > MAX_ENTRIES) throw new Error('文件夹顶层超过 ' + MAX_ENTRIES + ' 项，请拆分后再整理');
    const names = new Set(entries.map(e => e.name.toLowerCase()));

    // 网页另存为产生的 “xxx.html + xxx_files”，文件夹跟着网页走。
    const companions = new Map();
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = /^(.*)[_.]files$/i.exec(e.name);
      if (!m) continue;
      for (const ext of ['.html', '.htm', '.mhtml']) if (names.has((m[1] + ext).toLowerCase())) companions.set((m[1] + ext).toLowerCase(), e.name);
    }
    const companionDirs = new Set([...companions.values()].map(n => n.toLowerCase()));

    const reserved = new Set();
    for (const e of entries) {
      const name = e.name, lower = name.toLowerCase(), full = path.join(root, name);
      if (isSystemName(name)) continue;
      if (e.isSymbolicLink()) { result.Skipped++; continue; }
      if (excludes.has(lower)) { result.Kept.push(name); continue; }
      if (isTemporary(name)) { result.Skipped++; result.Waiting++; note(name + '：还在下载中，下载完成后再整理'); continue; }
      const isDirectory = e.isDirectory();
      if (isDirectory) {
        if (ARCHIVE_FOLDER.test(name) || categoryNames.has(lower)) continue;   // 已经是整理好的文件夹
        if (companionDirs.has(lower)) continue;                               // 跟随网页一起移动
        if (!rule.IncludeFolders) continue;
        try { if (fs.existsSync(path.join(full, 'desktop.ini'))) { result.Kept.push(name); continue; } } catch {}
      } else if (!e.isFile()) continue;

      try {
        const info = signature(full, isDirectory);
        const companionName = companions.get(lower);
        let companionInfo = null;
        if (companionName) companionInfo = signature(path.join(root, companionName), true);

        // 稳定判断：最近一次改动早于等待时间，或者连续观察到没有变化。
        const sig = info.sig + (companionInfo ? '|' + companionInfo.sig : '');
        const newest = Math.max(info.newest, companionInfo ? companionInfo.newest : 0);
        let obs = this.observations.get(fold(full));
        if (!obs || obs.sig !== sig) { obs = { sig, since: now }; this.observations.set(fold(full), obs); }
        obs.seen = now;
        const ready = now - newest >= stableMs || now - obs.since >= stableMs;

        // 改名（撤销时按原名改回）。文件和文件夹都适用，带“_files”附件的网页不改（改了网页里的引用会断）：
        //  文件名看不出内容（乱码、main.pdf、index.html…）→ 用内容里的中文标题，PDF 没中文时用它的英文标题；
        //  纯英文名 → 前面加上内容里的中文名：“中文名_英文名”。
        let newName = name, renameNote = '';
        if (rule.RenamePdf !== false && !companions.has(lower)) {
          const ext = isDirectory ? '' : path.extname(name), stem = isDirectory ? name : name.slice(0, name.length - ext.length);
          let title = suggestName(full, isDirectory, info.sig, options.translate);
          if (!title && ext.toLowerCase() === '.pdf' && isMeaninglessName(stem)) title = titleFromPdf(readPdf(full, info.sig));
          if (title && title !== stem) { newName = title + ext; renameNote = '改名：' + name + ' → ' + newName + '；'; }
        }

        let category = null, reason = '';
        if (mode !== MODES.DATE) {
          const c = categorize(full, { categories, isDirectory, displayName: newName, sig: info.sig });
          category = c.topic ? path.join(c.category, c.topic) : c.category; reason = c.reason;
        }
        let datePart = null;
        if (mode !== MODES.CATEGORY) {
          const when = isDirectory ? folderDate(full) : (Number(rule.DateSource) === 1 ? fs.statSync(full).mtime : (fs.statSync(full).birthtime || fs.statSync(full).mtime));
          datePart = period(when, granularity);
        }
        const parts = mode === MODES.DATE ? [datePart] : mode === MODES.CATEGORY ? [category] : mode === MODES.DATE_CATEGORY ? [datePart, category] : [category, datePart];
        const bucket = path.join(root, ...parts);
        const destination = uniqueDestination(path.join(bucket, newName), isDirectory, reserved);
        reserved.add(fold(destination));
        if (process.platform === 'win32' && destination.length >= 255) throw new Error('目标路径过长');
        const relative = path.relative(root, destination);
        if (!reason) reason = '按' + (Number(rule.DateSource) === 1 ? '修改' : '创建') + '日期归档';
        else if (datePart) reason += '，再按' + (granularity === 'day' ? '日' : '月') + '归档';
        reason = renameNote + reason;

        const move = { Source: full, Destination: destination, Relative: relative, Folder: parts.join(path.sep), Category: category, IsDirectory: isDirectory, Ready: ready, Signature: info.sig, Reason: reason };
        result.Moves.push(move);
        if (!ready) result.Waiting++;
        if (companionName) {
          const cDest = path.join(path.dirname(destination), companionName);
          if (fs.existsSync(cDest) || reserved.has(fold(cDest))) { move.Ready = false; move.Blocked = true; move.Reason = '目标位置已有同名网页附件文件夹，保留原位'; result.Moves.pop(); result.Skipped++; note(name + '：目标位置已有“' + companionName + '”，保留原位'); continue; }
          reserved.add(fold(cDest));
          result.Moves.push({ Source: path.join(root, companionName), Destination: cDest, Relative: path.relative(root, cDest), Folder: move.Folder, Category: category, IsDirectory: true, Ready: ready, Signature: companionInfo.sig, Reason: '网页的附件文件夹，跟随“' + name + '”一起移动', CompanionOf: full });
        }
      } catch (error) {
        result.Skipped++;
        if (error.waiting) result.Waiting++;
        note(name + '：' + messageOf(error));
      }
    }
    for (const [key, obs] of this.observations) if (now - obs.seen > 2 * 86400000) this.observations.delete(key);
    return result;
  }

  /** 执行计划中已经稳定的移动，并写撤销记录。 */
  execute(rule, plan) {
    const root = this.validateRoot(rule.Root);
    const result = { Moved: 0, Skipped: plan.Skipped || 0, Waiting: 0, Failed: 0, Messages: [], BatchId: null };
    let batch = null;
    const failedSources = new Set();
    for (const item of plan.Moves) {
      if (!item.Ready) { result.Waiting++; continue; }
      if (item.CompanionOf && failedSources.has(fold(item.CompanionOf))) { result.Skipped++; continue; }
      let entry = null, moved = false;
      try {
        const source = path.resolve(item.Source), destination = path.resolve(item.Destination);
        if (!within(source, root) || samePath(source, root) || !within(destination, root) || samePath(destination, root)) throw new Error('路径不属于这个任务');
        if (item.IsDirectory && within(destination, source)) throw new Error('不能把文件夹移到它自己里面');
        if (fs.existsSync(destination)) throw new Error('目标位置出现了同名项目，下次再整理');
        const now = signature(source, item.IsDirectory);
        if (item.Signature && now.sig !== item.Signature) { const e = new Error('预览之后文件又有变化，稍后再整理'); e.waiting = true; throw e; }
        if (!batch) batch = { Version: 1, Id: this.batchId(), Root: root, RuleName: rule.Name || '', CreatedUtc: this.now().toISOString(), Entries: [], CreatedDirectories: [] };
        entry = { Source: source, Destination: destination, Signature: now.sig, State: 'pending', Error: null, IsDirectory: !!item.IsDirectory, Reason: item.Reason || '' };
        batch.Entries.push(entry);
        this.rememberParents(batch, path.dirname(destination), root);
        this.saveJournal(batch);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        noLinks(path.dirname(destination), root);
        fs.renameSync(source, destination);
        moved = true; result.Moved++;
        this.observations.delete(fold(source));
        entry.State = 'moved';
        this.saveJournal(batch);
      } catch (error) {
        if (moved) { result.Messages.push('文件已移动，但记录收尾失败：' + messageOf(error)); break; }
        failedSources.add(fold(item.Source));
        const waiting = error.waiting || ['EBUSY', 'EPERM', 'EACCES'].includes(error.code);
        if (waiting) result.Waiting++; else result.Failed++;
        result.Messages.push(path.basename(item.Source) + '：' + messageOf(error));
        if (entry) { entry.State = 'failed'; entry.Error = messageOf(error); try { this.saveJournal(batch); } catch {} }
      }
    }
    if (batch) { this.cleanupCreated(batch, root); result.BatchId = batch.Id; }
    return result;
  }

  batchId() {
    const d = this.now();
    const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + String(d.getUTCMilliseconds()).padStart(3, '0') + '0000';
    return stamp + '-' + crypto.randomBytes(16).toString('hex');
  }

  rememberParents(batch, directory, root) {
    const missing = [];
    while (!samePath(directory, root) && within(directory, root) && !fs.existsSync(directory)) { missing.push(directory); directory = path.dirname(directory); }
    for (const p of missing.reverse()) if (!batch.CreatedDirectories.some(x => samePath(x, p))) batch.CreatedDirectories.push(p);
  }

  // 失败时清掉为本批预建、但最后没有用上的空文件夹。
  cleanupCreated(batch, root) {
    for (const p of [...(batch.CreatedDirectories || [])].sort((a, b) => b.length - a.length)) {
      try { if (within(p, root) && !samePath(p, root) && fs.existsSync(p) && fs.readdirSync(p).length === 0) fs.rmdirSync(p); } catch {}
    }
  }

  journalPath(id) {
    if (!/^[0-9]{10,30}-[a-f0-9]{32}$/.test(String(id))) throw new Error('整理记录编号无效');
    return path.join(this.journalDirectory, id + '.json');
  }

  saveJournal(batch) {
    const file = this.journalPath(batch.Id);
    const tmp = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(tmp, JSON.stringify(batch), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tmp, file);
  }

  readJournal(file) {
    if (fs.statSync(file).size > 32 * 1024 * 1024) throw new Error('记录过大');
    const batch = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    if (!batch || batch.Version !== 1 || !Array.isArray(batch.Entries) || path.basename(file, '.json') !== batch.Id) throw new Error('记录格式无效');
    return batch;
  }

  journalFiles() {
    return fs.readdirSync(this.journalDirectory).filter(n => /^[0-9]{10,30}-[a-f0-9]{32}\.json$/.test(n)).sort().reverse();
  }

  /** 最近的整理记录（新的在前）。 */
  activity(limit = 40) {
    const out = [];
    for (const name of this.journalFiles()) {
      if (out.length >= limit) break;
      try {
        const b = this.readJournal(path.join(this.journalDirectory, name));
        const entries = b.Entries.filter(e => ['moved', 'undone', 'failed'].includes(e.State));
        if (!entries.length) continue;
        out.push({
          Id: b.Id, Root: b.Root, RuleName: b.RuleName || path.basename(b.Root || ''), CreatedUtc: b.CreatedUtc,
          Moved: entries.filter(e => e.State === 'moved').length, Undone: entries.filter(e => e.State === 'undone').length,
          Entries: entries.slice(0, 200).map(e => ({ Source: e.Source, Destination: e.Destination, State: e.State, IsDirectory: !!e.IsDirectory, Error: e.Error || null }))
        });
      } catch {}
    }
    return out;
  }

  /** 撤销一批（不传编号时撤销最近一批还能撤销的）。 */
  undo(batchId) {
    const result = { Moved: 0, Skipped: 0, Waiting: 0, Failed: 0, Messages: [] };
    const files = batchId ? [path.basename(this.journalPath(batchId))] : this.journalFiles();
    for (const name of files) {
      const file = path.join(this.journalDirectory, name);
      let batch;
      try { batch = this.readJournal(file); } catch (e) { if (batchId) throw new Error('找不到这条整理记录'); continue; }
      const todo = batch.Entries.filter(e => e.State === 'moved' || e.State === 'pending' || e.State === 'undo-pending');
      if (!todo.length) { if (batchId) { result.Messages.push('这一批已经撤销过了。'); return result; } continue; }
      const root = this.validateRoot(batch.Root);
      for (const entry of [...batch.Entries].reverse()) {
        if (!['moved', 'pending', 'undo-pending'].includes(entry.State)) continue;
        try {
          const source = path.resolve(entry.Source), destination = path.resolve(entry.Destination);
          if (!within(source, root) || !within(destination, root) || samePath(source, root) || samePath(destination, root)) throw new Error('记录里的路径不属于原文件夹');
          const s = fs.existsSync(source), d = fs.existsSync(destination);
          if (entry.State === 'pending' && s && !d) { entry.State = 'cancelled'; this.saveJournal(batch); continue; }
          if (entry.State === 'undo-pending' && s && !d) { entry.State = 'undone'; this.saveJournal(batch); result.Moved++; continue; }
          if (s) throw new Error('原位置已经有同名项目，两边都保留');
          if (!d) throw new Error('整理后的位置找不到它了（可能已被移动或删除）');
          entry.State = 'undo-pending'; this.saveJournal(batch);
          fs.mkdirSync(path.dirname(source), { recursive: true });
          noLinks(path.dirname(source), root);
          fs.renameSync(destination, source);
          entry.State = 'undone'; this.saveJournal(batch); result.Moved++;
        } catch (error) {
          if (entry.State === 'undo-pending') { entry.State = 'moved'; try { this.saveJournal(batch); } catch {} }
          result.Failed++; result.Messages.push(path.basename(entry.Source) + '：' + messageOf(error));
        }
      }
      // 撤销后，整理时新建的、现在已空的文件夹一并去掉。
      for (const p of [...(batch.CreatedDirectories || [])].sort((a, b) => b.length - a.length)) {
        try { if (within(p, root) && !samePath(p, root) && fs.existsSync(p) && fs.readdirSync(p).length === 0) fs.rmdirSync(p); } catch {}
      }
      result.Messages.unshift('已移回 ' + result.Moved + ' 项' + (result.Failed ? '，' + result.Failed + ' 项无法移回（原因见下）' : '') + '。');
      return result;
    }
    result.Messages.push('没有可以撤销的整理记录。');
    return result;
  }
}

module.exports = { Engine, MODES, MODE_NAMES, within, samePath, isSystemName, isTemporary, period };
