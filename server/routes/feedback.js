// 反馈路由：用户提交/查看自己的反馈；管理员统一处理
import { Router } from 'express';
import {
  createFeedback, listFeedbackByUser, loadFeedback, updateFeedback, deleteFeedback,
  FEEDBACK_TYPES, FEEDBACK_STATUS, feedbackStats,
} from '../feedback.js';
import { authRequired, adminRequired } from '../middleware.js';

const router = Router();

// 提交反馈（所有登录用户）
router.post('/feedback', authRequired, (req, res) => {
  const { type = 'other', content, contact } = req.body || {};
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ error: '反馈内容不能为空' });
  if (text.length < 5) return res.status(400).json({ error: '反馈内容至少 5 个字符' });
  const fb = createFeedback({
    userId: req.user.id,
    username: req.user.username,
    type: FEEDBACK_TYPES[type] ? type : 'other',
    content: text,
    contact: String(contact || '').trim(),
  });
  res.json({ ok: true, feedback: fb });
});

// 我的反馈
router.get('/feedback/mine', authRequired, (req, res) => {
  res.json({ feedbacks: listFeedbackByUser(req.user.id) });
});

// 反馈类型与状态枚举
router.get('/feedback/meta', authRequired, (req, res) => {
  res.json({ types: FEEDBACK_TYPES, statuses: FEEDBACK_STATUS });
});

// ---------- 管理员 ----------

// 所有反馈（可按状态过滤）
router.get('/admin/feedback', adminRequired, (req, res) => {
  const { status } = req.query;
  let list = loadFeedback();
  if (status && FEEDBACK_STATUS[status]) list = list.filter((f) => f.status === status);
  res.json({ feedbacks: list, stats: feedbackStats(), statuses: FEEDBACK_STATUS, types: FEEDBACK_TYPES });
});

// 更新反馈（状态 / 备注）
router.patch('/admin/feedback/:id', adminRequired, (req, res) => {
  const { status, adminNote } = req.body || {};
  const patch = { by: req.user.username };
  if (status && FEEDBACK_STATUS[status]) patch.status = status;
  if (typeof adminNote === 'string') patch.adminNote = adminNote.slice(0, 1000);
  const updated = updateFeedback(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: '反馈不存在' });
  res.json({ ok: true, feedback: updated });
});

// 删除反馈
router.delete('/admin/feedback/:id', adminRequired, (req, res) => {
  deleteFeedback(req.params.id);
  res.json({ ok: true });
});

export default router;
