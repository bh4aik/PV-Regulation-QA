// 检索后重排（rerank）：用 LLM 从候选条文里精选最相关的 topN 条，
// 解决"关键词检索命中但 LLM 生成时忽略靠后相关条款"的问题
import { DEEPSEEK_URL, getDeepSeekConfig } from '../config.js';
import { expandQuery, detectPhase, detectRegion } from './qa.js';

const SEED = 20260815;

// 关键词定位摘要：展示含查询关键词（含中英文扩展术语）的片段（而非条款开头），
// 避免"关键内容在长条款后半段"时被 rerank 误判为不相关
function makeSnippet(text, question) {
  const t = String(text || '');
  const expanded = expandQuery(question); // 含 SUSAR→可疑且非预期严重不良反应 等扩展
  const terms = [];
  const cn = (expanded.match(/[\u4e00-\u9fff]{4,}/g) || []);
  terms.push(...cn);
  const en = (expanded.match(/[A-Za-z]{2,}/g) || []).map((s) => s.toUpperCase());
  terms.push(...en);
  for (const term of terms) {
    const i = t.indexOf(term);
    if (i > -1) {
      const start = Math.max(0, i - 60);
      return (start > 0 ? '…' : '') + t.slice(start, start + 220).replace(/\n/g, ' ') + '…';
    }
  }
  return t.slice(0, 180).replace(/\n/g, ' ');
}

export async function rerankCandidates(question, candidates, { topN = 15 } = {}) {
  const { key, model } = getDeepSeekConfig();
  if (!key || candidates.length <= topN) {
    return candidates.slice(0, topN); // 无 Key 或候选不足：降级为原始顺序
  }

  const list = candidates
    .map((r, i) => `[${i}]《${r.regTitle}》${r.articleNum || '（段落）'}：${makeSnippet(r.text, question)}`)
    .join('\n');

  const phase = detectPhase(question);
  const phaseRule =
    phase === 'pre'
      ? '用户问题涉及药品研发/临床试验等上市前活动，应优先选择 CDE 技术指导原则、GCP（药物临床试验质量管理规范）、药品注册管理办法等上市前法规条款；除非确无相关上市前条款，否则不要选《药物警戒质量管理规范》等上市后法规。'
      : phase === 'post'
        ? '用户问题涉及上市后持有人、不良反应监测等活动，应优先选择《药物警戒质量管理规范》等上市后法规条款。'
        : '';

  const region = detectRegion(question);
  const isCompare = /对比|比较|差异|区别|不同|difference|compare|vs\.?|versus/i.test(question);
  const regionRule =
    region === 'eu'
      ? (isCompare
          ? '用户问题是对比类（中欧/欧盟与中国对比），必须同时保留欧盟与中国双方的法规条款，两边都至少保留 2-3 条，分别呈现。'
          : '用户问题明确涉及欧盟/欧洲，应优先选择欧盟法规与指南（如 Good pharmacovigilance practices (GVP) 模块、Directive 2001/83/EC、Regulation (EU) No 520/2012 等），其次才是中国法规。')
      : region === 'us'
        ? (isCompare
            ? '用户问题是对比类（中美对比），必须同时保留美国与中国双方的法规条款，两边都至少保留 2-3 条。'
            : '用户问题明确涉及美国，应优先选择 FDA/美国法规与指南。')
        : '';

  const prompt = `你是法规检索排序助手。下面是从法规库检索到的候选条文（按初步相关度排序）。请从中选出最能回答用户问题的 ${topN} 条，按相关度从高到低排列，只输出候选编号的 JSON 数组。

选择原则：
1. 优先选直接回答用户问题核心（如问"时限"就优先选含具体时限的条款）的条文；
2. 同时纳入提供必要补充信息的关联条款（如报告义务、报告对象、报告方式、定义等），确保回答完整不遗漏；
3. 同一法规的相近条款可同时入选，但应避免冗余：若多个子条款（如 IV.B.3.1.1/3.1.2/3.1.3）都在讲同一主题（如"审计员要求"），合并选最核心的 1-2 条即可，不要全选，以免回答冗长被截断。
${phaseRule ? `4. 语境匹配：${phaseRule}` : ''}${regionRule ? `${phaseRule ? '\n' : '4. '}地区匹配：${regionRule}` : ''}

用户问题：${question}

候选条文：
${list}

输出格式（只输出 JSON，不要其他文字）：{"indices":[3,0,12,...]}`;

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(30000), // 重排请求 30s 超时
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是法规检索排序助手，只输出 JSON，不要输出任何解释。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        seed: SEED,
        max_tokens: 300,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) return candidates.slice(0, topN);

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '';
    let indices = [];
    try {
      const parsed = JSON.parse(content);
      indices = Array.isArray(parsed.indices) ? parsed.indices : [];
    } catch {
      return candidates.slice(0, topN);
    }

    const seen = new Set();
    const out = [];
    for (const i of indices) {
      if (Number.isInteger(i) && i >= 0 && i < candidates.length && !seen.has(i)) {
        seen.add(i);
        out.push(candidates[i]);
      }
    }
    // 不足补齐：按原始相关度顺序补充
    for (const c of candidates) {
      if (out.length >= topN) break;
      if (!out.includes(c)) out.push(c);
    }
    return out.slice(0, topN);
  } catch (e) {
    console.error('[rerank] 重排失败，降级为原始顺序:', e.message);
    return candidates.slice(0, topN);
  }
}
