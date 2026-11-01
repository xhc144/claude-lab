'use strict';
// 查找文件：在所有任务文件夹里建立文件名索引（只读），按关键词、类型、大类筛选。
const fsp = require('node:fs/promises');
const path = require('node:path');
const { isSystemName } = require('./engine.cjs');

const TYPES = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'txt', 'md', 'tex', 'rtf', 'odt', 'epub', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff'],
  media: ['mp4', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'webm', 'm4v', 'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'],
  web: ['html', 'htm', 'mhtml'],
  app: ['exe', 'msi', 'apk', 'dmg', 'iso', 'bat', 'ps1', 'jar']
};
const typeOf = ext => Object.keys(TYPES).find(k => TYPES[k].includes(ext)) || 'other';

class SearchIndex {
  constructor({ limit = 200000 } = {}) { this.limit = limit; this.items = []; this.builtAt = 0; this.building = null; this.truncated = false; }

  build(rules) {
    if (this.building) return this.building;
    this.building = (async () => {
      const items = []; let truncated = false;
      for (const rule of rules) {
        const root = rule.Root;
        const walk = async (dir, depth) => {
          if (items.length >= this.limit) { truncated = true; return; }
          if (depth > 14) return;
          let dirents; try { dirents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
          for (const e of dirents) {
            if (items.length >= this.limit) { truncated = true; return; }
            if (isSystemName(e.name) || e.isSymbolicLink()) continue;
            const full = path.join(dir, e.name);
            const rel = path.relative(root, full);
            const top = rel.split(path.sep)[0];
            let st = null; try { st = await fsp.stat(full); } catch { continue; }
            const isDir = e.isDirectory();
            const ext = isDir ? '' : path.extname(e.name).slice(1).toLowerCase();
            items.push({ name: e.name, lower: e.name.toLowerCase(), path: full, folder: path.dirname(rel), ruleId: rule.Id, ruleName: rule.Name, top: rel.includes(path.sep) ? top : '', isDir, ext, type: isDir ? 'folder' : typeOf(ext), size: isDir ? 0 : st.size, mtime: st.mtimeMs });
            if (isDir) await walk(full, depth + 1);
          }
        };
        await walk(root, 0);
      }
      this.items = items; this.truncated = truncated; this.builtAt = Date.now();
      return this.summary();
    })().finally(() => { this.building = null; });
    return this.building;
  }

  summary() { return { count: this.items.length, builtAt: this.builtAt, truncated: this.truncated, building: !!this.building }; }

  query({ q = '', type = 'all', ruleId = '', top = '', limit = 300 } = {}) {
    const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    let total = 0;
    for (const it of this.items) {
      if (type !== 'all' && it.type !== type) continue;
      if (!words.length && type === 'all' && it.isDir) continue;   // 什么都没输入时只列最近的文件
      if (ruleId && it.ruleId !== ruleId) continue;
      if (top && it.top !== top) continue;
      if (words.length && !words.every(w => it.lower.includes(w))) continue;
      total++;
      out.push(it);
    }
    out.sort((a, b) => {
      if (words.length) { const sa = a.lower.startsWith(words[0]) ? 0 : 1, sb = b.lower.startsWith(words[0]) ? 0 : 1; if (sa !== sb) return sa - sb; }
      return b.mtime - a.mtime;
    });
    return { total, items: out.slice(0, Math.min(1000, limit)).map(({ lower, ...rest }) => rest), ...this.summary() };
  }

  tops(ruleId) {
    const set = new Map();
    for (const it of this.items) if ((!ruleId || it.ruleId === ruleId) && it.top) set.set(it.top, (set.get(it.top) || 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }

  // 允许打开的路径：必须在索引里（即位于某个任务文件夹内）。
  has(p) { const l = path.resolve(p).toLowerCase(); return this.items.some(it => it.path.toLowerCase() === l); }
}

module.exports = { SearchIndex, TYPES };
