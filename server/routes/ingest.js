// 入库管道路由：上传 → 解析 → AI/启发式清洗 → 确认入库
import { Router } from 'express';
import multer from 'multer';
import { parseBuffer, detectType } from '../ingest/parse.js';
import { aiClean, heuristicClean } from '../ingest/clean.js';
import { saveRegulation } from '../ingest/store.js';
import { rebuildIndex } from '../rag/indexer.js';
import { createTask, getTask, updateTask, removeTask, activeTasks, recentTasks } from '../ingest/tasks.js';
import { getDeepSeekConfig } from '../config.js';
import { adminRequired } from '../middleware.js';
import { clearQaCache } from '../qa-cache.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// 上传文件 → 创建解析任务
router.post('/ingest/upload', adminRequired, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未收到文件（字段名应为 file）' });
    const type = detectType(req.file.originalname);
    if (type === 'unknown' || type === 'doc') {
      return res.status(400).json({ error: `不支持的文件类型：${req.file.originalname}（支持 txt/md/docx/pdf）` });
    }
    const { text, meta } = await parseBuffer(req.file.originalname, req.file.buffer);
    const task = createTask({
      kind: 'upload',
      title: meta.title || req.file.originalname,
      filename: req.file.originalname,
      rawText: text,
      meta,
    });
    res.json({
      task: {
        ...task,
        rawText: undefined,
        rawCharCount: text.length,
        rawTextPreview: text.slice(0, 600),
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 清洗任务（AI 优先，无 Key 时启发式）
router.post('/ingest/tasks/:id/clean', adminRequired, async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (!['parsed', 'cleaned'].includes(task.status)) return res.status(400).json({ error: `任务状态不允许清洗：${task.status}` });
  try {
    let cleaned = null;
    let cleanedBy = 'heuristic';
    const { key } = getDeepSeekConfig();
    if (key) {
      try {
        cleaned = await aiClean(task.rawText, task.meta);
        if (cleaned) cleanedBy = 'ai';
      } catch (e) {
        console.warn('[ingest] AI 清洗失败，回退启发式:', e.message);
      }
    }
    if (!cleaned) cleaned = heuristicClean(task.rawText, task.meta);
    cleaned._cleanedBy = cleanedBy;
    updateTask(task.id, { cleaned, cleanedBy, status: 'cleaned', error: '' });
    const updated = getTask(task.id);
    res.json({ task: stripRaw(updated) });
  } catch (e) {
    updateTask(task.id, { error: e.message, status: 'failed' });
    res.status(400).json({ error: e.message });
  }
});

// 确认入库
router.post('/ingest/tasks/:id/commit', adminRequired, (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'cleaned' || !task.cleaned) {
    return res.status(400).json({ error: '请先完成清洗再入库' });
  }
  try {
    const { reg } = saveRegulation(task.cleaned, {
      sourceUrl: task.source?.url || task.meta?.sourceUrl || '',
      sourceTitle: task.title,
      rawFile: task.filename || '',
    });
    const stats = rebuildIndex();
    updateTask(task.id, { status: 'committed', regId: reg.id });
    res.json({ ok: true, regId: reg.id, stats });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 删除任务
router.delete('/ingest/tasks/:id', adminRequired, (req, res) => {
  removeTask(req.params.id);
  res.json({ ok: true });
});

// 任务列表（含清洗结果预览）
router.get('/ingest/tasks', adminRequired, (req, res) => {
  const all = recentTasks(100);
  res.json({
    active: activeTasks().map(stripRaw),
    recent: all.map(stripRaw),
  });
});

// 重建索引
router.post('/ingest/rebuild', adminRequired, (req, res) => {
  const stats = rebuildIndex();
  clearQaCache();
  res.json({ ok: true, stats });
});

function stripRaw(t) {
  if (!t) return t;
  const { rawText, ...rest } = t;
  return rest;
}

export default router;
