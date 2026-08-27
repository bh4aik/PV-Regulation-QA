// 问答路由：POST /api/qa（SSE 流式）
// 一致性：相同问题（相同检索结果）命中缓存后直接重放相同答案
// 两阶段检索：显式条款定位（《法规》第X条）→ 或 BM25 检索 30 条 → LLM 重排精选 15 条 → 生成回答
// 每次问答记录分析埋点（问题/检索/引用/模型），并在 done 事件返回 historyId 供评分关联
import { Router } from 'express';
import { searchRegulations, buildAnswerStream, resolveExplicitCitation, detectRegion, queryRewrite } from '../rag/qa.js';
import { rerankCandidates } from '../rag/rerank.js';
import { appendHistory } from '../history.js';
import { recordQaUsage, appendUsage, countTodayQa } from '../auth.js';
import { recordQaEvent } from '../analytics.js';
import { getSettings, getDeepSeekConfig } from '../config.js';
import { authRequired, rateLimit } from '../middleware.js';
import { qaCacheKey, getCachedAnswer, setCachedAnswer } from '../qa-cache.js';
import { fixListNumbering } from '../util.js';

const router = Router();

const CANDIDATE_COUNT = 30; // 初检索候选数
const FINAL_COUNT = 15; // 重排后精选条数
const MAX_QUESTION_LENGTH = 2000;
const inFlightByUser = new Map();

function sanitizeResults(results) {
  return (results || []).map((r) => ({
    regId: r.regId,
    regTitle: r.regTitle,
    articleNum: r.articleNum,
    chapterTitle: r.chapterTitle,
    country: r.country || '',
    text: (r.text || '').slice(0, 400),
    score: r.score,
  }));
}

// 判断某条款属于欧盟法规（用 country 字段，缺失时回退标题启发式）
function isEuResult(r) {
  const c = String(r.country || '');
  if (c) return /欧盟|European Union|^\s*EU\s*$|Europe/i.test(c);
  return /GVP|Directive|Regulation \(EU\)|European Medicines Agency|European Union|\(EU\)|PRAC/i.test(r.regTitle || '');
}

// 地区均衡：对比类问题（如"欧盟vs中国"）rerank 后强制两边都有条款。
// 若某地区条款缺失/过少，从原始候选（rawResults）中按分数补足。
function balanceRegions(results, rawResults, question, region) {
  if (!region || (region !== 'eu' && region !== 'us')) return results;
  if (!/对比|比较|差异|区别|不同|difference|compare|vs\.?|versus/i.test(question)) return results;

  const out = [...results];
  const euCount = out.filter(isEuResult).length;
  const otherCount = out.length - euCount;
  const MIN_PER_SIDE = 3; // 每边至少保留 3 条

  // 补欧盟侧
  if (euCount < MIN_PER_SIDE) {
    const want = MIN_PER_SIDE - euCount;
    const missing = rawResults
      .filter((r) => isEuResult(r) && !out.some((x) => x.regId === r.regId && x.articleNum === r.articleNum))
      .sort((a, b) => b.score - a.score)
      .slice(0, want);
    // 替换掉分数最低的非欧盟条款（若存在），否则追加
    for (const m of missing) {
      const replaceIdx = out.findIndex((x) => !isEuResult(x));
      if (replaceIdx >= 0) out[replaceIdx] = m;
      else out.push(m);
    }
  }
  // 补非欧盟侧（中国等）
  if (otherCount < MIN_PER_SIDE) {
    const want = MIN_PER_SIDE - otherCount;
    const missing = rawResults
      .filter((r) => !isEuResult(r) && !out.some((x) => x.regId === r.regId && x.articleNum === r.articleNum))
      .sort((a, b) => b.score - a.score)
      .slice(0, want);
    for (const m of missing) {
      const replaceIdx = out.findIndex((x) => isEuResult(x));
      if (replaceIdx >= 0) out[replaceIdx] = m;
      else out.push(m);
    }
  }
  return out.slice(0, FINAL_COUNT);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function* chunkText(text, size = 40) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

// 统一记录：历史 + 用量 + 分析埋点（后台，不阻塞响应），返回 historyId
function recordAll({ req, q, answer, citations, retrieved, fallback = false, fallbackReason = '', mode = 'ai' }) {
  const hist = appendHistory({
    userId: req.user.id, username: req.user.username, question: q,
    answer, citations, fallback, fallbackReason, mode,
  });
  recordQaUsage(req.user.id);
  appendUsage({ userId: req.user.id, username: req.user.username, chars: q.length + (answer || '').length });
  recordQaEvent({
    userId: req.user.id, username: req.user.username, question: q,
    answerLen: (answer || '').length,
    model: getDeepSeekConfig().model,
    retrieved,
    cited: citations,
  });
  return hist.id;
}

router.post('/qa', authRequired, rateLimit({ windowMs: 60 * 1000, max: 20 }), async (req, res) => {
  const { question } = req.body || {};
  const q = String(question || '').trim();
  if (!q) {
    return res.status(400).json({ error: '问题不能为空' });
  }
  if (q.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `问题不能超过 ${MAX_QUESTION_LENGTH} 个字符` });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // 0) 每日问答限额（普通用户；管理员不受限）
  if (req.user.role !== 'admin') {
    const limit = Number(getSettings().dailyQaLimit) || 20;
    const inFlight = inFlightByUser.get(req.user.id) || 0;
    if (countTodayQa(req.user.id) + inFlight >= limit) {
      send({ type: 'error', message: `今日 AI 问答次数已达上限（${limit} 次/天），请明天再试或联系管理员` });
      send({ type: 'done' });
      return res.end();
    }
    inFlightByUser.set(req.user.id, inFlight + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const remaining = (inFlightByUser.get(req.user.id) || 1) - 1;
      if (remaining > 0) inFlightByUser.set(req.user.id, remaining);
      else inFlightByUser.delete(req.user.id);
    };
    res.once('finish', release);
    res.once('close', release);
  }

  // 1) 显式条款定位（用户直接指定《法规》第X条）：精确命中则跳过 BM25/rerank，避免英文翻译全文
  //    被当检索词召回大量无关条款（如"根据《药物警戒质量管理规范》第十七条，原文翻译如下：…"）
  const exact = resolveExplicitCitation(q);
  let rawResults;
  let exactMode = false;
  if (exact.mode === 'exact') {
    rawResults = exact.results;
    exactMode = true;
  } else {
    // 查询改写（主路径）：每次检索都用 LLM 把用户问题改写成中英双语规范检索词，
    // 彻底消除"手动词表覆盖不全导致反复漏检"的问题（递交/频率/评估等高频词无需逐个手补）。
    // glossary 仍作为确定性补充在 searchRegulations 内展开；改写失败则静默降级为原问题。
    let searchQ = q;
    const rewritten = await queryRewrite(q);
    if (rewritten && rewritten !== q) searchQ = q + ' ' + rewritten;
    const r = searchRegulations(searchQ, CANDIDATE_COUNT, { diverse: false });
    rawResults = r.results;
  }
  if (!rawResults.length) {
    send({ type: 'fallback', reason: 'no-results', message: '未检索到相关法规条文，请换个问法', results: [] });
    send({ type: 'done' });
    return res.end();
  }

  // 2) 缓存键 + 命中检查（exactMode 用独立 topK 维度区分缓存，避免与常规检索互相污染）
  const cacheKey = qaCacheKey(q, rawResults, exactMode ? -1 : CANDIDATE_COUNT);
  const cached = getCachedAnswer(cacheKey);

  if (cached && cached.answer) {
    const citations = sanitizeResults(cached.results || rawResults.slice(0, FINAL_COUNT));
    // 先保存历史拿 historyId（缓存命中也算一次问答，参与评分与分析）
    const historyId = recordAll({ req, q, answer: cached.answer, citations, retrieved: rawResults });
    send({ type: 'meta', results: citations });
    try {
      for (const piece of chunkText(cached.answer)) {
        send({ type: 'delta', text: piece });
        await sleep(12);
      }
      send({ type: 'done', historyId });
    } catch (e) {
      send({ type: 'error', message: e.message });
    }
    return res.end();
  }

  // 3) LLM 重排（显式定位命中时跳过——用户已指明条款，重排会把精确单条稀释成 15 条不相关）
  let results = exactMode ? rawResults : await rerankCandidates(q, rawResults, { topN: FINAL_COUNT });
  // 对比类问题（如"欧盟vs中国"）：rerank 后强制中欧两边都有条款
  results = balanceRegions(results, rawResults, q, detectRegion(q));
  const citations = sanitizeResults(results);

  // 4) 生成流式回答（exactMode 传 exact: true，要求 LLM 只围绕指定条款回答）
  const stream = await buildAnswerStream(q, results, { exact: exactMode });
  if (stream.type === 'fallback') {
    send({ type: 'fallback', reason: stream.reason, message: stream.message, results: citations });
    const historyId = recordAll({ req, q, answer: '', citations, retrieved: rawResults, fallback: true, fallbackReason: stream.reason, mode: 'fallback' });
    send({ type: 'done', historyId });
    return res.end();
  }

  send({ type: 'meta', results: citations });
  let fullAnswer = '';
  let errored = false;
  try {
    for await (const delta of stream.gen) {
      fullAnswer += delta;
      send({ type: 'delta', text: delta });
    }
  } catch (e) {
    errored = true;
    console.error('[qa] 流式输出错误:', e.message);
    send({ type: 'error', message: `生成回答时出错：${e.message}` });
  }

  // 保存历史拿 historyId，随 done 事件返回
  let historyId = '';
  if ((!errored || fullAnswer) && fullAnswer) {
    fullAnswer = fixListNumbering(fullAnswer); // 修正 LLM 输出的序号错误（如多个 "1."）
    historyId = recordAll({ req, q, answer: fullAnswer, citations, retrieved: rawResults });
    setCachedAnswer(cacheKey, { answer: fullAnswer, results });
  }
  send({ type: 'done', historyId });
  res.end();
});

export default router;
