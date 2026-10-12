// Credential encryption. On Windows Electron's safeStorage uses DPAPI, which ties the ciphertext to the
// current Windows user account; nothing is sent anywhere. A local AES key is the fallback for systems
// without an OS keystore (some Linux desktops).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import type { SecretBox } from './core/mail-core';

const MAGIC_SAFE = Buffer.from('HY1S');
const MAGIC_LOCAL = Buffer.from('HY1L');

export function createSecretBox(dataDir: string): SecretBox {
  const osAvailable = safeStorage.isEncryptionAvailable();
  let backend = osAvailable ? (process.platform === 'win32' ? 'Windows DPAPI' : process.platform === 'darwin' ? 'macOS 钥匙串' : 'OS keyring') : 'local key';
  if (process.platform === 'linux' && osAvailable) {
    try {
      const b = (safeStorage as any).getSelectedStorageBackend?.();
      if (b === 'basic_text') backend = 'basic_text';
    } catch { /* older Electron */ }
  }
  let localKey: Buffer | null = null;
  const getLocalKey = () => {
    if (localKey) return localKey;
    const file = path.join(dataDir, '.key');
    if (fs.existsSync(file)) localKey = fs.readFileSync(file);
    else {
      localKey = crypto.randomBytes(32);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, localKey, { mode: 0o600 });
    }
    return localKey;
  };
  const useOs = osAvailable && backend !== 'basic_text';
  return {
    available: useOs,
    backend,
    encrypt(plain: string): Buffer {
      if (useOs) return Buffer.concat([MAGIC_SAFE, safeStorage.encryptString(plain)]);
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', getLocalKey(), iv);
      const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
      return Buffer.concat([MAGIC_LOCAL, iv, c.getAuthTag(), enc]);
    },
    decrypt(data: Buffer): string {
      const magic = data.subarray(0, 4);
      if (magic.equals(MAGIC_SAFE)) return safeStorage.decryptString(data.subarray(4));
      if (magic.equals(MAGIC_LOCAL)) {
        const iv = data.subarray(4, 16);
        const tag = data.subarray(16, 32);
        const d = crypto.createDecipheriv('aes-256-gcm', getLocalKey(), iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(data.subarray(32)), d.final()]).toString('utf8');
      }
      throw new Error('unknown credential format');
    }
  };
}
