import type { Address } from '@shared/types';

const DAY = 86400000;

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayFmt = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });
const monthDayFmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
const fullDateFmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** Compact time for message lists: 14:32 · 昨天 · 周三 · 3/14 · 2023/3/14 */
export function listTime(t: number, now = Date.now()): string {
  const today = startOfDay(now);
  if (t >= today) return timeFmt.format(t);
  if (t >= today - DAY) return '昨天';
  if (t >= today - 6 * DAY) return weekdayFmt.format(t);
  if (new Date(t).getFullYear() === new Date(now).getFullYear()) return monthDayFmt.format(t);
  return fullDateFmt.format(t);
}

export function longTime(t: number): string {
  return longFmt.format(t);
}

export function relativeTime(t: number, now = Date.now()): string {
  const diff = now - t;
  if (diff < 45_000) return '刚刚';
  if (diff < 3600_000) return `${Math.round(diff / 60_000)} 分钟前`;
  if (diff < DAY && t >= startOfDay(now)) return `今天 ${timeFmt.format(t)}`;
  return `${listTime(t, now)} ${timeFmt.format(t)}`;
}

export function dateBucket(t: number, now = Date.now()): string {
  const today = startOfDay(now);
  if (t >= today) return '今天';
  if (t >= today - DAY) return '昨天';
  const d = new Date(now);
  const weekStart = today - ((d.getDay() + 6) % 7) * DAY;
  if (t >= weekStart) return '本周';
  if (t >= weekStart - 7 * DAY) return '上周';
  const md = new Date(t);
  if (md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth()) return '本月';
  if (md.getFullYear() === d.getFullYear()) return `${md.getMonth() + 1} 月`;
  return `${md.getFullYear()} 年`;
}

export function fileSize(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function displayName(a: Address | null | undefined, me?: Set<string>): string {
  if (!a) return '（未知发件人）';
  if (me?.has(a.address)) return '我';
  if (a.name && a.name !== a.address) return a.name;
  return a.address.split('@')[0];
}

export function addressLine(list: Address[], me?: Set<string>, max = 3): string {
  const names = list.map((a) => displayName(a, me));
  if (names.length <= max) return names.join('、');
  return `${names.slice(0, max).join('、')} 等 ${names.length} 人`;
}

export function formatAddress(a: Address): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

export function number(n: number): string {
  return n.toLocaleString('zh-CN');
}

export function parseAddressInput(s: string): Address | null {
  const t = s.trim().replace(/[，,;；]$/, '').trim();
  if (!t) return null;
  const m = /^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/.exec(t);
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim(), address: m[2].toLowerCase() };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return { name: '', address: t.toLowerCase() };
  return null;
}

export function isValidAddress(a: string): boolean {
  return /^[^@\s"<>]+@[^@\s"<>]+\.[A-Za-z0-9-]{2,}$/.test(a);
}
