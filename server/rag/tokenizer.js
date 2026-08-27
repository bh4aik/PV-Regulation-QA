// 中文分词：优先 jieba，缺失时回退为 CJK 二元组 + 字母数字 token
import { cut, loadDict } from '@node-rs/jieba';
import fs from 'node:fs';
import { GLOSSARY_FILE } from '../config.js';

const CJK = /[\u4e00-\u9fff]/;

// 领域词典：从 glossary.json 提取中文术语（≥2字），加载进 jieba 词典，
// 使"药物警戒负责人""药物警戒检查""药物警戒审计"等专有名词作为整体词被识别，
// 而非被拆成"药物/警戒/负责人"，从分词层面解决主题短语区分度丢失的问题。
let dictLoaded = false;
function ensureDictLoaded() {
  if (dictLoaded) return;
  dictLoaded = true;
  try {
    const glossary = JSON.parse(fs.readFileSync(GLOSSARY_FILE, 'utf-8'));
    const terms = new Set();
    for (const c of glossary.concepts || []) {
      for (const t of c.terms || []) {
        // 只收录纯中文术语（≥2字），排除含字母/数字/空格的混合词（如"CIOMS I表格"），
        // 避免 jieba loadDict 对含非中文字符的词 panic
        if (/^[\u4e00-\u9fff]{2,}$/.test(t)) terms.add(t);
      }
    }
    if (terms.size) {
      // jieba 词典格式：每行 "词 词频"（词频越高越倾向作为整体）
      const dict = [...terms].map((t) => `${t} 100`).join('\n');
      loadDict(Buffer.from(dict));
    }
  } catch {
    /* 词典加载失败静默降级为默认分词 */
  }
}

export function tokenize(text) {
  if (!text) return [];
  try {
    ensureDictLoaded();
    const words = cut(text);
    return words.filter((w) => w.trim().length > 0 && /[\u4e00-\u9fffA-Za-z0-9]/.test(w));
  } catch {
    return tokenizeFallback(text);
  }
}

function tokenizeFallback(text) {
  const out = [];
  const cleaned = text.replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, ' ');
  for (const seg of cleaned.split(/\s+/)) {
    if (!seg) continue;
    if (CJK.test(seg)) {
      if (seg.length === 1) {
        out.push(seg);
      } else {
        for (let i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
      }
    } else {
      out.push(seg.toLowerCase());
    }
  }
  return out;
}
