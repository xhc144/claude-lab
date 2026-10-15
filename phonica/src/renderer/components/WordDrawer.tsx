// Word detail: IPA (US/UK) with standard pronunciation, the learner's own clip,
// phone-by-phone scores with explanations, stress pattern and notes.
import { useEffect, useState } from 'react';
import type { AssessmentResult, WordResult } from '../../shared/types.ts';
import { Drawer } from './ui.tsx';
import { IconPlay, IconLoop, IconVolume, IconSlow, IconMic } from './icons.tsx';
import { api } from '../lib/api.ts';
import { player } from '../lib/audio.ts';
import { phoneRate, rate } from '../lib/format.ts';
import { useApp } from '../lib/store.tsx';

const ERR: Record<string, string> = { substitution: '读成了别的音', deletion: '漏读 / 过弱', distortion: '发音不准确', insertion: '多余的音' };

export function WordDrawer({ result, word, audioUrl, tag, onClose, onNav, refWords, refUrl }: { result: AssessmentResult; word: WordResult; audioUrl: string; tag: string; onClose: () => void; onNav: (d: number) => void; refWords?: Array<{ text: string; start: number; end: number }>; refUrl?: string }) {
  const { settings, toast, startPractice } = useApp();
  const [loop, setLoop] = useState(false);
  const [busy, setBusy] = useState('');
  const r = rate(word.score, word.skipped);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNav(1);
      if (e.key === 'ArrowLeft') onNav(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onNav]);

  const playMine = (rate = 1) => {
    if (word.skipped) return;
    void player.play(audioUrl, { tag: `${tag}:w${word.index}`, start: Math.max(0, word.start - 0.04), end: word.end + 0.06, rate, loop });
  };
  const playTts = async (accent: 'us' | 'uk', speed: number) => {
    if (!settings) return;
    setBusy(`${accent}${speed}`);
    try {
      const voice = accent === 'us' ? settings.voiceUS : settings.voiceUK;
      const t = await api.tts(word.spoken, voice, speed);
      await player.play(t.url, { tag: 'tts-word', loop });
    } catch (e) {
      toast(`标准发音生成失败：${(e as Error).message}`, 'error');
    } finally {
      setBusy('');
    }
  };
  const refSeg = refWords?.find((w, i) => w.text.toLowerCase() === word.text.toLowerCase() && refWords.slice(0, i).filter((x) => x.text.toLowerCase() === word.text.toLowerCase()).length === result.words.slice(0, word.index).filter((x) => x.text.toLowerCase() === word.text.toLowerCase()).length);

  return (
    <Drawer
      onClose={onClose}
      title={
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 650, fontFamily: 'var(--font-display)' }}>{word.text}</span>
          <span className={`chip ${r === 'missing' ? '' : r}`}>{word.skipped ? '未读' : `${word.score} 分`}</span>
        </div>
      }
      actions={
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm ghost" onClick={() => onNav(-1)} disabled={word.index === 0}>上一个</button>
          <button className="btn sm ghost" onClick={() => onNav(1)} disabled={word.index === result.words.length - 1}>下一个</button>
        </div>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <div className="card pad">
          <div className="grid2">
            {(['us', 'uk'] as const).map((a) => (
              <div key={a}>
                <div className="tiny muted">{a === 'us' ? '美音' : '英音'}{result.accent === a ? '（目标）' : ''}</div>
                <div className="ipa" style={{ fontSize: 20, margin: '2px 0 6px' }}>/{a === 'us' ? word.ipaUS : word.ipaUK}/</div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" disabled={!!busy} onClick={() => playTts(a, 1)}><IconVolume />{busy === `${a}1` ? '生成中' : '标准'}</button>
                  <button className="btn sm" disabled={!!busy} onClick={() => playTts(a, 0.7)} title="慢速"><IconSlow />慢速</button>
                </div>
              </div>
            ))}
          </div>
          <div className="divider" />
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn sm primary" disabled={word.skipped} onClick={() => playMine(1)}><IconPlay />我的发音</button>
            <button className="btn sm" disabled={word.skipped} onClick={() => playMine(0.6)}><IconSlow />慢放</button>
            {refSeg && refUrl && <button className="btn sm" onClick={() => player.play(refUrl, { tag: 'tts-ref-word', start: Math.max(0, refSeg.start - 0.03), end: refSeg.end + 0.05, loop })}><IconVolume />句中标准读法</button>}
            <button className={`btn sm ${loop ? 'active' : ''}`} onClick={() => setLoop(!loop)} title="循环播放"><IconLoop />循环</button>
            <button className="btn sm ghost right" onClick={() => startPractice(word.spoken, undefined, `单词：${word.spoken}`)}><IconMic />单独练习</button>
          </div>
          {!word.skipped && <div className="tiny muted" style={{ marginTop: 8 }}>录音位置 {word.start.toFixed(2)}–{word.end.toFixed(2)} 秒{word.heard ? <> · 识别到的实际读音 <span className="ipa">/{word.heard}/</span></> : null}</div>}
        </div>

        <div>
          <div className="card-title">音素评分 <span className="sub">≥80 良好 · 60–79 一般 · &lt;60 错误</span></div>
          <div className="phones">
            {word.phones.map((p, i) => {
              const pr = p.rating === 'missing' ? 'missing' : phoneRate(p.score);
              return (
                <div key={i} className={`phone ${pr}`} title={`${p.arpa} · ${p.start >= 0 ? `${p.start.toFixed(2)}–${p.end.toFixed(2)} s` : '未检测到'}`} style={{ cursor: p.start >= 0 ? 'pointer' : 'default' }} onClick={() => p.start >= 0 && player.play(audioUrl, { tag: `${tag}:p`, start: Math.max(0, p.start - 0.02), end: p.end + 0.02, rate: 0.75 })}>
                  <div className="p">{p.ipa}</div>
                  <div className="s">{p.rating === 'missing' ? '缺失' : p.score}</div>
                  {p.error?.heardIpa && <div className="h" title={p.error.confirmed ? '两个独立的声学模型都听成这个音' : '最可能的实际发音'}>像 /{p.error.heardIpa}/</div>}
                </div>
              );
            })}
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>点击音素可单独慢放该段录音。</div>
        </div>

        {word.phones.some((p) => p.error) && (
          <div className="col" style={{ gap: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>纠正建议</div>
            {word.phones.filter((p) => p.error).map((p, i) => (
              <div key={i} className="card pad" style={{ padding: '12px 14px' }}>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="ipa" style={{ fontSize: 18 }}>/{p.ipa}/</span>
                  {p.error!.heardIpa && <><span className="muted">→</span><span className="ipa" style={{ fontSize: 18, color: 'var(--poor)' }}>/{p.error!.heardIpa}/</span></>}
                  <span className={`chip ${p.score < 60 ? 'poor' : 'fair'}`}>{ERR[p.error!.type]}</span>
                  <span className="tiny muted right">{p.score} 分</span>
                </div>
                <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>{p.error!.advice}</div>
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  声学证据：LPR {p.gop.lpr}，帧一致率 {Math.round(p.gop.frameAcc * 100)}%{p.gop.ctc !== undefined ? `，CTC-GOP ${p.gop.ctc}` : ''}{p.closest ? `，最接近 /${p.closest.ipa}/` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {word.stress && (
          <div>
            <div className="card-title">重音 <span className={`chip ${word.stress.correct ? 'good' : 'fair'}`}>{word.stress.correct ? '位置正确' : `可能读错，应重读第 ${word.stress.expected + 1} 音节`}</span></div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 10, height: 90 }}>
              {word.stress.syllables.map((s, i) => {
                const h = Math.max(8, Math.min(80, 40 + s.prominence * 22));
                const ph = word.phones[s.phoneIndex];
                return (
                  <div key={i} className="col" style={{ alignItems: 'center', gap: 4 }}>
                    <div title={`强度 ${s.energyDb} dB · 音高 ${s.f0St ?? '—'} 半音 · 时长×${s.durNorm}`} style={{ width: 34, height: h, borderRadius: 8, background: i === word.stress!.expected ? 'var(--accent)' : 'var(--surface-3)', opacity: i === word.stress!.detected ? 1 : 0.65, border: i === word.stress!.detected ? '2px solid var(--fair)' : '2px solid transparent' }} />
                    <span className="ipa small">{ph?.ipa}</span>
                  </div>
                );
              })}
              <div className="tiny muted" style={{ marginLeft: 8, lineHeight: 1.6 }}>柱高 = 突显度（响度、音高、时长综合）<br />紫色 = 词典重音位置；橙框 = 你最突出的音节</div>
            </div>
          </div>
        )}

        {(word.notes.length > 0 || word.pauseAfter) && (
          <div className="col" style={{ gap: 6 }}>
            {word.notes.map((n, i) => <div key={i} className="notice warn">{n}</div>)}
            {word.pauseAfter ? <div className="notice">词后停顿 {word.pauseAfter.toFixed(2)} 秒</div> : null}
          </div>
        )}
        <div className="tiny muted">读音来源：{word.pron.source === 'cmudict' ? 'CMU 发音词典' : word.pron.source.startsWith('espeak') ? 'eSpeak-NG 规则' : word.pron.source === 'uk-derived' ? '英式非卷舌变体' : '神经网络 G2P'} · <span className="mono">{word.pron.arpa.join(' ')}</span></div>
      </div>
    </Drawer>
  );
}
