// 爬虫核心：按数据源抓取列表 → 去重 → 生成候选
import * as cheerio from 'cheerio';
import { getSources } from './sources.js';
import { createCandidate, getSeenSet, saveSeenSet, pendingCandidates } from './candidates.js';
import { isRegulationLike } from '../util.js';
import { fetchText } from '../util.js';

const DATE_RE = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

async function crawlTrsLabel(src) {
  const body = new URLSearchParams(src.form || {}).toString();
  const { text: html } = await fetchText(src.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://mpa.ah.gov.cn/',
    },
    body,
  });
  const $ = cheerio.load(html);
  const items = [];
  $('a[title]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const title = (a.attr('title') || a.text() || '').trim();
    if (!href || !/\.html?$/i.test(href) || !title) return;
    const abs = new URL(href, src.url).href;
    // 从所在列表项向上找日期
    let date = '';
    let node = a.parent();
    for (let i = 0; i < 4 && node.length; i++) {
      const m = node.text().match(DATE_RE);
      if (m) {
        date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        break;
      }
      node = node.parent();
    }
    items.push({ title, url: abs, date });
  });
  // 去重（同 URL）
  const seen = new Set();
  return items.filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true)));
}

async function crawlHtmlList(src) {
  const { text } = await fetchText(src.url);
  const $ = cheerio.load(text);
  const items = [];
  const linkSel = src.selectors?.link || 'a[href]';
  $(linkSel).each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const title = (a.attr('title') || a.text() || '').trim();
    if (!href || !title) return;
    const abs = new URL(href, src.url).href;
    let date = '';
    const m = a.text().match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    items.push({ title, url: abs, date });
  });
  return items;
}

export async function crawlSource(src) {
  if (src.type === 'trs-label') return crawlTrsLabel(src);
  if (src.type === 'html-list') return crawlHtmlList(src);
  throw new Error(`未知数据源类型: ${src.type}`);
}

export async function crawlAllSources() {
  const sources = getSources().filter((s) => s.enabled !== false);
  const results = [];
  const seenSet = getSeenSet();
  let added = 0;
  for (const src of sources) {
    try {
      const items = await crawlSource(src);
      const fresh = items.filter((it) => !seenSet.has(it.url));
      const filtered = fresh.filter((it) => (src.keywords && src.keywords.length ? src.keywords.some((k) => it.title.includes(k)) : isRegulationLike(it.title)));
      for (const it of filtered) {
        seenSet.add(it.url);
        createCandidate({ sourceName: src.name, title: it.title, url: it.url, date: it.date });
      }
      added += filtered.length;
      results.push({ source: src.name, ok: true, found: items.length, filtered: filtered.length });
    } catch (e) {
      results.push({ source: src.name, ok: false, error: e.message });
    }
  }
  saveSeenSet();
  return { results, added, pending: pendingCandidates().length };
}
