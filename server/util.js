// 通用工具
import crypto from 'node:crypto';
import { assertPublicRemoteUrl } from './security.js';

export function nanoid(len = 12) {
  return crypto.randomBytes(Math.ceil((len * 3) / 4)).toString('base64url').slice(0, len);
}

export function now() {
  return new Date().toISOString();
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 从 HTML 中提取正文文本（简易去标签）
export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 判断标题是否像"法规类"文件（用于爬虫过滤）
export function isRegulationLike(title) {
  return /(法|条例|办法|规定|规范|细则|准则|指南|指引|规程|标准|公告|通知|意见)$|(法|条例|办法|规定|规范|细则|准则|指南|指引|规程|标准)(（|\(|$)/.test(
    String(title || '')
  );
}

export async function fetchText(
  url,
  { timeout = 20000, maxBytes = 5 * 1024 * 1024, method = 'GET', headers = {}, body } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let current = await assertPublicRemoteUrl(url);
    let resp;
    for (let redirects = 0; redirects <= 5; redirects++) {
      resp = await fetch(current, {
        method,
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...headers,
        },
        body,
        redirect: 'manual',
      });
      if (![301, 302, 303, 307, 308].includes(resp.status)) break;
      if (redirects === 5) throw new Error('远程地址重定向次数过多');
      const location = resp.headers.get('location');
      if (!location) throw new Error('远程地址返回了无目标的重定向');
      current = await assertPublicRemoteUrl(new URL(location, current).href);
      if (resp.status === 303 || ((resp.status === 301 || resp.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const declaredSize = Number(resp.headers.get('content-length') || 0);
    if (declaredSize > maxBytes) throw new Error(`远程内容超过 ${maxBytes} 字节限制`);
    const chunks = [];
    let size = 0;
    for await (const chunk of resp.body || []) {
      size += chunk.length;
      if (size > maxBytes) {
        controller.abort();
        throw new Error(`远程内容超过 ${maxBytes} 字节限制`);
      }
      chunks.push(Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks, size);
    // 尝试按 charset 解码
    const type = resp.headers.get('content-type') || '';
    const charsetMatch = type.match(/charset=([\w-]+)/i);
    let text = '';
    if (charsetMatch && charsetMatch[1].toLowerCase() !== 'utf-8') {
      try {
        const { TextDecoder } = globalThis;
        const dec = new TextDecoder(charsetMatch[1]);
        text = dec.decode(new Uint8Array(buf));
      } catch {
        text = buf.toString('utf-8');
      }
    } else {
      text = buf.toString('utf-8');
    }
    return { text, url: resp.url || current.href };
  } finally {
    clearTimeout(timer);
  }
}

// 修正 LLM 输出的序号错误：多个段落都以 "1." 开头时，重排为 1,2,3…
// 例：五个小节都标 "1. xxx" → 自动改为 1. 2. 3. 4. 5.
export function fixListNumbering(text) {
  if (!text) return text;
  const blocks = String(text).split(/\n\s*\n/); // 按空行分块
  const targets = [];
  blocks.forEach((b, i) => {
    const firstLine = b.trim().split('\n')[0] || '';
    if (/^1[.、．](\s|$)/.test(firstLine)) targets.push({ i, b });
  });
  if (targets.length < 2) return text;
  targets.forEach(({ i, b }, k) => {
    const lines = b.split('\n');
    lines[0] = lines[0].replace(/^1[.、．]/, (k + 1) + '.');
    blocks[i] = lines.join('\n');
  });
  return blocks.join('\n\n');
}
