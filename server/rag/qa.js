// 检索增强问答：BM25 检索 → DeepSeek 流式生成（带引用）
// 一致性设计：检索确定性（BM25）+ 生成 temperature=0 + 固定 seed + 答案缓存（qa-cache.js）
import fs from 'node:fs';
import { getIndex, loadRegulations } from './indexer.js';
import { tokenize } from './tokenizer.js';
import { DEEPSEEK_URL, getDeepSeekConfig, GLOSSARY_FILE } from '../config.js';

const SYSTEM_PROMPT = `你是"中国药物警戒与药品安全法规"专业问答助手，服务于药品监管、药物警戒、不良反应监测、药品注册生产流通等领域的工作者。

行为准则：
1. 仅依据用户问题和你被提供的法规条文回答，回答使用简体中文。
2. 引用法规条款时使用格式【《法规全称》第X条】或【《法规全称》第X章】，引用必须来自提供的条文，不得编造条款。
3. 若提供的条文不足以回答，先说明"检索到的法规条文不足以完整回答"，再基于一般监管常识给出谨慎指引，并建议咨询当地省级药品监督管理部门或查阅具体法规原文。
4. 回答结构清晰、要点明确，涉及时限/处罚/条件等关键信息时务必准确。
5. 回答必须完整：若检索条文中存在直接回答用户问题的条款（如职责清单、时限、条件等），应完整引用全部相关条款内容，不得遗漏或只引用部分。
6. 语境匹配（重要）：先判断问题属于"上市前"（药品研发、临床试验、药品开发、注册审评、CDE 指导原则等）还是"上市后"（持有人、不良反应监测、药物警戒、召回、经营流通等）。上市前问题应优先引用《药品注册管理办法》、GCP（《药物临床试验质量管理规范》）、CDE 技术指导原则等上市前法规条款；上市后问题优先引用《药物警戒质量管理规范》等。除非相关上市前条款确实缺失，否则不要把 GVP 等上市后法规硬套在研发/临床试验问题上。
7. 地区匹配（重要）：若问题明确提及国家/地区/组织（如"欧盟/欧洲/美国/WHO"），优先引用该地区的法规与指南（欧盟：GVP 模块、Directive 2001/83/EC、Regulation (EU) No 520/2012 等英文文档；美国：FDA 指南）。若问题是"对比中国与某国"，则中欧/中美法规应同时引用、分别呈现。
8. 不提供医疗建议，不代替监管机构执法解释。`;

const TEMPERATURE = 0; // 确定性回答
const SEED = 20260815; // 固定随机种子（进一步降低采样差异）

// 双语术语等价组：从 data/glossary.json 加载（概念 → 中英同义词组）
// 检索时命中组内任一词，即展开组内全部词（中英双向 + 中文同义）
let _glossary = null;
function loadGlossary() {
  if (_glossary) return _glossary;
  try {
    const j = JSON.parse(fs.readFileSync(GLOSSARY_FILE, 'utf-8'));
    _glossary = Array.isArray(j.concepts) ? j.concepts : [];
  } catch {
    _glossary = [];
  }
  return _glossary;
}

// 判断问题是否命中某术语（中文子串匹配；英文按词边界匹配）
function matchTerm(question, term) {
  const t = String(term || '');
  if (!t) return false;
  if (/[A-Za-z]/.test(t)) {
    return new RegExp(`(^|[^A-Za-z])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i').test(question);
  }
  return String(question || '').includes(t);
}

// 问题命中的所有概念（等价组）
function matchedConcepts(question) {
  return loadGlossary().filter((c) => (c.terms || []).some((t) => matchTerm(question, t)));
}

// glossary 是否覆盖了问题（命中至少一个概念）。用于判断是否需要 LLM 查询改写兜底。
export function hasGlossaryCoverage(question) {
  return matchedConcepts(question).length > 0;
}


export function expandQuery(question) {
  let expanded = String(question || '');
  // 命中任一同义词组，展开组内全部词（中英双向 + 中文同义）
  for (const c of matchedConcepts(question)) {
    expanded += ' ' + (c.terms || []).join(' ');
  }
  return expanded;
}

export function searchRegulations(question, topK = 8, { diverse = true } = {}) {
  const idx = getIndex();
  if (!idx) return { results: [], stats: null };

  const region = detectRegion(question);
  const compare = isCompareQuestion(question);

  // ===== 对比类问题（如"欧盟vs中国"）：分路检索 =====
  // 对比必然涉及"中国 + 另一地区"两方；detectRegion 可能返回 cn（问题里"中国"先出现），
  // 此时需解析出"非中国的那一方"作为目标地区，避免两路都检索成中国。
  if (compare && (region === 'eu' || region === 'us' || region === 'cn')) {
    const targetRegion = region === 'cn' ? detectNonCnRegion(question) : region;
    const results = searchByRegion(idx, question, topK, targetRegion || 'eu', { diverse });
    return { results, stats: null };
  }

  // ===== 单地区问题（如"中国的XX"/"欧盟的XX"）：只在该地区法规内检索 =====
  // 根治"纯中国问题被英文扩展词拉入欧盟法规""纯欧盟问题被中文词拉入中国法规"的串扰
  if (!compare && (region === 'cn' || region === 'eu' || region === 'us')) {
    const results = searchSingleRegion(idx, question, topK, region, { diverse });
    return { results, stats: null };
  }

  // ===== 无地区意图：通用混合检索 =====
  const expanded = expandQuery(question);
  const raw = idx.search(tokenize(expanded), topK * 8);
  const merged = mergeArticleChunks(raw);

  // 补充检索（多路合并）：中文问题会淹没英文文档（BM25 中文词 IDF 高），
  // 用英文扩展词单独检索一路（同样扩大），把欧盟/美国等英文法规条款并入候选池。
  const engQuery = englishExpansionQuery(question);
  if (engQuery) {
    const rawEng = idx.search(tokenize(engQuery), topK * 8);
    const mergedEng = mergeArticleChunks(rawEng);
    const seen = new Set(merged.map((r) => (r.articleNum ? `${r.regId}|${r.articleNum}` : r.id)));
    for (const r of mergedEng) {
      const key = r.articleNum ? `${r.regId}|${r.articleNum}` : r.id;
      if (!seen.has(key)) {
        // 英文补充检索分数量级低于中文词，×1.6 对齐量级
        merged.push({ ...r, score: r.score * 1.6 });
        seen.add(key);
      }
    }
    merged.sort((a, b) => b.score - a.score);
  }

  // 语境感知加权：研发/临床试验（上市前）问题 → 提升 CDE 指导原则等；上市后问题 → 提升 GVP 等
  const phase = detectPhase(question);
  if (phase !== 'neutral') applyPhaseWeighting(merged, phase);

  if (!diverse) {
    return { results: merged.slice(0, topK), stats: null };
  }
  const diverseResults = applyDiversity(merged, topK, 3);
  return { results: diverseResults, stats: null };
}

// 单地区检索：只在该国家/地区法规内检索（中国用中文词、欧盟/美国用英文词），
// 不跨地区混检，避免"纯中国问题混入欧盟法规"的串扰
function searchSingleRegion(idx, question, topK, region, { diverse = true } = {}) {
  const isTarget = (r) => regRegionByCountry(r.country || r.regTitle) === region;
  const focused = stripCompareFraming(question);

  let query;
  if (region === 'cn') {
    // 中国侧：中文词（去噪主题 + 中文扩展词），不做英文展开
    query = focused + ' ' + chineseExpansionQuery(question);
  } else {
    // 欧盟/美国侧：英文词（英文扩展词排除地区泛词）
    const engQuery = englishExpansionQuery(question, { excludeRegionTerms: true });
    query = (engQuery || focused);
  }

  const raw = idx.search(tokenize(query), topK * 4);
  const merged = mergeArticleChunks(raw).filter(isTarget);

  // 主题短语匹配 boost：从查询提取高区分度的中文主题短语（如"药物警戒负责人"），
  // 对标题或正文含该短语的条款 +50% 权重。解决"MAH/持有人等高频泛词淹没主题词"
  // 导致核心条款（如 GVP 第二十五条职责）排名被无关条款压住的问题。
  const phrases = extractTopicPhrases(focused);
  if (phrases.length) {
    for (const r of merged) {
      const hay = (r.regTitle || '') + ' ' + (r.text || '');
      if (phrases.some((p) => hay.includes(p))) r.score *= 1.5;
    }
    merged.sort((a, b) => b.score - a.score);
  }

  // 语境感知加权（上市前/上市后）
  const phase = detectPhase(question);
  if (phase !== 'neutral') applyPhaseWeighting(merged, phase);

  if (!diverse) {
    return merged.slice(0, topK);
  }
  return applyDiversity(merged, topK, 3);
}

// 分路检索：对比类问题按国家/地区分别检索，独立排序后合并
function searchByRegion(idx, question, topK, region, { diverse = true } = {}) {
  const isTarget = (r) => regRegionByCountry(r.country || r.regTitle) === region;
  const isCn = (r) => regRegionByCountry(r.country || r.regTitle) === 'cn';

  // 查询去噪：去掉对比框架词（中国/欧盟/差异/区别/哪些 等），避免稀释核心主题词权重
  const focused = stripCompareFraming(question);

  // 中国侧：中文词检索（去噪后的主题 + 中文扩展词），过滤中国法规
  const cnQuery = focused + ' ' + chineseExpansionQuery(question);
  const cnRaw = idx.search(tokenize(cnQuery), topK * 4);
  const cnMerged = mergeArticleChunks(cnRaw).filter(isCn);

  // 主题短语匹配 boost：查询中的高区分度中文短语（如"药物警戒检查""药物警戒负责人"）
  // 若出现在法规标题或正文中，该条款 +50% 权重。解决"主题短语被高频泛词淹没导致核心条款漏检"。
  const phrases = extractTopicPhrases(focused);
  if (phrases.length) {
    for (const r of cnMerged) {
      const hay = (r.regTitle || '') + ' ' + (r.text || '');
      if (phrases.some((p) => hay.includes(p))) r.score *= 1.5;
    }
    cnMerged.sort((a, b) => b.score - a.score);
  }

  // 目标地区侧（欧盟/美国）：纯英文词检索（不用中文，中文词会挤占英文文档的候选名额），
  // 过滤目标地区法规；排除地区泛词（EU/EMA 等），让主题词（如 audit/inspection）主导 IDF
  const engQuery = englishExpansionQuery(question, { excludeRegionTerms: true });
  const targetQuery = (engQuery || focused);
  const targetRaw = idx.search(tokenize(targetQuery), topK * 4);
  const targetMerged = mergeArticleChunks(targetRaw).filter(isTarget);

  // 各取一半（不足则从对方补足），交错合并
  const half = Math.ceil(topK / 2);
  const picked = [];
  const seenKeys = new Set();
  const takeOne = (list) => {
    for (const r of list) {
      const key = `${r.regId}|${r.articleNum}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      picked.push(r);
      return true;
    }
    return false;
  };
  // 交错合并（欧盟1条、中国1条交替），避免 rerank 候选列表"前段全欧盟、后段全中国"
  // 导致 LLM 倾向只选一侧（历史教训：先取欧盟再取中国，rerank 全选欧盟、中国全丢）
  let ti = 0, ci = 0;
  const maxN = Math.max(targetMerged.length, cnMerged.length);
  for (let k = 0; k < maxN && picked.length < topK; k++) {
    if (k % 2 === 0) { if (ti < targetMerged.length && !seenKeys.has(`${targetMerged[ti].regId}|${targetMerged[ti].articleNum}`)) { seenKeys.add(`${targetMerged[ti].regId}|${targetMerged[ti].articleNum}`); picked.push(targetMerged[ti]); } ti++; }
    else { if (ci < cnMerged.length && !seenKeys.has(`${cnMerged[ci].regId}|${cnMerged[ci].articleNum}`)) { seenKeys.add(`${cnMerged[ci].regId}|${cnMerged[ci].articleNum}`); picked.push(cnMerged[ci]); } ci++; }
  }
  // 补足：若某侧耗尽，用另一侧补齐
  if (picked.length < topK) {
    for (const r of [...targetMerged, ...cnMerged]) {
      if (picked.length >= topK) break;
      const key = `${r.regId}|${r.articleNum}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      picked.push(r);
    }
  }

  if (!diverse) {
    return picked.slice(0, topK);
  }
  return applyDiversity(picked, topK, 3);
}

// 收集问题触发的英文扩展词（用于补充检索英文文档）
function englishExpansionQuery(question, { excludeRegionTerms = false } = {}) {
  const words = [];
  for (const c of matchedConcepts(question)) {
    // 分路检索时排除地区/组织泛词（EU/EMA/FDA 等）：它们对所有该地区文档都高频、无区分度，
    // 会稀释主题词（如 audit）的 IDF；地区定位已由 country 过滤完成。
    if (excludeRegionTerms && ['eu', 'us', 'who', 'ich', 'ema', 'fda', 'nmpa', 'cde'].includes(c.id)) continue;
    for (const t of c.terms || []) {
      if (!/[A-Za-z]/.test(t)) continue; // 只取英文术语
      for (const w of t.split(/[^A-Za-z]+/)) {
        if (w.length >= 3) words.push(w);
      }
    }
  }
  return [...new Set(words)].join(' ');
}

// 收集问题触发的中文扩展词（用于分路检索的中国侧）
function chineseExpansionQuery(question) {
  const words = [];
  for (const c of matchedConcepts(question)) {
    for (const t of c.terms || []) {
      if (/[A-Za-z]/.test(t)) continue; // 只取中文术语
      // 过滤单字泛词（"检查""审计"等 IDF 低、无区分度，反而稀释多字核心词如"药物警戒检查"）
      if (t.length < 2) continue;
      words.push(t);
    }
  }
  return [...new Set(words)].join(' ');
}

// ---------- 查询改写（LLM，主路径） ----------
// 每次检索前用 DeepSeek 把用户问题改写成中英双语检索词，彻底消除
// "手动词表覆盖不全导致反复漏检"的问题（递交/频率/评估等高频词无需逐个手补）。
// 带内存缓存 + 失败静默降级（返回原问题）。
const _rewriteCache = new Map();
const REWRITE_CACHE_MAX = 500;
const REWRITE_PROMPT = `你是药物警戒法规检索助手。请把用户问题改写成检索关键词，输出 JSON：{"keywords": ["中英双语关键词..."]}。关键词覆盖问题核心概念及同义词，中英双语都要有（中文词和对应英文词），每词 1-6 字，共 6-14 个词。只输出 JSON。`;

export async function queryRewrite(question) {
  const q = String(question || '').trim();
  if (!q) return q;
  if (_rewriteCache.has(q)) return _rewriteCache.get(q);
  const { key } = getDeepSeekConfig();
  if (!key) return q;
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(20000), // 改写请求 20s 超时
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: getDeepSeekConfig().model,
        messages: [
          { role: 'system', content: REWRITE_PROMPT },
          { role: 'user', content: q },
        ],
        temperature: 0,
        seed: SEED,
        max_tokens: 300,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) return q;
    const json = await resp.json();
    const content = (json.choices?.[0]?.message?.content || '').trim();
    let keywords = [];
    try {
      keywords = JSON.parse(content).keywords || [];
    } catch {
      // 非 JSON 输出时按空白拆分
      keywords = content.split(/[\s,，;；]+/).filter(Boolean);
    }
    if (!keywords.length) return q;
    const text = keywords.slice(0, 14).join(' ');
    if (text.length > 300) return q;
    // 缓存（FIFO）
    if (_rewriteCache.size >= REWRITE_CACHE_MAX) {
      const firstKey = _rewriteCache.keys().next().value;
      _rewriteCache.delete(firstKey);
    }
    _rewriteCache.set(q, text);
    return text;
  } catch {
    return q; // 失败静默降级，用原问题继续
  }
}

// ---------- 显式条款定位（用户直接指定《法规》第X条，如"根据《药物警戒质量管理规范》第十七条…"） ----------
// 这类问题不需要全库检索：直接精确定位该条款，避免英文翻译全文被当检索词导致召回大量无关条款。
const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 中文数字 → 阿拉伯数字（"第十七条" → 17；"第一百二十七条" → 127）
export function cn2num(s) {
  const str = String(s || '').replace(/[第条\s]/g, '');
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  let total = 0;
  let section = 0;
  let cur = 0;
  for (const ch of str) {
    if (ch === '十') { section += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { section += (cur || 1) * 100; cur = 0; }
    else if (ch === '千') { section += (cur || 1) * 1000; cur = 0; }
    else if (ch in CN_DIGITS) cur = CN_DIGITS[ch];
  }
  return section + cur;
}

// 识别问题中显式引用的条款：《法规名》第X条（支持中文/阿拉伯数字、"第X条"、"第 X 条"）
export function detectExplicitCitations(question) {
  const q = String(question || '');
  const hits = [];
  const re = /《([^》]{1,40}?)》\s*第\s*([0-9０-９]+|[零〇一二三四五六七八九十百千]+)\s*条/g;
  let m;
  while ((m = re.exec(q))) {
    hits.push({ regTitle: m[1].trim(), articleNum: cn2num(m[2]) });
  }
  return hits;
}

// 精确条款 → 检索结果格式（score 置顶，避免后续被稀释）
function exactToResult(reg, ch, art) {
  return {
    regId: reg.id || reg.title,
    regTitle: reg.title,
    articleNum: art.num,
    chapterTitle: ch.title || '',
    text: (art.text || '').trim(),
    part: 0,
    partTotal: 1,
    score: 1e9, // 显式引用条款，压倒性置顶
  };
}

// 按「法规标题 + 条款号」在法规库中精确定位；返回数组（可能命中多条）
export function locateExplicitArticles(citations) {
  const regs = loadRegulations();
  const out = [];
  for (const c of citations) {
    // 法规标题匹配：全等 > 包含
    const reg = regs.find((r) => r.title === c.regTitle)
      || regs.find((r) => (r.title || '').includes(c.regTitle) || (c.regTitle || '').includes(r.title || ''));
    if (!reg) continue;
    for (const ch of reg.chapters || []) {
      for (const art of ch.articles || []) {
        if (cn2num(art.num) === c.articleNum) {
          out.push(exactToResult(reg, ch, art));
        }
      }
    }
  }
  return out;
}

// 问答入口级封装：识别显式条款引用并精确定位。
// 返回 { mode: 'exact', results }（命中显式引用，应跳过 BM25/rerank）
//      { mode: 'normal' }（未命中显式引用，走常规检索）
export function resolveExplicitCitation(question) {
  const citations = detectExplicitCitations(question);
  if (!citations.length) return { mode: 'normal' };
  const results = locateExplicitArticles(citations);
  if (!results.length) return { mode: 'normal' }; // 引用的法规/条款不在库中，回退常规检索
  return { mode: 'exact', results };
}

// ---------- 上市前/上市后 语境识别 ----------
const PRE_MARKET_TERMS = ['研发', '临床', '试验', '开发', '上市前', '注册', '申办者', '受试者', '研究者', '伦理', '期临床', 'IND', '药审中心', 'CDE', '临床试验', '药品研发', '药物开发', '临床研究', '创新药研发', 'BE试验'];
const POST_MARKET_TERMS = ['上市后', '持有人', '不良反应', '召回', '经营', '流通', '药物警戒', 'MAH', '监测', 'PSUR', '药品经营'];

export function detectPhase(question) {
  const q = String(question || '');
  let pre = 0;
  let post = 0;
  for (const t of PRE_MARKET_TERMS) if (q.includes(t)) pre++;
  for (const t of POST_MARKET_TERMS) if (q.includes(t)) post++;
  if (pre > post) return 'pre';
  if (post > pre) return 'post';
  return 'neutral';
}

// 法规阶段属性（按标题启发式）：CDE 指导原则 → 上市前；GVP/ADR/召回等 → 上市后
function regPhase(regTitle) {
  const t = String(regTitle || '');
  if (/(指导原则|技术指导原则)/.test(t)) return 'pre';
  if (/(药物警戒|不良反应|召回|经营|流通|上市后|检查|监测)/.test(t)) return 'post';
  if (/(临床|研发|注册|试验|疫苗|器械|化妆品|生产)/.test(t)) return 'pre';
  return 'neutral';
}

// 语境加权：上市前语境提升上市前法规、压制上市后法规（反之亦然）
function applyPhaseWeighting(results, phase) {
  for (const r of results) {
    const rp = regPhase(r.regTitle);
    if (phase === 'pre') {
      if (rp === 'pre') r.score *= 1.25;
      else if (rp === 'post') r.score *= 0.55;
    } else if (phase === 'post') {
      if (rp === 'post') r.score *= 1.2;
      else if (rp === 'pre') r.score *= 0.8;
    }
  }
  results.sort((a, b) => b.score - a.score);
}

// ---------- 地区/国家 感知加权（全球法规库） ----------
// 问题提及某国家/地区/组织时，提升对应国家法规权重（如"欧盟/欧洲" → GVP/欧盟指令/条例）
const REGION_TERMS = {
  cn: ['中国', '我国', '国内', '国家药品监督管理局', '国家药监局', 'NMPA', 'China'],
  eu: ['欧盟', '欧洲', '欧共体', 'European Union', 'EU', 'Europe', 'EMA', '欧洲药品管理局'],
  us: ['美国', 'FDA', 'U.S.', 'USA', 'United States'],
  who: ['WHO', '世界卫生组织', '国际卫生'],
  ich: ['ICH', '国际人用药品注册技术协调会'],
};

// 检测问题中的地区意图（中国/欧盟/美国/WHO/ICH）；无地区意图返回 'neutral'
export function detectRegion(question) {
  const q = String(question || '');
  // 精确匹配优先：避免"中国"误匹配"中国境内"以外的场景；"我国/国内"也指中国
  for (const [region, terms] of Object.entries(REGION_TERMS)) {
    for (const t of terms) {
      if (q.includes(t)) return region;
    }
  }
  return 'neutral';
}

// 对比问题中"非中国的那一方"地区（如"欧盟和中国"→eu；"中美"→us）。
// detectRegion 可能因"中国"先出现而返回 cn，此时需解析出真正的对比对象。
function detectNonCnRegion(question) {
  const q = String(question || '');
  if (/欧盟|欧洲|欧共体|European Union|EU|Europe|EMA/.test(q)) return 'eu';
  if (/美国|FDA|U\.S\.|USA|United States/.test(q)) return 'us';
  return 'neutral';
}

// 法规地区属性（用法规库真实 country 字段，而非标题正则猜测）
function regRegionByCountry(country) {
  const c = String(country || '');
  if (/欧盟|European Union|^\s*EU\s*$|Europe/i.test(c)) return 'eu';
  if (/美国|United States|^\s*US\s*$|FDA|U\.S\./i.test(c)) return 'us';
  if (/中国|China|^\s*CN\s*$/i.test(c)) return 'cn';
  return 'neutral';
}

// 是否对比类问题（中欧/中美等对比）：对比时不应压制另一地区，需两边法规都保留
function isCompareQuestion(question) {
  return /对比|比较|差异|区别|不同|异同|差别|相异|difference|compare|vs\.?|versus|versus/i.test(String(question || ''));
}

// 查询去噪：去掉对比框架词（国家/地区名、对比/差异/区别/哪些等虚词），
// 避免这些高频虚词稀释核心主题词（如"药物警戒检查"）的 BM25 权重
function stripCompareFraming(question) {
  const q = String(question || '');
  return q
    .replace(/中国的|欧盟的|美国的|中欧|中美|中国|欧盟|欧洲|美国/g, ' ')
    .replace(/的差异|的区别|的不同|有哪些|有什么|差异|区别|不同|异同|差别|相异|对比|比较|哪些|什么/g, ' ')
    .replace(/vs\.?|versus|compare|difference/gi, ' ')
    .replace(/[和与及、。？?！!，,：:；;的]/g, ' ') // 去掉残留助词/标点
    .replace(/\s+/g, ' ')
    .trim();
}

// 提取查询中的高区分度主题短语（≥4字中文短语，排除泛词），用于正文/标题匹配 boost。
// 如"药物警戒负责人"（6字）可匹配 GVP 第二十五条正文；"药物警戒检查"可匹配检查指导原则标题。
// 排除"药品上市许可持有人""监督管理"等高频泛词，避免泛词 boost 放大噪声。
const TOPIC_STOP_PHRASES = ['药品上市许可持有人', '上市许可持有人', '监督管理', '质量管理规范', '相关法律法规'];
function extractTopicPhrases(focused) {
  const words = String(focused || '').split(/\s+/).filter(Boolean);
  const phrases = [];
  for (const w of words) {
    if (/^[\u4e00-\u9fff]{4,}$/.test(w) && !TOPIC_STOP_PHRASES.some((s) => w.includes(s))) {
      phrases.push(w);
    }
  }
  // 若无独立 ≥4 字短语，尝试合并相邻中文片段
  if (!phrases.length) {
    const joined = words.filter((w) => /^[\u4e00-\u9fff]+$/.test(w)).join('');
    if (joined.length >= 4 && !TOPIC_STOP_PHRASES.some((s) => joined.includes(s))) phrases.push(joined);
  }
  // 去重 + 按长度降序（长短语优先，如"药物警戒负责人"优先于"药物警戒"）
  return [...new Set(phrases)].sort((a, b) => b.length - a.length);
}

// 地区加权：提到欧盟时欧盟法规 ×2.5 提升、其他地区法规 ×0.5 压制；对比类问题仅提升目标地区（×1.8），不压制
function applyRegionWeighting(results, region, compare = false) {
  const boost = compare ? 1.8 : 2.5;
  const suppress = compare ? 1.0 : 0.5;
  for (const r of results) {
    const rr = regRegionByCountry(r.country || r.regTitle); // country 优先，缺失时回退标题
    if (region === 'eu') {
      if (rr === 'eu') r.score *= boost;
      else if (rr !== 'eu') r.score *= suppress;
    } else if (region === 'us') {
      if (rr === 'us') r.score *= boost;
      else if (rr !== 'us') r.score *= suppress;
    }
  }
  results.sort((a, b) => b.score - a.score);
}

// 法规多样性重排（MMR 简化版）：按相关性排序，但每部法规最多保留 maxPerReg 条，
// 确保法律/部门规章/指导原则等不同来源的法规都能进入上下文
function applyDiversity(results, topN, maxPerReg = 3) {
  const out = [];
  const perReg = new Map();
  for (const r of results) {
    const n = perReg.get(r.regId) || 0;
    if (n >= maxPerReg) continue;
    out.push(r);
    perReg.set(r.regId, n + 1);
    if (out.length >= topN) break;
  }
  return out;
}

// 条款级聚合：同一条款被切成多块时合并为完整条款，避免"命中断头块"丢失关键内容
function mergeArticleChunks(chunks) {
  const groups = new Map();
  for (const c of chunks) {
    // 有条号按条款聚合；无条号（CDE 段落）保持独立分块
    const key = c.articleNum ? `${c.regId}|${c.articleNum}` : c.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const merged = [];
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
    const first = arr[0];
    merged.push({
      ...first,
      text: arr.map((x) => x.text).join('\n'),
      score: Math.max(...arr.map((x) => x.score)),
    });
  }
  return merged.sort((a, b) => b.score - a.score);
}

function buildContext(results) {
  return results
    .map((r, i) => {
      const where = r.articleNum ? (/条$/.test(r.articleNum) ? r.articleNum : `${r.articleNum}条`) : '';
      const ch = r.chapterTitle ? `（${r.chapterTitle}）` : '';
      return `【片段${i + 1}】来源：《${r.regTitle}》${where}${ch}\n${r.text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * 基于已有检索结果生成流式回答（不含检索）。
 * 返回 { type: 'stream', gen } 或 { type: 'fallback', reason, message }
 */
export async function buildAnswerStream(question, results, { model: modelOverride, exact = false } = {}) {
  const { key, model } = getDeepSeekConfig();
  if (!key) {
    return { type: 'fallback', reason: 'no-key', message: '未配置 DeepSeek API Key，当前仅展示检索到的相关条文' };
  }
  const exactRule = exact
    ? '\n4. 用户已在问题中明确指出所引用的法规条款，请仅围绕该条款回答，只引用该条款，不要引入其他法规条款。'
    : '';
  const userPrompt = `请基于以下检索到的法规条文回答用户问题。\n\n=== 检索到的法规条文 ===\n${buildContext(results)}\n\n=== 用户问题 ===\n${question}\n\n要求：\n1. 优先依据检索条文回答并标注引用，格式【《法规名》第X条】；\n2. 检索条文中直接回答该问题的内容务必完整引用（如职责清单逐项列出），不要遗漏关键条款；\n3. 条文不足时如实说明。\n4. 控制篇幅：引用条文时概括要点即可，不要逐字粘贴大段原文；同一主题的多个相近条款合并表述，避免重复冗长。${exactRule}`;

  let resp;
  try {
    resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(120000), // 生成请求 120s 超时（流式长回答）
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelOverride || model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        temperature: TEMPERATURE,
        seed: SEED,
        max_tokens: 8000,
      }),
    });
  } catch (e) {
    return { type: 'fallback', reason: 'network-error', message: `无法连接 DeepSeek API：${e.message}` };
  }

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    return { type: 'fallback', reason: 'api-error', message: `DeepSeek API 返回 ${resp.status}：${errText.slice(0, 300)}` };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  async function* gen() {
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* 忽略解析失败的行 */
        }
      }
    }
  }

  return { type: 'stream', gen: gen() };
}

/**
 * 问答入口（检索 + 生成）。返回：
 *  - { type: 'fallback', reason, message, results }
 *  - { type: 'stream', results, gen }
 */
export async function answerQuestion(question, { topK = 8, model } = {}) {
  const { results } = searchRegulations(question, topK);
  if (!results.length) {
    return { type: 'fallback', reason: 'no-results', message: '未检索到相关法规条文，请换个问法', results: [] };
  }
  const stream = await buildAnswerStream(question, results, { model });
  if (stream.type === 'fallback') {
    return { type: 'fallback', reason: stream.reason, message: stream.message, results };
  }
  return { type: 'stream', results, gen: stream.gen };
}
