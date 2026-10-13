import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import type { ServerConfig } from '../../shared/types';
import type { Logger } from './logger';

export interface ImapAuth {
  user: string;
  pass?: string;
  accessToken?: string;
}

export interface ImapConnectOptions {
  server: ServerConfig;
  auth: ImapAuth;
  allowInsecureTls: boolean;
  log: Logger;
  autoIdle?: boolean;
  label?: string;
  timeouts?: { connection?: number; greeting?: number; socket?: number };
}

export const CLIENT_INFO = {
  name: 'Hongyan Mail',
  version: process.env.HY_VERSION || '1.0.0',
  vendor: 'Hongyan',
  'support-url': 'https://github.com/xhc144/claude-lab'
};

function imapLogger(log: Logger, label: string) {
  const fmt = (o: any) => (typeof o === 'string' ? o : o?.msg || JSON.stringify(o).slice(0, 400));
  return {
    debug: () => {},
    info: () => {},
    warn: (o: any) => log.warn(`[imap ${label}] ${fmt(o)}`),
    error: (o: any) => log.error(`[imap ${label}] ${fmt(o)}`)
  };
}

export function createImapClient(o: ImapConnectOptions): ImapFlow {
  const opts: ImapFlowOptions = {
    host: o.server.host,
    port: o.server.port,
    secure: o.server.security === 'tls',
    doSTARTTLS: o.server.security === 'starttls' ? true : o.server.security === 'none' ? false : undefined,
    servername: net_isIp(o.server.host) ? undefined : o.server.host,
    auth: o.auth.accessToken ? { user: o.auth.user, accessToken: o.auth.accessToken } : { user: o.auth.user, pass: o.auth.pass || '' },
    tls: { rejectUnauthorized: !o.allowInsecureTls },
    clientInfo: CLIENT_INFO,
    logger: imapLogger(o.log, o.label || o.auth.user) as any,
    disableAutoIdle: !o.autoIdle,
    connectionTimeout: o.timeouts?.connection ?? 20_000,
    greetingTimeout: o.timeouts?.greeting ?? 16_000,
    socketTimeout: o.timeouts?.socket ?? 5 * 60_000,
    maxIdleTime: 4 * 60_000
  };
  return new ImapFlow(opts);
}

function net_isIp(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
}

/** True for errors that mean the connection is unusable (as opposed to a rejected command). */
export function isConnectionError(e: any): boolean {
  const code = String(e?.code || '');
  return ['NoConnection', 'EConnectionClosed', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ETIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED',
    'ENETUNREACH', 'EHOSTUNREACH', 'CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'UPGRADE_TIMEOUT', 'ClosedAfterConnectText', 'ClosedAfterConnectTLS',
    'StateLogout', 'ENETDOWN'].includes(code) || /connection (not available|closed)|socket (closed|hang up)/i.test(String(e?.message || ''));
}
