// 问答缓存：相同问题（相同检索结果）返回完全一致的答案
import fs from 'node:fs';
import crypto from 'node:crypto';
import { QA_CACHE_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

const MAX_ENTRIES = 300; // 最多缓存条数（FIFO）

export function loadCache() {
  try {
    const obj = JSON.parse(fs.readFileSync(QA_CACHE_FILE, 'utf-8'));
    return Array.isArray(obj) ? obj : [];
  } catch {
    return [];
  }
}

function saveCache(list) {
  writeJsonAtomic(QA_CACHE_FILE, list);
}

/**
 * 生成缓存键：问题 + 检索结果（法规 id + 相关度）确定检索内容，
 * 法规库更新 → 检索结果变化 → 键变化 → 自动失效。
 */
export function qaCacheKey(question, results, topK = 8) {
  const sig = results
    .map((r) => `${r.regId}|${r.articleNum || ''}|${r.score || 0}`)
    .join('\n');
  return crypto.createHash('sha256').update(`${question}\n${topK}\n${sig}`).digest('hex');
}

export function getCachedAnswer(key) {
  return loadCache().find((e) => e.key === key) || null;
}

export function setCachedAnswer(key, { answer, results }) {
  const list = loadCache();
  list.unshift({ key, answer: String(answer || '').slice(0, 20000), results: (results || []).slice(0, 8), createdAt: new Date().toISOString() });
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  saveCache(list);
}

export function clearQaCache() {
  saveCache([]);
}

export function qaCacheStats() {
  return { entries: loadCache().length, max: MAX_ENTRIES };
}
