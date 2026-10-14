import { useEffect, useMemo, useState } from 'react';
import type { AiAnalysis, AssessmentResult, HistoryEntry, WeakStats } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { fmtDate, fmtTime, rate, MODE_LABEL } from '../lib/format.ts';
import { ResultView } from '../components/ResultView.tsx';
import { TrendChart } from '../components/Charts.tsx';
import { Modal, Seg, Empty, Spinner } from '../components/ui.tsx';
import { IconChevronL, IconSearch, IconStar, IconTrash, IconCompare, IconMic, IconHistory } from '../components/icons.tsx';

export function History() {
  const { route, go, historyVersion, toast, startPractice } = useApp();
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [stats, setStats] = useState<WeakStats | null>(null);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'all' | 'word' | 'sentence' | 'passage' | 'fav'>('all');
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const load = () => {
    api.listRecords().then(setList).catch((e) => toast(e.message, 'error'));
    api.stats().then(setStats).catch(() => undefined);
  };
  useEffect(load, [historyVersion]);

  const filtered = useMemo(() => (list ?? []).filter((e) => (mode === 'all' || (mode === 'fav' ? e.favorite : e.mode === mode)) && (!q || e.text.toLowerCase().includes(q.toLowerCase()))), [list, q, mode]);

  if (route.recordId) return <RecordDetail id={route.recordId} onBack={() => go({ page: 'history' })} onChanged={load} />;

  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>历史记录</h1>
          <p>{stats ? `共 ${stats.totalRecords} 次练习 · 累计录音 ${stats.totalMinutes} 分钟` : '…'}</p>
        </div>
        <div className="actions">
          {compare.length === 2 && <button className="btn primary" onClick={() => setShowCompare(true)}><IconCompare />对比所选两次</button>}
        </div>
      </div>
      <div className="col" style={{ gap: 16 }}>
        <div className="card pad">
          <div className="card-title">进步趋势 <span className="sub">每日平均分</span></div>
          <TrendChart data={stats?.trend ?? []} />
        </div>
        <div className="card">
          <div className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ position: 'relative', width: 300 }}>
              <IconSearch style={{ position: 'absolute', left: 10, width: 16, height: 16, color: 'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="搜索朗读内容" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Seg value={mode} onChange={setMode} options={[{ value: 'all', label: '全部' }, { value: 'word', label: '单词' }, { value: 'sentence', label: '句子' }, { value: 'passage', label: '文章' }, { value: 'fav', label: '收藏' }]} />
            <span className="small muted right">勾选两条记录可对比</span>
          </div>
          {list === null ? <div className="center" style={{ padding: 40 }}><Spinner /></div> : filtered.length === 0 ? (
            <Empty icon={<IconHistory />}>{list.length ? '没有匹配的记录' : '还没有练习记录，去“朗读练习”录第一段吧'}</Empty>
          ) : (
            <div>
              {filtered.map((e) => {
                const r = rate(e.scores.overall);
                return (
                  <div key={e.id} className="hist-item" onClick={() => go({ page: 'history', recordId: e.id })}>
                    <div className={`sc bg-${r}`} style={{ color: `var(--${r})` }}>{e.scores.overall}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="txt" style={{ fontWeight: 550 }}>{e.text}</div>
                      <div className="small muted row" style={{ gap: 10 }}>
                        <span>{fmtDate(e.createdAt)}</span>
                        <span>{MODE_LABEL[e.mode]}</span>
                        <span>{e.accent === 'us' ? '美音' : '英音'}</span>
                        <span>{fmtTime(e.durationSec)}</span>
                        <span>准确 {e.scores.accuracy} · 流利 {e.scores.fluency} · 韵律 {e.scores.prosody}</span>
                        {e.aiCount ? <span className="chip accent">AI ×{e.aiCount}</span> : null}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4 }} onClick={(ev) => ev.stopPropagation()}>
                      <label className="row tiny muted" style={{ gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={compare.includes(e.id)} onChange={() => toggleCompare(e.id)} />对比</label>
                      <button className="btn sm ghost icon" title="再练一次" onClick={() => startPractice(e.text, e.materialId)}><IconMic /></button>
                      <button className={`btn sm ghost icon`} title="收藏" style={{ color: e.favorite ? 'var(--fair)' : undefined }} onClick={async () => { await api.favorite(e.id, !e.favorite); load(); }}><IconStar fill={e.favorite ? 'currentColor' : 'none'} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {showCompare && compare.length === 2 && <CompareModal ids={compare} onClose={() => setShowCompare(false)} />}
    </div>
  );
}

function RecordDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { toast, startPractice } = useApp();
  const [data, setData] = useState<{ entry: HistoryEntry; result: AssessmentResult; ai: AiAnalysis[]; audioUrl: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    api.getRecord(id).then(setData).catch((e) => { toast(e.message, 'error'); onBack(); });
  }, [id]);
  if (!data) return <div className="page center"><Spinner /></div>;
  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost icon" onClick={onBack}><IconChevronL /></button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20 }}>{fmtDate(data.entry.createdAt)} 的练习</h1>
          <p className="txt" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 700 }}>{data.result.text}</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => startPractice(data.result.text, data.entry.materialId)}><IconMic />再练一次</button>
          <button className="btn danger" onClick={() => setConfirm(true)}><IconTrash />删除</button>
        </div>
      </div>
      <ResultView recordId={id} result={data.result} audioUrl={data.audioUrl} ai={data.ai} />
      {confirm && (
        <Modal title="删除这条记录？" onClose={() => setConfirm(false)} footer={<><button className="btn" onClick={() => setConfirm(false)}>取消</button><button className="btn primary" style={{ background: 'var(--poor)' }} onClick={async () => { await api.deleteRecord(id); onChanged(); onBack(); }}>删除</button></>}>
          录音、评测结果和 AI 分析都会从本地删除，无法恢复。
        </Modal>
      )}
    </div>
  );
}

function CompareModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [recs, setRecs] = useState<Array<{ entry: HistoryEntry; result: AssessmentResult }>>([]);
  useEffect(() => {
    Promise.all(ids.map((i) => api.getRecord(i))).then((r) => setRecs(r.sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt))));
  }, [ids]);
  if (recs.length < 2) return <Modal title="对比" onClose={onClose}><Spinner /></Modal>;
  const [a, b] = recs;
  const keys: Array<[keyof AssessmentResult['scores'], string]> = [['overall', '总分'], ['accuracy', '准确度'], ['fluency', '流利度'], ['completeness', '完整度'], ['prosody', '韵律'], ['stress', '单词重音'], ['intonation', '句尾语调']];
  const same = a.result.text === b.result.text;
  return (
    <Modal title="两次练习对比" onClose={onClose} wide>
      <table className="tbl">
        <thead><tr><th>指标</th><th>{fmtDate(a.entry.createdAt)}</th><th>{fmtDate(b.entry.createdAt)}</th><th>变化</th></tr></thead>
        <tbody>
          {keys.map(([k, l]) => {
            const va = a.result.scores[k];
            const vb = b.result.scores[k];
            const d = va !== null && vb !== null ? (vb as number) - (va as number) : null;
            return <tr key={k}><td>{l}</td><td>{va ?? '—'}</td><td>{vb ?? '—'}</td><td style={{ color: d === null ? undefined : d >= 0 ? 'var(--good)' : 'var(--poor)', fontWeight: 600 }}>{d === null ? '—' : `${d >= 0 ? '+' : ''}${d}`}</td></tr>;
          })}
          <tr><td>语速（词/分）</td><td>{a.result.fluency.wordsPerMinute}</td><td>{b.result.fluency.wordsPerMinute}</td><td>{b.result.fluency.wordsPerMinute - a.result.fluency.wordsPerMinute}</td></tr>
          <tr><td>不自然停顿</td><td>{a.result.fluency.disfluentPauseCount}</td><td>{b.result.fluency.disfluentPauseCount}</td><td>{b.result.fluency.disfluentPauseCount - a.result.fluency.disfluentPauseCount}</td></tr>
        </tbody>
      </table>
      {same ? (
        <>
          <div className="card-title" style={{ marginTop: 18 }}>逐词变化</div>
          <div className="annot" style={{ fontSize: 16 }}>
            {a.result.words.map((w, i) => {
              const wb = b.result.words[i];
              const d = wb ? wb.score - w.score : 0;
              return (
                <span key={i} className={`w ${rate(wb?.score ?? 0, wb?.skipped)}`} title={`${w.score} → ${wb?.score}`}>
                  {w.text}
                  <span className="sc" style={{ color: d > 4 ? 'var(--good)' : d < -4 ? 'var(--poor)' : 'var(--text-3)' }}>{d > 0 ? '+' : ''}{d}</span>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div className="notice" style={{ marginTop: 14 }}>两次练习的朗读内容不同，仅对比总体指标。</div>
      )}
    </Modal>
  );
}
