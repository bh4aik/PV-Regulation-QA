// 问询历史存储：data/state/history.json
import fs from 'node:fs';
import { nanoid } from './util.js';
import { HISTORY_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

const MAX_ITEMS = 500; // 最多保留条数

export function loadHistory() {
  try {
    const arr = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  writeJsonAtomic(HISTORY_FILE, list);
}

/**
 * 追加一条问答记录
 * @param {{question: string, answer: string, citations: Array, fallback?: boolean, fallbackReason?: string, mode?: string}} data
 */
export function appendHistory({ userId = '', username = '', question, answer = '', citations = [], fallback = false, fallbackReason = '', mode = 'ai' }) {
  const list = loadHistory();
  const item = {
    id: nanoid(14),
    userId,
    username,
    question: String(question || '').slice(0, 2000),
    answer: String(answer || '').slice(0, 20000),
    citations: (citations || []).slice(0, 20).map((c) => ({
      regId: c.regId || '',
      regTitle: c.regTitle || '',
      articleNum: c.articleNum || '',
      chapterTitle: c.chapterTitle || '',
      text: String(c.text || '').slice(0, 500),
    })),
    fallback: !!fallback,
    fallbackReason: String(fallbackReason || ''),
    mode, // ai | fallback
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
  saveHistory(list);
  return item;
}

export function getHistoryItem(id) {
  return loadHistory().find((h) => h.id === id) || null;
}

export function deleteHistoryItem(id) {
  const list = loadHistory().filter((h) => h.id !== id);
  saveHistory(list);
}

export function clearHistory() {
  saveHistory([]);
}

export function historySummary(limit = 100) {
  return loadHistory()
    .slice(0, limit)
    .map((h) => ({
      id: h.id,
      question: h.question,
      answerPreview: (h.answer || '').slice(0, 120),
      fallback: h.fallback,
      mode: h.mode,
      citationsCount: (h.citations || []).length,
      createdAt: h.createdAt,
    }));
}

export function historyStats() {
  return { total: loadHistory().length };
}
