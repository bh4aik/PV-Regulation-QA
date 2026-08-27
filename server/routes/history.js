// 问询历史路由
import { Router } from 'express';
import { loadHistory, deleteHistoryItem, clearHistory } from '../history.js';
import { authRequired } from '../middleware.js';

const router = Router();

// 历史列表（摘要）——普通用户仅看自己的；管理员可看全部
router.get('/history', authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const all = loadHistory();
  const mine = req.user.role === 'admin' ? all : all.filter((h) => h.userId === req.user.id);
  const items = mine.slice(0, limit).map((h) => ({
    id: h.id,
    question: h.question,
    answerPreview: (h.answer || '').slice(0, 120),
    fallback: h.fallback,
    mode: h.mode,
    citationsCount: (h.citations || []).length,
    createdAt: h.createdAt,
  }));
  res.json({ items, total: mine.length });
});

// 单条详情
router.get('/history/:id', authRequired, (req, res) => {
  const item = loadHistory().find((h) => h.id === req.params.id);
  if (!item) return res.status(404).json({ error: '记录不存在' });
  if (req.user.role !== 'admin' && item.userId !== req.user.id) {
    return res.status(403).json({ error: '无权查看他人的历史记录' });
  }
  res.json({ item });
});

// 删除单条
router.delete('/history/:id', authRequired, (req, res) => {
  const item = loadHistory().find((h) => h.id === req.params.id);
  if (!item) return res.status(404).json({ error: '记录不存在' });
  if (req.user.role !== 'admin' && item.userId !== req.user.id) {
    return res.status(403).json({ error: '无权删除他人的历史记录' });
  }
  deleteHistoryItem(req.params.id);
  res.json({ ok: true });
});

// 清空全部
router.delete('/history', authRequired, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  clearHistory();
  res.json({ ok: true });
});

export default router;
