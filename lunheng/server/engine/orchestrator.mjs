// The research orchestrator: a resumable state machine that drives a team of models through
// rounds of independent analysis, cross-examination, rebuttal, independent verification and
// synthesis, recording every structured contribution in the claim ledger.
import { newId } from '../util/ids.mjs';
import { mapLimit } from '../util/semaphore.mjs';
import { truncate } from '../util/text.mjs';
import { log } from '../util/log.mjs';
import { ProviderError } from '../providers/errors.mjs';
import { parseContribution, countItems, normRef } from './protocol.mjs';
import {
  addClaim, addObjection, addResponse, addRuling, addVerdict, addEvidence, addQuestion, setStance, withdrawClaim,
  reviseClaim, recompute, consensusOf, current, CLAIM_STATUS,
} from './ledger.mjs';
import { systemPrompt, buildUserMessage, computeFollowup, FORMAT_REPAIR, PHASES, researcherLabel, kindName } from './prompts.mjs';
import { planPhase, reviewTargets } from './grouping.mjs';
import { buildReport } from './report.mjs';
import { runCompute } from './sandbox.mjs';
import { Budget } from './budget.mjs';

export const SETTINGS_DEFAULTS = {
  maxRounds: 3,
  minVerifiers: 2,
  crossVendor: true,
  anonymize: true,
  autoAdvance: true,
  temperature: 0.6,
  maxOutputTokens: 8000,
  contextChars: 30000,
  budgetUsd: 5,
  maxTotalTokens: 0,
  concurrency: 5,
  computeSandbox: true,
  formatRepair: true,
  reviewersPerClaim: 2,
  earlyStop: true,
  thinking: 'auto',
};

const FIRST_ROUND = ['independent', 'critique', 'rebuttal', 'verify', 'synthesis'];
const LATER_ROUND = ['investigate', 'critique', 'rebuttal', 'verify', 'synthesis'];
export const phasesForRound = (r) => (r <= 1 ? FIRST_ROUND : LATER_ROUND);

const MAX_FEED = 1500;
const MAX_CALLS = 3000;

export class ResearchRun {
  /**
   * @param {object} p
   * @param {object} p.session persisted session state (mutated in place)
   * @param {import('../providers/gateway.mjs').Gateway} p.gateway
   * @param {(s:object)=>Promise<void>} p.persist
   * @param {(type:string, data:any)=>void} p.emit
   * @param {object} p.account { rates, checkGlobal(usd), addSpend(usd, tokens) }
   * @param {object} p.config
   */
  constructor({ session, gateway, persist, emit, account, config }) {
    this.s = session;
    this.gateway = gateway;
    this.persistFn = persist;
    this.emitFn = emit;
    this.account = account;
    this.config = config;
    this.running = false;
    this.stopRequested = false;
    this.stepOnce = false;
    this.abortCtl = null;
    this.deltaBuf = new Map();
    this.deltaTimer = null;
    this.metaTimer = null;
    this.ledgerTimer = null;
    this.saveTimer = null;
    this.budget = new Budget({
      limitUsd: session.settings.budgetUsd,
      limitTokens: session.settings.maxTotalTokens,
      spentUsd: session.usage.costUsd,
      spentTokens: session.usage.inputTokens + session.usage.outputTokens,
      extraCheck: (usd) => account.checkGlobal?.(usd),
    });
  }

  // ───────────────────────────── events & persistence ─────────────────────────────

  emit(type, data) {
    try { this.emitFn(type, data); } catch (err) { log.warn(`emit ${type} failed: ${err.message}`); }
  }

  meta() {
    const s = this.s;
    return {
      id: s.id, title: s.title, status: s.status, pauseReason: s.pauseReason, cursor: s.cursor, plan: s.plan,
      team: s.team, chairId: s.chairId, settings: s.settings, usage: s.usage, timeline: s.timeline,
      directives: s.directives, updatedAt: s.updatedAt, hasReport: !!s.report, running: this.running,
    };
  }

  emitMeta(now = false) {
    if (now) { clearTimeout(this.metaTimer); this.metaTimer = null; this.emit('meta', this.meta()); return; }
    if (this.metaTimer) return;
    this.metaTimer = setTimeout(() => { this.metaTimer = null; this.emit('meta', this.meta()); }, 200);
  }

  emitLedger() {
    if (this.ledgerTimer) return;
    this.ledgerTimer = setTimeout(() => { this.ledgerTimer = null; this.emit('ledger', this.s.ledger); }, 150);
  }

  feed(kind, text, extra = {}) {
    const entry = { id: newId('f', 6), at: new Date().toISOString(), kind, text, round: this.s.cursor.round, phase: this.s.cursor.phase, ...extra };
    this.s.feed.push(entry);
    if (this.s.feed.length > MAX_FEED) this.s.feed.splice(0, this.s.feed.length - MAX_FEED);
    this.emit('feed', entry);
    return entry;
  }

  save(now = false) {
    this.s.updatedAt = new Date().toISOString();
    clearTimeout(this.saveTimer);
    if (now) return this.persistFn(this.s);
    this.saveTimer = setTimeout(() => { this.persistFn(this.s).catch((e) => log.error(`save failed: ${e.message}`)); }, 700);
    return Promise.resolve();
  }

  // ───────────────────────────── control surface ─────────────────────────────

  start({ step = false } = {}) {
    if (this.running) {
      this.stepOnce = step;
      return false;
    }
    if (this.s.status === 'completed' && this.s.cursor.phase === 'done') return false;
    this.stopRequested = false;
    this.stepOnce = step;
    // Work that was in flight when the process stopped (crash, restart, abort) is redone.
    if (this.s.plan?.progress) for (const [rid, v] of Object.entries(this.s.plan.progress)) if (v === 'running') this.s.plan.progress[rid] = 'pending';
    this.running = true;
    this.abortCtl = new AbortController();
    this.s.status = 'running';
    this.s.pauseReason = '';
    this.feed('system', step ? '单步推进：执行一个阶段后暂停' : '研究开始自动推进');
    this.emitMeta(true);
    this.loop().catch((err) => {
      log.error(`run ${this.s.id} crashed`, err);
      this.s.status = 'failed';
      this.s.pauseReason = `内部错误：${err.message}`;
      this.feed('error', `研究流程出错：${err.message}`);
      this.running = false;
      this.emitMeta(true);
      this.save(true);
    });
    return true;
  }

  /** Graceful pause: in-flight calls finish, no new calls start. */
  pause(reason = '用户暂停') {
    if (!this.running) return false;
    this.stopRequested = true;
    this.s.status = 'pausing';
    this.s.pauseReason = reason;
    this.feed('system', `正在暂停：${reason}（等待进行中的调用完成）`);
    this.emitMeta(true);
    return true;
  }

  /** Hard stop: abort in-flight calls. Aborted work is redone on resume. */
  abort(reason = '用户中止') {
    if (!this.running) return false;
    this.stopRequested = true;
    this.s.pauseReason = reason;
    this.abortCtl?.abort(new Error(reason));
    this.feed('system', `已中止进行中的调用：${reason}`);
    return true;
  }

  async waitIdle(timeoutMs = 30_000) {
    const t0 = Date.now();
    while (this.running && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 50));
  }

  // ───────────────────────────── main loop ─────────────────────────────

  async loop() {
    try {
      while (!this.stopRequested) {
        const phase = this.s.cursor.phase;
        if (phase === 'done') break;
        if (phase === 'report') {
          await this.runReport();
          if (this.s.report) { this.s.cursor.phase = 'done'; this.s.status = 'completed'; }
          break;
        }
        const finished = await this.runPhase(phase);
        if (!finished) break;
        this.advance();
        await this.save(true);
        if (!this.s.settings.autoAdvance || this.stepOnce) {
          this.s.pauseReason = this.stepOnce ? '单步完成' : '等待人工推进（自动推进已关闭）';
          break;
        }
      }
    } finally {
      this.running = false;
      this.flushDeltas();
      if (this.s.status !== 'completed' && this.s.status !== 'failed') {
        this.s.status = 'paused';
        if (!this.s.pauseReason) this.s.pauseReason = '已暂停';
      }
      if (this.s.status === 'completed') this.feed('system', '研究完成，报告已生成');
      else this.feed('system', `研究暂停：${this.s.pauseReason}`);
      this.emitMeta(true);
      await this.save(true);
    }
  }

  advance() {
    const c = this.s.cursor;
    const phases = phasesForRound(c.round);
    if (c.phase === 'synthesis') {
      const conclude = this.shouldConclude();
      if (conclude) {
        c.phase = 'report';
        this.feed('phase', `研究进入收尾：${conclude}`);
        return;
      }
      c.round += 1;
      c.phase = phasesForRound(c.round)[0];
      this.feed('phase', `进入第 ${c.round} 轮`);
      return;
    }
    const i = phases.indexOf(c.phase);
    c.phase = phases[i + 1] || 'synthesis';
  }

  shouldConclude() {
    const s = this.s;
    const r = s.cursor.round;
    if (r >= s.settings.maxRounds) return `已达到最大轮数 ${s.settings.maxRounds}`;
    const syn = s.syntheses[s.syntheses.length - 1];
    const c0 = s.ledger.claims.C0.status;
    const settled = ['proved', 'refuted'].includes(c0);
    const unresolved = Object.values(s.ledger.claims).filter((c) => ['pending', 'disputed'].includes(c.status) && (c.target === 'C0'));
    if (syn?.round === r && syn.decision?.value === 'conclude' && s.settings.earlyStop) {
      if (settled || r >= 2) return `主持人判断可以结束：${truncate(syn.decision.reason, 120)}`;
    }
    if (s.settings.earlyStop && settled && !unresolved.length) return `主命题已${CLAIM_STATUS[c0]}，且没有待处理的相关论证`;
    return '';
  }

  /** Run (or resume) one phase. Returns true when every task has finished. */
  async runPhase(phase) {
    const s = this.s;
    const key = `${s.cursor.round}:${phase}`;
    if (!s.plan || s.plan.key !== key) {
      this.recompute();
      const { tasks, groups, alarms = [] } = planPhase(s, phase);
      s.plan = { key, phase, round: s.cursor.round, tasks, groups, alarms, progress: Object.fromEntries(Object.keys(tasks).map((rid) => [rid, 'pending'])), startedAt: new Date().toISOString() };
      s.timeline.push({ round: s.cursor.round, phase, startedAt: s.plan.startedAt, endedAt: null, skipped: false, summary: '', groups });
      if (Object.keys(tasks).length) {
        this.feed('phase', `第 ${s.cursor.round} 轮 · ${PHASES[phase].name}：${groups.map((g) => `${g.name}（${g.members.map((m) => this.label(m)).join('、')}）`).join('；')}`);
      }
      for (const a of alarms) this.feed('alarm', `共识警报：${a.target} 获得 ${Math.round(a.agreeRatio * 100)}% 同意但尚未证明，已指派红队 ${a.members.map((m) => this.label(m)).join('、')} 尝试反驳`, { refs: [a.target] });
      this.emitMeta(true);
    }
    const tl = s.timeline[s.timeline.length - 1];
    const todo = Object.keys(s.plan.tasks).filter((rid) => ['pending', 'failed'].includes(s.plan.progress[rid]));
    if (!Object.keys(s.plan.tasks).length) {
      tl.skipped = true;
      tl.endedAt = new Date().toISOString();
      tl.summary = { rebuttal: '没有需要答辩的质疑', verify: '没有需要核验的断言或质疑', critique: '没有可审查的断言' }[phase] || '无任务';
      this.feed('phase', `第 ${s.cursor.round} 轮 · ${PHASES[phase].name}：跳过（${tl.summary}）`);
      return true;
    }
    if (todo.length) {
      await mapLimit(todo, Math.max(1, s.settings.concurrency), async (rid) => {
        if (this.stopRequested) return;
        await this.runTask(rid, s.plan.tasks[rid]);
      });
    }
    const pending = Object.values(s.plan.progress).filter((v) => v === 'pending' || v === 'running').length;
    if (pending) return false;
    const done = Object.values(s.plan.progress).filter((v) => v === 'done').length;
    const total = Object.keys(s.plan.tasks).length;
    if (!done) {
      // Every task failed: stop instead of marching on with an empty phase.
      s.pauseReason = `${PHASES[phase].name} 阶段的全部调用都失败了，请检查服务商配置后继续`;
      this.stopRequested = true;
      return false;
    }
    this.recompute();
    this.snapshotConsensus(phase);
    tl.endedAt = new Date().toISOString();
    tl.summary = this.phaseSummary(phase, done, total);
    this.feed('phase', `第 ${s.cursor.round} 轮 · ${PHASES[phase].name} 完成：${tl.summary}`);
    this.emitMeta(true);
    return true;
  }

  phaseSummary(phase, done, total) {
    const s = this.s;
    const inPhase = s.contributions.filter((c) => c.round === s.cursor.round && c.phase === phase);
    const n = (k) => inPhase.reduce((a, c) => a + (c.items?.[k]?.length || 0), 0);
    const parts = [`${done}/${total} 名研究员完成`];
    if (n('claims')) parts.push(`新断言 ${n('claims')}`);
    if (n('objections')) parts.push(`质疑 ${n('objections')}`);
    if (n('verdicts')) parts.push(`核验 ${n('verdicts')}`);
    if (n('rulings')) parts.push(`裁定 ${n('rulings')}`);
    if (n('responses')) parts.push(`答辩 ${n('responses')}`);
    parts.push(`C0：${CLAIM_STATUS[s.ledger.claims.C0.status]}`);
    return parts.join(' · ');
  }

  label(rid) {
    const r = this.s.team.find((x) => x.id === rid);
    return r ? r.label : rid === 'PI' ? 'PI' : rid;
  }

  recompute() {
    const s = this.s;
    const changes = recompute(s.ledger, {
      minVerifiers: s.settings.minVerifiers,
      crossVendor: s.settings.crossVendor,
      vendorOf: (rid) => s.team.find((r) => r.id === rid)?.vendor || '',
      labelOf: (rid) => researcherLabel(s, rid),
      round: s.cursor.round,
      phase: s.cursor.phase,
    });
    for (const ch of changes) {
      if (!ch.from && ch.to === 'open') continue;
      this.feed('status', `${ch.id} 状态：${CLAIM_STATUS[ch.from] || '新'} → ${CLAIM_STATUS[ch.to]}（${truncate(ch.reason, 140)}）`, { refs: [ch.id], status: ch.to });
    }
    this.emitLedger();
    return changes;
  }

  snapshotConsensus(phase) {
    const s = this.s;
    const active = new Set(s.team.filter((r) => r.active !== false).map((r) => r.id));
    const claims = {};
    for (const c of Object.values(s.ledger.claims)) {
      if (c.withdrawn) continue;
      const k = consensusOf(s.ledger, c.id, active);
      claims[c.id] = { a: k.agree, d: k.disagree, u: k.unsure, w: +k.weighted.toFixed(3), st: c.status };
    }
    const entry = { idx: s.consensus.length, round: s.cursor.round, phase, at: new Date().toISOString(), claims };
    s.consensus.push(entry);
    this.emit('consensus', entry);
  }

  // ───────────────────────────── one researcher, one task ─────────────────────────────

  async runTask(rid, task) {
    const s = this.s;
    const r = s.team.find((x) => x.id === rid);
    if (!r || r.active === false) { s.plan.progress[rid] = 'done'; return; }
    s.plan.progress[rid] = 'running';
    this.emitMeta();
    const round = s.cursor.round;
    const phase = s.cursor.phase;
    try {
      const contribution = await this.converse(r, task, { round, phase });
      s.plan.progress[rid] = 'done';
      if (task.type === 'synthesis') this.recordSynthesis(r, contribution);
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError({ kind: 'server', message: err.message });
      if (e.kind === 'aborted') {
        s.plan.progress[rid] = 'pending';
      } else if (e.kind === 'budget') {
        s.plan.progress[rid] = 'pending';
        if (!this.stopRequested) {
          this.stopRequested = true;
          s.pauseReason = `预算限制：${e.message}`;
          this.feed('budget', `预算不足，研究自动暂停：${e.message}`);
        }
      } else {
        s.plan.progress[rid] = 'failed';
        this.feed('error', `研究员 ${r.label}（${r.modelId}）调用失败：${e.summary}`, { rid });
        if (task.type === 'synthesis') this.recordSynthesis(r, null, e);
      }
    } finally {
      r.stats.state = 'idle';
      this.emitMeta();
      this.save();
    }
  }

  /** Main call, optional compute round-trip, optional format repair; applies parsed items to the ledger. */
  async converse(r, task, { round, phase }) {
    const s = this.s;
    const system = systemPrompt(s, r);
    const user = buildUserMessage(s, r, task);
    const contribution = {
      id: newId('ctb', 8), rid: r.id, round, phase, task: summarizeTask(task), text: '', thinking: '', at: new Date().toISOString(),
      callIds: [], followups: [], items: {}, mapping: {}, evidence: [], parseNote: '',
    };
    let messages = [{ role: 'user', content: user }];
    const first = await this.call(r, task, system, messages, { round, phase, kind: 'main' });
    contribution.callIds.push(first.callId);
    contribution.text = first.text;
    contribution.thinking = truncate(first.thinking, 40000);
    let parsed = parseContribution(first.text);
    const wantsStructure = !['report', 'consult'].includes(task.type);
    this.apply(r, parsed, contribution, { round, phase, task });

    if (s.settings.computeSandbox && parsed.computes.length && task.type !== 'synthesis' && task.type !== 'report') {
      const results = [];
      for (const c of parsed.computes.slice(0, 3)) {
        this.feed('compute', `研究员 ${r.label} 在沙箱中运行计算：${truncate(c.purpose || c.code.split('\n')[0], 80)}`, { rid: r.id });
        const res = await runCompute(c.code, { timeoutMs: this.config.sandboxTimeoutMs, memoryMb: this.config.sandboxMemoryMb });
        const target = contribution.mapping[c.target] || c.target;
        const eid = addEvidence(s.ledger, { by: r.id, purpose: c.purpose, target: s.ledger.claims[target] ? target : null, code: c.code, ...res, round, phase });
        contribution.evidence.push(eid);
        results.push({ ...res, purpose: c.purpose });
        this.feed('compute', `${eid}：${res.ok ? `运行成功（${res.durationMs} ms）${truncate(res.output.replace(/\s+/g, ' '), 100)}` : `运行失败：${truncate(res.error, 100)}`}`, { rid: r.id, refs: [eid] });
      }
      this.emitLedger();
      messages = [...messages, { role: 'assistant', content: first.text }, { role: 'user', content: computeFollowup(results) }];
      // The first answer is already in the ledger, so a failed follow-up must not re-queue the task
      // (that would apply the same claims twice); it is recorded and the task still counts as done.
      try {
        const second = await this.call(r, task, system, messages, { round, phase, kind: 'compute-followup' });
        contribution.callIds.push(second.callId);
        contribution.followups.push({ type: 'compute', text: second.text });
        const p2 = parseContribution(second.text);
        p2.computes = [];
        this.apply(r, p2, contribution, { round, phase, task });
      } catch (err) {
        contribution.parseNote = `计算后的追问未完成（${err.summary || err.message}），保留首次回答`;
        this.noteFollowupFailure(err);
      }
    } else if (s.settings.formatRepair && wantsStructure && countItems(parsed) === 0 && !parsed.summary && !parsed.computes.length) {
      messages = [...messages, { role: 'assistant', content: first.text }, { role: 'user', content: FORMAT_REPAIR }];
      try {
        const fix = await this.call(r, task, system, messages, { round, phase, kind: 'format-repair' });
        contribution.callIds.push(fix.callId);
        contribution.followups.push({ type: 'repair', text: fix.text });
        const p3 = parseContribution(fix.text);
        this.apply(r, p3, contribution, { round, phase, task });
        if (!countItems(p3) && !p3.summary) contribution.parseNote = '未能解析出结构化内容';
      } catch (err) {
        contribution.parseNote = '格式修复调用未完成';
        this.noteFollowupFailure(err);
      }
    }
    s.contributions.push(contribution);
    this.emit('contribution', contribution);
    this.recompute();
    return contribution;
  }

  /** A follow-up call failed after the main answer was applied: pause on budget, otherwise just log. */
  noteFollowupFailure(err) {
    if (err?.kind === 'budget' && !this.stopRequested) {
      this.stopRequested = true;
      this.s.pauseReason = `预算限制：${err.message}`;
      this.feed('budget', `预算不足，研究自动暂停：${err.message}`);
    } else if (err?.kind !== 'aborted') {
      this.feed('error', `追问调用失败：${err?.summary || err?.message}`);
    }
  }

  async call(r, task, system, messages, { round, phase, kind }) {
    const s = this.s;
    const rec = {
      id: newId('call', 8), rid: r.id, providerId: r.providerId, providerName: r.providerName, vendor: r.vendor, modelId: r.modelId,
      round, phase, kind, status: 'running', startedAt: new Date().toISOString(), endedAt: null,
      inputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0, latencyMs: 0, firstTokenMs: 0, retries: 0, repairs: 0, estimated: false, error: '',
    };
    s.calls.push(rec);
    if (s.calls.length > MAX_CALLS) s.calls.splice(0, s.calls.length - MAX_CALLS);
    r.stats.state = 'thinking';
    this.emit('call', rec);
    this.emitMeta();
    try {
      const res = await this.gateway.invoke({
        userId: s.userId,
        providerId: r.providerId,
        modelId: r.modelId,
        system,
        messages,
        maxTokens: r.maxOutputTokens || s.settings.maxOutputTokens,
        temperature: r.temperature ?? s.settings.temperature,
        thinking: r.thinking && r.thinking !== 'inherit' ? r.thinking : s.settings.thinking,
        signal: this.abortCtl?.signal,
        budget: this.budget,
        rates: this.account.rates,
        onDelta: (d) => {
          if (r.stats.state !== 'streaming' && d.type === 'text') { r.stats.state = 'streaming'; this.emitMeta(); }
          this.pushDelta(rec.id, r.id, d);
        },
        onRetry: (info) => {
          rec.retries = info.attempt;
          this.emit('call_retry', { callId: rec.id, rid: r.id, ...info });
          this.feed('retry', `研究员 ${r.label} 调用失败（${info.error.summary}），${Math.round(info.delayMs / 100) / 10}s 后第 ${info.attempt}/${info.maxRetries} 次重试`, { rid: r.id });
        },
      });
      Object.assign(rec, {
        status: 'ok', endedAt: new Date().toISOString(), inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens,
        reasoningTokens: res.usage.reasoningTokens || 0, costUsd: res.costUsd, latencyMs: res.latencyMs, firstTokenMs: res.firstTokenMs,
        retries: res.retries, repairs: res.repairs, estimated: res.usage.estimated, priced: res.priced, finishReason: res.finishReason, servedModel: res.servedModel,
      });
      r.stats.calls++;
      r.stats.inputTokens += res.usage.inputTokens;
      r.stats.outputTokens += res.usage.outputTokens;
      r.stats.costUsd += res.costUsd;
      s.usage.calls++;
      s.usage.inputTokens += res.usage.inputTokens;
      s.usage.outputTokens += res.usage.outputTokens;
      s.usage.reasoningTokens += res.usage.reasoningTokens || 0;
      s.usage.costUsd += res.costUsd;
      s.usage.retries += res.retries;
      if (res.usage.estimated) s.usage.estimated = true;
      if (!res.priced) s.usage.unpriced = true;
      this.account.addSpend?.(res.costUsd, res.usage.inputTokens + res.usage.outputTokens);
      return { ...res, callId: rec.id };
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError({ kind: 'server', message: err.message });
      Object.assign(rec, { status: e.kind === 'aborted' ? 'aborted' : 'error', endedAt: new Date().toISOString(), error: e.summary, errorKind: e.kind });
      if (e.kind !== 'aborted') {
        r.stats.errors++;
        r.stats.lastError = e.summary;
        s.usage.errors++;
      }
      throw e;
    } finally {
      this.flushDeltas(rec.id);
      this.emit('call', rec);
    }
  }

  pushDelta(callId, rid, d) {
    let b = this.deltaBuf.get(callId);
    if (!b) { b = { callId, rid, text: '', thinking: '' }; this.deltaBuf.set(callId, b); }
    if (d.type === 'thinking') b.thinking += d.text;
    else b.text += d.text;
    if (!this.deltaTimer) this.deltaTimer = setTimeout(() => this.flushDeltas(), 60);
  }

  flushDeltas(onlyCallId) {
    if (!onlyCallId) { clearTimeout(this.deltaTimer); this.deltaTimer = null; }
    for (const [id, b] of this.deltaBuf) {
      if (onlyCallId && id !== onlyCallId) continue;
      if (b.text || b.thinking) this.emit('delta', b);
      this.deltaBuf.delete(id);
    }
  }

  // ───────────────────────────── applying contributions ─────────────────────────────

  /** Validate and apply parsed items. Independence rules are enforced here, not trusted to the model. */
  apply(r, p, contribution, { round, phase, task }) {
    const s = this.s;
    const L = s.ledger;
    const ctx = { round, phase, at: new Date().toISOString() };
    const items = contribution.items;
    const push = (k, v) => { (items[k] ||= []).push(v); };
    const resolve = (ref) => {
      if (!ref) return null;
      const id = contribution.mapping[ref] || ref;
      return L.claims[id] ? id : null;
    };
    const lab = `研究员 ${r.label}`;

    if (phase !== 'synthesis' && task.type !== 'report') {
      const created = [];
      for (const c of p.claims) {
        const relation = c.relation || (c.kind === 'counterexample' ? 'refutes' : null);
        const target = c.target ? resolve(c.target) : null;
        const id = addClaim(L, { author: r.id, kind: c.kind, statement: c.statement, proof: c.proof, evidence: c.evidence, relation, target: target || (relation ? 'C0' : null), depends: [], confidence: c.confidence, ...ctx });
        if (!id) continue;
        contribution.mapping[c.ref] = id;
        created.push([id, c]);
        push('claims', id);
        this.feed('claim', `${lab} 提出${kindName(c.kind)} ${id}：${truncate(c.statement, 110)}`, { rid: r.id, refs: [id] });
      }
      for (const [id, c] of created) {
        L.claims[id].depends = c.depends.map(resolve).filter((d) => d && d !== id);
        if (c.target && !L.claims[id].target) L.claims[id].target = resolve(c.target);
      }
    }

    for (const st of p.stances) {
      const target = resolve(st.target);
      if (!target) continue;
      setStance(L, { by: r.id, target, position: st.position, confidence: st.confidence, reason: st.reason, ...ctx });
      push('stances', target);
    }

    for (const o of p.objections) {
      const target = resolve(o.target);
      if (!target) continue;
      if (L.claims[target].author === r.id) continue; // objections to one's own claim are made via revise/withdraw
      const id = addObjection(L, { target, author: r.id, type: o.type, severity: o.severity, content: o.content, counterexample: o.counterexample, ...ctx });
      if (!id) continue;
      push('objections', id);
      this.feed('objection', `${lab} 对 ${target} 提出${{ fatal: '致命', major: '重要', minor: '次要' }[L.objections[id].severity]}质疑 ${id}（${{ counterexample: '反例', gap: '证明缺口', error: '推理错误', ambiguity: '歧义', scope: '适用范围' }[o.type]}）：${truncate(o.content, 100)}`, { rid: r.id, refs: [id, target] });
    }

    for (const resp of p.responses) {
      const o = L.objections[resp.objection];
      if (!o) continue;
      const claim = L.claims[o.target];
      if (!claim || claim.author !== r.id) continue;
      addResponse(L, o.id, { by: r.id, action: resp.action, content: resp.content, ...ctx });
      push('responses', o.id);
      let note = { concede: '承认', rebut: '反驳', revise: '修订回应' }[resp.action];
      if (resp.action === 'revise' && (resp.revisedStatement || resp.revisedProof)) {
        const v = reviseClaim(L, claim.id, { statement: resp.revisedStatement, proof: resp.revisedProof, by: r.id, reason: `回应 ${o.id}`, ...ctx });
        if (v) note = `修订为第 ${v} 版`;
      }
      this.feed('response', `${lab} 对质疑 ${o.id}：${note}`, { rid: r.id, refs: [o.id, claim.id] });
    }

    for (const v of p.verdicts) {
      const target = resolve(v.target);
      if (!target) continue;
      if (L.claims[target].author === r.id) { contribution.parseNote = '已忽略对自己断言的核验结论（不具独立性）'; continue; }
      const id = addVerdict(L, { target, by: r.id, verdict: v.verdict, content: v.content, evidence: contribution.evidence.slice(), ...ctx });
      if (!id) continue;
      push('verdicts', id);
      this.feed('verdict', `${lab} 核验 ${target}：${{ valid: '有效 ✓', gap: '有缺口', flawed: '有错误', false: '陈述为假 ✗', unverifiable: '无法核验' }[v.verdict]}`, { rid: r.id, refs: [id, target], verdict: v.verdict });
    }

    for (const ru of p.rulings) {
      const o = L.objections[ru.objection];
      if (!o) continue;
      const claim = L.claims[o.target];
      const isObjector = o.author === r.id;
      if (claim?.author === r.id) continue; // the defended party cannot rule
      if (isObjector && ru.ruling !== 'dismissed') continue; // objector may only withdraw
      addRuling(L, o.id, { by: r.id, ruling: ru.ruling, content: ru.content, ...ctx });
      push('rulings', o.id);
      this.feed('ruling', isObjector ? `${lab} 撤回质疑 ${o.id}` : `${lab} 裁定质疑 ${o.id}：${ru.ruling === 'upheld' ? '成立' : '驳回'}`, { rid: r.id, refs: [o.id] });
    }

    for (const w of p.withdrawals) {
      const target = resolve(w.target);
      if (target && withdrawClaim(L, target, r.id, w.reason, ctx)) {
        push('withdrawals', target);
        this.feed('withdraw', `${lab} 撤回断言 ${target}`, { rid: r.id, refs: [target] });
      }
    }

    for (const q of p.questions) {
      const id = addQuestion(L, { by: r.id, text: q, ...ctx });
      if (id) push('questions', id);
    }

    if (countItems(p)) this.recompute();
  }

  recordSynthesis(r, contribution, error) {
    const s = this.s;
    let syn;
    if (contribution) {
      const all = [contribution.text, ...contribution.followups.map((f) => f.text)].join('\n');
      const p = parseContribution(all);
      syn = {
        round: s.cursor.round, by: r.id, at: new Date().toISOString(),
        summary: p.summary || truncate(contribution.text.replace(/<[^>]+>/g, ''), 2000),
        focus: p.focus.map((f) => ({ ...f, target: contribution.mapping[f.target] || f.target })).filter((f) => s.ledger.claims[f.target]),
        assignments: p.assignments.map((a) => ({ ...a, target: a.target ? contribution.mapping[a.target] || a.target : null })),
        decision: p.decision,
        auto: false,
      };
    } else {
      const focus = reviewTargets(s).slice(0, 3).map((c) => ({ target: c.id, priority: 'normal', reason: `状态：${CLAIM_STATUS[c.status]}` }));
      syn = {
        round: s.cursor.round, by: 'system', at: new Date().toISOString(),
        summary: `主持人调用失败（${error?.summary || '未知错误'}），由系统根据账本自动生成：主命题状态为「${CLAIM_STATUS[s.ledger.claims.C0.status]}」；待处理断言 ${focus.map((f) => f.target).join('、') || '无'}。`,
        focus, assignments: [], decision: { value: 'continue', reason: '系统自动规划' }, auto: true,
      };
    }
    s.syntheses.push(syn);
    this.emit('synthesis', syn);
    this.feed('synthesis', `主持人综合：${truncate(syn.summary, 160)}${syn.decision ? `（决定：${syn.decision.value === 'conclude' ? '结束研究' : '继续'}）` : ''}`, { rid: syn.by });
  }

  async runReport() {
    const s = this.s;
    const chair = s.team.find((r) => r.id === s.chairId && r.active !== false) || s.team.find((r) => r.active !== false);
    this.recompute();
    let narrative = '';
    let narrator = null;
    if (chair) {
      s.plan = { key: `${s.cursor.round}:report`, phase: 'report', round: s.cursor.round, tasks: { [chair.id]: { type: 'report' } }, groups: [{ name: '撰写报告', kind: 'report', members: [chair.id] }], alarms: [], progress: { [chair.id]: 'running' }, startedAt: new Date().toISOString() };
      this.emitMeta(true);
      try {
        const c = await this.converse(chair, { type: 'report' }, { round: s.cursor.round, phase: 'report' });
        narrative = c.text;
        narrator = chair.id;
        s.plan.progress[chair.id] = 'done';
      } catch (err) {
        s.plan.progress[chair.id] = 'failed';
        if (err.kind === 'aborted') return;
        if (err.kind === 'budget') {
          this.feed('budget', `预算不足，报告叙述部分未生成：${err.message}`);
        } else this.feed('error', `报告叙述生成失败：${err.summary || err.message}，仅输出账本章节`);
      }
    }
    s.report = { markdown: buildReport(s, narrative), narrative, by: narrator, generatedAt: new Date().toISOString() };
    s.timeline.push({ round: s.cursor.round, phase: 'report', startedAt: s.plan?.startedAt, endedAt: new Date().toISOString(), skipped: false, summary: `C0：${CLAIM_STATUS[s.ledger.claims.C0.status]}`, groups: [] });
    this.emit('report', s.report);
  }

  /** Rebuild the report from the current ledger without spending tokens. */
  rebuildReport() {
    this.recompute();
    const narrative = this.s.report?.narrative || '';
    this.s.report = { markdown: buildReport(this.s, narrative), narrative, by: this.s.report?.by || null, generatedAt: new Date().toISOString() };
    this.emit('report', this.s.report);
    this.save();
    return this.s.report;
  }

  // ───────────────────────────── human intervention ─────────────────────────────

  addDirective(text) {
    const d = { id: newId('d', 6), text: truncate(String(text).trim(), 2000), at: new Date().toISOString(), round: this.s.cursor.round, active: true };
    this.s.directives.push(d);
    this.feed('pi', `首席研究员指示：${truncate(d.text, 160)}`);
    this.emitMeta(true);
    this.save();
    return d;
  }

  setDirectiveActive(id, active) {
    const d = this.s.directives.find((x) => x.id === id);
    if (!d) return null;
    d.active = !!active;
    this.emitMeta(true);
    this.save();
    return d;
  }

  piClaim({ statement, proof, kind = 'lemma', relation = null, target = null }) {
    const L = this.s.ledger;
    const id = addClaim(L, { author: 'PI', kind, statement, proof, relation, target: target && L.claims[target] ? target : null, round: this.s.cursor.round, phase: 'pi' });
    if (!id) return null;
    this.feed('pi', `首席研究员提出${kindName(kind)} ${id}：${truncate(statement, 120)}`, { refs: [id] });
    this.recompute();
    this.save();
    return id;
  }

  piObjection({ target, content, type = 'gap', severity = 'major' }) {
    const L = this.s.ledger;
    const t = normRef(target);
    if (!L.claims[t]) return null;
    const id = addObjection(L, { target: t, author: 'PI', type, severity, content, round: this.s.cursor.round, phase: 'pi' });
    if (!id) return null;
    this.feed('pi', `首席研究员对 ${t} 提出质疑 ${id}：${truncate(content, 120)}`, { refs: [id, t] });
    this.recompute();
    this.save();
    return id;
  }

  /** Ask one researcher a direct question. Runs immediately, alongside or outside the main loop. */
  async consult(rid, question) {
    const r = this.s.team.find((x) => x.id === rid);
    if (!r) throw new ProviderError({ kind: 'config', message: '研究员不存在', retryable: false });
    const prevAbort = this.abortCtl;
    if (!this.running) this.abortCtl = new AbortController();
    this.feed('pi', `首席研究员向研究员 ${r.label} 提问：${truncate(question, 140)}`, { rid });
    try {
      const c = await this.converse(r, { type: 'consult', question: String(question).slice(0, 4000) }, { round: this.s.cursor.round, phase: 'consult' });
      return c;
    } finally {
      r.stats.state = 'idle';
      if (!this.running) this.abortCtl = prevAbort;
      this.emitMeta(true);
      this.save();
    }
  }

  /** Jump to the report phase (used by "conclude now"). */
  concludeNow() {
    if (this.running) return false;
    this.s.cursor.phase = 'report';
    this.s.plan = null;
    this.feed('pi', '首席研究员决定立即结束研究并生成报告');
    this.save();
    return true;
  }

  /** Continue a completed study for more rounds. */
  extend(rounds = 1) {
    if (this.running) return false;
    const s = this.s;
    s.settings.maxRounds = Math.max(s.settings.maxRounds, s.cursor.round) + Math.max(1, Math.min(5, rounds | 0));
    s.cursor.round += 1;
    s.cursor.phase = phasesForRound(s.cursor.round)[0];
    s.plan = null;
    if (s.status === 'completed') s.status = 'paused';
    s.pauseReason = `已追加研究轮次，最多 ${s.settings.maxRounds} 轮`;
    this.feed('pi', s.pauseReason);
    this.emitMeta(true);
    this.save();
    return true;
  }

  updateSettings(patch) {
    Object.assign(this.s.settings, patch);
    this.budget.setLimits({ limitUsd: this.s.settings.budgetUsd, limitTokens: this.s.settings.maxTotalTokens });
    this.recompute();
    this.emitMeta(true);
    this.save();
  }
}

function summarizeTask(task) {
  switch (task.type) {
    case 'critique': return { type: task.type, targets: task.targets };
    case 'rebuttal': return { type: task.type, objections: task.objections };
    case 'verify': return { type: task.type, claims: task.claims, objections: task.objections };
    case 'investigate': return { type: task.type, assignment: task.assignment, redTeam: !!task.redTeam };
    case 'consult': return { type: task.type, question: task.question };
    default: return { type: task.type };
  }
}

export function freshStats() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, errors: 0, lastError: '', state: 'idle' };
}

export { current };
