// 认证路由：注册 / 登录 / 登出 / 当前用户
import { Router } from 'express';
import {
  createUser, findUserByUsername, findUserByPhone, findUserByEmail, verifyPassword,
  createSession, destroySession, publicUser, updateUser, countUsers,
} from '../auth.js';
import { authRequired, getToken, rateLimit } from '../middleware.js';
import { getSettings } from '../config.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cloudflare Turnstile 校验：向 CF 验证 token 有效性
async function verifyTurnstile(token) {
  const settings = getSettings();
  const secret = settings.turnstileSecretKey || process.env.TURNSTILE_SECRET_KEY || '';
  if (!secret || !token) return false;
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// 注册：邮箱 + 密码必填；用户名/手机号选填（无用户名时用邮箱作默认用户名）
// 防护：速率限制（同 IP 限次）+ 注册开关 + 可选邀请码
router.post('/auth/register', rateLimit({ windowMs: 60 * 1000, max: 5, message: '注册请求过于频繁，请稍后再试' }), async (req, res) => {
  // 注册开关与邀请码（管理员可在设置页配置）
  const settings = getSettings();
  if (settings.signupEnabled === false) {
    return res.status(403).json({ error: '注册功能已关闭，请联系管理员' });
  }
  const inviteCode = String(settings.inviteCode || '').trim();
  if (inviteCode) {
    const provided = String(req.body?.inviteCode || '').trim();
    if (provided !== inviteCode) {
      return res.status(403).json({ error: '邀请码不正确' });
    }
  }

  // Turnstile 人机验证（若已启用）
  if (settings.turnstileEnabled) {
    const turnstileToken = String(req.body?.turnstileToken || '').trim();
    if (!turnstileToken) return res.status(400).json({ error: '请完成人机验证' });
    const ok = await verifyTurnstile(turnstileToken);
    if (!ok) return res.status(400).json({ error: '人机验证失败，请重试' });
  }

  const { username, email, password, phone } = req.body || {};
  const name = String(username || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  const ph = String(phone || '').trim();

  if (!mail) return res.status(400).json({ error: '请输入邮箱地址' });
  if (mail.length > 254) return res.status(400).json({ error: '邮箱地址过长' });
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (pass.length < 12 || pass.length > 128) return res.status(400).json({ error: '密码需为 12-128 位' });
  if (name && (name.length < 2 || name.length > 30)) return res.status(400).json({ error: '用户名需为 2-30 个字符（可留空）' });
  if (ph && !/^1\d{10}$/.test(ph)) return res.status(400).json({ error: '手机号格式不正确' });
  if (findUserByEmail(mail)) return res.status(409).json({ error: '该邮箱已注册' });
  if (name && findUserByUsername(name)) return res.status(409).json({ error: '用户名已存在' });
  if (ph && findUserByPhone(ph)) return res.status(409).json({ error: '该手机号已绑定其他账号' });

  const user = createUser({ username: name, email: mail, password: pass, phone: ph });
  const token = createSession(user.id);
  updateUser(user.id, { lastLoginAt: new Date().toISOString() });
  res.json({ ok: true, token, user: { ...user, lastLoginAt: new Date().toISOString() }, isFirst: user.role === 'admin' });
});

// 登录：邮箱为主，兼容用户名/手机号；防暴力破解限流
router.post('/auth/login', rateLimit({ windowMs: 60 * 1000, max: 10, message: '登录尝试过于频繁，请稍后再试' }), (req, res) => {
  const { account, password } = req.body || {};
  const acc = String(account || '').trim();
  const pass = String(password || '');
  if (!acc || !pass) return res.status(400).json({ error: '请输入邮箱和密码' });
  if (acc.length > 254 || pass.length > 128) return res.status(400).json({ error: '账号或密码格式不正确' });

  let user = findUserByEmail(acc) || findUserByUsername(acc) || findUserByPhone(acc);
  if (!user || !verifyPassword(pass, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: '该账号已被禁用，请联系管理员' });

  const token = createSession(user.id);
  updateUser(user.id, { lastLoginAt: new Date().toISOString() });
  res.json({ ok: true, token, user: { ...publicUser(user), lastLoginAt: new Date().toISOString() } });
});

// 登出
router.post('/auth/logout', (req, res) => {
  destroySession(getToken(req));
  res.json({ ok: true });
});

// 当前用户
router.get('/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// 公开：Turnstile 配置（仅返回 siteKey，不返回 secretKey）
router.get('/public/turnstile', (req, res) => {
  const s = getSettings();
  const siteKey = s.turnstileSiteKey || process.env.TURNSTILE_SITE_KEY || '';
  res.json({ enabled: !!s.turnstileEnabled && !!siteKey, siteKey });
});

// 公开：是否需要提示"首个注册用户自动成为管理员"（仅 AUTO_FIRST_ADMIN 开启且无用户时）
router.get('/public/needs-admin', (req, res) => {
  res.json({ needsAdmin: process.env.AUTO_FIRST_ADMIN !== 'false' && countUsers() === 0 });
});
export default router;
