# 💊 药物警戒法规 AI 问答库（Pharmacovigilance Regulation Q&A）

面向**药品监管、药物警戒（PV）、不良反应监测、注册生产流通**从业者的法规智能问答库。基于 **RAG（检索增强生成）**：本地 BM25 检索 + DeepSeek 流式生成，回答引用具体法规条款并可点击跳转原文。

> **v0.4.0** · Node.js 22+ · 无构建步骤 · 支持中欧双法规库（中国 40 部 + 欧盟 EMA/EU 41 部）

---

## ✨ 核心功能

| 功能 | 说明 |
|---|---|
| 🤖 **智能问答** | BM25 检索 + DeepSeek 流式生成（SSE），回答引用具体条款【《法规》第X条】，点击引用跳转原文；Markdown 渲染 |
| 🌐 **全球法规库** | 已收录 **81 部法规 / 3582 条款**：中国（药品管理法、GVP、注册/生产/经营/检查办法、CDE 指导原则等 40 部）+ 欧盟（GVP 模块 I-XVI、附件、Directive 2001/83/EC、Reg. (EU) 520/2012 等 41 部） |
| 🔍 **语境感知检索** | 中英术语表（142 个概念组）+ 上市前/上市后语境加权 + 地区（中/欧/美）分流检索 + 显式条款定位（《法规》第X条精确命中） |
| 🔄 **中欧对比** | "中国 vs 欧盟"对比类问题自动分路检索（各自独立检索后交错合并），双侧法规均衡呈现 |
| 📚 **法规库管理** | 全文查看、搜索（不区分大小写）、按类别/国家筛选、上传入库（txt/md/docx/pdf → AI 清洗 → 核对入库）、在线编辑元数据 |
| 🔐 **账号体系** | 注册/登录（邮箱必填，用户名/手机号可选）、管理员控制台（用户管理、用量分析、反馈处理、分析洞察、系统日志） |
| 🕷️ **每日爬虫** | 定时抓取各官网新法规 → 去重 → 人工确认 → 清洗入库 |
| 👍 **反馈闭环** | 问答 👍/👎 评价、答案一键复制、反馈管理 |
| 🛡️ **安全加固** | 上传管理员鉴权、法规 ID 目录穿越防护、爬虫 SSRF 防护、JSON 原子写入、问答限流/并发保护、容器最小权限运行（详见「安全边界」） |

## 📐 检索架构（v0.3.x 重构）

```
用户问题
  ├─ 显式条款定位（《法规》第X条）→ 精确定位该条款
  ├─ 对比问题（中欧/中美）→ 分路检索：中国侧中文词 + 欧盟侧英文词，各自独立排序后交错合并
  ├─ 单地区问题（"中国的XX"/"欧盟的XX"）→ 仅该地区法规内检索（不跨地区串扰）
  └─ 无地区意图 → 通用混合检索（术语扩展 + 英文补充 + 地区加权）

后续：jieba 领域词典分词 → BM25（topK×8）→ 条款聚合 → 语境/地区加权
    → LLM 重排（rerank，含语境+地区规则）→ DeepSeek 生成 → 序号修正 → 缓存
```

**关键设计**：
- **地区元数据过滤**：每条法规带 `country` 字段，检索按地区分流，根治"问中国法规却混入欧盟条款"
- **jieba 领域词典**：从术语表加载 300+ 中文专有名词（药物警戒负责人/检查/审计等）整体识别
- **中英术语表**：`data/glossary.json`（142 概念组），中英双向 + 中文同义（如"安全性沟通"↔"风险沟通"↔"safety communication"）
- **LLM 查询改写兜底**：术语表未覆盖的措辞自动改写为中英双语检索词
- **确定性回答**：temperature=0 + 固定 seed + 答案缓存，相同问题返回一致答案

## 权限模型

| 功能 | 游客 | 普通用户 | 管理员 |
|---|---|---|---|
| 浏览法规库 | ✅ | ✅ | ✅ |
| AI 问答 / 查看自己的历史 | ❌（需登录） | ✅ | ✅ |
| 查看他人历史 / 全站历史 | ❌ | ❌ | ✅ |
| 上传 / 清洗 / 删除法规 | ❌ | ❌ | ✅ |
| 爬虫 / 设置（API Key） | ❌ | ❌ | ✅ |
| 用户管理与用量分析 | ❌ | ❌ | ✅ |

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js 22+）
npm ci

# 2. 启动
npm start
# 开发模式（代码改动自动重启）：npm run dev

# 3. 打开 http://localhost:3000
#    注册第一个账号 → 自动成为管理员
#    （或 .env 配置 ADMIN_USERNAME / ADMIN_PASSWORD 预置管理员）

# 4. 配置 DeepSeek API Key（二选一）
#    a) 复制 .env.example 为 .env，填 DEEPSEEK_API_KEY
#    b) 管理员登录后在「设置」页填写
#    不配置也能用：问答退化为「检索原文片段」模式
```

> 端口可用环境变量 `PORT` 修改。用户数据存于 `data/state/`（密码 scrypt 加盐哈希，不明文保存）。新密码要求 12-128 位。

## 安全边界

- **公网部署必须**：预置管理员（`ADMIN_USERNAME/ADMIN_PASSWORD`）并设置 `AUTO_FIRST_ADMIN=false`，防止首用户抢注接管。
- **接口防护**：上传/删除/设置等管理接口全部需要管理员 token；法规 ID 严格白名单校验（防目录穿越）；问答限流（60 秒 20 次）、单问题长度上限与每用户并发保护。
- **爬虫 SSRF 防护**：只允许 HTTP(S) 公网地址，逐跳校验重定向，限制响应体大小（默认 5MB）与外部 API 超时。
- **数据落盘**：设置/用户/历史等 JSON 采用原子写入（临时文件 + rename）并限制 0600 权限。
- **容器最小权限**：生产镜像 Node.js 22 非 root 用户（UID 1000）、只读根文件系统、丢弃全部 capabilities、端口仅绑定回环地址（`127.0.0.1:3000`），由宿主机 Caddy 反向代理。
- **隐私提示**：用户问题与召回的法规片段会发送给 DeepSeek；不要输入个人敏感信息或公司机密。API Key 不会回显到页面。
- 本项目提供法规检索辅助，不替代官方原文、法律意见或监管机构解释。

## 🗂️ 目录结构

```
├── server/
│   ├── index.js            # Express 入口
│   ├── config.js           # 路径 / 设置 / DeepSeek 配置
│   ├── changelog.js        # 系统日志（版本升级记录，种子自动合并）
│   ├── security.js         # 法规 ID 校验 / 私网地址检测 / 公网 URL 校验
│   ├── json-store.js       # JSON 原子写入（0600 权限）
│   ├── rag/                # 检索增强问答
│   │   ├── tokenizer.js    # jieba 分词 + 领域词典
│   │   ├── bm25.js         # BM25 索引
│   │   ├── indexer.js      # 法规 → 分块 → 索引（含 country）
│   │   ├── qa.js           # 检索（地区分流/语境加权）+ DeepSeek 生成
│   │   └── rerank.js       # LLM 重排（语境+地区规则）
│   ├── ingest/             # 入库管道（AI/启发式清洗，支持中英文法规）
│   ├── crawler/            # 每日爬虫
│   └── routes/             # REST API
├── web/                    # 前端（原生 JS 单页应用，无构建）
├── data/
│   ├── glossary.json       # 中英双语术语表（142 概念组）
│   ├── raw/                # 法规原始文本（含 cde/ ema/ eu-legislation/）
│   ├── regulations/        # 清洗入库的结构化法规（知识库，含 country）
│   ├── pending/            # 清洗任务 / 爬虫候选
│   └── state/              # 设置/用户/历史/缓存（运行数据，勿提交 Git）
├── scripts/
│   ├── ingest-raw.js       # 原始文本批量入库
│   ├── ingest-eu.js        # 欧盟法规入库（英文清洗）
│   ├── ema-collect.js      # EMA GVP 指南采集
│   ├── eu-legislation-collect.js  # 欧盟核心法规采集
│   ├── cde-collect.js      # CDE 指导原则采集
│   ├── manual-rag-check.mjs # 检索质量手动验证
│   └── deploy/             # 一键部署 / 备份脚本
├── test/                   # 安全回归测试（npm test）
├── Dockerfile              # 容器化（Node 22 非 root 只读根）
└── docker-compose.yml
```

## 🔌 API 一览

> 除标注（公开）外，均需 `Authorization: Bearer <token>`；`[A]` 表示仅管理员。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册（公开；首个账号自动为管理员） |
| POST | `/api/auth/login` | 登录（公开；支持邮箱/用户名/手机号） |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/public/needs-admin` | 系统是否尚无用户（公开） |
| POST | `/api/qa` | 问答（SSE 流式：meta/delta/fallback/done） |
| GET | `/api/history` | 我的问询历史 |
| DELETE | `/api/history/:id` | 删除单条历史 |
| GET | `/api/regulations` | 法规列表（公开，含 country） |
| GET | `/api/regulations/:id` | 法规全文（公开） |
| PATCH | `/api/regulations/:id` | 编辑法规元数据/标签 `[A]` |
| DELETE | `/api/regulations/:id` | 删除法规 `[A]` |
| POST | `/api/ingest/upload` | 上传法规文件 `[A]` |
| POST | `/api/ingest/tasks/:id/clean` | AI/启发式清洗 `[A]` |
| POST | `/api/ingest/tasks/:id/commit` | 确认入库 `[A]` |
| POST | `/api/crawler/run` | 立即检查各来源新法规 `[A]` |
| POST | `/api/crawler/candidates/:id/decide` | 候选处理（clean/ignore）`[A]` |
| GET/POST | `/api/settings` | 读取/保存设置 `[A]` |
| POST | `/api/settings/test-key` | 测试 DeepSeek Key 连通性 `[A]` |
| GET | `/api/admin/users` | 用户列表（含用量）`[A]` |
| PATCH | `/api/admin/users/:id` | 修改用户（角色/状态/密码/手机号）`[A]` |
| DELETE | `/api/admin/users/:id` | 删除用户 `[A]` |
| GET | `/api/admin/stats` | 用量分析（按天/按用户）`[A]` |
| GET | `/api/health` | 健康检查（公开） |

## 🐳 Docker 部署

```bash
# 生产环境（见 DEPLOY.md 完整流程）
docker compose up -d --build
```

- 端口仅绑定 `127.0.0.1:3000`，公网访问由宿主机 Caddy（HTTPS）反向代理；
- 容器以 UID 1000 非 root 用户运行，`data/` 目录需 `chown -R 1000:1000 data`（`upload.sh` 部署时自动执行）；
- 根文件系统只读 + 丢弃全部 capabilities，运行数据仅写入挂载卷 `./data` 与 `/tmp`（tmpfs）。

## 🧠 法规采集脚本

| 脚本 | 用途 |
|---|---|
| `node scripts/ema-collect.js` | 从 EMA 官网采集 GVP 指南 PDF（37 份）→ `data/raw/ema/` |
| `node scripts/eu-legislation-collect.js` | 从 legislation.gov.uk 采集 EU 核心法规 → `data/raw/eu-legislation/` |
| `node scripts/ingest-eu.js` | 欧盟文档清洗入库（英文结构识别） |
| `node scripts/cde-collect.js` | CDE 指导原则采集 |
| `node scripts/ingest-raw.js` | 任意原始文本批量入库 |

## 测试

```bash
npm test    # node --test test/*.test.js（安全回归：ID 校验 / SSRF / 原子写入）
```

## ❓ 常见问题

- **没有 DeepSeek Key 能用吗？** 能。问答显示检索到的相关条文（无生成式回答）；清洗自动用启发式解析。
- **问"中国法规"却出现欧盟条款？** 已修复——按地区分流检索，单地区问题不再跨地区串扰。
- **对比类问题某一侧缺失？** 已修复——对比问题分路检索 + 交错合并，中欧双侧均衡。
- **英文缩写（PSUR/SUSAR/QPPV）查不到？** 中英术语表已覆盖，或触发 LLM 查询改写兜底。
- **上传 PDF 解析不了？** 仅支持文本型 PDF（扫描件需先 OCR）；.doc 请另存为 .docx。

## 📄 许可与免责

本项目为**药物警戒法规检索与学习辅助工具**。回答由大模型生成，仅供参考，**不构成法律意见**；具体监管要求请以官方原文及主管机关解释为准。

法规数据来源：中国政府网/国家药监局/CDE 官网、EMA 官网、legislation.gov.uk 等官方公开渠道。
