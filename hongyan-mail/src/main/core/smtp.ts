import os from 'node:os';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { convert as htmlToPlain } from 'html-to-text';
import type { Address, ServerConfig } from '../../shared/types';
import type { ImapAuth } from './imap';

export interface SmtpOptions {
  server: ServerConfig;
  auth: ImapAuth;
  allowInsecureTls: boolean;
}

/** EHLO name: the machine name if it is a valid host label, otherwise a neutral literal. */
function ehloName(): string {
  const h = os.hostname().toLowerCase();
  return /^[a-z0-9][a-z0-9.-]{0,62}$/.test(h) ? h : '[127.0.0.1]';
}

export function createTransport(o: SmtpOptions) {
  return nodemailer.createTransport({
    host: o.server.host,
    port: o.server.port,
    secure: o.server.security === 'tls',
    requireTLS: o.server.security === 'starttls',
    ignoreTLS: o.server.security === 'none',
    name: ehloName(),
    auth: o.auth.accessToken
      ? { type: 'OAuth2', user: o.auth.user, accessToken: o.auth.accessToken }
      : { user: o.auth.user, pass: o.auth.pass || '' },
    tls: { rejectUnauthorized: !o.allowInsecureTls, servername: /^\d+\.\d+\.\d+\.\d+$/.test(o.server.host) ? undefined : o.server.host },
    connectionTimeout: 20_000,
    greetingTimeout: 16_000,
    socketTimeout: 90_000,
    logger: false
  } as any);
}

export interface OutgoingAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

export interface OutgoingMessage {
  from: Address;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  subject: string;
  html: string;
  attachments: OutgoingAttachment[];
  inReplyTo?: string | null;
  references?: string[];
  messageId?: string;
  date?: Date;
}

export function newMessageId(fromAddress: string): string {
  const domain = fromAddress.split('@')[1] || 'hongyan.local';
  return `<${crypto.randomUUID()}@${domain}>`;
}

export function htmlToText(html: string): string {
  return htmlToPlain(html, {
    wordwrap: 100,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

/** Builds the RFC 822 message. keepBcc controls whether the Bcc header is kept (for the Sent copy). */
export async function buildRaw(m: OutgoingMessage, keepBcc: boolean): Promise<Buffer> {
  const fmt = (a: Address) => ({ name: a.name || '', address: a.address });
  const composer = new MailComposer({
    from: fmt(m.from),
    to: m.to.map(fmt),
    cc: m.cc.map(fmt),
    bcc: m.bcc.map(fmt),
    subject: m.subject,
    html: m.html,
    text: htmlToText(m.html),
    attachments: m.attachments.map((a) => ({ filename: a.filename, path: a.path, content: a.content, contentType: a.contentType })),
    inReplyTo: m.inReplyTo || undefined,
    references: m.references && m.references.length ? m.references.join(' ') : undefined,
    messageId: m.messageId,
    date: m.date || new Date(),
    headers: { 'X-Mailer': `Hongyan Mail ${process.env.HY_VERSION || '1.0.0'}` },
    attachDataUrls: true,
    textEncoding: 'base64'
  } as any);
  const node: any = composer.compile();
  node.keepBcc = keepBcc;
  return new Promise((resolve, reject) => node.build((err: Error | null, buf: Buffer) => (err ? reject(err) : resolve(buf))));
}
