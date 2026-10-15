// User accounts, per-user settings and cumulative spend.
import { join } from 'node:path';
import { readJson, writeJson, removePath } from './util/json-store.mjs';
import { newId } from './util/ids.mjs';
import { hashPassword, verifyPassword, validatePassword } from './security/passwords.mjs';
import { ProviderError } from './providers/errors.mjs';
import { ValidationError } from './providers/store.mjs';

const DEFAULT_SETTINGS = { currency: 'USD', cnyPerUsd: 7.1, globalBudgetUsd: 0 };

export class UserStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.file = join(dataDir, 'users.json');
    this.data = null;
    this.usage = new Map();
  }

  async load() {
    this.data = (await readJson(this.file, null)) || { users: [] };
    return this;
  }

  async #save() { await writeJson(this.file, this.data); }

  count() { return this.data.users.length; }

  publicUser(u) {
    return u ? { id: u.id, username: u.username, createdAt: u.createdAt, settings: { ...DEFAULT_SETTINGS, ...u.settings } } : null;
  }

  getById(id) { return this.data.users.find((u) => u.id === id) || null; }

  async create(username, password) {
    const name = String(username || '').trim();
    if (!/^[\p{L}\p{N}_.-]{2,32}$/u.test(name)) throw new ValidationError('用户名需为 2–32 位字母、数字、下划线、点或连字符');
    const pwErr = validatePassword(password);
    if (pwErr) throw new ValidationError(pwErr);
    if (this.data.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) throw new ValidationError('用户名已被占用');
    const user = { id: newId('usr', 10), username: name, password: await hashPassword(password), createdAt: new Date().toISOString(), settings: { ...DEFAULT_SETTINGS } };
    this.data.users.push(user);
    await this.#save();
    return user;
  }

  async authenticate(username, password) {
    const u = this.data.users.find((x) => x.username.toLowerCase() === String(username || '').trim().toLowerCase());
    // Hash even when the user does not exist so response time does not reveal valid usernames.
    if (!u) { await verifyPassword(password, DUMMY); return null; }
    return (await verifyPassword(password, u.password)) ? u : null;
  }

  async changePassword(id, oldPw, newPw) {
    const u = this.getById(id);
    if (!u || !(await verifyPassword(oldPw, u.password))) throw new ValidationError('当前密码不正确');
    const err = validatePassword(newPw);
    if (err) throw new ValidationError(err);
    u.password = await hashPassword(newPw);
    await this.#save();
  }

  async updateSettings(id, patch) {
    const u = this.getById(id);
    if (!u) return null;
    const s = { ...DEFAULT_SETTINGS, ...u.settings };
    if (patch.currency !== undefined) s.currency = patch.currency === 'CNY' ? 'CNY' : 'USD';
    if (patch.cnyPerUsd !== undefined) {
      const r = Number(patch.cnyPerUsd);
      if (!(r > 0 && r < 100)) throw new ValidationError('汇率无效');
      s.cnyPerUsd = r;
    }
    if (patch.globalBudgetUsd !== undefined) {
      const b = Number(patch.globalBudgetUsd);
      if (!(b >= 0 && b < 1e6)) throw new ValidationError('总预算无效');
      s.globalBudgetUsd = b;
    }
    u.settings = s;
    await this.#save();
    return this.publicUser(u);
  }

  #usageFile(id) { return join(this.dataDir, 'users', id, 'usage.json'); }

  async getUsage(id) {
    if (!this.usage.has(id)) this.usage.set(id, (await readJson(this.#usageFile(id), null)) || { totalUsd: 0, totalTokens: 0, byDay: {} });
    return this.usage.get(id);
  }

  /** Spend hooks handed to each research run. Rates are read live so currency changes apply at once. */
  async accountFor(id) {
    const usage = await this.getUsage(id);
    const self = this;
    return {
      get rates() {
        const u = self.getById(id);
        return { USD: 1, CNY: u?.settings?.cnyPerUsd || DEFAULT_SETTINGS.cnyPerUsd };
      },
      checkGlobal(usd) {
        const cap = self.getById(id)?.settings?.globalBudgetUsd || 0;
        if (cap > 0 && usage.totalUsd + usd > cap) {
          throw new ProviderError({ kind: 'budget', retryable: false, message: `账户总预算 $${cap} 将被超出（已用 $${usage.totalUsd.toFixed(4)}）` });
        }
      },
      addSpend(usd, tokens) {
        usage.totalUsd += usd || 0;
        usage.totalTokens += tokens || 0;
        const day = new Date().toISOString().slice(0, 10);
        usage.byDay[day] = (usage.byDay[day] || 0) + (usd || 0);
        writeJson(self.#usageFile(id), usage).catch(() => {});
      },
    };
  }

  async deleteUser(id) {
    this.data.users = this.data.users.filter((u) => u.id !== id);
    await this.#save();
    await removePath(join(this.dataDir, 'users', id));
  }
}

const DUMMY = { alg: 'scrypt', N: 1 << 15, r: 8, p: 1, salt: 'AAAAAAAAAAAAAAAAAAAAAA==', hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
