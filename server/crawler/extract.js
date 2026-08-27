// 文章正文提取：从候选 URL 抓取详情页 → 纯文本
import * as cheerio from 'cheerio';
import { fetchText, htmlToText } from '../util.js';

const CONTENT_SELECTORS = [
  '.wzcon',
  '.TRS_Editor',
  '.article-content',
  '.article',
  '#zoom',
  '.content',
  '.Section0',
  '.view',
  '.detail-content',
];

export async function fetchArticleText(url) {
  const { text: html } = await fetchText(url);
  return extractArticleText(html);
}

export function extractArticleText(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,iframe,form,header,footer,nav,.nav,.footer,.header').remove();
  // 1) 常见正文容器
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length) {
      const t = htmlToText(el.html() || '');
      if (t.length > 300) return t;
    }
  }
  // 2) 兜底：取文本最长的块级容器
  let best = '';
  let bestLen = 0;
  $('div,article,section,td').each((_, el) => {
    const t = htmlToText($(el).html() || '');
    if (t.length > bestLen) {
      bestLen = t.length;
      best = t;
    }
  });
  if (bestLen > 300) return best;
  // 3) 最后兜底：整页去标签
  return htmlToText($('body').html() || '');
}
