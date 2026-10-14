// Outbound URL policy for model endpoints. Blocks private / link-local / metadata addresses unless
// the deployment allows private hosts (single-user workstation running Ollama, LAN relay, ...).
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0;
}

const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

export function isPrivateAddress(ip) {
  const fam = isIP(ip);
  if (fam === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKS.some(([base, mask]) => (n & mask) === (base & mask));
  }
  if (fam === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

export class UrlPolicyError extends Error {
  constructor(message) { super(message); this.code = 'URL_POLICY'; }
}

/** Validate a provider base URL. Throws UrlPolicyError when the URL may not be called. */
export async function assertAllowedUrl(rawUrl, { allowPrivateHosts }) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new UrlPolicyError('Base URL 格式无效'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UrlPolicyError('只支持 http/https 协议');
  if (url.username || url.password) throw new UrlPolicyError('Base URL 不能包含用户名或密码，请使用 API Key 字段');
  if (allowPrivateHosts) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UrlPolicyError(`无法解析主机 ${host}`);
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new UrlPolicyError(`出于安全策略，服务器不允许访问内网地址 ${host}（管理员可设置 LUNHENG_ALLOW_PRIVATE_HOSTS=1）`);
  }
  return url;
}
