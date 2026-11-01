'use strict';
// 机器翻译：把内容里找不到中文的英文文件名，通过 OpenAI 兼容接口（默认本机“大模型统一API网关”）翻成中文。
// 只发文件名（和 PDF 的英文标题），不发文件内容。结果缓存在 translate-cache.json，同一个名字只问一次。
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { Enabled: false, BaseUrl: 'http://127.0.0.1:8787/v1', Model: 'xhc-deepseek-v4-flash' };
const BATCH = 30;

function cleanZh(s) {
  let t = String(s || '').normalize('NFKC').replace(/^["'“”‘’「」《》\s]+|["'“”‘’「」《》\s]+$/g, '')
    .replace(/:/g, '：').replace(/\?/g, '？').replace(/\|/g, '｜').replace(/[<>"/\\*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/\s*([：？｜])\s*/g, '$1').trim();
  t = t.replace(/\.(pdf|zip|html?|mp4|mp3|docx?|pptx?|xlsx?|exe|tex|md|txt)$/i, '').replace(/[. _-]+$/, '');
  if (t.length > 40) t = t.slice(0, 40).trim();
  return (t.match(/\p{Script=Han}/gu) || []).length >= 2 ? t : '';
}

class Translator {
  /** encrypt/decrypt：保存密钥用（主进程传 Electron safeStorage）；测试里可以不传。 */
  constructor({ dataDirectory, encrypt = s => s, decrypt = s => s, log = () => {}, fetchImpl = globalThis.fetch }) {
    this.configFile = path.join(dataDirectory, 'translate.json');
    this.cacheFile = path.join(dataDirectory, 'translate-cache.json');
    this.encrypt = encrypt; this.decrypt = decrypt; this.log = log; this.fetch = fetchImpl;
    this.cache = {}; this.lastError = ''; this.lastOk = '';
    try { this.cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')); } catch {}
  }

  config() {
    let c = {};
    try { c = JSON.parse(fs.readFileSync(this.configFile, 'utf8')); } catch {}
    return { ...DEFAULTS, ...c };
  }
  /** 给界面看的设置（不含密钥）。 */
  publicConfig() {
    const c = this.config();
    return { Enabled: !!c.Enabled, BaseUrl: c.BaseUrl, Model: c.Model, HasKey: !!c.KeyEnc, LastError: this.lastError, LastOk: this.lastOk, Cached: Object.keys(this.cache).length };
  }
  save({ Enabled, BaseUrl, Model, Key }) {
    const c = this.config();
    const url = String(BaseUrl || DEFAULTS.BaseUrl).trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('接口地址应以 http:// 或 https:// 开头。');
    const next = { Enabled: !!Enabled, BaseUrl: url, Model: String(Model || DEFAULTS.Model).trim(), KeyEnc: c.KeyEnc || '' };
    if (typeof Key === 'string' && Key.trim()) next.KeyEnc = this.encrypt(Key.trim());
    if (Key === null) next.KeyEnc = '';
    fs.writeFileSync(this.configFile, JSON.stringify(next, null, 2));
    return this.publicConfig();
  }
  enabled() { const c = this.config(); return !!(c.Enabled && c.BaseUrl && c.Model); }

  /** 同步查缓存：有译文返回中文，没有返回 ''。 */
  lookup(english) { const v = this.cache[english]; return typeof v === 'string' ? v : ''; }

  async request(names, config = this.config()) {
    const key = config.KeyEnc ? this.decrypt(config.KeyEnc) : '';
    const list = names.map((n, i) => (i + 1) + '. ' + n).join('\n');
    const body = {
      model: config.Model, temperature: 0.2,
      messages: [
        { role: 'system', content: '你是文件名翻译助手。把每个英文文件名或标题翻译成简洁、自然的中文标题（数学、物理、计算机术语用规范译名；人名、产品名可保留原文）。不超过 20 个汉字，不加扩展名，不加引号。只输出 JSON 数组，顺序与输入一致。' },
        { role: 'user', content: list }
      ]
    };
    const res = await this.fetch(config.BaseUrl + '/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error('接口返回 ' + res.status + (res.status === 401 ? '（密钥不对）' : ''));
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content || '');
    const m = /\[[\s\S]*\]/.exec(text);
    if (!m) throw new Error('接口没有返回译文');
    const arr = JSON.parse(m[0]);
    return names.map((_, i) => cleanZh(arr[i]));
  }

  /** 把还没翻过的名字批量翻译并缓存。失败只记录，不抛出（整理照常进行）。 */
  async ensure(names) {
    if (!this.enabled()) return 0;
    const todo = [...new Set(names.filter(n => n && !(n in this.cache)))];
    let done = 0;
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      try {
        const out = await this.request(chunk);
        chunk.forEach((n, k) => { this.cache[n] = out[k]; });
        done += chunk.length; this.lastError = ''; this.lastOk = new Date().toISOString();
      } catch (error) {
        this.lastError = (error.name === 'TimeoutError' ? '接口超时' : error.cause?.code === 'ECONNREFUSED' ? '连不上接口（网关没开？）' : error.message);
        this.log('机器翻译失败：' + this.lastError);
        break;
      }
    }
    if (done) { try { fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 1)); } catch {} }
    return done;
  }

  /** 设置页“测试”按钮：翻一个样例，不写缓存。 */
  async test(config) {
    const c = { ...this.config(), ...(config || {}) };
    if (config && typeof config.Key === 'string' && config.Key.trim()) c.KeyEnc = this.encrypt(config.Key.trim());
    const [zh] = await this.request(['shifted_path_distance_spectra'], c);
    if (!zh) throw new Error('接口能连上，但没返回中文');
    return zh;
  }
}

module.exports = { Translator, cleanZh, DEFAULTS };
