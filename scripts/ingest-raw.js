// 一次性入库脚本：data/raw/**/*.md → data/regulations/*.json（启发式清洗，无需 API Key）
// 用法：node scripts/ingest-raw.js
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from '../server/config.js';
import { heuristicClean } from '../server/ingest/clean.js';
import { saveRegulation } from '../server/ingest/store.js';

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

// 递归收集 data/raw 下所有 .md（含子目录如 cde/）
function collectMd(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMd(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

const files = collectMd(RAW_DIR);
const results = [];

for (const full of files) {
  const rel = path.relative(RAW_DIR, full);
  const raw = fs.readFileSync(full, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);
  let cleaned;
  try {
    cleaned = heuristicClean(body, meta);
    for (const k of ['title', 'shortTitle', 'documentNumber', 'issuingAuthority', 'issueDate', 'effectiveDate', 'status', 'category', 'country', 'sourceUrl']) {
      if (meta[k]) cleaned[k] = meta[k];
    }
    cleaned._cleanedBy = 'heuristic';
    cleaned.category = meta.category || cleaned.category;
    const { reg } = saveRegulation(cleaned, { sourceUrl: meta.sourceUrl || '', rawFile: rel });
    const articles = reg.chapters.reduce((s, c) => s + c.articles.length, 0);
    results.push({ file: rel, title: reg.title, chapters: reg.chapters.length, articles, docNumber: (reg.documentNumber || '').slice(0, 30) });
  } catch (e) {
    results.push({ file: rel, title: '✗ ' + e.message });
  }
}

console.table(results);
const total = results.reduce((s, r) => s + (r.articles || 0), 0);
console.log(`\n共处理 ${results.length} 个文件，合计 ${total} 条。`);
