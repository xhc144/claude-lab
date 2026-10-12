import fs from 'node:fs';
import path from 'node:path';

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/** Appends to a log file (rotated at 5 MB) and mirrors to the console in development. */
export function createFileLogger(dir: string, echo = false): Logger {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'main.log');
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) fs.renameSync(file, file + '.1');
  } catch { /* ignore */ }
  const write = (level: string, msg: string) => {
    const line = `${new Date().toISOString()} ${level.padEnd(5)} ${redact(msg)}\n`;
    try { fs.appendFileSync(file, line); } catch { /* disk full etc. */ }
    if (echo) process.stdout.write(line);
  };
  return {
    debug: (m) => { if (echo) write('debug', m); },
    info: (m) => write('info', m),
    warn: (m) => write('warn', m),
    error: (m, e) => write('error', e ? `${m}: ${(e as any)?.stack || e}` : m)
  };
}

/** Never let passwords or tokens reach the log file. */
export function redact(s: string): string {
  return s
    .replace(/(pass(word)?|accessToken|refreshToken|access_token|refresh_token|client_secret)(["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1$3***')
    .replace(/(AUTHENTICATE\s+\S+\s+)\S+/gi, '$1***')
    .replace(/(LOGIN\s+\S+\s+)\S+/gi, '$1***');
}

export const nullLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
