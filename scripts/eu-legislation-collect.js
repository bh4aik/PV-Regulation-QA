// 欧盟核心药物警戒法规采集脚本：从 legislation.gov.uk 的 EU 法规 XML 数据端点
// 提取完整条文文本 → data/raw/eu-legislation/<slug>.md（带 frontmatter：country=欧盟）
// 覆盖：Regulation 520/2012（药物警戒实施细则）、Regulation 1235/2010、1027/2012（726/2004 药物警戒修订）、
//       Directive 2001/83/EC（人用药品法典，含 Title IX 药物警戒章节）
// 用法：node scripts/eu-legislation-collect.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../data/raw/eu-legislation');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 待采集法规：{ slug, title, docNumber, url, kind: 'regulation'|'directive' }
const REGULATIONS = [
  {
    slug: 'eu-regulation-520-2012-pharmacovigilance-implementation',
    title: 'Commission Implementing Regulation (EU) No 520/2012 on the performance of pharmacovigilance activities',
    docNumber: 'Commission Implementing Regulation (EU) No 520/2012',
    issuingAuthority: 'European Commission',
    issueDate: '2012-06-19',
    effectiveDate: '2012-07-10',
    url: 'https://www.legislation.gov.uk/eur/2012/520/data.xml',
  },
  {
    slug: 'eu-regulation-1235-2010-amending-726-2004-pharmacovigilance',
    title: 'Regulation (EU) No 1235/2010 amending Regulation (EC) No 726/2004 as regards pharmacovigilance',
    docNumber: 'Regulation (EU) No 1235/2010',
    issuingAuthority: 'European Parliament and Council',
    issueDate: '2010-12-15',
    effectiveDate: '2011-07-02',
    url: 'https://www.legislation.gov.uk/eur/2010/1235/data.xml',
  },
  {
    slug: 'eu-regulation-1027-2012-amending-726-2004-pharmacovigilance',
    title: 'Regulation (EU) No 1027/2012 amending Regulation (EC) No 726/2004 as regards pharmacovigilance',
    docNumber: 'Regulation (EU) No 1027/2012',
    issuingAuthority: 'European Parliament and Council',
    issueDate: '2012-10-25',
    effectiveDate: '2012-11-14',
    url: 'https://www.legislation.gov.uk/eur/2012/1027/data.xml',
  },
  {
    slug: 'eu-directive-2001-83-ec-community-code-medicinal-products',
    title: 'Directive 2001/83/EC on the Community code relating to medicinal products for human use',
    docNumber: 'Directive 2001/83/EC',
    issuingAuthority: 'European Parliament and Council',
    issueDate: '2001-11-06',
    effectiveDate: '2001-12-06',
    url: 'https://www.legislation.gov.uk/eudr/2001/83/data.xml',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 用正则提取 XML 中的条款：<P1 id="article-N">...</P1>
// 保留条款号与正文，跳过 . . . . 占位符（legislation.gov.uk 对已废止条款的占位）
function xmlToMarkdown(xml, title) {
  const out = [];
  out.push(`# ${title}`);
  out.push('');

  // 章节标题（如 <PartTitle> / <ChapterTitle> / <Title>）
  // legislation.gov.uk 用 <Part> / <Chapter> 等元素；简化处理：只提取 P1 条款
  const p1Re = /<P1\b[^>]*id="article-(\d+)"[^>]*>([\s\S]*?)<\/P1>/g;
  let m;
  let count = 0;
  let skipped = 0;
  while ((m = p1Re.exec(xml))) {
    const num = m[1];
    let body = m[2];
    // 提取条款号文本（Pnumber）
    const pnum = body.match(/<Pnumber[^>]*>([\s\S]*?)<\/Pnumber>/);
    const pnumText = pnum ? stripTags(pnum[1]).trim() : `Article ${num}`;
    // 提取正文（去掉注释引用标签）
    body = body.replace(/<CommentaryRef[^>]*\/>/g, '');
    body = body.replace(/<Pnumber[^>]*>[\s\S]*?<\/Pnumber>/g, '');
    let text = stripTags(body).trim();
    // 跳过占位符条款（正文全是点线）
    if (/^[.\s]+$/.test(text)) { skipped++; continue; }
    if (!text) { skipped++; continue; }
    count++;
    out.push(`**${pnumText}**`);
    out.push('');
    out.push(text);
    out.push('');
  }
  return { md: out.join('\n'), count, skipped };
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function collectOne(reg) {
  const outFile = path.join(OUT_DIR, reg.slug + '.md');
  if (fs.existsSync(outFile)) return { ok: true, file: reg.slug + '.md', note: '已存在，跳过' };
  const resp = await fetch(reg.url, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const xml = await resp.text();
  const { md, count, skipped } = xmlToMarkdown(xml, reg.title);
  if (count === 0) throw new Error('未提取到任何条款');
  const frontmatter = [
    '---',
    `title: ${reg.title}`,
    `documentNumber: ${reg.docNumber}`,
    `issuingAuthority: ${reg.issuingAuthority}`,
    `issueDate: ${reg.issueDate}`,
    `effectiveDate: ${reg.effectiveDate}`,
    'country: 欧盟',
    'status: 现行有效',
    'category: 法规',
    `sourceUrl: ${reg.url.replace(/\/data\.xml$/, '')}`,
    '---',
    '',
    md,
    '',
  ].join('\n');
  fs.writeFileSync(outFile, frontmatter, 'utf-8');
  return { ok: true, file: reg.slug + '.md', count, skipped, chars: md.length };
}

async function main() {
  console.log('=== 欧盟核心药物警戒法规采集 ===\n');
  for (const reg of REGULATIONS) {
    try {
      const r = await collectOne(reg);
      console.log(`  ${r.ok ? '✓' : '✗'} ${reg.slug} — 条款 ${r.count || 0}，跳过占位 ${r.skipped || 0}，${r.chars || 0} 字符`);
    } catch (e) {
      console.log(`  ✗ ${reg.slug}: ${e.message}`);
    }
    await sleep(500);
  }
  console.log('\n完成。');
}

main().catch((e) => { console.error(e); process.exit(1); });
