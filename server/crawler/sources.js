// 爬虫数据源配置（默认源均已验证可访问）
// 用户可在设置页或 data/state/sources.json 中增删改
import fs from 'node:fs';
import { STATE_DIR } from '../config.js';
import { writeJsonAtomic } from '../json-store.js';

const SOURCES_FILE = `${STATE_DIR}/sources.json`;

export const DEFAULT_SOURCES = [
  {
    id: 'ahfda-normative',
    name: '安徽省药监局·规范性文件',
    type: 'trs-label',
    enabled: true,
    url: 'https://mpa.ah.gov.cn/site/label/8888',
    method: 'post',
    form: {
      labelName: 'publicInfoList',
      siteId: '10914581',
      organId: '4140867',
      pageSize: '30',
      catId: '6719764',
      type: '4',
      dateFormat: 'yyyy年MM月dd日',
      file: '/shiyjj/publicInfoList_newest2020',
    },
    note: 'TRS 标签接口：返回 HTML 片段，含 a[title] 链接与日期',
  },
  {
    id: 'ahfda-latest',
    name: '安徽省药监局·最新公开信息',
    type: 'trs-label',
    enabled: true,
    url: 'https://mpa.ah.gov.cn/site/label/8888',
    method: 'post',
    form: {
      labelName: 'publicInfoList',
      siteId: '10914581',
      organId: '4140867',
      pageSize: '30',
      catId: '',
      type: '4',
      dateFormat: 'yyyy年MM月dd日',
      file: '/shiyjj/publicInfoList_newest2020',
    },
    note: '含通知、公告、方案等全部最新公开信息（可人工筛选）',
  },
];

export function getSources() {
  try {
    const saved = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
    if (Array.isArray(saved)) return saved;
  } catch {
    /* 无保存配置 */
  }
  return DEFAULT_SOURCES;
}

export function saveSources(sources) {
  writeJsonAtomic(SOURCES_FILE, sources);
}
