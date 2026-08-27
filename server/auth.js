// 账号体系：用户、会话（token）、密码哈希、用量统计
import fs from 'node:fs';
import crypto from 'node:crypto';
import { nanoid, now } from './util.js';
import { USERS_FILE, SESSIONS_FILE, USAGE_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 会话有效期 7 天
const USAGE_KEEP_DAYS = 90; // 用量明细保留天数

// ---------- 密码哈希（scrypt） ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  try {
    const h = crypto.scryptSync(String(password), String(salt), 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(String(hash), 'hex'));
  } catch {
    return false;
  }
}

// ---------- 用户存储 ----------
export function loadUsers() {
  try {
    const arr = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUsers(list) {
  writeJsonAtomic(USERS_FILE, list);
}

export function findUserByUsername(username) {
  const u = String(username || '').trim().toLowerCase();
  return loadUsers().find((x) => x.username.toLowerCase() === u) || null;
}

export function findUserByEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  return loadUsers().find((x) => (x.email || '').toLowerCase() === e) || null;
}

export function findUserByPhone(phone) {
  const p = String(phone || '').trim();
  if (!p) return null;
  return loadUsers().find((x) => x.phone === p) || null;
}

export function findUserById(id) {
  return loadUsers().find((x) => x.id === id) || null;
}

export function countUsers() {
  return loadUsers().length;
}

export function createUser({ username, email, password, phone = '', role = 'user' }) {
  const list = loadUsers();
  const mail = String(email || '').trim().toLowerCase();
  // 用户名选填：未提供时用邮箱作为默认用户名
  const name = String(username || '').trim() || mail;
  const { salt, hash } = hashPassword(password);
  // 仅当系统尚无任何用户且开启 AUTO_FIRST_ADMIN（默认开，公网部署建议关闭）时，首个注册者成为管理员
  const autoAdmin = list.length === 0 && process.env.AUTO_FIRST_ADMIN !== 'false';
  const user = {
    id: 'u_' + nanoid(10),
    username: name,
    email: mail,
    phone: String(phone || '').trim(),
    passwordSalt: salt,
    passwordHash: hash,
    role: autoAdmin ? 'admin' : role,
    status: 'active',
    createdAt: now(),
    lastLoginAt: null,
    qaCount: 0,
    lastQaAt: null,
  };
  list.push(user);
  saveUsers(list);
  return publicUser(user);
}

export function updateUser(id, patch) {
  const list = loadUsers();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  if (patch.password) {
    const { salt, hash } = hashPassword(patch.password);
    list[idx].passwordSalt = salt;
    list[idx].passwordHash = hash;
    delete patch.password;
  }
  list[idx] = { ...list[idx], ...patch };
  saveUsers(list);
  return publicUser(list[idx]);
}

export function deleteUser(id) {
  const list = loadUsers().filter((x) => x.id !== id);
  saveUsers(list);
}

export function recordQaUsage(userId) {
  const list = loadUsers();
  const idx = list.findIndex((x) => x.id === userId);
  if (idx === -1) return;
  list[idx].qaCount = (list[idx].qaCount || 0) + 1;
  list[idx].lastQaAt = now();
  saveUsers(list);
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email || '',
    phone: u.phone || '',
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    qaCount: u.qaCount || 0,
    lastQaAt: u.lastQaAt,
  };
}

// ---------- 会话 ----------
export function loadSessions() {
  try {
    const arr = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSessions(list) {
  writeJsonAtomic(SESSIONS_FILE, list);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = loadSessions().filter(
    (s) => s.userId !== userId || Date.now() - new Date(s.createdAt).getTime() < SESSION_TTL_MS
  );
  sessions.push({ token, userId, createdAt: now(), expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  saveSessions(sessions);
  return token;
}

export function getUserByToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const s = sessions.find((x) => x.token === token);
  if (!s) return null;
  if (Date.now() > new Date(s.expiresAt).getTime()) {
    saveSessions(sessions.filter((x) => x.token !== token));
    return null;
  }
  const user = findUserById(s.userId);
  if (!user || user.status !== 'active') return null;
  return publicUser(user);
}

export function destroySession(token) {
  saveSessions(loadSessions().filter((x) => x.token !== token));
}

// ---------- 用量明细 ----------
export function appendUsage({ userId, username, chars }) {
  const list = loadUsage();
  list.push({ userId, username, ts: now(), chars: chars || 0 });
  // 裁剪过期明细
  const cutoff = Date.now() - USAGE_KEEP_DAYS * 24 * 3600 * 1000;
  const kept = list.filter((u) => new Date(u.ts).getTime() > cutoff);
  writeJsonAtomic(USAGE_FILE, kept);
}

export function loadUsage() {
  try {
    const arr = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// 统计某用户今天已问答次数（用于每日限额）
export function countTodayQa(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return loadUsage().filter((u) => u.userId === userId && new Date(u.ts).toISOString().slice(0, 10) === today).length;
}

// 用量分析：按天（最近 days 天）+ 按用户
export function usageAnalysis(days = 14) {
  const usage = loadUsage();
  const users = loadUsers();
  const byDay = {};
  const nowMs = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = 0;
  }
  for (const u of usage) {
    const key = new Date(u.ts).toISOString().slice(0, 10);
    if (key in byDay) byDay[key] += 1;
  }
  const byUser = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      status: u.status,
      qaCount: u.qaCount || 0,
      lastQaAt: u.lastQaAt,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }))
    .sort((a, b) => b.qaCount - a.qaCount);
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalUsers: users.length,
    totalQa: users.reduce((s, u) => s + (u.qaCount || 0), 0),
    todayQa: byDay[today] || 0,
    activeUsers: users.filter((u) => u.lastQaAt).length,
    byDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    byUser,
  };
}
