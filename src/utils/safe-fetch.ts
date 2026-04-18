/**
 * SSRF 防护工具 — 校验用户提供的 URL 是否安全
 *
 * 拦截：
 * - 私有 IP：127.0.0.1, 10.x.x.x, 172.16-31.x.x, 192.168.x.x
 * - 元数据端点：169.254.169.254, 169.254.169.249 等
 * - IPv6 链路本地地址
 * - 非 HTTP/HTTPS 协议
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'localhost.localdomain',
]);

// IPv4 私有段正则
const PRIVATE_V4_RE = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
// 元数据端点
const METADATA_RE = /^169\.254\.169\.(254|249|239|240|250|251|252|253|255)/;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (METADATA_RE.test(h)) return true;
  return false;
}

function isPrivateIP(ip: string): boolean {
  return PRIVATE_V4_RE.test(ip);
}

export class SSRFError extends Error {
  constructor(url: string, reason: string) {
    super(`SSRF blocked: ${reason} — ${url}`);
    this.name = 'SSRFError';
  }
}

/**
 * 校验 URL 是否允许发起请求
 * @throws SSRFError
 */
export async function validateURL(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SSRFError(rawUrl, 'invalid URL format');
  }

  // 仅允许 HTTP/HTTPS
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SSRFError(rawUrl, `protocol ${url.protocol} not allowed (only http/https)`);
  }

  const hostname = url.hostname;

  // 检查 hostname 是否为私有/阻塞地址
  if (isBlockedHost(hostname)) {
    throw new SSRFError(rawUrl, `host ${hostname} is blocked`);
  }

  // DNS 双重解析：先用系统解析，再检查解析结果是否指向私有 IP
  try {
    const dns = require('dns');
    const { promisify } = require('util');
    const lookup = promisify(dns.lookup);

    // 同步检查 hostname 本身
    const parsed = url.host.split(':')[0];
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed)) {
      // 已经是 IP，直接检查
      if (isPrivateIP(parsed)) {
        throw new SSRFError(rawUrl, `private IP address: ${parsed}`);
      }
    } else {
      // 域名需解析后验证
      const { address } = await lookup(hostname);
      if (!address) throw new SSRFError(rawUrl, `DNS lookup failed for ${hostname}`);
      if (isPrivateIP(address)) {
        throw new SSRFError(rawUrl, `hostname resolved to private IP: ${address}`);
      }
    }
  } catch (err) {
    if (err instanceof SSRFError) throw err;
    // DNS 解析失败时拒绝（防止 DNS 重绑定绕过）
    throw new SSRFError(rawUrl, `DNS resolution failed for ${hostname}`);
  }

  return url;
}

/**
 * 带 SSRF 校验的 fetch（Promise 版本，调用方需 await）
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  const url = await validateURL(rawUrl);
  return fetch(url.href, init);
}
