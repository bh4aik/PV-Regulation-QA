# 📘 药物警戒法规 AI 问答库 · 系统维护操作手册

> 版本：0.4.0（合并版：本地 v0.3.5 功能 + 远程安全加固）｜ 适用：本机开发 + 公网部署（阿里云轻量服务器 / Cloudflare）
> 最后更新：2026-08-27

---

## 一、系统概览

| 项目 | 说明 |
|---|---|
| 系统名称 | 药物警戒法规 AI 问答库 |
| 公网地址 | https://pv.izturn.me |
| 服务器 | 阿里云轻量应用服务器（香港），IP：8.210.74.191，Ubuntu 24.04 |
| 部署方式 | Docker Compose（`node:20-slim` 镜像） |
| 技术栈 | Node.js + Express + 原生 JS 前端（无构建） |
| 本机项目位置 | `…/Deepseek Harness/Projects/pv-qa`（iCloud 同步目录内） |
| 数据目录 | 服务器 `/opt/pvqa/data`；本机 `data/` |
| 备份目录 | 服务器 `/opt/pvqa-data-backup/` |
| 域名/DNS | Cloudflare 托管（izturn.me），`pv` 子域名 A 记录 → 8.210.74.191 |
| HTTPS | 服务器 Caddy 自动签发 Let's Encrypt 证书 |

### 数据组成（`data/` 目录）

| 子目录/文件 | 内容 | 部署时处理 |
|---|---|---|
| `data/regulations/*.json` | 法规库（结构化条款，核心知识库） | ✅ 随部署同步 |
| `data/raw/*.md`、`data/raw/cde/*.md` | 法规原始文本 | ✅ 随部署同步 |
| `data/state/users.json` | 注册用户（含密码哈希） | 🚫 保留服务器本地 |
| `data/state/settings.json` | 配置（API Key、模型、限额、注册防护） | 🚫 保留服务器本地 |
| `data/state/history.json` | 问答历史 | 🚫 保留服务器本地 |
| `data/state/analytics.json`、`ratings.json` | 行为分析、👍/👎 评分 | 🚫 保留服务器本地 |
| `data/state/feedback.json` | 用户反馈 | 🚫 保留服务器本地 |
| `data/state/changelog.json` | 系统日志（版本升级/功能/修正记录） | 🚫 保留服务器本地（首次启动自动生成种子） |
| `data/state/qa-cache.json` | 问答缓存 | 部署时清空 |
| `data/state/sessions.json` | 登录会话 | 清理 |
| `data/state/seen-urls.json`、`crawl-state.json`、`sources.json` | 爬虫状态 | 🚫 保留 |
| `data/pending/` | 清洗任务、爬虫候选 | 🚫 保留 |

> ⚠️ **重要**：`data/state` 和 `data/pending` 是**运行数据**，升级部署时**不会被覆盖**（详见第三节）。

---

## 二、日常运维

### 2.1 服务状态

```bash
# 服务器上查看容器状态
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose ps"

# 查看日志（最近 50 行）
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose logs --tail=50"

# 实时跟踪日志
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose logs -f"
```

### 2.2 健康检查

```bash
# 本机
curl http://localhost:3000/api/health
# 公网（服务器）
curl https://pv.izturn.me/api/health
```

正常返回：`{"ok":true,...,"index":{"chunks":1819}}`（chunks 数量 = 法规分块数，随法规库增减变化）。

### 2.3 重启 / 停止 / 启动

```bash
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose restart"   # 重启
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose stop"      # 停止
ssh root@8.210.74.191 "cd /opt/pvqa && docker compose start"     # 启动
```

### 2.4 本机开发

```bash
cd "/Users/jinxu/Library/Mobile Documents/com~apple~CloudDocs/Deepseek Harness/Projects/pv-qa"
npm start          # 启动（端口 3000）
npm run dev        # 开发模式（代码改动自动重启）
```

> 本机项目目录在 **iCloud 同步目录**内，`data/state/settings.json`（含 API Key）会被同步到 iCloud——注意账号安全，或考虑迁移项目目录。

---

## 三、升级部署（一键更新）

### 3.1 标准升级流程

```bash
cd "/Users/jinxu/Library/Mobile Documents/com~apple~CloudDocs/Deepseek Harness/Projects/pv-qa"
PVQA_SERVER_IP=8.210.74.191 \
PVQA_PUBLIC_URL=https://pv.izturn.me \
bash scripts/deploy/upload.sh
```

脚本自动完成（会要 SSH 密码）：
1. **打包**：代码 + 法规库（`regulations`/`raw`），**排除** `data/state`、`data/pending`
2. **上传**到服务器 `/opt/pvqa/`
3. **备份**服务器当前 `data/state`、`data/pending` 到 `/opt/pvqa-data-backup/`
4. **授权数据目录**：`mkdir -p data/state data/pending && chown -R 1000:1000 data`（非 root 容器运行必需）
5. **构建**镜像 + 重启容器 + **清空问答缓存**
6. **健康检查**（经 SSH 内网 `curl 127.0.0.1:3000/api/health`，打印 `{"ok":true,...}` 即成功）

> 服务器 IP/用户/目录不再写死在脚本里（公网仓库防泄露），通过环境变量传入：`PVQA_SERVER_IP`（必填）、`PVQA_SERVER_USER`（默认 root）、`PVQA_APP_DIR`（默认 /opt/pvqa）、`PVQA_PUBLIC_URL`。

### 3.2 ⚠️ 关键数据保护说明（重要）

- 升级**不会覆盖**服务器上的注册用户、历史、设置、反馈（`data/state`）
- 法规库更新（新增/编辑法规）**会同步**到服务器
- 本地 `data/state` 的配置（API Key、模型、限额等）**不会**自动同步到服务器——服务器配置需在服务器上管理（管理员登录 → 设置页）

### 3.3 版本号维护

版本号定义在 `web/js/app.js` 的 `App.VERSION = '0.4.0'` 与 `package.json` 的 `version`，升级时同步修改。

### 3.4 变更发布清单

| 类型 | 处理 |
|---|---|
| 前端改动（JS/CSS/HTML） | 重新部署生效 |
| 后端改动（检索/接口） | 重新部署 + 脚本自动清缓存 |
| 法规库改动 | 重新部署同步，或服务器上直接操作 |
| 术语映射（中英双语词表） | 改 `data/glossary.json` + 重新部署 + 清缓存 |
| 语境加权词表/系数 | 改 `server/rag/qa.js`（PRE_MARKET_TERMS/POST_MARKET_TERMS/regPhase 正则/系数）+ 重新部署 + 清缓存 |
| 版本升级说明 | 改 `web/js/app.js` 版本号 + `server/changelog.js` 种子记录 + 重新部署 |

### 3.5 系统日志（版本升级记录）

- 管理后台 **📜 系统日志** 面板集中展示版本升级、功能新增、问题修正记录，管理员可在线新增/删除。
- 数据文件：`data/state/changelog.json`；首次启动自动写入种子记录（`server/changelog.js` 的 `SEED_CHANGELOG`），**升级版本后应在此补充新版本的升级说明**（或通过后台「新增日志」在线添加）。
- API：`GET/POST /api/admin/changelog`、`DELETE /api/admin/changelog/:id`（均需 admin）。

---

## 四、备份与恢复

### 4.1 每日自动备份（已配置）

服务器 crontab 每天 **凌晨 3:00** 执行 `/usr/local/bin/pvqa-backup.sh`：
- 备份 `data/state` + `data/pending` → `/opt/pvqa-data-backup/state-日期-时间.tar.gz`
- **自动保留 7 天**，更早的自动删除

查看备份列表：
```bash
ssh root@8.210.74.191 "ls -lh /opt/pvqa-data-backup/"
```

手动触发一次备份：
```bash
ssh root@8.210.74.191 "/usr/local/bin/pvqa-backup.sh"
```

### 4.2 手动备份（本机）

```bash
cd "/Users/jinxu/Library/Mobile Documents/com~apple~CloudDocs/Deepseek Harness/Projects/pv-qa"
# 完整备份（含 API Key、用户数据）——仅本地留存
tar --exclude='node_modules' --exclude='.git' --exclude='backups' --exclude='.env' --exclude='*.log' \
    -czf backups/pv-qa-full-$(date +%Y%m%d-%H%M%S).tar.gz .
# 脱敏备份（不含 API Key / 用户账号）——可外发分享
cp data/state/settings.json /tmp/settings.orig.json && \
python3 -c "import json; s=json.load(open('data/state/settings.json')); s['deepseekApiKey']=''; json.dump(s, open('data/state/settings.json','w'))" && \
tar --exclude='node_modules' --exclude='.git' --exclude='backups' --exclude='.env' --exclude='*.log' \
    --exclude='./data/state/users.json' --exclude='./data/state/sessions.json' \
    -czf backups/pv-qa-nokey-$(date +%Y%m%d-%H%M%S).tar.gz . && \
cp /tmp/settings.orig.json data/state/settings.json
```

### 4.3 恢复备份

**服务器每日备份恢复**（如恢复到 2026-08-16 的备份）：
```bash
ssh root@8.210.74.191 "tar -xzf /opt/pvqa-data-backup/state-2026-08-16-0300.tar.gz -C /opt/pvqa && docker compose -f /opt/pvqa/docker-compose.yml restart"
```

**本机完整备份恢复**：
```bash
tar -xzf backups/pv-qa-full-XXXXXXXX.tar.gz -C 目标目录
cd 目标目录 && npm install && npm start
```

### 4.4 阿里云快照（强烈建议）

- 登录[阿里云轻量服务器控制台](https://swas.console.aliyun.com/) → 服务器 → **快照**
- 建议**每周创建一次快照**（免费额度内），作为服务器级保险
- 快照可回滚整个系统到快照时刻（包括被误删/误覆盖的数据）

---

## 五、账号与权限管理

### 5.1 角色

| 角色 | 权限 |
|---|---|
| 管理员（izturn） | 全部：法规库增删改、清洗任务、爬虫、设置（API Key/模型/限额/注册防护）、用户管理、反馈处理、分析洞察、系统日志 |
| 普通用户 | 法规查询、AI 问答、查看自己的历史与反馈 |

### 5.2 用户管理（管理控制台）

- 入口：侧栏 → **管理控制台 → 👥 用户管理**
- 可操作：禁用/启用、设为/取消管理员、删除、重置密码
- 保护：不能删除自己或最后一个管理员

### 5.3 注册与登录

- 注册：邮箱（必填）+ 密码 + 用户名/手机号（选填）
- 登录：邮箱为主，兼容用户名/手机号
- 防机器人：同 IP 速率限制（注册 5 次/分钟、登录 10 次/分钟）、注册开关、邀请码、Cloudflare Turnstile

### 5.4 密码重置

管理员在「用户管理」点「修改密码」；忘记管理员密码时：
1. 停止容器：`ssh root@8.210.74.191 "cd /opt/pvqa && docker compose stop"`
2. 编辑 `data/state/users.json` 中该用户，删除 passwordHash/passwordSalt 并重启（需按 scrypt 重新生成，建议直接移除该用户后用 env 预置管理员重新注册）

---

## 六、法规库维护

### 6.1 上传新法规（管理员）

法规库 → **上传新法规** → 选择文件（txt/md/docx/pdf，≤30MB）→ AI 清洗 → 核对 → 确认入库。

> 服务器为 Linux，**不支持旧版 .doc**（textutil 仅 macOS），请转存为 .docx/.txt/.pdf。

### 6.2 编辑法规（管理员）

法规库 → 法规卡片/详情页 → **编辑**：可修改标题、简称、文号、发布机关、日期、状态、类别、**国家/地区/组织**、**原文链接**、**标签**（预定义 15 个 + 自定义）。保存后自动重建索引并清缓存。

> 🌐 **全球法规库**：每部法规带 `country` 字段（国家/地区/组织）。当前在库 **76 部**：中国 35 部 + 欧盟（EMA/EU）41 部。新增法规时该字段默认为空，管理员入库后编辑填写；检索/问答暂未按国家过滤（后续版本可按需加入）。

### 6.3 EMA/欧盟法规采集（药物警戒）

EMA 官网可直连下载（GVP 页面），EUR-Lex 有反爬（HTTP 202），**核心 EU 法规改用 legislation.gov.uk 的 EU 法规 XML 数据端点**（`/eur/<year>/<num>/data.xml` 或 `/eudr/<year>/<num>/data.xml`；注意：部分在英脱欧后被标记 Repealed 的法规正文被虚线占位，不可用——如 726/2004 主文本，但 520/2012、1235/2010、1027/2012、2001/83/EC 均可用）。

```bash
# 1) 采集 EMA GVP 指南 PDF（37 个）→ data/raw/ema/*.md
node scripts/ema-collect.js
# 2) 采集 EU 核心法规 → data/raw/eu-legislation/*.md
node scripts/eu-legislation-collect.js
# 3) 清洗入库（英文文档走 englishClean；EMA 标题映射在 scripts/ema-titles.js）
node scripts/ingest-eu.js
# 4) 重启服务重建索引
```

> 注意：新增英文法规后，需在 `server/rag/qa.js` 的 TERM_SYNONYMS 补充中英术语映射（如 PSMF→Pharmacovigilance system master file），否则英文提问可能只命中中文法规。英文清洗器在 `server/ingest/clean.js` 的 `englishClean`（识别 Article N / I.A. 编号结构）。

### 6.4 删除法规（管理员）

法规库 → 法规卡片 → **删除**（会重建索引）。

### 6.5 CDE 指导原则采集

```bash
# 本机执行：从国家药品审评中心（CDE）官网抓取指导原则 PDF → 提取文本 → data/raw/cde/
node scripts/cde-collect.js
# 采集后入库
node scripts/ingest-raw.js
```

### 6.6 原始文本批量入库

```bash
# 把法规全文放入 data/raw/（可含子目录 cde/）后：
node scripts/ingest-raw.js
```

### 6.7 每日爬虫

- 默认每天 09:00 自动检查（可在设置页改 cron）
- 默认数据源：安徽省药监局 TRS 公开接口（省级站点转载国家药监局文件）
- 候选在「清洗任务 → 🕷️ 爬虫发现」确认后入库
- 国家药监局官网（nmpa.gov.cn）有 JS 反爬，需手动上传或用镜像源

---

## 七、检索与问答维护

### 7.1 架构

```
用户问题 → 显式条款定位（《法规》第X条）──命中→ 精确定位该条款 → 生成回答（跳过 BM25/rerank）
        └──未命中→ 中英术语扩展 → 语境识别（上市前/上市后）→ BM25 检索 30 条
                 → 条款聚合 → 语境加权重排 → LLM 重排精选 15 条 → LLM 生成回答
```

### 7.2 显式条款定位（《法规》第X条）

文件：`server/rag/qa.js` 的 `detectExplicitCitations` / `locateExplicitArticles` / `resolveExplicitCitation`。

- 当用户问题中直接引用《法规名》第X条（中文数字或阿拉伯数字均可）时，直接从法规库**精确定位该条款**，跳过全库 BM25 检索与 LLM 重排，回答只引用该条款。
- **解决场景**：用户给出指定条款要求翻译/核对（如"根据《药物警戒质量管理规范》第十七条，原文翻译如下：…"），若按常规检索，英文翻译全文会被当检索词导致召回大量无关条款（经营办法、检查办法等）。
- 命中时缓存键使用独立 topK 维度（`exactMode ? -1 : CANDIDATE_COUNT`），与常规检索缓存互不污染；生成提示词追加"仅围绕指定条款回答"准则。
- 若引用的法规/条款不在库中，自动回退常规检索。

### 7.3 语境感知加权（上市前/上市后）

文件：`server/rag/qa.js` 的 `detectPhase` / `regPhase` / `applyPhaseWeighting`。

- **问题语境判定**（`detectPhase`）：统计问题中的上市前词（研发/临床/试验/开发/注册/申办者/受试者/CDE 等）与上市后词（上市后/持有人/不良反应/召回/经营/药物警戒等），多者胜出；无法判定为 `neutral` 不加权。
- **法规阶段属性**（`regPhase`）：按标题启发式——含「指导原则」→ 上市前；含「药物警戒/不良反应/召回/经营/流通/上市后/检查/监测」→ 上市后；含「临床/研发/注册/试验/疫苗/器械/化妆品/生产」→ 上市前。
- **权重**（`applyPhaseWeighting`）：上市前问题把上市前法规 ×1.25、上市后法规 ×0.55；上市后问题反向 ×1.2 / ×0.8，加权后重新排序。
- **同步引导**：`rerank.js` 提示词与 `qa.js` 的 SYSTEM_PROMPT（第 6 条）均加入语境匹配准则，防止生成阶段把 GVP 等上市后法规硬套到研发/临床试验问题上。

**维护**：用户反馈"研发/临床试验问题却引用 GVP 等上市后法规"时，优先检查：
1. 语境词是否覆盖（如新出现的上市前术语未列入 `PRE_MARKET_TERMS`）；
2. 法规标题启发式是否误判（如含「不良反应」的 CDE 指导原则——因含「指导原则」已判上市前，注意正则顺序）；
3. 修改后清缓存重问。

### 7.4 术语映射（双语词表 glossary.json）

文件：`data/glossary.json`（62 个概念等价组）。取代旧代码内 `TERM_SYNONYMS`。

**结构**：每个 `concept` 的 `terms` 互为同义/近义/中英对应，检索时命中任一词即展开全部词。
```json
{ "id": "psmf", "terms": ["药物警戒体系主文件", "体系主文件", "SMF", "PSMF", "Pharmacovigilance System Master File", "pharmacovigilance system master file"] }
```

**维护**（3 种情况）：
1. 中文提问查不到英文文档 → 在该概念 terms 里补英文规范词（注意用法规原文用词，如欧盟 GVP 用 "submission time frames" 而非 "reporting timeframe"）
2. 英文提问查不到中文法规 → 补中文全称
3. 同一概念中文有多个说法（如"安全性沟通" vs "风险沟通"）→ 归入同一概念组

> glossary 未覆盖的措辞会自动触发 LLM 查询改写兜底（`queryRewrite`），但仍建议补充词表以省去额外 LLM 调用。

### 7.5 问答缓存

- 位置：`data/state/qa-cache.json`（上限 500 条，FIFO）
- **法规变更、检索逻辑变更时自动清空**；升级部署时也自动清空
- 手动清空：`echo '[]' > data/state/qa-cache.json`（然后重启）

### 7.6 回答质量参数

| 参数 | 位置 | 当前值 |
|---|---|---|
| 生成 max_tokens | `server/rag/qa.js` | 6000（防长回答截断） |
| rerank 精选数 | `server/routes/qa.js` | 15（FINAL_COUNT） |
| 初检索候选数 | `server/routes/qa.js` | 30（CANDIDATE_COUNT） |
| temperature / seed | `server/rag/qa.js` | 0 / 20260815（确定性回答） |
| 语境加权系数 | `server/rag/qa.js` | 上市前 ×1.25 / ×0.55；上市后 ×1.2 / ×0.8 |
| 地区加权系数 | `server/rag/qa.js` | 地区问题 ×2.5 / ×0.5；对比问题 ×1.8（不压制） |
| 候选池规模 | `server/rag/qa.js` | topK × 8（主检索 + 英文补充各） |

### 7.7 序号修正

LLM 偶尔输出重复序号（如多个 "1."），`fixListNumbering`（`server/util.js`）在生成后自动重排为 1,2,3…。

---

## 八、安全维护

### 8.1 API Key 安全

- API Key 存服务器 `data/state/settings.json` 和 `.env`，**不通过 HTTP 接口返回**（已代码审计确认）
- 主要风险面：服务器被入侵、iCloud 同步（本机项目目录在 iCloud）
- **建议定期轮换**：DeepSeek 平台 → API Keys → 重新生成，旧 key 作废

### 8.2 防机器人注册（已实现）

| 防护 | 说明 |
|---|---|
| 速率限制 | 注册 5 次/分、登录 10 次/分（同 IP） |
| 注册开关 | 设置页可一键关闭注册 |
| 邀请码 | 设置后注册需输入邀请码 |
| Cloudflare Turnstile | 无感人机验证（Site Key / Secret Key 在设置页配置） |

### 8.3 SSH 加固建议

```bash
# 服务器上：
# 1. 改 SSH 端口 + 禁用密码登录 + 使用密钥
# 2. 安装 fail2ban
apt-get install -y fail2ban && systemctl enable --now fail2ban
```

### 8.4 模型与密钥变更

- 模型列表（设置页）：`deepseek-v4-flash`（推荐）/ `deepseek-v4-pro`；旧别名 `deepseek-chat`/`deepseek-reasoner` 已停用
- `.env` 支持 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`AUTO_FIRST_ADMIN`、`TRUST_PROXY_HOPS`

### 8.5 接口与容器安全加固（v0.4.0 合并）

| 项 | 说明 |
|---|---|
| 上传鉴权 | `/api/ingest/upload` 增加管理员认证（此前缺失） |
| 法规 ID 校验 | 目录穿越防护：ID 仅允许 `A-Za-z0-9中文_-` 且 ≤120 字符（`server/security.js`） |
| 爬虫 SSRF 防护 | 只允许公网 HTTP(S) 地址，重定向逐跳校验（最多 5 跳），响应体 ≤5MB，外部 API 超时 |
| 问答保护 | 60 秒 20 次限流 + 单问题 ≤2000 字 + 每用户并发上限 + 重写/重排/流式超时 |
| JSON 原子写入 | 设置/用户/历史/缓存等一律临时文件 + rename + 0600 权限（`server/json-store.js`） |
| 密码策略 | 注册/改密要求 12-128 位（前后端同步校验） |
| 敏感配置不回显 | Turnstile Secret 等不再回填到页面输入框 |
| 容器最小权限 | Node 22 非 root（UID 1000）+ 只读根文件系统 + 丢弃全部 capabilities + `no-new-privileges` + 端口仅回环 `127.0.0.1:3000` + `/tmp` tmpfs |

> 升级部署后建议跑一次安全回归：`npm test`（覆盖 ID 校验 / SSRF / 原子写入）。

---

## 九、常见问题排查

| 现象 | 排查/解决 |
|---|---|
| 本机登录不上 | 本地服务未启动：`npm start` |
| 公网打不开 | ① 容器状态：`docker compose ps` ② 阿里云防火墙放行 80/443/3000 ③ 本机代理软件（Clash/Surge）会劫持域名，用手机流量验证 |
| 回答没引用某法规 | ① 术语映射缺英文（补充 data/glossary.json）② 清缓存重问 |
| 研发/临床试验问题误引 GVP 等上市后法规 | ① 语境词表缺新词（PRE_MARKET_TERMS）② regPhase 标题启发式误判 ③ 清缓存重问（详见 7.2） |
| 回答被截断 | max_tokens（当前 8000，如仍截断可上调） |
| 序号错乱（多个 1.） | 已自动修正（fixListNumbering），仍出现则手动重问 |
| 问答报错/无输出 | ① API Key 是否有效（设置页测试）② 模型是否停用（改用 v4）③ 缓存清空重试 |
| 用户数据"丢失" | 检查 `/opt/pvqa-data-backup/` 最新备份；恢复后重启容器 |
| 爬虫抓不到新法规 | 数据源反爬/失效，换镜像源或手动添加候选 |
| 上传 .doc 失败 | Linux 无 textutil，转存 .docx/.txt/.pdf |

---

## 十、关键文件清单（本机项目）

| 文件 | 用途 |
|---|---|
| `server/index.js` | 服务入口（启动时预热系统日志种子） |
| `server/rag/qa.js` | 检索+生成（术语映射 TERM_SYNONYMS、语境加权 detectPhase/regPhase 在此） |
| `server/rag/rerank.js` | LLM 重排（提示词含语境匹配准则） |
| `server/rag/indexer.js` | 索引构建（分块聚合） |
| `server/rag/bm25.js`、`tokenizer.js` | BM25 索引、jieba 分词 |
| `server/routes/qa.js` | 问答路由（缓存/埋点/序号修正） |
| `server/changelog.js` | 系统日志存储（SEED_CHANGELOG 种子记录） |
| `server/auth.js` | 用户/会话/用量 |
| `server/analytics.js` | 行为分析聚合 |
| `server/crawler/` | 爬虫与调度 |
| `scripts/deploy/upload.sh` | 一键升级部署 |
| `scripts/deploy/backup.sh` | 每日备份脚本（服务器端） |
| `scripts/cde-collect.js` | CDE 指导原则采集 |
| `scripts/ingest-raw.js` | 原始文本入库 |
| `Dockerfile`、`docker-compose.yml` | 容器化部署 |
| `DEPLOY.md` | 首次部署指南 |
