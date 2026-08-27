// 法规索引：从 data/regulations/*.json 构建分块 → BM25
import fs from 'node:fs';
import path from 'node:path';
import { REGS_DIR } from '../config.js';
import { tokenize } from './tokenizer.js';
import { BM25Index } from './bm25.js';

export function loadRegulations() {
  if (!fs.existsSync(REGS_DIR)) return [];
  return fs
    .readdirSync(REGS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(REGS_DIR, f), 'utf-8'));
      } catch (e) {
        console.error(`[indexer] 无法解析 ${f}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

export function chunkRegulation(reg) {
  const chunks = [];
  for (const ch of reg.chapters || []) {
    for (const art of ch.articles || []) {
      const text = (art.text || '').trim();
      if (!text) continue;
      const segs = splitText(text, 600);
      segs.forEach((seg, i) => {
        chunks.push({
          id: `${reg.id}#${art.num}#${i}`,
          regId: reg.id,
          regTitle: reg.title,
          articleNum: art.num,
          chapterTitle: ch.title || '',
          country: reg.country || '', // 国家/地区/组织（检索地区加权用）
          text: seg,
          part: i,
          partTotal: segs.length,
        });
      });
    }
  }
  return chunks;
}

function splitText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxLen) {
      parts.push(cur);
      cur = '';
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

let index = null;

export function getIndex() {
  return index;
}

export function rebuildIndex() {
  const regs = loadRegulations();
  const bm = new BM25Index();
  for (const reg of regs) {
    for (const chunk of chunkRegulation(reg)) {
      // 标题词追加到 tokens（×2 提升标题相关性）：使"药物警戒检查"等标题核心词参与匹配，
      // 避免检查要点类文档（正文不含标题词）在"药物警戒检查"查询下漏检
      const titleTokens = tokenize(chunk.regTitle || '');
      const bodyTokens = tokenize(chunk.text);
      bm.add({ ...chunk, tokens: [...bodyTokens, ...titleTokens, ...titleTokens] });
    }
  }
  bm.finalize();
  index = bm;
  const chapters = regs.reduce((s, r) => s + (r.chapters || []).length, 0);
  const articles = regs.reduce(
    (s, r) => s + (r.chapters || []).reduce((a, c) => a + (c.articles || []).length, 0),
    0
  );
  return { regulations: regs.length, chapters, articles, chunks: bm.size() };
}

export function getStats() {
  if (!index) return rebuildIndex();
  return null;
}
