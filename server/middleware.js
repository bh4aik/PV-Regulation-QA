// 认证中间件：登录校验 / 管理员校验 / 速率限制
import { getUserByToken } from './auth.js';

export function getToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

export function authRequired(req, res, next) {
  const user = getUserByToken(getToken(req));
  if (!user) return res.status(401).json({ error: '请先登录' });
  req.user = user;
  next();
}

export function adminRequired(req, res, next) {
  const user = getUserByToken(getToken(req));
  if (!user) return res.status(401).json({ error: '请先登录' });
  if (user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  req.user = user;
  next();
}

// 速率限制：基于 IP 的滑动窗口限流（内存实现，单实例够用）
const ipCounters = new Map(); // ip -> { count, windowStart }

export function rateLimit({ windowMs = 60 * 1000, max = 10, message = '操作过于频繁，请稍后再试' } = {}) {
  // 定期清理过期记录，防止内存无限增长
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of ipCounters) {
      if (now - rec.windowStart > windowMs * 2) ipCounters.delete(ip);
    }
  }, 5 * 60 * 1000).unref?.();
  return (req, res, next) => {
    // req.ip 依赖 Express trust proxy 配置（见 index.js），比手动解析 x-forwarded-for 更安全
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let rec = ipCounters.get(ip);
    if (!rec || now - rec.windowStart > windowMs) {
      rec = { count: 0, windowStart: now };
      ipCounters.set(ip, rec);
    }
    rec.count++;
    if (rec.count > max) {
      // 告知客户端多久后可重试（RFC 6585）
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowMs - (now - rec.windowStart)) / 1000))));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
