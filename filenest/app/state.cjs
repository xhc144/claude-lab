'use strict';
// 设置存储：任务 + 分类规则。写入使用临时文件 + 改名，并保留上一版 .bak。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const { DEFAULT_CATEGORIES, FALLBACK, safeLabel } = require('./classify.cjs');
const { within } = require('./engine.cjs');

const copy = v => JSON.parse(JSON.stringify(v));
const id = () => crypto.randomBytes(16).toString('hex');
const overlap = (a, b) => within(a, b) || within(b, a);

function normalizeRoot(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('请选择或粘贴一个文件夹路径。');
  let value = input.trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (/^https?:\/\//i.test(value)) throw new Error('这是网页链接，请选择电脑上的文件夹。');
  if (/^file:/i.test(value)) value = fileURLToPath(new URL(value));
  if (value.includes('\0') || !path.isAbsolute(value)) throw new Error('请使用完整的文件夹路径，例如 D:\\下载。');
  return path.resolve(value);
}

function validateRule(input, { dataDirectory, appDirectory, mustExist = true } = {}) {
  if (!input || typeof input !== 'object') throw new Error('任务配置不正确。');
  const rule = {
    Id: input.Id || id(), Name: String(input.Name || '').trim(), Root: normalizeRoot(input.Root),
    Mode: Number(input.Mode ?? 4), DateGranularity: input.DateGranularity === 'day' ? 'day' : 'month',
    DateSource: Number(input.DateSource ?? 0), Schedule: Number(input.Schedule ?? 0),
    DailyTime: input.DailyTime || '20:00', LastAutoDate: input.LastAutoDate || '',
    Enabled: input.Enabled === true, IncludeFolders: input.IncludeFolders !== false,
    StableSeconds: Number(input.StableSeconds ?? 30),
    Excludes: (Array.isArray(input.Excludes) ? input.Excludes : String(input.Excludes || '').split(/\r?\n/))
      .map(x => String(x).trim()).filter(Boolean).slice(0, 200)
  };
  if (!/^[a-f0-9]{32}$/i.test(rule.Id)) throw new Error('任务编号无效。');
  if (!rule.Name || rule.Name.length > 100) throw new Error('请填写 1 至 100 字的任务名称。');
  if (![0, 1, 4, 5].includes(rule.Mode) || ![0, 1, 2].includes(rule.Schedule) || ![0, 1].includes(rule.DateSource)) throw new Error('整理方式无效。');
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(rule.DailyTime)) throw new Error('时间应为 00:00 至 23:59。');
  if (!Number.isInteger(rule.StableSeconds) || rule.StableSeconds < 10 || rule.StableSeconds > 3600) throw new Error('稳定等待应为 10 至 3600 秒。');
  if (path.parse(rule.Root).root === rule.Root) throw new Error('不能整理整个磁盘，请选择具体文件夹。');
  for (const p of [dataDirectory, appDirectory]) if (p && overlap(rule.Root, p)) throw new Error('不能整理程序或配置所在的文件夹。');
  if (process.platform === 'win32') {
    for (const key of ['WINDIR', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData', 'LOCALAPPDATA', 'APPDATA'])
      if (process.env[key] && overlap(rule.Root, process.env[key])) throw new Error('请选择资料文件夹，不要选择系统或程序目录。');
    if (process.env.USERPROFILE && path.resolve(rule.Root).toLowerCase() === path.resolve(process.env.USERPROFILE).toLowerCase()) throw new Error('请选择用户目录下的具体文件夹。');
  }
  if (rule.Schedule === 2) rule.Enabled = false;
  if (mustExist) {
    let st; try { st = fs.statSync(rule.Root); } catch { throw new Error('文件夹不存在：' + rule.Root); }
    if (!st.isDirectory()) throw new Error('所选路径不是文件夹。');
  }
  return rule;
}

function validateCategories(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) throw new Error('分类数量应为 1 至 30 个。');
  const seen = new Set([FALLBACK.toLowerCase()]);
  return input.map(c => {
    const name = safeLabel(c && c.Name);
    if (!name) throw new Error('分类名称不能为空，也不能是日期或包含 \\ / : * ? " < > |。');
    if (seen.has(name.toLowerCase())) throw new Error('分类“' + name + '”重复，或与兜底分类“' + FALLBACK + '”同名。');
    seen.add(name.toLowerCase());
    const list = v => (Array.isArray(v) ? v : String(v || '').split(/[,，、;；\s]+/)).map(x => String(x).trim()).filter(Boolean).slice(0, 400);
    const exts = v => list(v).map(x => x.replace(/^\./, '').toLowerCase());
    const out = { Name: name, Keywords: list(c.Keywords), Extensions: exts(c.Extensions) };
    if (Number(c.ExtensionScore) > 0) out.ExtensionScore = Math.min(100, Number(c.ExtensionScore));
    const topics = (Array.isArray(c.Topics) ? c.Topics : []).slice(0, 30)
      .map(t => ({ Name: safeLabel(t && t.Name), Keywords: list(t && t.Keywords), Extensions: exts(t && t.Extensions) })).filter(t => t.Name);
    if (topics.length) out.Topics = topics;
    if (safeLabel(c.DefaultTopic)) out.DefaultTopic = safeLabel(c.DefaultTopic);
    return out;
  });
}

function atomicWrite(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp-' + id();
  try {
    const fd = fs.openSync(tmp, 'wx');
    try { fs.writeFileSync(fd, value, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(target)) fs.copyFileSync(target, target + '.bak');
    fs.renameSync(tmp, target);
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}

class Store {
  constructor(dataDirectory, appDirectory) {
    this.dataDirectory = path.resolve(dataDirectory); this.appDirectory = appDirectory;
    fs.mkdirSync(this.dataDirectory, { recursive: true });
    this.filename = path.join(this.dataDirectory, 'settings-v3.json');
    this.notice = '';
    this.value = this.load();
  }
  defaults() { return { Version: 3, Paused: false, Rules: [], Categories: copy(DEFAULT_CATEGORIES) }; }
  validate(value, mustExist = false) {
    if (!value || value.Version !== 3 || !Array.isArray(value.Rules) || value.Rules.length > 100) throw new Error('设置文件格式不正确。');
    const result = this.defaults();
    result.Paused = value.Paused === true;
    result.Categories = validateCategories(value.Categories || DEFAULT_CATEGORIES);
    result.Rules = value.Rules.map(r => validateRule(r, { dataDirectory: this.dataDirectory, appDirectory: this.appDirectory, mustExist }));
    const ids = new Set();
    for (const r of result.Rules) { if (ids.has(r.Id)) throw new Error('任务编号重复。'); ids.add(r.Id); }
    for (let i = 0; i < result.Rules.length; i++) for (let j = i + 1; j < result.Rules.length; j++)
      if (overlap(result.Rules[i].Root, result.Rules[j].Root)) throw new Error('两个任务的文件夹重复或互相包含，请合并为一个任务。');
    return result;
  }
  read(p) { if (fs.statSync(p).size > 8 * 1024 * 1024) throw new Error('设置文件过大。'); return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
  load() {
    if (fs.existsSync(this.filename)) {
      try { return this.validate(this.read(this.filename)); }
      catch {
        try { fs.copyFileSync(this.filename, this.filename + '.damaged-' + id()); } catch {}
        try { const v = this.validate(this.read(this.filename + '.bak')); v.Paused = true; this.notice = '设置已从备份恢复，自动整理先暂停，请检查后恢复。'; return v; }
        catch { const v = this.defaults(); this.notice = '设置读取失败，原文件已保留在数据文件夹；请重新添加任务或导入备份。'; return v; }
      }
    }
    const legacy = path.join(this.dataDirectory, 'settings-v2.json');
    if (fs.existsSync(legacy)) {
      try {
        const old = this.read(legacy);
        const next = this.defaults();
        next.Paused = old.Paused === true;
        // 旧版：0 按日期(按天) / 1 智能分类 / 2 日期+智能分类 / 3 仅生成上下文
        next.Rules = (old.Rules || []).map(r => ({
          ...r, Mode: r.Mode === 1 ? 1 : r.Mode === 2 ? 4 : 0, DateGranularity: r.Mode === 0 ? 'day' : 'month',
          Enabled: r.Mode === 3 ? false : r.Enabled === true, Schedule: r.Mode === 3 ? 2 : r.Schedule, Excludes: []
        }));
        const result = this.validate(next);
        atomicWrite(this.filename, JSON.stringify(result, null, 2));
        if (result.Rules.length) this.notice = '已升级整理方式：新文件按“学科大类 → 月份”整理，已经整理好的旧文件夹保持不动。';
        return result;
      } catch { this.notice = '旧版设置无法自动升级（原文件已保留），请重新添加任务。'; }
    }
    return this.defaults();
  }
  snapshot() { return copy(this.value); }
  commit(value) { const v = this.validate(value); atomicWrite(this.filename, JSON.stringify(v, null, 2)); this.value = v; return this.snapshot(); }
  saveRule(input) {
    const rule = validateRule(input, { dataDirectory: this.dataDirectory, appDirectory: this.appDirectory });
    const next = this.snapshot(); rule.LastAutoDate = '';
    const at = next.Rules.findIndex(r => r.Id === rule.Id);
    if (at < 0) next.Rules.push(rule); else next.Rules[at] = rule;
    return this.commit(next);
  }
  addExclude(ruleId, name) {
    const next = this.snapshot(); const r = next.Rules.find(x => x.Id === ruleId);
    if (!r) throw new Error('任务不存在。');
    if (!r.Excludes.some(x => x.toLowerCase() === String(name).toLowerCase())) r.Excludes.push(String(name));
    return this.commit(next);
  }
  deleteRule(ruleId) { const next = this.snapshot(); next.Rules = next.Rules.filter(r => r.Id !== ruleId); return this.commit(next); }
  setPaused(paused) { const next = this.snapshot(); next.Paused = paused === true; return this.commit(next); }
  markDate(ruleId, date) { const next = this.snapshot(); const r = next.Rules.find(x => x.Id === ruleId); if (r) r.LastAutoDate = date; return this.commit(next); }
  saveCategories(list) { const next = this.snapshot(); next.Categories = validateCategories(list); return this.commit(next); }
  resetCategories() { return this.saveCategories(copy(DEFAULT_CATEGORIES)); }
  importFile(filename) {
    const raw = this.read(filename);
    const next = this.validate(raw, true);
    next.Paused = true; for (const r of next.Rules) r.LastAutoDate = '';
    return this.commit(next);
  }
  exportFile(filename) { atomicWrite(filename, JSON.stringify(this.snapshot(), null, 2)); }
}

function localDay(now) { return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); }
function isDue(rule, { paused, now = new Date(), lastAttempt = 0 }) {
  if (paused || !rule.Enabled || rule.Schedule === 2) return false;
  if (now.getTime() - lastAttempt < 30000) return false;
  if (rule.Schedule === 0) return true;
  const [h, m] = rule.DailyTime.split(':').map(Number);
  return rule.LastAutoDate !== localDay(now) && now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

module.exports = { Store, normalizeRoot, validateRule, validateCategories, localDay, isDue, id };
