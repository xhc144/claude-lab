import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, Circle, Copy, ExternalLink, Lightbulb, Minus, X } from 'lucide-react';
import type { DiagStep, Diagnosis, DiagnosisReport } from '@shared/types';
import { api } from '../api';
import { useApp } from '../store';
import { cx, Spinner } from './ui';

export function DiagSteps({ steps }: { steps: DiagStep[] }) {
  return (
    <ol className="diag-steps">
      {steps.map((st, i) => (
        <motion.li key={st.id} className={cx('diag-step', `is-${st.status}`)} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
          <span className="diag-icon">
            {st.status === 'running' ? <Spinner size={14} /> : st.status === 'ok' ? <Check size={13} strokeWidth={3} /> : st.status === 'fail' ? <X size={13} strokeWidth={3} /> : st.status === 'warn' ? <AlertTriangle size={12} /> : st.status === 'skipped' ? <Minus size={13} /> : <Circle size={8} />}
          </span>
          <span className="diag-label">{st.label}</span>
          {st.detail && <span className="diag-detail" title={st.detail}>{st.detail}</span>}
          {st.ms !== undefined && st.status !== 'pending' && st.status !== 'skipped' && <span className="diag-ms">{st.ms < 1000 ? `${st.ms} ms` : `${(st.ms / 1000).toFixed(1)} s`}</span>}
        </motion.li>
      ))}
    </ol>
  );
}

export function DiagnosisCard({ d, report }: { d: Diagnosis; report?: DiagnosisReport | null }) {
  const [open, setOpen] = useState(false);
  const toast = useApp((s) => s.toast);
  const copy = () => {
    const lines = [
      `问题：${d.title}`,
      `说明：${d.explanation}`,
      ...d.suggestions.map((x, i) => `建议 ${i + 1}：${x}`),
      ...(report ? report.steps.map((st) => `[${st.status}] ${st.label}${st.detail ? ` — ${st.detail}` : ''}${st.ms !== undefined ? ` (${st.ms}ms)` : ''}`) : []),
      d.technical ? `技术细节：${d.technical}` : ''
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast({ kind: 'success', message: '诊断报告已复制' }));
  };
  return (
    <motion.div className="diag-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="diag-card-head">
        <span className="diag-card-icon"><AlertTriangle size={18} /></span>
        <div>
          <h4>{d.title}</h4>
          <p>{d.explanation}</p>
        </div>
      </div>
      {d.suggestions.length > 0 && (
        <ul className="diag-suggest">
          {d.suggestions.map((x, i) => (
            <li key={i}><Lightbulb size={14} /><span>{x}</span></li>
          ))}
        </ul>
      )}
      <div className="diag-card-foot">
        {d.helpUrl && <button className="link-btn" onClick={() => api.openExternal(d.helpUrl!)}><ExternalLink size={13} /> 打开帮助页面</button>}
        <button className="link-btn" onClick={copy}><Copy size={13} /> 复制诊断报告</button>
        {d.technical && (
          <button className="link-btn" onClick={() => setOpen(!open)}>技术细节 <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
        )}
      </div>
      {open && d.technical && <pre className="diag-tech">{d.technical}</pre>}
    </motion.div>
  );
}
