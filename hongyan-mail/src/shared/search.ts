// Search query language, e.g.:  from:alice 报价 has:attachment after:2024-01-01 is:unread
import type { Category, SpecialUse } from './types';

export interface ParsedQuery {
  text: string[];
  from: string[];
  to: string[];
  subject: string[];
  hasAttachment?: boolean;
  unread?: boolean;
  starred?: boolean;
  in: SpecialUse[];
  folder: string[];
  account: string[];
  before?: number;
  after?: number;
  category?: Category;
}

const IN_ALIASES: Record<string, SpecialUse> = {
  inbox: 'inbox', 收件箱: 'inbox',
  sent: 'sent', 已发送: 'sent', 发件箱: 'sent',
  drafts: 'drafts', draft: 'drafts', 草稿: 'drafts', 草稿箱: 'drafts',
  trash: 'trash', deleted: 'trash', 已删除: 'trash', 垃圾桶: 'trash', 回收站: 'trash',
  junk: 'junk', spam: 'junk', 垃圾邮件: 'junk',
  archive: 'archive', 归档: 'archive', 存档: 'archive',
  all: 'all'
};

const CATEGORY_ALIASES: Record<string, Category> = {
  primary: 'primary', 主要: 'primary',
  notifications: 'notifications', updates: 'notifications', 通知: 'notifications',
  promotions: 'promotions', promo: 'promotions', 推广: 'promotions', 广告: 'promotions',
  social: 'social', 社交: 'social'
};

function parseDate(s: string): number | undefined {
  const m = /^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2})日?)?$/.exec(s.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] || 1));
    return isNaN(d.getTime()) ? undefined : d.getTime();
  }
  const rel = /^(\d+)\s*([dwmy天周月年])$/i.exec(s.trim());
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const day = 86400000;
    const ms = unit === 'd' || unit === '天' ? n * day : unit === 'w' || unit === '周' ? n * 7 * day : unit === 'm' || unit === '月' ? n * 30 * day : n * 365 * day;
    return Date.now() - ms;
  }
  return undefined;
}

/** Splits a query into tokens, honouring "quoted phrases" and key:"quoted values". */
export function tokenize(q: string): string[] {
  const tokens: string[] = [];
  const re = /(\S+?[:：])?"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    if (m[2] !== undefined) tokens.push((m[1] || '') + '\u0000' + m[2]);
    else tokens.push(m[3]);
  }
  return tokens;
}

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { text: [], from: [], to: [], subject: [], in: [], folder: [], account: [] };
  for (const raw of tokenize(q)) {
    const quoted = raw.includes('\u0000');
    const tok = raw.replace('\u0000', '');
    const m = /^([a-z_一-龥]+)[:：](.*)$/i.exec(tok);
    if (!m || (quoted && raw.indexOf('\u0000') === 0)) {
      if (tok.trim()) out.text.push(tok.trim());
      continue;
    }
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (!val) { out.text.push(tok); continue; }
    switch (key) {
      case 'from': case '发件人': case '来自': out.from.push(val.toLowerCase()); break;
      case 'to': case 'cc': case '收件人': out.to.push(val.toLowerCase()); break;
      case 'subject': case '主题': out.subject.push(val); break;
      case 'has': case '有':
        if (/^(attachment|attachments|附件|file)$/i.test(val)) out.hasAttachment = true;
        else out.text.push(tok);
        break;
      case 'is': case '是': {
        const v = val.toLowerCase();
        if (v === 'unread' || v === '未读') out.unread = true;
        else if (v === 'read' || v === '已读') out.unread = false;
        else if (v === 'starred' || v === 'flagged' || v === '星标' || v === '已加星标') out.starred = true;
        else out.text.push(tok);
        break;
      }
      case 'in': case '位于': case '文件夹': {
        const su = IN_ALIASES[val.toLowerCase()];
        if (su) out.in.push(su);
        else out.folder.push(val);
        break;
      }
      case 'account': case '账户': case '账号': out.account.push(val.toLowerCase()); break;
      case 'before': case '早于': case 'older_than': { const d = parseDate(val); if (d) out.before = d; else out.text.push(tok); break; }
      case 'after': case '晚于': case 'newer_than': case 'since': { const d = parseDate(val); if (d) out.after = d; else out.text.push(tok); break; }
      case 'category': case '分类': { const c = CATEGORY_ALIASES[val.toLowerCase()]; if (c) out.category = c; else out.text.push(tok); break; }
      default: out.text.push(tok);
    }
  }
  return out;
}

export function isEmptyQuery(p: ParsedQuery): boolean {
  return !p.text.length && !p.from.length && !p.to.length && !p.subject.length && p.hasAttachment === undefined &&
    p.unread === undefined && p.starred === undefined && !p.in.length && !p.folder.length && !p.account.length &&
    p.before === undefined && p.after === undefined && !p.category;
}
