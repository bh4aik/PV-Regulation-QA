// 法规库路由
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadRegulations } from '../rag/indexer.js';
import { getRegulation, deleteRegulation } from '../ingest/store.js';
import { rebuildIndex, getIndex } from '../rag/indexer.js';
import { clearQaCache } from '../qa-cache.js';
import { REGS_DIR } from '../config.js';
import { adminRequired } from '../middleware.js';
import { assertSafeRegulationId, parseRemoteUrl } from '../security.js';
import { writeJsonAtomic } from '../json-store.js';

const router = Router();

// 法规 ID 白名单校验（防目录穿越）：所有带 :id 的路由先过此中间件
router.param('id', (req, res, next, id) => {
  try {
    assertSafeRegulationId(id);
    next();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function publicMeta(reg) {
  return {
    id: reg.id,
    title: reg.title,
    shortTitle: reg.shortTitle || '',
    documentNumber: reg.documentNumber || '',
    issuingAuthority: reg.issuingAuthority || '',
    issueDate: reg.issueDate || '',
    effectiveDate: reg.effectiveDate || '',
    status: reg.status || '',
    category: reg.category || '',
    country: reg.country || '', // 国家/地区/组织（全球法规库）
    articleCount: reg.articleCount ?? reg.chapters?.reduce((s, c) => s + (c.articles?.length || 0), 0) ?? 0,
    chapterCount: reg.chapters?.length || 0,
    sourceUrl: reg.sourceUrl || '',
    tags: reg.tags || [],
    cleanedBy: reg._cleanedBy || '',
    updatedAt: reg.updatedAt || '',
  };
}

// 法规列表（仅元数据）
router.get('/regulations', (req, res) => {
  const regs = loadRegulations().sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  res.json({ regulations: regs.map(publicMeta), count: regs.length });
});

// 单部法规全文
router.get('/regulations/:id', (req, res) => {
  const reg = getRegulation(req.params.id);
  if (!reg) return res.status(404).json({ error: '未找到该法规' });
  res.json({ regulation: { ...publicMeta(reg), chapters: reg.chapters } });
});

// 删除法规（仅管理员）
router.delete('/regulations/:id', adminRequired, (req, res) => {
  try {
    deleteRegulation(req.params.id);
    const stats = rebuildIndex();
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 编辑法规元数据 + tags（仅管理员）
router.patch('/regulations/:id', adminRequired, (req, res) => {
  const reg = getRegulation(req.params.id);
  if (!reg) return res.status(404).json({ error: '未找到该法规' });
  try {
    const allowed = ['title', 'shortTitle', 'documentNumber', 'issuingAuthority', 'issueDate', 'effectiveDate', 'status', 'category', 'country', 'sourceUrl'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = String(req.body[k] ?? '').trim();
    }
    if (Array.isArray(req.body.tags)) {
      patch.tags = [...new Set(req.body.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: '没有可更新的字段' });
    // SSRF 防护：sourceUrl 仅允许公网 http/https
    if (patch.sourceUrl) patch.sourceUrl = parseRemoteUrl(patch.sourceUrl).href;
    const updated = { ...reg, ...patch, updatedAt: new Date().toISOString() };
    const file = path.join(REGS_DIR, `${assertSafeRegulationId(reg.id)}.json`);
    writeJsonAtomic(file, updated); // 原子写入，防中断损坏
    // 标题等变化影响检索索引，重建并清缓存
    const stats = rebuildIndex();
    clearQaCache();
    res.json({ ok: true, regulation: publicMeta(updated), stats });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 索引统计
router.get('/stats', (req, res) => {
  const idx = getIndex();
  const regs = loadRegulations();
  res.json({
    regulations: regs.length,
    chunks: idx ? idx.size() : 0,
    articles: regs.reduce((s, r) => s + (r.articleCount || 0), 0),
  });
});

export default router;
