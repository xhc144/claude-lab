// Local IMAP (Dovecot) + SMTP test server for the integration and end-to-end tests.
//
// Usage as CLI:   node scripts/test-server/mail-server.mjs        (Ctrl+C to stop)
// Usage as module: const srv = await startMailServer(); ... await srv.stop();
//
// Requires the `dovecot-imapd` package (apt) and root (to drop privileges to vmail).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { SMTPServer } from 'smtp-server';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const TEST_USERS = {
  'alice@hy.test': 'alice-pass',
  'bob@hy.test': 'bob-pass',
  'carol@hy.test': 'carol-pass'
};

function waitPort(port, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} not ready`));
        else setTimeout(tryOnce, 100);
      });
    };
    tryOnce();
  });
}

export async function startMailServer(opts = {}) {
  const root = opts.root || fs.mkdtempSync(path.join(os.tmpdir(), 'hy-mailsrv-'));
  const ports = {
    imap: opts.imapPort || 11143,
    imaps: opts.imapsPort || 11993,
    smtps: opts.smtpsPort || 11465,
    smtp: opts.smtpPort || 11587
  };
  for (const d of ['run', 'state', 'mail', 'home']) fs.mkdirSync(path.join(root, d), { recursive: true });
  const uid = Number(execFileSync('id', ['-u', 'vmail']).toString().trim());
  const gid = Number(execFileSync('id', ['-g', 'vmail']).toString().trim());

  if (!fs.existsSync(path.join(root, 'cert.pem'))) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
      '-subj', '/CN=localhost', '-keyout', path.join(root, 'key.pem'), '-out', path.join(root, 'cert.pem')],
    { stdio: 'ignore' });
  }
  fs.writeFileSync(path.join(root, 'users.passwd'),
    Object.entries(TEST_USERS).map(([u, p]) => `${u}:{PLAIN}${p}`).join('\n') + '\n');
  const conf = fs.readFileSync(path.join(HERE, 'dovecot.conf.tpl'), 'utf8')
    .replaceAll('__ROOT__', root)
    .replaceAll('__UID__', String(uid))
    .replaceAll('__GID__', String(gid))
    .replaceAll('__IMAP_PORT__', String(ports.imap))
    .replaceAll('__IMAPS_PORT__', String(ports.imaps));
  const confPath = path.join(root, 'dovecot.conf');
  fs.writeFileSync(confPath, conf);
  execFileSync('chown', ['-R', `${uid}:${gid}`, path.join(root, 'mail'), path.join(root, 'home')]);
  fs.chmodSync(root, 0o755);

  const dovecot = spawn('dovecot', ['-F', '-c', confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let dovecotErr = '';
  dovecot.stderr.on('data', (d) => { dovecotErr += d; });
  try {
    await waitPort(ports.imap);
  } catch (e) {
    dovecot.kill();
    throw new Error('dovecot failed to start: ' + dovecotErr + (fs.existsSync(path.join(root, 'dovecot.log')) ? fs.readFileSync(path.join(root, 'dovecot.log'), 'utf8') : ''));
  }

  /** Deliver a raw RFC822 message into a user's mailbox (bypasses SMTP). */
  function deliver(user, raw, mailbox = 'INBOX') {
    execFileSync('doveadm', ['-c', confPath, 'save', '-u', user, '-m', mailbox], { input: raw });
  }

  const delivered = [];
  const makeSmtp = (secure) => new SMTPServer({
    secure,
    key: fs.readFileSync(path.join(root, 'key.pem')),
    cert: fs.readFileSync(path.join(root, 'cert.pem')),
    authMethods: ['PLAIN', 'LOGIN'],
    logger: false,
    onAuth(auth, session, cb) {
      if (TEST_USERS[auth.username] && TEST_USERS[auth.username] === auth.password) cb(null, { user: auth.username });
      else {
        const err = new Error('5.7.8 Authentication credentials invalid');
        err.responseCode = 535;
        cb(err);
      }
    },
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        const raw = Buffer.concat(chunks);
        const rcpts = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
        delivered.push({ from: session.envelope.mailFrom && session.envelope.mailFrom.address, rcpts, raw });
        try {
          for (const r of rcpts) if (TEST_USERS[r]) deliver(r, raw);
          cb();
        } catch (e) { cb(e); }
      });
    }
  });
  const smtps = makeSmtp(true);
  const smtp = makeSmtp(false);
  // Clients that probe the port and hang up (connection tests) raise socket errors; they are expected.
  smtps.on('error', () => {});
  smtp.on('error', () => {});
  await new Promise((r) => smtps.listen(ports.smtps, '127.0.0.1', r));
  await new Promise((r) => smtp.listen(ports.smtp, '127.0.0.1', r));

  async function stop() {
    await new Promise((r) => smtps.close(r));
    await new Promise((r) => smtp.close(r));
    await new Promise((resolve) => {
      if (dovecot.exitCode !== null) return resolve();
      dovecot.once('exit', resolve);
      dovecot.kill('SIGTERM');
      setTimeout(() => { try { dovecot.kill('SIGKILL'); } catch { /* gone */ } resolve(); }, 3000);
    });
    if (!opts.keep) fs.rmSync(root, { recursive: true, force: true });
  }

  return { root, ports, confPath, users: TEST_USERS, deliver, delivered, stop };
}

/** Build a simple RFC822 message for seeding test mailboxes. */
export function buildRaw({ from, to, subject, text, html, date = new Date(), messageId, inReplyTo, references, headers = {} }) {
  const id = messageId || `<${Math.random().toString(36).slice(2)}.${Date.now()}@hy.test>`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0'
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
  if (html) {
    const b = 'b' + Math.random().toString(36).slice(2);
    lines.push(`Content-Type: multipart/alternative; boundary="${b}"`, '',
      `--${b}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
      Buffer.from(text || '').toString('base64'),
      `--${b}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
      Buffer.from(html).toString('base64'), `--${b}--`, '');
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
      Buffer.from(text || '').toString('base64'), '');
  }
  return Buffer.from(lines.join('\r\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const srv = await startMailServer({ root: process.env.HY_MAILSRV_ROOT, keep: !!process.env.HY_MAILSRV_ROOT });
  console.log('Mail test server running');
  console.log('  root   :', srv.root);
  console.log('  IMAP   : 127.0.0.1:%d (STARTTLS)  127.0.0.1:%d (TLS)', srv.ports.imap, srv.ports.imaps);
  console.log('  SMTP   : 127.0.0.1:%d (STARTTLS)  127.0.0.1:%d (TLS)', srv.ports.smtp, srv.ports.smtps);
  console.log('  users  :', Object.entries(TEST_USERS).map(([u, p]) => `${u} / ${p}`).join(', '));
  if (process.env.HY_SEED) {
    const now = Date.now();
    for (let i = 0; i < Number(process.env.HY_SEED); i++) {
      srv.deliver('alice@hy.test', buildRaw({
        from: `Sender ${i} <s${i}@example.com>`, to: 'alice@hy.test',
        subject: `测试邮件 #${i}`, text: `这是第 ${i} 封测试邮件。\nHello ${i}`, date: new Date(now - i * 3600_000)
      }));
    }
    console.log('  seeded :', process.env.HY_SEED, 'messages for alice');
  }
  const shutdown = async () => { await srv.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
