// 待确认候选（爬虫发现的疑似新法规）
import fs from 'node:fs';
import { nanoid, now } from '../util.js';
import { CANDIDATES_FILE } from '../config.js';
import { writeJsonAtomic } from '../json-store.js';

export function loadCandidates() {
  try {
    return JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveCandidates(list) {
  writeJsonAtomic(CANDIDATES_FILE, list);
}

export function createCandidate({ sourceName, title, url, date = '' }) {
  const list = loadCandidates();
  if (list.some((c) => c.url === url)) return null;
  const cand = {
    id: nanoid(),
    sourceName,
    title,
    url,
    date,
    status: 'pending', // pending | ignored | cleaned
    taskId: '',
    createdAt: now(),
  };
  list.unshift(cand);
  saveCandidates(list);
  return cand;
}

export function getCandidate(id) {
  return loadCandidates().find((c) => c.id === id) || null;
}

export function updateCandidate(id, patch) {
  const list = loadCandidates();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  saveCandidates(list);
  return list[idx];
}

export function pendingCandidates() {
  return loadCandidates().filter((c) => c.status === 'pending');
}

export function recentCandidates(limit = 100) {
  return loadCandidates().slice(0, limit);
}

// 已见 URL 去重（持久化到 state/seen-urls.json）
import { SEEN_URLS_FILE } from '../config.js';

let seenCache = null;

export function getSeenSet() {
  if (seenCache) return seenCache;
  try {
    seenCache = new Set(JSON.parse(fs.readFileSync(SEEN_URLS_FILE, 'utf-8')));
  } catch {
    seenCache = new Set();
  }
  return seenCache;
}

export function saveSeenSet() {
  if (!seenCache) return;
  writeJsonAtomic(SEEN_URLS_FILE, [...seenCache]);
}
