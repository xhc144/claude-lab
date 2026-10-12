import React from 'react';
import type { ListFilter, ViewSpec } from '@shared/types';
import { GOOSE_PATH, Spinner } from './ui';

/** Ink-wash landscape with a skein of geese in V formation — used for empty and welcome states. */
export function InkScene({ width = 260, variant = 'calm' }: { width?: number; variant?: 'calm' | 'search' | 'done' }) {
  const id = React.useId().replace(/:/g, '');
  const h = width * 0.62;
  // lead goose first; followers trail behind on both arms of the V
  const geese: Array<[number, number, number]> = [[120, 38, 0.3], [102, 48, 0.25], [86, 57, 0.21], [108, 30, 0.24], [94, 23, 0.2]];
  return (
    <svg className="ink-scene" width={width} height={h} viewBox="0 0 260 162" aria-hidden>
      <defs>
        <radialGradient id={`fade${id}`} cx="50%" cy="48%" r="50%">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={`m${id}`}>
          <rect width="260" height="162" fill={`url(#fade${id})`} />
        </mask>
        <linearGradient id={`m1${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--text)" stopOpacity="0.2" />
          <stop offset="1" stopColor="var(--text)" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id={`m2${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--text)" stopOpacity="0.34" />
          <stop offset="1" stopColor="var(--text)" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={`sky${id}`} cx="72%" cy="22%" r="70%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g mask={`url(#m${id})`}>
        <rect width="260" height="162" fill={`url(#sky${id})`} />
        <circle cx={variant === 'search' ? 66 : 190} cy="44" r="16" fill="var(--accent)" opacity="0.88" />
        <path d="M0 116 C 26 96, 50 88, 76 100 C 98 110, 114 80, 142 76 C 172 72, 188 104, 216 98 C 234 94, 248 86, 260 90 L260 162 L0 162 Z" fill={`url(#m1${id})`} />
        <path d="M0 136 C 24 120, 46 112, 70 122 C 92 131, 118 108, 146 112 C 176 116, 196 136, 226 128 C 240 124, 252 120, 260 122 L260 162 L0 162 Z" fill={`url(#m2${id})`} />
        <path d="M24 148 C 70 142, 110 149, 150 146 C 190 143, 222 149, 248 146" stroke="var(--text)" strokeOpacity="0.14" strokeWidth="0.8" fill="none" />
        <g fill="var(--text)">
          {geese.map(([x, y, sc], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.82 - i * 0.1}>
              <g className="ink-goose" style={{ animationDelay: `${-i * 0.7}s` }}>
                <path d={GOOSE_PATH} />
              </g>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

export function EmptyState({ view, filter, syncing }: { view: ViewSpec; filter: ListFilter; syncing: boolean }) {
  let title = '这里空空如也';
  let text = '没有邮件。';
  if (syncing) {
    title = '正在收取邮件';
    text = '首次同步会先下载最新的邮件，历史邮件会在后台继续下载。';
  } else if (view.kind === 'search') {
    title = '没有找到匹配的邮件';
    text = '试试更短的关键词，或点击上方「在服务器上搜索正文」。支持 from: to: subject: has:attachment is:unread before: after: 等条件。';
  } else if (filter !== 'all') {
    title = '没有符合筛选条件的邮件';
    text = '切换回「全部邮件」可以看到其他邮件。';
  } else if (view.kind === 'unified' && view.box === 'inbox') {
    title = '收件箱已清空';
    text = '所有邮件都处理完了，享受片刻宁静。';
  } else if (view.kind === 'unified' && view.box === 'starred') {
    title = '还没有星标邮件';
    text = '为重要的邮件加上星标（快捷键 S），它们会集中出现在这里。';
  } else if (view.kind === 'unified' && view.box === 'unread') {
    title = '没有未读邮件';
    text = '一切尽在掌握。';
  }
  return (
    <div className="empty-state">
      <InkScene width={220} variant={view.kind === 'search' ? 'search' : 'calm'} />
      <h3>{syncing && <Spinner size={14} />} {title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function ReaderEmpty({ unread, accounts }: { unread: number; accounts: number }) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return (
    <div className="reader-empty">
      <InkScene width={300} />
      <h2>{greeting}</h2>
      <p>{unread ? `收件箱里有 ${unread} 封未读邮件` : accounts ? '收件箱里没有未读邮件' : '添加一个邮箱开始使用'}</p>
      <div className="reader-empty-keys">
        <span><kbd className="kbd">C</kbd> 写邮件</span>
        <span><kbd className="kbd">/</kbd> 搜索</span>
        <span><kbd className="kbd">J</kbd><kbd className="kbd">K</kbd> 上下切换</span>
        <span><kbd className="kbd">Ctrl</kbd><kbd className="kbd">K</kbd> 命令面板</span>
      </div>
    </div>
  );
}

export default React.memo(EmptyState);
