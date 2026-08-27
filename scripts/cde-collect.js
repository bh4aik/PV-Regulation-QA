// CDE 指导原则采集脚本：会话 Cookie → 详情页 → PDF 附件 → 文本 → data/raw/cde/<slug>.md
// 用法：node scripts/cde-collect.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../data/raw/cde');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CDE = 'https://www.cde.org.cn';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LIST_REFERER = CDE + '/zdyz/listpage/9cd8db3b7530c6fa0c86485e563f93c7';

// 选定的药物警戒/药品安全相关指导原则（id = zdyzIdCODE，来自 getDomesticGuideList）
const GUIDES = [
  { title: '药物临床试验期间安全性数据快速报告常见问答（2.0版）', id: '4f3036bb259e130010864b95a131054b', issueDate: '2023-03-17', category: '指导原则' },
  { title: '药物临床试验期间安全性信息汇总分析和报告指导原则（试行）', id: '33da45e6ea3c651fb019ddf8fcca227c', issueDate: '2023-03-17', category: '指导原则' },
  { title: '研发期间安全性更新报告的问答文件', id: 'ec63a8e714557462ab2c20700a688ed5', issueDate: '2026-02-24', category: '指导原则' },
  { title: '研究者手册中安全性参考信息撰写技术指导原则', id: '5154df4b9ed01a3e1d05dd0e332e8ef2', issueDate: '2022-01-04', category: '指导原则' },
  { title: '儿童药物临床试验安全信息评估与报告技术指导原则（试行）', id: '35c7dc1219a82cda6c6661beca0e9e83', issueDate: '2025-05-29', category: '指导原则' },
  { title: '药物临床试验不良事件相关性评价技术指导原则（试行）', id: '4cbfc5c21ce27f4fa10e4205cfbf07b9', issueDate: '2024-06-14', category: '指导原则' },
  { title: '创新药研发期间风险管理计划撰写技术指导原则（试行）', id: 'ac067d45a3ae5ec9a1ddc05b246d1653', issueDate: '2025-12-05', category: '指导原则' },
  { title: '“临床风险管理计划”撰写指导原则（试行）', id: '95956dcefc749cb4d3c305f044d9356c', issueDate: '2022-01-06', category: '指导原则' },
  { title: '新药获益-风险评估技术指导原则', id: '4e4fa7a700f30cd630c57a09f10958f9', issueDate: '2023-06-25', category: '指导原则' },
  { title: '以患者为中心的药物获益-风险评估技术指导原则（试行）', id: 'c5ed3f3c040266a64f15e0cc5fd95c22', issueDate: '2023-07-27', category: '指导原则' },
  { title: '新药全球同步研发中基于多区域临床试验数据进行获益-风险评估的指导原则（试行）', id: '4607f5142a77d16f82f7f0d21457670f', issueDate: '2026-02-24', category: '指导原则' },
  { title: '新药临床安全性评价技术指导原则', id: '7e29accad2068260ce5fea15debf3347', issueDate: '2023-12-01', category: '指导原则' },
  { title: '抗肿瘤创新药上市申请安全性总结资料准备技术指导原则', id: 'a8324515db0094772eccf51b7ea98c9d', issueDate: '2020-12-31', category: '指导原则' },
  { title: '抗肿瘤药物说明书安全性信息撰写技术指导原则', id: 'd682081e99c87e1af49c2855e25297df', issueDate: '2024-01-16', category: '指导原则' },
  { title: '抗肿瘤药物说明书不良反应数据汇总指导原则', id: '8a98e51252c6de09bd84c511155a82f6', issueDate: '2022-04-21', category: '指导原则' },
  { title: '抗肿瘤治疗的免疫相关不良事件评价技术指导原则', id: 'cc090bfd53ece9d54393ba3ae16b306a', issueDate: '2022-05-17', category: '指导原则' },
  { title: '疫苗临床试验不良事件分级标准指导原则（修订版）', id: 'e7c82c40e4b5b69f151581e58cacc06f', issueDate: '2025-12-05', category: '指导原则' },
  { title: '药物安全药理学研究技术指导原则', id: 'eabe80e6d8d90236c7fde1c5ff8f8999', issueDate: '2014-05-13', category: '指导原则' },
  { title: '药物免疫毒性非临床研究技术指导原则', id: 'cecb9ff9df4e146a3abcf502e988a6e5', issueDate: '2024-01-18', category: '指导原则' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getSessionCookie() {
  const resp = await fetch(CDE + '/', { headers: { 'User-Agent': UA } });
  const cookies = (resp.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
  return cookies.join('; ');
}

async function fetchBuf(url, cookie) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: cookie, Referer: LIST_REFERER, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    redirect: 'follow',
  });
  return { resp, buf: Buffer.from(await resp.arrayBuffer()) };
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdfText(buf) {
  try {
    // 用 pdfjs 坐标重建行结构（保留真实换行，便于后续章节解析）
    const { getResolvedPDFJS } = await import('unpdf');
    const pdfjs = await getResolvedPDFJS();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const allLines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      // 过滤独立页码文本项（如 "1"、"- 1 -"），避免与正文粘连
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
        if (key === null) {
          groups.set(y, []);
          key = y;
        }
        groups.get(key).push(it);
      }
      const pageLines = [...groups.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, its]) => its.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join('').trim())
        .filter(Boolean);
      allLines.push(...pageLines, '');
    }
    return allLines.join('\n').trim();
  } catch (e) {
    throw new Error('PDF 解析失败: ' + e.message);
  }
}

function slugify(title) {
  return title.replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function collectOne(g, cookie) {
  const infoResp = await fetchBuf(`${CDE}/zdyz/domesticinfopage?zdyzIdCODE=${g.id}`, cookie);
  const infoHtml = infoResp.buf.toString('utf-8');
  const attIds = [...infoHtml.matchAll(/\/zdyz\/downloadAtt\?idCODE=([a-f0-9]+)/g)].map((m) => m[1]);
  const attNames = [...infoHtml.matchAll(/fileLink[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim());
  if (!attIds.length) return { ok: false, title: g.title, error: '未找到附件链接' };

  // 尝试每个附件，取文本最长者作为正文
  let bestText = '';
  let bestName = '';
  for (let i = 0; i < attIds.length; i++) {
    try {
      const attResp = await fetchBuf(`${CDE}/zdyz/downloadAtt?idCODE=${attIds[i]}`, cookie);
      const ct = attResp.resp.headers.get('content-type') || '';
      if (ct.includes('html') || attResp.buf.length < 200) continue;
      let text = '';
      if (attNames[i]?.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(attResp.buf);
      } else if (/\.(txt|md)$/i.test(attNames[i] || '')) {
        text = attResp.buf.toString('utf-8');
      } else if (attNames[i]?.toLowerCase().endsWith('.docx')) {
        const { default: mammoth } = await import('mammoth');
        const r = await mammoth.extractRawText({ buffer: attResp.buf });
        text = (r.value || '').trim();
      } else if (attNames[i]?.toLowerCase().endsWith('.doc')) {
        // 旧版 .doc：写入临时文件后用 macOS textutil 转换
        const os = await import('node:os');
        const cp = await import('node:child_process');
        const tmp = path.join(os.tmpdir(), `pvqa_${Date.now()}_${i}.doc`);
        fs.writeFileSync(tmp, attResp.buf);
        try {
          text = cp.execSync(`textutil -convert txt -stdout "${tmp}"`, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 });
        } catch (e) {
          console.warn(`  .doc 转换失败: ${e.message}`);
        } finally {
          fs.rmSync(tmp, { force: true });
        }
      }
      if (text.length > bestText.length) {
        bestText = text;
        bestName = attNames[i] || '';
      }
    } catch (e) {
      console.warn(`  附件 ${i} 失败: ${e.message}`);
    }
    await sleep(300);
  }

  if (!bestText || bestText.length < 300) {
    return { ok: false, title: g.title, error: `正文过短（${bestText.length} 字）` };
  }

  // 提取元数据补充信息
  const metaText = htmlToText(infoHtml);
  const scope = (metaText.match(/适用范围\s*([^\n]+)/) || [])[1] || '';
  const state = (metaText.match(/版本状态\s*([^\n]+)/) || [])[1] || '颁布';
  const sourceUrl = `${CDE}/zdyz/domesticinfopage?zdyzIdCODE=${g.id}`;

  const md = `---
title: ${g.title}
documentNumber: ''
issuingAuthority: 国家药品监督管理局药品审评中心（CDE）
issueDate: ${g.issueDate}
effectiveDate: ${g.issueDate}
status: ${state.includes('废止') ? '已废止' : '现行有效'}
category: 指导原则
sourceUrl: ${sourceUrl}
attachment: ${bestName || ''}
collectedAt: ${new Date().toISOString().slice(0, 10)}
---

${bestText}
`;
  const file = path.join(OUT_DIR, `${slugify(g.title)}.md`);
  fs.writeFileSync(file, md, 'utf-8');
  return { ok: true, title: g.title, chars: bestText.length, attachment: bestName, file };
}

async function main() {
  console.log('获取 CDE 会话 Cookie…');
  const cookie = await getSessionCookie();
  if (!cookie) throw new Error('未能获取会话 Cookie');
  console.log('Cookie 获取成功，开始采集', GUIDES.length, '个指导原则\n');

  const results = [];
  for (const g of GUIDES) {
    process.stdout.write(`▸ ${g.title} … `);
    try {
      const r = await collectOne(g, cookie);
      console.log(r.ok ? `✅ ${r.chars} 字（附件: ${r.attachment || '无'}）` : `❌ ${r.error}`);
      results.push(r);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      results.push({ ok: false, title: g.title, error: e.message });
    }
    await sleep(400);
  }

  const ok = results.filter((r) => r.ok);
  console.log(`\n完成：${ok.length}/${results.length} 成功`);
  for (const r of results.filter((x) => !x.ok)) console.log('失败:', r.title, '-', r.error);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
