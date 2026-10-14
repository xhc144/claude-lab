import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(password).normalize('NFKC'), salt, 32, PARAMS);
  return { alg: 'scrypt', N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function verifyPassword(password, record) {
  if (!record || record.alg !== 'scrypt') return false;
  const expected = Buffer.from(record.hash, 'base64');
  const actual = await scrypt(String(password).normalize('NFKC'), Buffer.from(record.salt, 'base64'), expected.length, {
    N: record.N, r: record.r, p: record.p, maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return '密码至少 8 位';
  if (pw.length > 256) return '密码过长';
  return null;
}
