// 爬虫路由：触发检查、候选确认、来源管理、状态
import { Router } from 'express';
import { runCrawlOnce, getCrawlState, resyncScheduler, isSchedulerActive } from '../crawler/scheduler.js';
import { getSources, saveSources } from '../crawler/sources.js';
import { getCandidate, updateCandidate, pendingCandidates, recentCandidates, createCandidate } from '../crawler/candidates.js';
import { fetchArticleText } from '../crawler/extract.js';
import { createTask } from '../ingest/tasks.js';
import { getSettings } from '../config.js';
import { adminRequired } from '../middleware.js';
import { parseRemoteUrl } from '../security.js';

const router = Router();

// 候选列表
router.get('/crawler/candidates', adminRequired, (req, res) => {
  res.json({
    pending: pendingCandidates(),
    recent: recentCandidates(60),
  });
});

// 立即检查新法规
router.post('/crawler/run', adminRequired, async (req, res) => {
  try {
    const out = await runCrawlOnce();
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 候选处理：ignore 忽略 / clean 抓取正文并生成清洗任务
router.post('/crawler/candidates/:id/decide', adminRequired, async (req, res) => {
  const { action } = req.body || {};
  const cand = getCandidate(req.params.id);
  if (!cand) return res.status(404).json({ error: '候选不存在' });
  if (action === 'ignore') {
    updateCandidate(cand.id, { status: 'ignored' });
    return res.json({ ok: true, candidate: getCandidate(cand.id) });
  }
  if (action === 'clean') {
    try {
      const text = await fetchArticleText(cand.url);
      if (!text || text.length < 200) throw new Error('文章正文提取过短，可能不是正文页面');
      const task = createTask({
        kind: 'crawl',
        title: cand.title,
        source: { title: cand.title, url: cand.url, date: cand.date, sourceName: cand.sourceName },
        rawText: text,
        meta: { title: cand.title, sourceUrl: cand.url },
      });
      updateCandidate(cand.id, { status: 'cleaned', taskId: task.id });
      return res.json({ ok: true, taskId: task.id, candidate: getCandidate(cand.id) });
    } catch (e) {
      return res.status(500).json({ error: `抓取失败：${e.message}` });
    }
  }
  return res.status(400).json({ error: `未知操作：${action}` });
});

// 来源列表 / 保存
router.get('/crawler/sources', adminRequired, (req, res) => {
  res.json({ sources: getSources(), scheduler: { active: isSchedulerActive(), schedule: getSettings().crawlSchedule || '0 9 * * *', enabled: getSettings().crawlEnabled !== false } });
});

router.post('/crawler/sources', adminRequired, (req, res) => {
  const { sources } = req.body || {};
  if (!Array.isArray(sources)) return res.status(400).json({ error: 'sources 必须是数组' });
  if (sources.length > 50) return res.status(400).json({ error: '数据源不能超过 50 个' });
  try {
    for (const source of sources) {
      if (!source || !['trs-label', 'html-list'].includes(source.type)) throw new Error('数据源类型不合法');
      parseRemoteUrl(source.url); // SSRF 防护：仅允许公网 http/https，拦截内网地址
    }
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  saveSources(sources);
  res.json({ ok: true, sources: getSources() });
});

// 爬虫状态
router.get('/crawler/state', adminRequired, (req, res) => {
  const state = getCrawlState();
  res.json({ ...state, scheduler: { active: isSchedulerActive(), schedule: getSettings().crawlSchedule || '0 9 * * *', enabled: getSettings().crawlEnabled !== false } });
});

// 手动添加候选（用户粘贴链接）
router.post('/crawler/candidates', adminRequired, (req, res) => {
  const { title, url, date = '', sourceName = '手动添加' } = req.body || {};
  if (!url || !title) return res.status(400).json({ error: '需要 title 和 url' });
  if (String(title).length > 300 || String(sourceName).length > 100) {
    return res.status(400).json({ error: '标题或来源名称过长' });
  }
  let safeUrl;
  try {
    safeUrl = parseRemoteUrl(url).href; // SSRF 防护
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const cand = createCandidate({ sourceName, title, url: safeUrl, date });
  res.json({ ok: true, candidate: cand });
});

export default router;
