// 用户行为分析：问答埋点 + 引用点击 + 回答评分
import fs from 'node:fs';
import { nanoid, now } from './util.js';
import { tokenize } from './rag/tokenizer.js';
import { ANALYTICS_FILE, RATINGS_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

const MAX_EVENTS = 5000;
const MAX_RATINGS = 5000;

// 中文停用词（关键词分析时过滤）
const STOPWORDS = new Set([
  '的', '了', '是', '吗', '呢', '啊', '吧', '什么', '怎么', '如何', '哪些', '哪', '什么',
  '要求', '规定', '相关', '请问', '一下', '这个', '那个', '对于', '关于', '以及', '还有',
  '有', '在', '和', '与', '或', '及', '等', '中', '上', '下', '要', '会', '能', '可以',
  '需要', '应该', '应当', '根据', '按照', '其中', '进行', '一个', '什么', '为什么', '多少',
  '多久', '是否', '不', '都', '也', '就', '而', '但', '该', '其', '这', '那', '你', '我',
  '他', '她', '它', '我们', '你们', '他们', '吗', '呢', '为', '被', '把', '让', '给',
]);

export function loadEvents() {
  try {
    const arr = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveEvents(list) {
  if (list.length > MAX_EVENTS) list = list.slice(0, MAX_EVENTS);
  writeJsonAtomic(ANALYTICS_FILE, list);
}

export function loadRatings() {
  try {
    const arr = JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRatings(list) {
  if (list.length > MAX_RATINGS) list = list.slice(0, MAX_RATINGS);
  writeJsonAtomic(RATINGS_FILE, list);
}

// 记录一次问答（检索命中的法规 + 最终引用的法规）
export function recordQaEvent({ userId, username, question, answerLen, model, retrieved = [], cited = [] }) {
  const list = loadEvents();
  list.unshift({
    id: 'ev_' + nanoid(10),
    type: 'qa',
    userId,
    username,
    question: String(question || '').slice(0, 500),
    answerLen: answerLen || 0,
    model: model || '',
    retrieved: (retrieved || []).slice(0, 15).map((r) => ({ regId: r.regId, regTitle: r.regTitle, articleNum: r.articleNum })),
    cited: (cited || []).slice(0, 15).map((r) => ({ regId: r.regId, regTitle: r.regTitle, articleNum: r.articleNum })),
    ts: now(),
  });
  saveEvents(list);
}

// 记录引用条款点击（用户点了回答里的引用跳转）
export function recordCitationClick({ userId, username, regId, regTitle, articleNum, question = '' }) {
  const list = loadEvents();
  list.unshift({
    id: 'ev_' + nanoid(10),
    type: 'citation_click',
    userId,
    username,
    regId,
    regTitle,
    articleNum,
    question: String(question || '').slice(0, 300),
    ts: now(),
  });
  saveEvents(list);
}

// 提交/更新回答评分（同一 historyId 可覆盖）
export function addRating({ historyId, userId, username, question, rating, tags = [], note = '' }) {
  const list = loadRatings();
  const idx = list.findIndex((r) => r.historyId === historyId);
  const item = {
    id: 'r_' + nanoid(10),
    historyId,
    userId,
    username,
    question: String(question || '').slice(0, 500),
    rating, // 'up' | 'down'
    tags: (tags || []).slice(0, 4),
    note: String(note || '').slice(0, 300),
    createdAt: now(),
  };
  if (idx === -1) list.unshift(item);
  else {
    item.id = list[idx].id;
    item.createdAt = list[idx].createdAt;
    list[idx] = { ...item, updatedAt: now() };
  }
  saveRatings(list);
  return item;
}

// 聚合分析（近 days 天）
export function analyticsSummary(days = 30) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const events = loadEvents().filter((e) => new Date(e.ts).getTime() > cutoff);
  const ratings = loadRatings().filter((r) => new Date(r.createdAt).getTime() > cutoff);
  const qaEvents = events.filter((e) => e.type === 'qa');
  const clicks = events.filter((e) => e.type === 'citation_click');

  // 关键词统计
  const kwCount = new Map();
  for (const e of qaEvents) {
    for (const t of tokenize(e.question)) {
      if (t.length < 2) continue;
      if (STOPWORDS.has(t)) continue;
      kwCount.set(t, (kwCount.get(t) || 0) + 1);
    }
  }
  const keywords = [...kwCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, c]) => ({ keyword: k, count: c }));

  // 被引用法规统计（cited）
  const citedReg = new Map();
  for (const e of qaEvents) {
    for (const r of e.cited || []) {
      const key = `${r.regTitle}|${r.articleNum}`;
      citedReg.set(key, (citedReg.get(key) || 0) + 1);
    }
  }
  const topCited = [...citedReg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, c]) => {
    const [regTitle, articleNum] = k.split('|');
    return { regTitle, articleNum, count: c };
  });

  // 法规命中（retrieved，体现召回）与被引用对比
  const retrievedReg = new Map();
  for (const e of qaEvents) {
    for (const r of e.retrieved || []) {
      const key = `${r.regTitle}|${r.articleNum}`;
      retrievedReg.set(key, (retrievedReg.get(key) || 0) + 1);
    }
  }
  // 被检索到但从未被引用的条款（召回但没被采纳）
  const citedKeys = new Set(citedReg.keys());
  const retrievedNotCited = [...retrievedReg.entries()]
    .filter(([k]) => !citedKeys.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, c]) => { const [regTitle, articleNum] = k.split('|'); return { regTitle, articleNum, count: c }; });

  // 评分统计
  const upCount = ratings.filter((r) => r.rating === 'up').length;
  const downCount = ratings.filter((r) => r.rating === 'down').length;
  const tagCount = new Map();
  for (const r of ratings) {
    for (const t of r.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  }
  const downReasons = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));

  // 用户活跃度
  const userQa = new Map();
  for (const e of qaEvents) userQa.set(e.userId, (userQa.get(e.userId) || 0) + 1);
  const userRatings = new Map();
  for (const r of ratings) userRatings.set(r.userId, (userRatings.get(r.userId) || 0) + 1);
  const userActivity = [...userQa.entries()]
    .map(([userId, qa]) => {
      const ev = qaEvents.find((e) => e.userId === userId);
      return { userId, username: ev?.username || '?', qaCount: qa, ratingCount: userRatings.get(userId) || 0 };
    })
    .sort((a, b) => b.qaCount - a.qaCount)
    .slice(0, 20);

  // 高频原问题（展示用户实际反复问的）
  const qCount = new Map();
  for (const e of qaEvents) {
    const q = e.question.slice(0, 60);
    qCount.set(q, (qCount.get(q) || 0) + 1);
  }
  const topQuestions = [...qCount.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([q, c]) => ({ question: q, count: c }));

  // 生成洞察
  const insights = [];
  if (keywords.length) insights.push(`用户最关心的主题：${keywords.slice(0, 5).map((k) => k.keyword).join('、')}`);
  if (downCount > 0) {
    const downRate = Math.round((downCount / (upCount + downCount)) * 100);
    insights.push(`回答不满意率 ${downRate}%（${downCount} 次 👎 / ${upCount} 次 👍），主要原因是${downReasons.length ? downReasons[0].tag : '未标注'}`);
  } else if (upCount > 0) {
    insights.push('近期回答均为正面评价 👍');
  }
  if (retrievedNotCited.length) {
    insights.push(`有 ${retrievedNotCited.length} 类条款被检索到但从未被引用，可能存在召回精度问题：${retrievedNotCited.slice(0, 3).map((r) => r.regTitle).join('、')}`);
  }
  if (topQuestions.length) insights.push(`重复提问最多的问题：${topQuestions[0].question}`);

  return {
    days,
    totalQa: qaEvents.length,
    totalRatings: ratings.length,
    upCount,
    downCount,
    upRate: upCount + downCount > 0 ? Math.round((upCount / (upCount + downCount)) * 100) : null,
    keywords,
    topCited,
    retrievedNotCited,
    downReasons,
    userActivity,
    topQuestions,
    citationClicks: clicks.length,
    insights,
  };
}
