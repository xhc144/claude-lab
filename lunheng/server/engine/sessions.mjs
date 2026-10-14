// Research session manager: creation and validation, persistence, per-session event bus, runners.
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { readJson, writeJson, removePath } from '../util/json-store.mjs';
import { newId, isSafeId } from '../util/ids.mjs';
import { createLedger } from './ledger.mjs';
import { ROLE_IDS, LABELS } from './roles.mjs';
import { ResearchRun, SETTINGS_DEFAULTS, freshStats, phasesForRound } from './orchestrator.mjs';
import { ValidationError } from '../providers/store.mjs';
import { DOMAINS } from './prompts.mjs';

export const PALETTE = ['#4de8ff', '#b18cff', '#ffb547', '#ff6b9a', '#3cf0a8', '#6aa8ff', '#c6f25b', '#ff8a4c', '#f27bff', '#2fd6c4'];

const SETTING_RULES = {
  maxRounds: [1, 12, 'int'], minVerifiers: [1, 5, 'int'], temperature: [0, 2, 'num'], maxOutputTokens: [512, 128000, 'int'],
  contextChars: [4000, 400000, 'int'], budgetUsd: [0, 10000, 'num'], maxTotalTokens: [0, 1e9, 'int'], concurrency: [1, 16, 'int'],
  reviewersPerClaim: [1, 4, 'int'],
};
const BOOL_SETTINGS = ['crossVendor', 'anonymize', 'autoAdvance', 'computeSandbox', 'formatRepair', 'earlyStop'];

export function cleanSettings(input = {}, base = SETTINGS_DEFAULTS) {
  const out = { ...base };
  for (const [k, [lo, hi, type]] of Object.entries(SETTING_RULES)) {
    if (input[k] === undefined || input[k] === null || input[k] === '') continue;
    const n = Number(input[k]);
    if (!Number.isFinite(n)) throw new ValidationError(`设置项 ${k} 无效`);
    out[k] = Math.min(hi, Math.max(lo, type === 'int' ? Math.round(n) : n));
  }
  for (const k of BOOL_SETTINGS) if (input[k] !== undefined) out[k] = !!input[k];
  if (input.thinking !== undefined) out.thinking = ['auto', 'on', 'off'].includes(input.thinking) ? input.thinking : 'auto';
  return out;
}

function summaryOf(s) {
  return {
    id: s.id, title: s.title, question: s.ledger.claims.C0.versions[0].statement.slice(0, 300), domain: s.domain,
    status: s.status, pauseReason: s.pauseReason, round: s.cursor.round, phase: s.cursor.phase,
    c0: s.ledger.claims.C0.status, claims: Object.keys(s.ledger.claims).length - 1,
    team: s.team.map((r) => ({ label: r.label, modelId: r.modelId, vendor: r.vendor, color: r.color })),
    costUsd: s.usage.costUsd, tokens: s.usage.inputTokens + s.usage.outputTokens, createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}

export class SessionManager {
  constructor({ config, gateway, providers, accounts }) {
    this.config = config;
    this.gateway = gateway;
    this.providers = providers;
    this.accounts = accounts;
    this.runs = new Map(); // sessionId -> { userId, run, bus }
    this.indexCache = new Map();
  }

  #dir(userId) { return join(this.config.dataDir, 'users', userId, 'sessions'); }
  #file(userId, id) { return join(this.#dir(userId), `${id}.json`); }
  #indexFile(userId) { return join(this.#dir(userId), 'index.json'); }

  async #index(userId) {
    if (!this.indexCache.has(userId)) this.indexCache.set(userId, (await readJson(this.#indexFile(userId), null)) || { sessions: {} });
    return this.indexCache.get(userId);
  }

  async #persist(userId, session) {
    await writeJson(this.#file(userId, session.id), session);
    const idx = await this.#index(userId);
    idx.sessions[session.id] = summaryOf(session);
    await writeJson(this.#indexFile(userId), idx);
  }

  async list(userId) {
    const idx = await this.#index(userId);
    for (const [id, entry] of this.runs) {
      if (entry.userId === userId && idx.sessions[id]) idx.sessions[id] = summaryOf(entry.run.s);
    }
    return Object.values(idx.sessions).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async #validateTeam(userId, team) {
    if (!Array.isArray(team) || team.length < 3) throw new ValidationError('研究团队至少需要 3 名研究员（建议 5–10 名，来自不同厂商）');
    if (team.length > 10) throw new ValidationError('研究团队最多 10 名研究员');
    const providers = await this.providers.list(userId);
    const out = [];
    let chairSeen = false;
    for (let i = 0; i < team.length; i++) {
      const t = team[i] || {};
      const p = providers.find((x) => x.id === t.providerId);
      if (!p) throw new ValidationError(`第 ${i + 1} 名研究员的服务商不存在`);
      const modelId = String(t.modelId || '').trim();
      if (!modelId || modelId.length > 200) throw new ValidationError(`第 ${i + 1} 名研究员缺少模型 ID`);
      let role = ROLE_IDS.includes(t.role) ? t.role : 'generalist';
      if (role === 'chair') { if (chairSeen) role = 'generalist'; chairSeen = true; }
      const model = p.models.find((m) => m.id === modelId);
      out.push({
        id: `R${i + 1}`, label: LABELS[i], name: String(t.name || '').slice(0, 40),
        providerId: p.id, providerName: p.name, vendor: p.vendor, presetId: p.presetId, modelId, modelLabel: model?.label || modelId,
        role, color: PALETTE[i % PALETTE.length],
        thinking: ['auto', 'on', 'off', 'inherit'].includes(t.thinking) ? t.thinking : 'inherit',
        temperature: t.temperature === '' || t.temperature == null || !Number.isFinite(+t.temperature) ? null : Math.min(2, Math.max(0, +t.temperature)),
        active: true, stats: freshStats(),
      });
    }
    if (!chairSeen) out[0].role = 'chair';
    return out;
  }

  async create(userId, input) {
    const question = String(input.question || '').trim();
    if (question.length < 4) throw new ValidationError('请输入要研究的命题');
    if (question.length > 8000) throw new ValidationError('命题过长（最多 8000 字）');
    const team = await this.#validateTeam(userId, input.team);
    const now = new Date().toISOString();
    const session = {
      id: newId('ses', 10), userId, version: 1,
      title: String(input.title || '').trim().slice(0, 120) || question.replace(/\s+/g, ' ').slice(0, 40),
      background: String(input.background || '').trim().slice(0, 8000),
      domain: DOMAINS[input.domain] ? input.domain : 'math',
      language: input.language === 'en' ? 'en' : 'zh',
      createdAt: now, updatedAt: now,
      status: 'ready', pauseReason: '',
      settings: cleanSettings(input.settings),
      team, chairId: team.find((r) => r.role === 'chair').id,
      cursor: { round: 1, phase: phasesForRound(1)[0] },
      plan: null,
      ledger: createLedger(question, now),
      contributions: [], syntheses: [], directives: [], consensus: [], timeline: [], calls: [], feed: [],
      usage: { calls: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0, estimated: false, unpriced: false, errors: 0, retries: 0 },
      report: null,
    };
    if (new Set(team.map((r) => r.vendor)).size < Math.min(3, team.length)) {
      session.feed.push({ id: newId('f', 6), at: now, kind: 'system', text: '提示：团队成员来自的厂商少于 3 家，独立性与观点多样性可能不足。', round: 1, phase: 'setup' });
    }
    await this.#persist(userId, session);
    return session;
  }

  /** Load (or get the live) runner for a session owned by userId. */
  async open(userId, id) {
    if (!isSafeId(id)) return null;
    const live = this.runs.get(id);
    if (live) return live.userId === userId ? live : null;
    const session = await readJson(this.#file(userId, id), null);
    if (!session || session.userId !== userId) return null;
    if (['running', 'pausing'].includes(session.status)) {
      session.status = 'paused';
      session.pauseReason = '服务器重启后研究已暂停，可随时继续';
    }
    const bus = new EventEmitter();
    bus.setMaxListeners(100);
    const account = await this.accounts.accountFor(userId);
    const run = new ResearchRun({
      session,
      gateway: this.gateway,
      config: this.config,
      account,
      persist: (s) => this.#persist(userId, s),
      emit: (type, data) => bus.emit('event', { type, data }),
    });
    const entry = { userId, run, bus };
    this.runs.set(id, entry);
    return entry;
  }

  async remove(userId, id) {
    const entry = await this.open(userId, id);
    if (!entry) return false;
    entry.run.abort('研究被删除');
    await entry.run.waitIdle(10_000);
    this.runs.delete(id);
    await removePath(this.#file(userId, id));
    const idx = await this.#index(userId);
    delete idx.sessions[id];
    await writeJson(this.#indexFile(userId), idx);
    return true;
  }

  /** Copy a session's question, team and settings into a fresh study. */
  async duplicate(userId, id) {
    const entry = await this.open(userId, id);
    if (!entry) return null;
    const s = entry.run.s;
    return this.create(userId, {
      title: `${s.title}（副本）`, question: s.ledger.claims.C0.versions[0].statement, background: s.background, domain: s.domain, language: s.language,
      team: s.team.map((r) => ({ providerId: r.providerId, modelId: r.modelId, role: r.role, thinking: r.thinking, temperature: r.temperature, name: r.name })),
      settings: s.settings,
    });
  }

  /** Edit the team while the study is not running. */
  async updateTeam(userId, id, changes) {
    const entry = await this.open(userId, id);
    if (!entry) return null;
    const { run } = entry;
    if (run.running) throw new ValidationError('请先暂停研究再调整团队');
    const s = run.s;
    const providers = await this.providers.list(userId);
    for (const ch of changes.update || []) {
      const r = s.team.find((x) => x.id === ch.id);
      if (!r) continue;
      if (ch.role && ROLE_IDS.includes(ch.role)) {
        if (ch.role === 'chair') { for (const x of s.team) if (x.role === 'chair') x.role = 'generalist'; s.chairId = r.id; }
        r.role = ch.role;
      }
      if (ch.active !== undefined) r.active = !!ch.active;
      if (ch.thinking && ['auto', 'on', 'off', 'inherit'].includes(ch.thinking)) r.thinking = ch.thinking;
      if (ch.temperature !== undefined) r.temperature = ch.temperature === null || ch.temperature === '' ? null : Math.min(2, Math.max(0, +ch.temperature));
      if (ch.providerId || ch.modelId) {
        const p = providers.find((x) => x.id === (ch.providerId || r.providerId));
        if (!p) throw new ValidationError('服务商不存在');
        r.providerId = p.id; r.providerName = p.name; r.vendor = p.vendor; r.presetId = p.presetId;
        if (ch.modelId) { r.modelId = String(ch.modelId).trim(); r.modelLabel = p.models.find((m) => m.id === r.modelId)?.label || r.modelId; }
      }
    }
    for (const add of changes.add || []) {
      if (s.team.length >= 10) throw new ValidationError('研究团队最多 10 名研究员');
      const p = providers.find((x) => x.id === add.providerId);
      if (!p || !add.modelId) throw new ValidationError('新研究员需要有效的服务商与模型');
      const i = s.team.length;
      s.team.push({
        id: `R${i + 1}`, label: LABELS[i], name: '', providerId: p.id, providerName: p.name, vendor: p.vendor, presetId: p.presetId,
        modelId: String(add.modelId).trim(), modelLabel: p.models.find((m) => m.id === add.modelId)?.label || add.modelId,
        role: ROLE_IDS.includes(add.role) && add.role !== 'chair' ? add.role : 'generalist', color: PALETTE[i % PALETTE.length],
        thinking: 'inherit', temperature: null, active: true, stats: freshStats(),
      });
      run.feed('pi', `研究员 ${LABELS[i]}（${add.modelId}）加入团队`);
    }
    if (s.team.filter((r) => r.active !== false).length < 2) throw new ValidationError('至少保留 2 名在任研究员');
    if (!s.team.some((r) => r.id === s.chairId && r.active !== false)) {
      const next = s.team.find((r) => r.active !== false);
      for (const x of s.team) if (x.role === 'chair') x.role = 'generalist';
      next.role = 'chair';
      s.chairId = next.id;
    }
    s.plan = s.plan && Object.values(s.plan.progress).every((v) => v === 'pending') ? null : s.plan;
    run.emitMeta(true);
    await run.save(true);
    return s;
  }

  subscribe(id, listener) {
    const entry = this.runs.get(id);
    if (!entry) return () => {};
    entry.bus.on('event', listener);
    return () => entry.bus.off('event', listener);
  }

  /** Pause everything and flush to disk (SIGINT/SIGTERM). */
  async shutdown() {
    const all = [...this.runs.values()];
    for (const { run } of all) if (run.running) run.abort('服务器关闭');
    await Promise.all(all.map(({ run }) => run.waitIdle(8000)));
    await Promise.all(all.map(({ run }) => run.save(true).catch(() => {})));
  }
}
