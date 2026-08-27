// 行为分析与评分路由：引用点击埋点、回答评分、管理员分析
import { Router } from 'express';
import { recordCitationClick, addRating, analyticsSummary } from '../analytics.js';
import { getHistoryItem } from '../history.js';
import { authRequired, adminRequired } from '../middleware.js';

const router = Router();

// 引用条款点击埋点（零负担，前端静默上报）
router.post('/analytics/citation-click', authRequired, (req, res) => {
  const { regId, regTitle, articleNum, question } = req.body || {};
  if (!regId && !regTitle) return res.status(400).json({ error: '缺少引用信息' });
  recordCitationClick({
    userId: req.user.id,
    username: req.user.username,
    regId: String(regId || ''),
    regTitle: String(regTitle || ''),
    articleNum: String(articleNum || ''),
    question: String(question || ''),
  });
  res.json({ ok: true });
});

// 回答评分（👍/👎，同一 historyId 可覆盖）
router.post('/analytics/rating', authRequired, (req, res) => {
  const { historyId, rating, tags, note } = req.body || {};
  if (!historyId) return res.status(400).json({ error: '缺少问答标识' });
  if (!['up', 'down'].includes(rating)) return res.status(400).json({ error: '评分取值无效' });
  // 校验 historyId 归属（防止越权评分他人的问答）
  const item = getHistoryItem(historyId);
  if (item && req.user.role !== 'admin' && item.userId !== req.user.id) {
    return res.status(403).json({ error: '无权评价他人的问答' });
  }
  const question = item?.question || String(req.body.question || '').slice(0, 500);
  const result = addRating({
    historyId,
    userId: req.user.id,
    username: req.user.username,
    question,
    rating,
    tags: Array.isArray(tags) ? tags : [],
    note: String(note || ''),
  });
  res.json({ ok: true, rating: result });
});

// 管理员：行为分析洞察
router.get('/admin/analytics', adminRequired, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  res.json(analyticsSummary(days));
});

export default router;
