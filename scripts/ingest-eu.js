// EMA/欧盟 文档入库脚本：data/raw/ema/*.md + data/raw/eu-legislation/*.md → data/regulations/*.json
// - 英文文档走 englishClean（识别 Article N / I.A. 编号结构）
// - EMA 指南用 scripts/ema-titles.js 的标题映射
// - country 统一为"欧盟"
// 用法：node scripts/ingest-eu.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAW_DIR, REGS_DIR } from '../server/config.js';
import { heuristicClean } from '../server/ingest/clean.js';
import { saveRegulation } from '../server/ingest/store.js';
import { EMA_GUIDE_TITLES } from './ema-titles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

function collectMd(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMd(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

const files = [
  ...collectMd(path.join(RAW_DIR, 'ema')),
  ...collectMd(path.join(RAW_DIR, 'eu-legislation')),
];
const results = [];

for (const full of files) {
  const rel = path.relative(RAW_DIR, full);
  const base = path.basename(full, '.md');
  const raw = fs.readFileSync(full, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);
  try {
    // EMA 指南标题映射（法规文件已有规范 title）
    const mapped = EMA_GUIDE_TITLES[base];
    const title = mapped?.title || meta.title || '';
    const metaFull = {
      ...meta,
      title,
      shortTitle: mapped?.shortTitle || meta.shortTitle || title,
      country: meta.country || '欧盟',
      category: meta.category || (rel.includes('eu-legislation') ? '法规' : '指南'),
    };
    const cleaned = heuristicClean(body, metaFull);
    cleaned.country = metaFull.country;
    cleaned.category = metaFull.category;
    if (title) cleaned.title = title;
    cleaned._cleanedBy = 'heuristic';
    const { reg } = saveRegulation(cleaned, { sourceUrl: meta.sourceUrl || '', rawFile: rel });
    const articles = reg.chapters.reduce((s, c) => s + (c.articles || []).length, 0);
    results.push({ file: rel, title: reg.title || base, chapters: reg.chapters.length, articles, country: reg.country });
  } catch (e) {
    results.push({ file: rel, title: '✗ ' + e.message });
  }
}

console.table(results);
const total = results.reduce((s, r) => s + (r.articles || 0), 0);
const ok = results.filter((r) => !r.title.startsWith('✗')).length;
console.log(`\n共处理 ${results.length} 个文件（成功 ${ok}），合计 ${total} 条。`);
