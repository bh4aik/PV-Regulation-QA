// 管理员路由：用户管理 + 用量分析 + 系统日志（仅 admin）
import { Router } from 'express';
import {
  loadUsers, findUserById, updateUser, deleteUser, publicUser, usageAnalysis,
} from '../auth.js';
import { adminRequired } from '../middleware.js';
import { loadChangelog, appendChangelog, deleteChangelog } from '../changelog.js';

const router = Router();

// 用户列表
router.get('/admin/users', adminRequired, (req, res) => {
  const users = loadUsers()
    .map(publicUser)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ users });
});

// 用量分析
router.get('/admin/stats', adminRequired, (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  res.json(usageAnalysis(days));
});

// 修改用户（角色 / 状态 / 密码 / 手机号）
router.patch('/admin/users/:id', adminRequired, (req, res) => {
  const { role, status, password, phone } = req.body || {};
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: '用户不存在' });

  if (target.id === req.user.id) {
    if (role && role !== 'admin') return res.status(400).json({ error: '不能取消自己的管理员权限' });
    if (status === 'disabled') return res.status(400).json({ error: '不能禁用自己' });
  }
  // 保护最后一个管理员
  if (target.role === 'admin' && role && role !== 'admin') {
    const adminCount = loadUsers().filter((u) => u.role === 'admin' && u.status === 'active').length;
    if (adminCount <= 1) return res.status(400).json({ error: '至少保留一名管理员' });
  }

  const patch = {};
  if (role && ['admin', 'user'].includes(role)) patch.role = role;
  if (status && ['active', 'disabled'].includes(status)) patch.status = status;
  if (typeof password === 'string') {
    if (password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: '密码需为 12-128 位' });
    }
    patch.password = password;
  }
  if (typeof phone === 'string' && (!phone || /^1\d{10}$/.test(phone))) patch.phone = phone.trim();

  const updated = updateUser(target.id, patch);
  res.json({ ok: true, user: updated });
});

// 删除用户
router.delete('/admin/users/:id', adminRequired, (req, res) => {
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.id === req.user.id) return res.status(400).json({ error: '不能删除自己的账号' });
  if (target.role === 'admin') {
    const adminCount = loadUsers().filter((u) => u.role === 'admin' && u.status === 'active').length;
    if (adminCount <= 1) return res.status(400).json({ error: '至少保留一名管理员' });
  }
  deleteUser(target.id);
  res.json({ ok: true });
});

// 系统日志列表（版本升级 / 功能新增 / 问题修正）
router.get('/admin/changelog', adminRequired, (req, res) => {
  res.json({ entries: loadChangelog() });
});

// 追加系统日志
router.post('/admin/changelog', adminRequired, (req, res) => {
  const { version, title, kind, items } = req.body || {};
  if (!title || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '标题与内容不能为空' });
  }
  const item = appendChangelog({ version, title, kind, items, by: req.user.username });
  res.json({ ok: true, entry: item });
});

// 删除系统日志
router.delete('/admin/changelog/:id', adminRequired, (req, res) => {
  deleteChangelog(req.params.id);
  res.json({ ok: true });
});

export default router;
