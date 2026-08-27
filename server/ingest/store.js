// 法规存储：校验、落盘 data/regulations/<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { REGS_DIR } from '../config.js';
import { loadRegulations } from '../rag/indexer.js';
import { assertSafeRegulationId, parseRemoteUrl } from '../security.js';
import { writeJsonAtomic } from '../json-store.js';

export function slugify(title, fallback = 'regulation') {
  const s = String(title || '')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

export function validateCleaned(cleaned) {
  if (!cleaned || typeof cleaned !== 'object') throw new Error('清洗结果为空');
  if (!Array.isArray(cleaned.chapters)) throw new Error('清洗结果缺少 chapters 数组');
  const articles = cleaned.chapters.reduce((s, c) => s + (Array.isArray(c.articles) ? c.articles.length : 0), 0);
  if (articles === 0) throw new Error('清洗结果中没有解析出任何条款');
  return { articles };
}

export function saveRegulation(cleaned, { sourceUrl, sourceTitle, rawFile } = {}) {
  const id = slugify(cleaned.id || cleaned.title);
  const requestedSourceUrl = String(sourceUrl || cleaned.sourceUrl || '').trim();
  const safeSourceUrl = requestedSourceUrl ? parseRemoteUrl(requestedSourceUrl).href : '';
  const reg = {
    ...cleaned,
    id,
    sourceUrl: safeSourceUrl,
    sourceTitle: sourceTitle || cleaned.sourceTitle || '',
    rawFile: rawFile || '',
    updatedAt: new Date().toISOString(),
  };
  // 规范化章节内字段：去掉条款文本开头的重复条号（如 "第一条 第一条为了…"）
  reg.chapters = (reg.chapters || []).map((c) => ({
    title: c.title || '',
    articles: (c.articles || []).map((a) => {
      const num = a.num || '';
      let text = (a.text || '').trim();
      if (num && text.startsWith(num)) {
        text = text.slice(num.length).replace(/^[\s:：、．.。，,]+/, '');
      }
      return { num, text: text.trim() };
    }),
  }));
  const { articles } = validateCleaned(reg);
  reg.articleCount = articles;
  const file = path.join(REGS_DIR, `${assertSafeRegulationId(reg.id)}.json`);
  writeJsonAtomic(file, reg);
  return { reg, file };
}

export function deleteRegulation(id) {
  const safeId = assertSafeRegulationId(id);
  const file = path.join(REGS_DIR, `${safeId}.json`);
  if (!fs.existsSync(file)) throw new Error(`未找到法规 ${id}`);
  fs.unlinkSync(file);
}

export function getRegulation(id) {
  const safeId = assertSafeRegulationId(id);
  const file = path.join(REGS_DIR, `${safeId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function findRegulationByTitle(title) {
  const regs = loadRegulations();
  return regs.find((r) => r.title === title || r.shortTitle === title) || null;
}
