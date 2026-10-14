// API-key vault: AES-256-GCM with a per-user data key derived from the server master key (HKDF).
// The ciphertext is bound to (user, provider) through GCM associated data, so an encrypted key
// copied into another user's record or another provider entry fails authentication.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const VERSION = 1;

export async function loadMasterKey({ masterKey, dataDir }) {
  if (masterKey) return parseKey(masterKey, 'LUNHENG_MASTER_KEY');
  const file = join(dataDir, 'master.key');
  try {
    const raw = (await fs.readFile(file, 'utf8')).trim();
    return parseKey(raw, file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const key = randomBytes(32);
  // wx: never overwrite an existing key file (that would make every stored API key undecryptable).
  await fs.writeFile(file, key.toString('base64') + '\n', { mode: 0o600, flag: 'wx' });
  return key;
}

function parseKey(raw, source) {
  const s = String(raw).trim();
  let key = null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) key = Buffer.from(s, 'hex');
  else {
    try { key = Buffer.from(s, 'base64'); } catch { key = null; }
  }
  if (!key || key.length !== 32) throw new Error(`${source}: master key must be 32 bytes (64 hex chars or base64)`);
  return key;
}

export class Vault {
  constructor(masterKey) {
    if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) throw new Error('vault needs a 32-byte master key');
    this.masterKey = masterKey;
    this.cache = new Map();
  }

  #userKey(userId) {
    let k = this.cache.get(userId);
    if (!k) {
      k = Buffer.from(hkdfSync('sha256', this.masterKey, Buffer.from('lunheng-vault-v1'), Buffer.from(`user:${userId}`), 32));
      this.cache.set(userId, k);
    }
    return k;
  }

  encrypt(userId, scope, plaintext) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#userKey(userId), iv);
    cipher.setAAD(Buffer.from(`${userId}|${scope}`));
    const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return { v: VERSION, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
  }

  decrypt(userId, scope, box) {
    if (!box || box.v !== VERSION) throw new Error('unsupported vault record');
    const decipher = createDecipheriv('aes-256-gcm', this.#userKey(userId), Buffer.from(box.iv, 'base64'));
    decipher.setAAD(Buffer.from(`${userId}|${scope}`));
    decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(box.ct, 'base64')), decipher.final()]).toString('utf8');
  }
}

/** Display hint that never reveals more than the last 4 characters. */
export function keyHint(key) {
  const s = String(key || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, Math.min(3, s.length - 6))}••••${s.slice(-4)}`;
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
