import dns from 'node:dns/promises';
import net from 'node:net';

const REGULATION_ID_RE = /^[A-Za-z0-9\u4e00-\u9fff_-]{1,120}$/;

export function assertSafeRegulationId(value) {
  const id = String(value || '');
  if (!REGULATION_ID_RE.test(id)) {
    const error = new Error('法规 ID 格式不合法');
    error.code = 'INVALID_REGULATION_ID';
    throw error;
  }
  return id;
}

export function isPrivateAddress(address) {
  const ip = String(address || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) return true;
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip)) return true;
    return false;
  }
  return true;
}

export function parseRemoteUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('URL 格式不合法');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅允许 http/https URL');
  if (url.username || url.password) throw new Error('URL 不允许包含用户名或密码');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('不允许访问本机地址');
  }
  if (net.isIP(hostname) && isPrivateAddress(hostname)) throw new Error('不允许访问内网或保留地址');
  return url;
}

export async function assertPublicRemoteUrl(value) {
  const url = parseRemoteUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('目标域名解析到内网或保留地址');
  }
  return url;
}
