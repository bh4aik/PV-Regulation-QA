// 用户反馈存储：data/state/feedback.json
import fs from 'node:fs';
import { nanoid, now } from './util.js';
import { FEEDBACK_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

export const FEEDBACK_TYPES = {
  bug: '问题反馈',
  feature: '功能建议',
  other: '其他',
};

export const FEEDBACK_STATUS = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

export function loadFeedback() {
  try {
    const arr = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFeedback(list) {
  writeJsonAtomic(FEEDBACK_FILE, list);
}

export function createFeedback({ userId, username, type = 'other', content, contact = '' }) {
  const list = loadFeedback();
  const item = {
    id: 'fb_' + nanoid(10),
    userId,
    username,
    type,
    content: String(content || '').slice(0, 2000),
    contact: String(contact || '').slice(0, 100),
    status: 'pending',
    adminNote: '',
    statusHistory: [{ status: 'pending', at: now(), by: 'system' }],
    createdAt: now(),
    updatedAt: now(),
  };
  list.unshift(item);
  saveFeedback(list);
  return item;
}

export function listFeedbackByUser(userId) {
  return loadFeedback().filter((f) => f.userId === userId);
}

export function updateFeedback(id, patch) {
  const list = loadFeedback();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const prev = list[idx];
  if (patch.status && patch.status !== prev.status) {
    prev.statusHistory = prev.statusHistory || [];
    prev.statusHistory.push({ status: patch.status, at: now(), by: patch.by || 'admin' });
  }
  list[idx] = { ...prev, ...patch, updatedAt: now() };
  saveFeedback(list);
  return list[idx];
}

export function deleteFeedback(id) {
  saveFeedback(loadFeedback().filter((f) => f.id !== id));
}

export function feedbackStats() {
  const list = loadFeedback();
  return {
    total: list.length,
    pending: list.filter((f) => f.status === 'pending').length,
    processing: list.filter((f) => f.status === 'processing').length,
    resolved: list.filter((f) => f.status === 'resolved').length,
  };
}
