// 法规清洗：优先 DeepSeek 结构化抽取，无 Key 时启发式解析（按 第X章/第X条）
import { DEEPSEEK_URL, getDeepSeekConfig } from '../config.js';

const CLEAN_PROMPT = `你是一名中国法律文本数据清洗专家。请把下面提供的法规原始文本清洗为**严格的结构化 JSON**，只输出 JSON，不要输出任何其他文字、不要用 Markdown 代码块包裹。

输出 JSON 结构：
{
  "title": "法规全称",
  "shortTitle": "常用简称（如：药品管理法）",
  "documentNumber": "文号（如：主席令第三十一号；无则空字符串）",
  "issuingAuthority": "发布机关",
  "issueDate": "YYYY-MM-DD（无法确定则空字符串）",
  "effectiveDate": "YYYY-MM-DD（施行日期，无法确定则空字符串）",
  "status": "现行有效 | 已修订 | 已废止 | 试行（按文本判断）",
  "category": "法律 | 行政法规 | 部门规章 | 规范性文件 | 标准",
  "chapters": [
    { "title": "第一章 总则（无章节则空字符串）", "articles": [ { "num": "第一条", "text": "该条完整原文" } ] }
  ]
}

要求：
- 逐条完整保留原文内容，不得增删改、不得概括。
- 正文中每条"第X条"必须单独成为一条记录；该条内容跨多段时全部合并进 text（保留换行）。
- 条文编号可能为阿拉伯数字（如"1."）或中文数字（如"第一条"），统一转为中文数字格式"第X条"（含修订说明、附则等）。
- 无章节结构的，把全部条款放进一个 title 为空字符串的章节。
- 若文本开头有公告/通知性质的段落（如"国家药监局关于发布××的公告"）且不属于法规正文条款，可放入 chapters 中 title 为"前言/公告"的章节，或忽略；正文条款不得遗漏。

=== 法规原始文本开始 ===
`;

const JSON_MODE = { response_format: { type: 'json_object' } };

export async function aiClean(rawText, meta = {}) {
  const { key, model } = getDeepSeekConfig();
  if (!key) return null;
  if (rawText.length > 90000) {
    throw new Error('原文超过 AI 单次清洗的 90000 字限制，将改用本地启发式清洗；请务必人工核对完整性');
  }
  const payload = {
    model,
    messages: [
      { role: 'system', content: CLEAN_PROMPT },
      { role: 'user', content: rawText + '\n=== 法规原始文本结束 ===' },
    ],
    temperature: 0.1,
    max_tokens: 8000,
    stream: false,
    ...JSON_MODE,
  };
  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`DeepSeek API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) parsed = JSON.parse(fenced[1]);
    else throw new Error('DeepSeek 返回内容无法解析为 JSON');
  }
  parsed._cleanedBy = 'ai';
  return { ...parsed, ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}) };
}

// 启发式清洗：按 第X章 / 第X条 正则解析，无条号文档回退为段落模式，无需 API
export function heuristicClean(rawText, meta = {}) {
  // 英文文本（EU/EMA 等国际法规指南）：走英文清洗分支
  if (isEnglishText(rawText)) {
    return englishClean(rawText, meta);
  }
  // 归一化：去全角空格、压缩 CJK 之间的空格
  let text = rawText.replace(/\r\n/g, '\n').replace(/\u3000/g, ' ');
  text = text.replace(/(?<=[\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const chapters = [];
  let current = { title: '', articles: [] };
  const chapterRe = /^第[一二三四五六七八九十百千零〇两]+章/;
  const articleRe = /^(第[一二三四五六七八九十百千零〇两]+条)/;

  let sawArticle = false;
  // 检查要点表编号（药物警戒检查指导原则附件的 "PV01/PV02..." 检查项）
  const pvRe = /^PV\d{1,3}$/;
  for (const line of lines) {
    if (chapterRe.test(line)) {
      if (current.articles.length || current.title) chapters.push(current);
      current = { title: line, articles: [] };
    } else if (articleRe.test(line)) {
      sawArticle = true;
      const num = line.match(articleRe)[1];
      current.articles.push({ num, text: line });
    } else if (pvRe.test(line)) {
      // 检查项编号（PV01/PV02...）作为独立条款起点，避免检查要点表被整段合并
      sawArticle = true;
      current.articles.push({ num: line, text: line });
    } else if (current.articles.length) {
      // 上一条的延续段落
      const last = current.articles[current.articles.length - 1];
      last.text += '\n' + line;
    } else if (!sawArticle && chapters.length === 0) {
      // 正文开始前的标题/公告行：忽略或并入前言
      if (!current.title && line.length < 60) current.title = line;
    }
  }
  if (current.articles.length || current.title) chapters.push(current);

  // 无章节标题且无条款时：回退为段落模式
  const realChapters = chapters.filter((c) => c.articles.length);
  if (!realChapters.length) {
    return guideOrParagraphFallback(text, meta);
  }
  if (!chapters.some((c) => c.title && c.articles.length)) {
    // 全部并入一个空标题章节
    const all = { title: '', articles: [] };
    for (const c of chapters) all.articles.push(...c.articles);
    return { chapters: [all], ...meta, _cleanedBy: 'heuristic' };
  }

  // 无任何"第X条"结构（如通知/公告类）：回退为段落模式
  const finalChapters = chapters.filter((c) => c.articles.length);
  const totalArticles = finalChapters.reduce((s, c) => s + c.articles.length, 0);
  if (totalArticles === 0) {
    return guideOrParagraphFallback(text, meta);
  }

  const title = meta.title || chapters[0]?.title || '';
  return {
    title,
    shortTitle: title.replace(/^中华人民共和国/, '').replace(/（试行）$/, ''),
    documentNumber: meta.documentNumber || '',
    issuingAuthority: meta.issuingAuthority || '',
    issueDate: meta.issueDate || '',
    effectiveDate: meta.effectiveDate || '',
    status: /试行/.test(title) ? '试行' : '现行有效',
    category: '',
    country: '', // 国家/地区/组织（默认空，管理员入库后可编辑）
    chapters: finalChapters,
    _cleanedBy: 'heuristic',
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
  };
}

// 无条号文档：优先按 指导原则层级结构（一、二、三 章节 + （一）/1. 条目），再退化为段落模式
function guideOrParagraphFallback(text, meta = {}) {
  const guided = guideStructureClean(text, meta);
  if (guided) return guided;
  return paragraphFallback(text, meta);
}

// 指导原则/方案类结构解析：章节"一、二、三…"，条目"（一）（二）…"或"1. 2. 3.…"
function guideStructureClean(text, meta = {}) {
  // 处理 PDF 提取的连续文本：去页码噪声、在结构标记前插入换行
  let t = text;
  // 去除句末后孤立页码，如 "。 2 试验药物" → "。试验药物"
  t = t.replace(/([。！？；;])\s*\d{1,3}\s+(?=[\u4e00-\u9fff])/g, '$1');
  // 结构标记前插换行：仅当前面是句末标点/括号收尾（避免误切"统一、协调"这类词）
  const markRe = /(?<=[。！？；;：:）】\s])(?=[一二三四五六七八九十]{1,3}、|（(?:\d{1,3}|[一二三四五六七八九十]{1,3})）|\d{1,3}．)/g;
  t = t.replace(markRe, '\n');
  // 文本开头的 "1 附件"/"1 一、" 之类标题行清理
  t = t.replace(/^\s*\d{1,3}\s+/, '');

  const lines = cleanGuideLines(t.split('\n').map((l) => l.trim()).filter(Boolean));
  const chapterRe = /^[一二三四五六七八九十]{1,3}[、．.]/;
  const itemRe = /^((?:（(?:\d{1,3}|[一二三四五六七八九十]{1,3})）)|\d{1,3}[、．.]|[一二三四五六七八九十]{1,3}、)/;
  const chapters = [];
  let cur = { title: '', articles: [] };
  let hierarchyFound = false;

  for (const line of lines) {
    if (chapterRe.test(line)) {
      hierarchyFound = true;
      if (cur.articles.length) chapters.push(cur);
      cur = { title: line, articles: [] };
    } else if (itemRe.test(line)) {
      hierarchyFound = true;
      const num = line.match(itemRe)[1];
      cur.articles.push({ num, text: line });
    } else if (cur.articles.length) {
      // 上一条目/标题的延续
      const last = cur.articles[cur.articles.length - 1];
      last.text += '\n' + line;
    } else if (cur.title || (!chapters.length && !cur.articles.length)) {
      cur.articles.push({ num: '', text: line });
    }
  }
  if (cur.articles.length) chapters.push(cur);

  if (!hierarchyFound) return null;
  const real = chapters.filter((c) => c.articles.length);

  // 去掉"章节标题行"本身就是空壳（标题+无内容）的情况
  const real2 = real.map((c) => {
    if (c.articles.length === 1 && c.articles[0].num === '' && c.articles[0].text.length < 30 && c.title) {
      c.articles[0].text = c.title + ' ' + c.articles[0].text;
      c.articles[0].num = '';
    }
    return c;
  });
  const real3 = real2.filter((c) => c.articles.length);
  if (!real3.length) return null;
  // 无章节标题的条目并入单章
  const merged = real3.some((c) => c.title) ? real3 : [{ title: '', articles: real3.flatMap((c) => c.articles) }];
  const title = meta.title || '';
  return {
    title,
    shortTitle: title.replace(/^中华人民共和国/, '').replace(/（试行）$/, ''),
    documentNumber: meta.documentNumber || '',
    issuingAuthority: meta.issuingAuthority || '',
    issueDate: meta.issueDate || '',
    effectiveDate: meta.effectiveDate || '',
    status: /试行/.test(title) ? '试行' : '现行有效',
    category: '',
    country: '', // 国家/地区/组织（默认空，管理员入库后可编辑）
    chapters: merged,
    _cleanedBy: 'heuristic',
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
  };
}

// 清理指导原则文本中的噪声行：封面/目录/页码/点线行
function cleanGuideLines(lines) {
  let ls = lines;
  const dot = (l) => /[.．…]{4,}/.test(l);
  // 去掉纯页码行
  ls = ls.filter((l) => !/^\d{1,3}$/.test(l));
  const tocIdx = ls.findIndex((l) => l.replace(/\s/g, '') === '目录');
  if (tocIdx > -1) {
    // 丢弃目录行及其之前（封面/页眉），跳过后续点线目录条目
    let start = tocIdx + 1;
    while (start < ls.length && dot(ls[start])) start++;
    ls = ls.slice(start);
  } else {
    const d = ls.findIndex(dot);
    if (d > -1) {
      // 无"目录"标题但有点线目录：丢弃封面与全部目录行
      let end = d;
      while (end + 1 < ls.length && dot(ls[end + 1])) end++;
      ls = ls.slice(end + 1);
    } else {
      // 无目录：丢弃第一个结构标记前的封面行
      const mIdx = ls.findIndex((l) => /^[一二三四五六七八九十]{1,3}[、．.]|^（(?:\d{1,3}|[一二三四五六七八九十]{1,3})）|^\d{1,3}[、．.]/.test(l));
      if (mIdx > 0) ls = ls.slice(mIdx);
    }
  }
  // 丢弃残留的点线目录行
  ls = ls.filter((l) => !dot(l));
  // 丢弃过短的孤立行（非结构标记）与页码脚注残留（如 "-  -"）
  ls = ls.filter((l) => !/^[\s—–-]{1,4}$/.test(l));
  ls = ls.filter((l) => l.length >= 4 || /^[一二三四五六七八九十]{1,3}[、．.]/.test(l) || /^（/.test(l));
  return ls;
}

// 段落模式：无条号文档按段落拆分，保留"一、二、"式编号
function paragraphFallback(text, meta = {}) {
  const paragraphs = text
    .split(/\n{2,}|\n(?=[一二三四五六七八九十]{1,3}[、．.])/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);
  const articles = paragraphs.map((p) => {
    const numMatch = p.match(/^[一二三四五六七八九十]{1,3}[、．.]/);
    return { num: numMatch ? numMatch[0] : '', text: p };
  });
  const title = meta.title || '';
  return {
    title,
    shortTitle: title.replace(/^中华人民共和国/, '').replace(/（试行）$/, ''),
    documentNumber: meta.documentNumber || '',
    issuingAuthority: meta.issuingAuthority || '',
    issueDate: meta.issueDate || '',
    effectiveDate: meta.effectiveDate || '',
    status: '现行有效',
    category: '',
    country: '', // 国家/地区/组织（默认空，管理员入库后可编辑）
    chapters: [{ title: '', articles }],
    _cleanedBy: 'heuristic',
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
  };
}

// ---------- 英文法规/指南清洗（EU/EMA 等国际文档） ----------

// 判断是否英文文本：正文中拉丁字母占比明显高于 CJK
function isEnglishText(text) {
  const sample = String(text || '').slice(0, 4000);
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  return latin > 50 && cjk === 0 && latin > sample.length * 0.3;
}

// 英文清洗：识别 "Article N"（法规）、"1. 1.1." 编号（指南）、章节标题、Annex 等结构
function englishClean(rawText, meta = {}) {
  let text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const chapters = [];
  let current = { title: '', articles: [] };
  let sawArticle = false;

  // 章节标题匹配：纯标题行（如 "CHAPTER II"、"TITLE IX"、"ANNEX I"、"PART A"、"1. Introduction"）
  const chapterHeadingRe = /^(CHAPTER|TITLE|PART|SECTION|ANNEX)\s+[IVXLC\d]+[\s.:]*(.*)$/i;
  // 法规条款匹配：**Article N**（来自采集脚本的加粗标记）或 "Article N" 行首
  const articleRe = /^\*{0,2}\s*Article\s+(\d+|[IVXLC]+)\s*\*{0,2}/i;
  // 指南编号条目：1. / 1.1. / (a) / I.A. / I.B.1. / III.A. / P.IV.A. / IX. Add I.1. 等
  const numberedRe = /^(\d+(?:\.\d+)*\.?\s|\([a-z]\)\s|[IVXLC]{1,5}(?:\.[A-Z0-9]+)+\.?\s|[IVXLC]{1,5}\.\s*(?:Add|Appendix)\s+[IVXLC\d]+(?:\.\d+)*\.?\s|P\.[IVXLC]+\.\s)/i;

  for (const line of lines) {
    if (chapterHeadingRe.test(line)) {
      if (current.articles.length || current.title) chapters.push(current);
      current = { title: line.replace(/\s{2,}/g, ' '), articles: [] };
      sawArticle = false;
      continue;
    }
    const am = line.match(articleRe);
    if (am) {
      sawArticle = true;
      current.articles.push({ num: `Article ${am[1]}`, text: line.replace(/^\*{0,2}\s*/, '') });
      continue;
    }
    if (numberedRe.test(line) && line.length < 200 && /[a-z]/.test(line) && !/^[A-Z]{2,}\s/.test(line)) {
      // 排除噪声：日期行（"3 August 2015"）、脚注残留行（"13 (1), Art 17 (1)]."）
      if (/^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(line)) {
        // 日期行 → 跳过（不作为编号）
      } else if (/^\d+\s+\([^)]*\)\s*,/.test(line) || /^\[\s*\d+\s*\]/.test(line)) {
        // 脚注残留 → 跳过
      } else {
        // 指南结构：编号行（"1. " / "I.A. " / "I.B.1. " / "III.A. " / "VII.C.3.3.2. "）持续作为新条款；
        // 排除全大写标题行（如 "INTRODUCTION"）
        sawArticle = true;
        // num 提取与 numberedRe 保持一致（罗马数字 1-5 位 + 多层点号）
        current.articles.push({
          num: line.match(/^(\d+(?:\.\d+)*\.?\s|[IVXLC]{1,5}(?:\.[A-Z0-9]+)+\.?\s|[IVXLC]{1,5}\.\s*(?:Add|Appendix)\s+[IVXLC\d]+(?:\.\d+)*\.?\s|P\.[IVXLC]+\.\s)/i)?.[1]?.trim() || '',
          text: line,
        });
        continue;
      }
    }
    if (current.articles.length) {
      const last = current.articles[current.articles.length - 1];
      last.text += '\n' + line;
    } else if (!current.title && line.length < 120 && !/^(Table|Figure|©|European Medicines Agency|Heads of Medicines)/i.test(line)) {
      current.title = line;
    }
  }
  if (current.articles.length || current.title) chapters.push(current);

  const realChapters = chapters.filter((c) => c.articles.length);
  if (!realChapters.length) {
    // 全无结构：整篇作为一个段落条款
    return {
      title: meta.title || '',
      shortTitle: meta.shortTitle || '',
      documentNumber: meta.documentNumber || '',
      issuingAuthority: meta.issuingAuthority || '',
      issueDate: meta.issueDate || '',
      effectiveDate: meta.effectiveDate || '',
      status: meta.status || '现行有效',
      category: meta.category || '',
      country: meta.country || '',
      chapters: [{ title: '', articles: [{ num: '', text }] }],
      _cleanedBy: 'heuristic',
      ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
    };
  }

  return {
    title: meta.title || chapters.find((c) => c.title && c.articles.length)?.title || '',
    shortTitle: meta.shortTitle || '',
    documentNumber: meta.documentNumber || '',
    issuingAuthority: meta.issuingAuthority || '',
    issueDate: meta.issueDate || '',
    effectiveDate: meta.effectiveDate || '',
    status: meta.status || '现行有效',
    category: meta.category || '',
    country: meta.country || '',
    chapters: realChapters,
    _cleanedBy: 'heuristic',
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
  };
}
