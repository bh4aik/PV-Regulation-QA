// 系统日志（版本升级记录）存储：data/state/changelog.json
// 记录系统升级、功能新增与问题修正，供管理员在「系统日志」面板查看。
import fs from 'node:fs';
import { nanoid, now } from './util.js';
import { CHANGELOG_FILE } from './config.js';
import { writeJsonAtomic } from './json-store.js';

// 种子记录：首次创建（或清空）时写入，保证新部署/新环境自带最新升级说明。
// 条目结构：{ id, version, date, title, kind: 'upgrade'|'fix'|'feature', items: string[], by }
export const SEED_CHANGELOG = [
  {
    id: 'seed_040',
    version: '0.4.0',
    date: '2026-08-27',
    title: '升级至 v0.4.0：安全与部署加固',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '修复上传接口缺少管理员认证、法规 ID 目录穿越和索引重建运行时错误。',
      '新增爬虫 SSRF 防护、响应大小限制、外部 API 超时以及问答长度、频率和并发额度保护。',
      '敏感配置不再回显，JSON 状态采用原子写入并限制权限。',
      '生产容器升级至 Node.js 22，以非 root、只读根文件系统和最小权限运行。',
    ],
  },
  {
    id: 'seed_021',
    version: '0.2.1',
    date: '2026-08-16',
    title: '升级至 v0.2.1：语境感知检索加权',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '新增「上市前/上市后」语境识别（detectPhase）与法规阶段属性（regPhase）：涉及药品研发、临床试验、药品开发、注册审评等问题，检索时自动提升 CDE 技术指导原则、GCP、药品注册管理办法等上市前法规的权重，并压制 GVP 等上市后法规；上市后问题反向处理。',
      '重排（rerank）提示词与回答生成系统提示词同步加入语境匹配准则，引导模型优先引用对应阶段的法规条款。',
      '修正：研发阶段/临床研究类问题不再误引《药物警戒质量管理规范》等上市后法规作答。',
      '新增「系统日志」管理面板：集中展示版本升级、功能新增与问题修正记录。',
    ],
  },
  {
    id: 'seed_020',
    version: '0.2.0',
    date: '2026-08-15',
    title: '升级至 v0.2.0：检索质量与监管知识覆盖强化',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '扩展中英文术语映射（SUSAR/PSUR/PBRER/RMP/Signal Detection/Benefit-Risk Assessment 等），英文缩写与全称提问均可命中中文法规原文。',
      '检索候选数提升（topK 8→20、候选 30 条精选 15 条），解决职责类、信号检测类问题漏引核心条款。',
      '新增 LLM 重排（rerank）与关键词定位摘要，长条款关键内容不再被误判为不相关。',
      '条款按法规聚合、多样性重排，避免单一法规刷屏淹没核心条款。',
    ],
  },
  {
    id: 'seed_015',
    version: '0.1.5',
    date: '2026-08-14',
    title: '升级至 v0.1.5：管理后台与部署完善',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '新增管理控制面板（概览/用户管理/反馈管理/分析洞察）、👍👎 反馈与答案复制、注册防滥用（限流/开关/邀请码/Turnstile）。',
      '修复回答截断（max_tokens 6000）、列表序号重复、聊天记录切换视图丢失等问题。',
      '法规库支持在线编辑元数据与标签；每日定时爬虫 + 自动备份；完善公网部署流程。',
    ],
  },

  {
    id: 'seed_035',
    version: '0.3.5',
    date: '2026-08-19',
    title: '升级至 v0.3.5：检索准确性与法规库体验全面提升',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '检索架构三路分流：对比问题分路检索（中欧交错合并）、单地区问题单地区过滤、无地区意图通用混合；detectRegion 补齐「中国」识别。',
      'jieba 领域词典：从术语表加载 300+ 中文术语，专有名词整体识别（药物警戒负责人/检查/审计等），核心条款不再被高频泛词淹没。',
      '术语映射重构为结构化双语词表 data/glossary.json（142 个概念组，中英双向 + 中文同义）。',
      '欧盟 EMA 药物警戒法规库上线（GVP 模块 I-XVI、附件、Directive 2001/83/EC、Reg. (EU) 520/2012 等 41 部），法规库共 78 部。',
      '法规库页面：搜索不区分大小写、新增国家/地区 filter（中国/欧盟/美国/ICH，AND 关系）、类别 filter 补全。',
      '修复英文清洗器（罗马数字编号/噪声过滤）、检查要点表 PV 项拆分、长回答截断等。',
    ],
  },
  {
    id: 'seed_031',
    version: '0.3.1',
    date: '2026-08-17',
    title: '升级至 v0.3.1：全球法规库 + 检索架构重构',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '法规库扩展为全球法规库：新增「国家/地区/组织」属性，收录欧盟 EMA/EU 药物警戒法规 41 部。',
      '对比类问题改用分路检索（中欧各自独立检索后合并），根治中英文文档同量纲竞争导致英文文档被压制的问题。',
      '新增显式条款定位（《法规》第X条精确定位）、上市前/上市后语境加权、地区感知加权。',
    ],
  },
  {
    id: 'seed_024',
    version: '0.2.4',
    date: '2026-08-17',
    title: '升级至 v0.2.4：英文条款编号提取系统性修复',
    kind: 'fix',
    by: 'admin',
    items: [
      '修复英文清洗器 num 提取正则与判定正则不一致（罗马数字编号），GVP 模块条款号 articleNum 大量为空的 bug。',
      '新增英文文档清洗器（识别 Article N / I.A. / III.A. / IX. Add I.1. 编号结构）。',
    ],
  },
  {
    id: 'seed_023',
    version: '0.2.3',
    date: '2026-08-17',
    title: '升级至 v0.2.3：检索架构系统性重构（方案1）',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '法规 country 字段打入 chunk 索引，地区加权改用真实 country。',
      '术语映射重构为结构化双语词表，新增 LLM 查询改写兜底。',
    ],
  },
  {
    id: 'seed_022',
    version: '0.2.2',
    date: '2026-08-17',
    title: '升级至 v0.2.2：欧盟 EMA 药物警戒法规库上线',
    kind: 'upgrade',
    by: 'admin',
    items: [
      '新增欧盟 EMA 药物警戒指南 37 份（GVP 模块）+ 欧盟核心法规 4 部。',
      '法规库新增「国家/地区/组织」属性，检索分块 1819 → 6531。',
    ],
  },
];

export function loadChangelog() {
  let arr = null;
  try {
    arr = JSON.parse(fs.readFileSync(CHANGELOG_FILE, 'utf-8'));
    if (!Array.isArray(arr)) arr = null;
  } catch {
    arr = null;
  }

  if (!arr) {
    // 文件不存在或损坏：用种子记录初始化
    const seed = SEED_CHANGELOG.map((c) => ({ ...c, id: 'log_' + nanoid(8), createdAt: now() }));
    writeJsonAtomic(CHANGELOG_FILE, seed);
    return seed;
  }

  // 合并种子：把 SEED_CHANGELOG 中「文件里还没有的版本」补进文件，保证升级部署后
  // 服务器能自动带上最新版本升级说明（data/state 不随部署覆盖，靠种子合并补新版本）。
  // 按 version 去重；用户手动增删的同版本日志不受影响。
  const existingVersions = new Set(arr.map((c) => c.version).filter(Boolean));
  let changed = false;
  for (const seed of SEED_CHANGELOG) {
    if (!seed.version || existingVersions.has(seed.version)) continue;
    arr.unshift({ ...seed, id: 'log_' + nanoid(8), createdAt: now() });
    existingVersions.add(seed.version);
    changed = true;
  }
  if (changed) {
    writeJsonAtomic(CHANGELOG_FILE, arr);
  }
  return arr;
}

function saveChangelog(list) {
  writeJsonAtomic(CHANGELOG_FILE, list);
}

// 追加一条系统日志（管理员手工记录）
export function appendChangelog({ version = '', title = '', kind = 'feature', items = [], by = 'admin' }) {
  const list = loadChangelog();
  const item = {
    id: 'log_' + nanoid(10),
    version: String(version || '').slice(0, 20),
    date: new Date().toISOString().slice(0, 10),
    title: String(title || '').slice(0, 120),
    kind: ['upgrade', 'feature', 'fix'].includes(kind) ? kind : 'feature',
    items: (Array.isArray(items) ? items : []).map((s) => String(s).slice(0, 500)).filter(Boolean),
    by: String(by || 'admin').slice(0, 50),
    createdAt: now(),
  };
  list.unshift(item);
  saveChangelog(list);
  return item;
}

export function deleteChangelog(id) {
  const list = loadChangelog().filter((c) => c.id !== id);
  saveChangelog(list);
  return list;
}
