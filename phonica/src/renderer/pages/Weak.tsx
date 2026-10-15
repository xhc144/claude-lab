import { useEffect, useMemo, useState } from 'react';
import type { WeakStats } from '../../shared/types.ts';
import { PHONES } from '../../engine/phones.ts';
import { PHONE_DRILLS, BUILTIN_MATERIALS } from '../../shared/materials.ts';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { fmtDate } from '../lib/format.ts';
import { Modal, Empty, Spinner, Seg } from '../components/ui.tsx';
import { IconMic, IconTarget, IconVolume } from '../components/icons.tsx';
import { player } from '../lib/audio.ts';

function patternText(p: string): string {
  const [e, h] = p.split('>');
  const ipa = (a: string) => PHONES[a]?.ipaUS ?? a.toLowerCase();
  if (!e) return '';
  if (!h) return `/${ipa(e)}/`;
  if (h === 'deletion') return `/${ipa(e)}/ 漏读`;
  if (h === 'distortion') return `/${ipa(e)}/ 不准`;
  return `/${ipa(e)}/ → /${ipa(h)}/`;
}

export function Weak() {
  const { historyVersion, startPractice, settings } = useApp();
  const [stats, setStats] = useState<WeakStats | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  const [kind, setKind] = useState<'all' | 'vowel' | 'consonant'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { api.stats().then(setStats).catch(() => undefined); }, [historyVersion]);

  const phones = useMemo(() => (stats?.phones ?? []).filter((p) => p.total >= 3 && (kind === 'all' || PHONES[p.arpa]?.kind === kind)), [stats, kind]);
  if (!stats) return <div className="page center"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>薄弱项</h1>
          <p>根据全部练习记录自动统计经常读错的音素和单词</p>
        </div>
      </div>
      {stats.totalRecords === 0 ? (
        <Empty icon={<IconTarget />}>完成几次朗读练习后，这里会自动整理你的薄弱音素和单词，并生成专项练习。</Empty>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          <div className="card pad">
            <div className="card-title">音素错误率 <span className="sub">出现 ≥3 次的音素，按错误率排序，点击进行专项练习</span>
              <div className="right"><Seg value={kind} onChange={setKind} options={[{ value: 'all', label: '全部' }, { value: 'vowel', label: '元音' }, { value: 'consonant', label: '辅音' }]} /></div>
            </div>
            {phones.length === 0 ? <div className="empty small">数据还不够，再多练几次吧</div> : (
              <div className="mat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                {phones.map((p) => {
                  const pct = Math.round(p.rate * 100);
                  const c = pct >= 30 ? 'var(--poor)' : pct >= 12 ? 'var(--fair)' : 'var(--good)';
                  return (
                    <div key={p.arpa} className="card phone-card" onClick={() => setDrill(p.arpa)}>
                      <div className="big ipa">/{PHONES[p.arpa]?.ipaUS ?? p.arpa}/</div>
                      <div style={{ fontWeight: 650, color: c, fontSize: 18 }}>{pct}%</div>
                      <div className="tiny muted">错误率 · 均分 {p.avg} · {p.total} 次</div>
                      <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${Math.max(3, pct)}%`, background: c }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card pad">
            <div className="card-title">经常读错的单词 <span className="sub">得分低于 70 的单词，按出现次数排序</span>
              <div className="right">
                <button className="btn sm primary" disabled={!picked.length} onClick={() => startPractice(picked.join(', '), undefined, '我的薄弱单词')}><IconMic />练习所选 {picked.length || ''}</button>
                <button className="btn sm" disabled={!stats.words.length} onClick={() => startPractice(stats.words.slice(0, 10).map((w) => w.word).join(', '), undefined, '最常读错的 10 个单词')}>练习前 10 个</button>
              </div>
            </div>
            {stats.words.length === 0 ? <div className="empty small">暂时没有反复读错的单词</div> : (
              <div style={{ maxHeight: 460, overflow: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th></th><th>单词</th><th>次数</th><th>平均分</th><th>主要问题</th><th>最近</th><th></th></tr></thead>
                  <tbody>
                    {stats.words.map((w) => (
                      <tr key={w.word}>
                        <td><input type="checkbox" checked={picked.includes(w.word)} onChange={() => setPicked((p) => (p.includes(w.word) ? p.filter((x) => x !== w.word) : [...p, w.word]))} /></td>
                        <td style={{ fontWeight: 600 }}>{w.word}</td>
                        <td>{w.count}</td>
                        <td style={{ color: w.avg < 50 ? 'var(--poor)' : 'var(--fair)', fontWeight: 600 }}>{w.avg}</td>
                        <td className="ipa">{patternText(w.pattern)}</td>
                        <td className="muted small">{fmtDate(w.lastSeen)}</td>
                        <td>
                          <button className="btn sm ghost icon" title="标准发音" onClick={() => settings && api.tts(w.word, settings.accent === 'us' ? settings.voiceUS : settings.voiceUK, 0.9).then((r) => player.play(r.url, { tag: 'tts-word' }))}><IconVolume /></button>
                          <button className="btn sm ghost icon" title="练习" onClick={() => startPractice(w.word, undefined, `单词：${w.word}`)}><IconMic /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {drill && <DrillModal arpa={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function DrillModal({ arpa, onClose }: { arpa: string; onClose: () => void }) {
  const { startPractice, settings } = useApp();
  const info = PHONES[arpa];
  const d = PHONE_DRILLS[arpa];
  const pairs = d?.pairs ? BUILTIN_MATERIALS.find((m) => m.id === d.pairs) : null;
  const voice = settings?.accent === 'uk' ? settings.voiceUK : settings?.voiceUS ?? 'af_heart';
  const say = (t: string) => api.tts(t, voice, 0.85).then((r) => player.play(r.url, { tag: 'tts-word' })).catch(() => undefined);
  return (
    <Modal title={<span>专项练习 <span className="ipa">/{info?.ipaUS}/</span> · {info?.nameZh}</span>} onClose={onClose}>
      <div className="col" style={{ gap: 14 }}>
        <div className="notice" style={{ lineHeight: 1.8 }}>{info?.tip}</div>
        {d && (
          <>
            <div>
              <div className="card-title">练习单词</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {d.words.map((w) => <button key={w} className="btn sm" onClick={() => say(w)}><IconVolume />{w}</button>)}
              </div>
            </div>
            <div>
              <div className="card-title">练习句子</div>
              <div className="row"><span style={{ fontSize: 16 }}>{d.sentence}</span><button className="btn sm ghost icon" onClick={() => say(d.sentence)}><IconVolume /></button></div>
            </div>
          </>
        )}
        <div className="row wrap" style={{ gap: 8 }}>
          {d && <button className="btn primary" onClick={() => { onClose(); startPractice(d.words.join(', '), undefined, `/${info?.ipaUS}/ 单词练习`); }}><IconMic />练习单词</button>}
          {d && <button className="btn" onClick={() => { onClose(); startPractice(d.sentence, undefined, `/${info?.ipaUS}/ 句子练习`); }}><IconMic />练习句子</button>}
          {pairs && <button className="btn" onClick={() => { onClose(); startPractice(pairs.text, pairs.id, pairs.title); }}><IconMic />最小对立词：{pairs.title}</button>}
        </div>
      </div>
    </Modal>
  );
}
