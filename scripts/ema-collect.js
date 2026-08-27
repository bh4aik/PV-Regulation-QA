// EMA 药物警戒指南采集脚本：从 EMA 官网 Good pharmacovigilance practices (GVP) 页面
// 下载全部 PDF → unpdf 提取文本 → 清洗页眉/页脚/目录/页码 → data/raw/ema/<slug>.md
// 用法：node scripts/ema-collect.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../data/raw/ema');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const GVP_PAGE = 'https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/pharmacovigilance-post-authorisation/good-pharmacovigilance-practices-gvp';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 从 GVP 页面提取全部 PDF 直链
async function fetchPdfLinks() {
  const resp = await fetch(GVP_PAGE, { headers: { 'User-Agent': UA } });
  const html = await resp.text();
  const links = [...html.matchAll(/href="([^"]*\.pdf[^"]*)"/g)].map((m) => {
    const raw = m[1];
    return raw.startsWith('http') ? raw : 'https://www.ema.europa.eu' + raw;
  });
  return [...new Set(links)];
}

// 从 PDF 提取文本（坐标重建行结构，过滤独立页码）
async function extractPdfText(buf) {
  const { getResolvedPDFJS } = await import('unpdf');
  const pdfjs = await getResolvedPDFJS();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const allLines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // 过滤独立页码（"3"、"Pag e 3 / 25" 等已由 items 拆分）
    const items = tc.items.filter((it) => {
      const s = it.str.trim();
      return !/^[-–—\s]*\d{1,3}[-–—\s]*$/.test(s);
    });
    const groups = new Map();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      let key = null;
      for (const g of groups.keys()) {
        if (Math.abs(g - y) <= 3) { key = g; break; }
      }
      if (key === null) { groups.set(y, []); key = y; }
      groups.get(key).push(it);
    }
    const pageLines = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, its]) => its.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join('').trim())
      .filter(Boolean);
    allLines.push(...pageLines, '');
  }
  return allLines.join('\n').trim();
}

// 清洗 EMA 文档文本：页眉/页脚/目录点线/页码行
function cleanEmaText(text) {
  const lines = text.split('\n');
  const out = [];
  let inToc = false;
  let tocDepth = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inToc) tocDepth++; if (tocDepth > 2) inToc = false; out.push(''); continue; }
    // 页眉：文档名 + 参考号（如 "Guideline on good pharmacovigilance practices (GVP) – Module I"）
    if (/^Guideline on good pharmacovigilance practices/.test(line) && line.length < 120) continue;
    if (/^EMA\/\d+\/\d+/.test(line)) continue; // 参考号行
    if (/^Pag\s*e\s*\d+\s*\/\s*\d+$/i.test(line)) continue;
    if (/^Page\s+\d+\s+of\s+\d+$/i.test(line)) continue;
    // 目录点线（"....."）：正文中不会出现 4+ 连续点，直接丢弃
    if (/\.{4,}/.test(line)) {
      inToc = true; tocDepth = 0;
      continue;
    }
    if (inToc) {
      if (/\.{4,}/.test(line)) continue;
      inToc = false;
    }
    out.push(line);
  }
  // 合并连续空行
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// URL slug → 人类可读标题（粗提取，入库时以清洗器识别为准）
// 注意：部分文档 slug 截断后重复（如 product-or-population-specific-considerations I~IV），
// 这里为已知冲突的 URL 提供精确文件名，避免互相覆盖。
const SLUG_OVERRIDES = {
  'guideline-good-pharmacovigilance-practices-gvp-module-vii-periodic-safety-update-report-explanatory-note_en.pdf':
    'gvp-module-vii-psur-explanatory-note',
  'guideline-good-pharmacovigilance-practices-gvp-product-or-population-specific-considerations-i-vaccines-prophylaxis-against-infectious-diseases_en.pdf':
    'gvp-product-specific-considerations-i-vaccines',
  'guideline-good-pharmacovigilance-practices-gvp-product-or-population-specific-considerations-ii-biological-medicinal-products_en.pdf':
    'gvp-product-specific-considerations-ii-biological',
  'guideline-good-pharmacovigilance-practices-gvp-product-or-population-specific-considerations-iii-pregnant-breastfeeding-women-their-children-exposed-utero-or-breastmilk_en.pdf':
    'gvp-product-specific-considerations-iii-pregnancy-lactation',
  'guideline-good-pharmacovigilance-practices-gvp-product-or-population-specific-considerations-iv-paediatric-population_en.pdf':
    'gvp-product-specific-considerations-iv-paediatric',
};

function slugifyTitle(url) {
  const rawName = url.split('/').pop(); // 完整文件名（含 _en.pdf）
  if (SLUG_OVERRIDES[rawName]) return SLUG_OVERRIDES[rawName];
  const base = rawName.replace(/_en\.pdf$/, '');
  return base.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function main() {
  console.log('=== EMA 药物警戒指南采集 ===\n');
  const links = await fetchPdfLinks();
  console.log(`从 EMA GVP 页面发现 ${links.length} 个 PDF\n`);
  const results = [];
  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    const slug = slugifyTitle(url);
    const outFile = path.join(OUT_DIR, slug + '.md');
    if (fs.existsSync(outFile)) {
      results.push({ ok: true, file: slug + '.md', note: '已存在，跳过' });
      continue;
    }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': UA, Referer: GVP_PAGE } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const text = await extractPdfText(buf);
      const cleaned = cleanEmaText(text);
      if (cleaned.length < 500) throw new Error('文本过短（' + cleaned.length + ' 字符）');
      const frontmatter = [
        '---',
        `title: ${slug}`,
        'country: 欧盟',
        'category: 指南',
        `sourceUrl: ${url}`,
        '---',
        '',
        cleaned,
        '',
      ].join('\n');
      fs.writeFileSync(outFile, frontmatter, 'utf-8');
      results.push({ ok: true, file: slug + '.md', chars: cleaned.length, pages: text.length ? 'ok' : '?' });
      console.log(`  [${i + 1}/${links.length}] ✓ ${slug} (${cleaned.length} 字符)`);
    } catch (e) {
      results.push({ ok: false, file: slug + '.md', error: e.message });
      console.log(`  [${i + 1}/${links.length}] ✗ ${slug}: ${e.message}`);
    }
    await sleep(400);
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n完成：成功 ${ok}/${links.length}`);
  if (results.some((r) => !r.ok)) {
    console.log('\n失败项：');
    for (const r of results.filter((x) => !x.ok)) console.log('  ✗', r.file, '-', r.error);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
