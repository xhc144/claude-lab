import { describe, it, expect } from 'vitest';
import iconv from 'iconv-lite';
import { parseQuery, isEmptyQuery, tokenize } from '../../src/shared/search';
import { classify } from '../../src/main/core/classify';
import {
  baseSubject, cleanMessageId, decodeWords, findPreviewPart, hasAttachments, htmlToText, makeSnippet, parseHeaderBlock, parseReferences, snippetFromPart
} from '../../src/main/core/mime';
import { compressUids } from '../../src/main/core/sync';
import { redact } from '../../src/main/core/logger';
import { initials } from '../../src/renderer/lib/avatar';
import { fileSize, parseAddressInput, listTime, dateBucket } from '../../src/renderer/lib/format';

describe('search query language', () => {
  it('parses operators, phrases and free text', () => {
    const q = parseQuery('from:alice 报价 subject:"季度 总结" has:attachment is:unread after:2024-01-15 in:sent');
    expect(q.from).toEqual(['alice']);
    expect(q.text).toEqual(['报价']);
    expect(q.subject).toEqual(['季度 总结']);
    expect(q.hasAttachment).toBe(true);
    expect(q.unread).toBe(true);
    expect(q.in).toEqual(['sent']);
    expect(new Date(q.after!).getFullYear()).toBe(2024);
  });
  it('accepts Chinese operators and full-width colons', () => {
    const q = parseQuery('发件人：张伟 是:星标 位于:收件箱 分类:推广');
    expect(q.from).toEqual(['张伟']);
    expect(q.starred).toBe(true);
    expect(q.in).toEqual(['inbox']);
    expect(q.category).toBe('promotions');
  });
  it('keeps unknown operators as text', () => {
    expect(parseQuery('foo:bar').text).toEqual(['foo:bar']);
    expect(parseQuery('"exact phrase"').text).toEqual(['exact phrase']);
  });
  it('relative dates', () => {
    const q = parseQuery('newer_than:7d');
    expect(Date.now() - q.after!).toBeGreaterThan(6.9 * 86400000);
  });
  it('detects empty queries', () => {
    expect(isEmptyQuery(parseQuery('   '))).toBe(true);
    expect(tokenize('a "b c" d:"e f"')).toHaveLength(3);
  });
});

describe('smart categories', () => {
  const c = (fromAddr: string, subject: string, headers: Record<string, string> = {}, fromName = '') => classify({ fromAddr, fromName, subject, headers });
  it('personal mail is primary', () => {
    expect(c('zhangwei@company.com', '明天的会议改到下午')).toBe('primary');
    expect(c('friend@qq.com', '周末一起吃饭？')).toBe('primary');
  });
  it('newsletters with marketing language are promotions', () => {
    expect(c('newsletter@shop.example', '双十一大促 全场 5 折', { 'list-unsubscribe': '<https://x>', precedence: 'bulk' })).toBe('promotions');
    expect(c('deals@store.example', '50% off this weekend only', { 'list-unsubscribe': '<mailto:u@x>' })).toBe('promotions');
  });
  it('transactional and alert mail are notifications', () => {
    expect(c('no-reply@accounts.google.com', 'Security alert for your account')).toBe('notifications');
    expect(c('notifications@github.com', '[repo] Build failed', { 'list-id': 'repo <repo.github.com>' })).toBe('notifications');
    expect(c('service@bank.example', '您的验证码是 123456')).toBe('notifications');
  });
  it('social networks are social', () => {
    expect(c('messages-noreply@linkedin.com', 'You appeared in 12 searches')).toBe('social');
    expect(c('notice@weibo.com', '有人赞了你的微博')).toBe('social');
  });
});

describe('MIME helpers', () => {
  it('parses folded header blocks', () => {
    const h = parseHeaderBlock(Buffer.from('References: <a@x>\r\n <b@x>\r\nList-Id: Foo <foo.list>\r\n\r\n'));
    expect(h.references).toBe('<a@x> <b@x>');
    expect(h['list-id']).toBe('Foo <foo.list>');
  });
  it('normalises message ids and references', () => {
    expect(cleanMessageId(' <abc@x> ')).toBe('<abc@x>');
    expect(cleanMessageId('abc@x')).toBe('<abc@x>');
    expect(parseReferences('<a@x>  <b@y>\t<c@z>')).toEqual(['<a@x>', '<b@y>', '<c@z>']);
  });
  it('strips reply and forward prefixes', () => {
    expect(baseSubject('Re: RE: Fwd: 季度报价')).toBe('季度报价');
    expect(baseSubject('回复：答复: 转发：项目')).toBe('项目');
    expect(baseSubject('Re[2]: hello')).toBe('hello');
  });
  it('decodes encoded words', () => {
    expect(decodeWords('=?UTF-8?B?5L2g5aW9?=')).toBe('你好');
    expect(decodeWords('=?GB2312?B?xOO6ww==?=')).toBe('你好');
  });
  it('picks the preview part and detects attachments', () => {
    const structure = {
      type: 'multipart/mixed', childNodes: [
        { type: 'multipart/alternative', childNodes: [
          { part: '1.1', type: 'text/plain', parameters: { charset: 'gbk' }, encoding: 'quoted-printable', size: 100 },
          { part: '1.2', type: 'text/html', parameters: { charset: 'gbk' }, encoding: 'base64', size: 300 }
        ] },
        { part: '2', type: 'application/pdf', disposition: 'attachment', dispositionParameters: { filename: 'a.pdf' }, encoding: 'base64', size: 1000 }
      ]
    };
    expect(findPreviewPart(structure)).toEqual({ part: '1.1', type: 'text/plain', charset: 'gbk', encoding: 'quoted-printable', size: 100 });
    expect(hasAttachments(structure)).toBe(true);
    expect(hasAttachments({ type: 'multipart/related', childNodes: [{ type: 'text/html', part: '1' }, { type: 'image/png', part: '2', id: '<logo>', disposition: 'inline', dispositionParameters: { filename: 'logo.png' } }] })).toBe(false);
  });
  it('builds snippets from truncated base64 and GBK quoted-printable', () => {
    const text = '您好，附件是本周的周报，请查收。'.repeat(20);
    const b64 = Buffer.from(text).toString('base64').slice(0, 203);
    const s = snippetFromPart(Buffer.from(b64), { part: '1', type: 'text/plain', charset: 'utf-8', encoding: 'base64', size: 0 });
    expect(s.startsWith('您好，附件是本周的周报')).toBe(true);
    expect(s).not.toContain('�');
    const gbk = iconv.encode('测试中文邮件', 'gbk');
    const qp = [...gbk].map((b) => '=' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
    expect(snippetFromPart(Buffer.from(qp), { part: '1', type: 'text/plain', charset: 'gbk', encoding: 'quoted-printable', size: 0 })).toBe('测试中文邮件');
  });
  it('drops quoted replies and converts HTML to text', () => {
    expect(makeSnippet('好的，没问题。\n\n在 2024年1月1日 张三 写道：\n> 原文')).toBe('好的，没问题。');
    expect(htmlToText('<style>p{}</style><p>Hello&nbsp;<b>world</b></p><br>x')).toContain('Hello  world');
  });
  it('compresses UID sets', () => {
    expect(compressUids([5, 1, 2, 3, 9, 10, 3])).toBe('1:3,5,9:10');
    expect(compressUids([])).toBe('');
  });
  it('redacts secrets from log lines', () => {
    expect(redact('{"user":"a","pass":"hunter2"}')).not.toContain('hunter2');
    expect(redact('A1 LOGIN alice secret')).toBe('A1 LOGIN alice ***');
    expect(redact('access_token=abc.def&x=1')).not.toContain('abc.def');
  });
});

describe('renderer helpers', () => {
  it('builds avatar initials for people and organisations', () => {
    expect(initials('张伟', 'zw@x')).toBe('伟');
    expect(initials('李晓明', 'x@x')).toBe('晓明');
    expect(initials('招商银行信用卡', 'x@x')).toBe('招');
    expect(initials('GitHub', 'n@github.com')).toBe('GH');
    expect(initials('Trip.com', 'x@x')).toBe('TC');
    expect(initials('', 'john.smith@x.com')).toBe('JS');
  });
  it('parses typed addresses', () => {
    expect(parseAddressInput('张三 <ZS@Example.com>')).toEqual({ name: '张三', address: 'zs@example.com' });
    expect(parseAddressInput('a@b.co,')).toEqual({ name: '', address: 'a@b.co' });
    expect(parseAddressInput('not an address')).toBeNull();
  });
  it('formats sizes and times', () => {
    expect(fileSize(0)).toBe('0 B');
    expect(fileSize(1536)).toBe('1.5 KB');
    expect(fileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    const now = new Date(2026, 9, 14, 15, 0).getTime();
    expect(listTime(new Date(2026, 9, 14, 9, 5).getTime(), now)).toBe('09:05');
    expect(listTime(new Date(2026, 9, 13, 9, 5).getTime(), now)).toBe('昨天');
    expect(dateBucket(new Date(2026, 9, 14, 1).getTime(), now)).toBe('今天');
    expect(dateBucket(new Date(2025, 1, 1).getTime(), now)).toBe('2025 年');
  });
});
