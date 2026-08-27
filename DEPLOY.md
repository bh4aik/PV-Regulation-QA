# 🚀 公网部署指南（Cloudflare + VPS + Docker）

目标：把本系统部署到 `pv.izturn.me`（或任意子域名），公网可访问。

## 一、准备

1. **一台云服务器（VPS）**：阿里云 / 腾讯云 / 搬瓦工 / Vultr 等均可，最低 1C1G 即可跑动（建议 2G 内存）。操作系统选 **Ubuntu 22.04 / Debian 12**。
2. **域名在 Cloudflare 托管**：你的 `izturn.me` 已托管在 Cloudflare ✓（nameserver 指向 Cloudflare）。
3. 服务器安全组/防火墙**放行 80/443 端口**（如用 Cloudflare 代理模式，仅放行 80/443；22 保留给 SSH）。

## 二、服务器初始化（一键脚本）

```bash
# 上传初始化脚本并执行（自动安装 Docker + Caddy + 创建目录）
scp scripts/deploy/setup-server.sh root@服务器IP:~/
ssh root@服务器IP "bash ~/setup-server.sh"
```

> 脚本内容等价于手动执行：
> ```bash
> curl -fsSL https://get.docker.com | sh && systemctl enable --now docker
> ```

## 三、上传项目并配置

**方式一（推荐）：一键脚本**

```bash
# 服务器信息通过环境变量传入（不写死在仓库里）
PVQA_SERVER_IP=8.210.74.191 \
PVQA_PUBLIC_URL=https://pv.izturn.me \
bash scripts/deploy/upload.sh
# 可选：PVQA_SERVER_USER（默认 root）、PVQA_APP_DIR（默认 /opt/pvqa）
```

脚本会自动：打包（排除运行数据）→ 上传 → 备份服务器运行数据 → 解压 → **`chown -R 1000:1000 data`（非 root 容器数据权限）** → `docker compose up -d --build` → 清问答缓存 → SSH 内网健康检查。

**方式二：手动**

```bash
# 在本地打包（排除 node_modules，Docker 内会安装）
tar --exclude='node_modules' --exclude='.git' --exclude='backups' -czf pvqa-deploy.tar.gz .

# 上传到服务器
scp pvqa-deploy.tar.gz root@服务器IP:/opt/pvqa/
ssh root@服务器IP
cd /opt/pvqa && tar -xzf pvqa-deploy.tar.gz
```

**配置 `.env`（关键！）**：

```bash
cp .env.example .env
nano .env
```

```ini
# ⚠️ 公网部署必须配置以下两项，否则没有管理员
ADMIN_USERNAME=izturn          # 你的管理员用户名
ADMIN_PASSWORD=一个强密码      # 一定要用强密码（12-128 位）！
AUTO_FIRST_ADMIN=false         # 关闭"首用户自动成为管理员"（防抢注接管）

DEEPSEEK_API_KEY=sk-你的key     # 若未配置，问答将退化为检索模式
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=3000
TRUST_PROXY_HOPS=1             # 宿主机 Caddy 反代 + Docker 场景用 1
```

> 首次启动时系统无用户，将自动用 `ADMIN_USERNAME/ADMIN_PASSWORD` 创建管理员。之后普通用户可自行注册（受每日问答限额保护）。

## 四、启动

```bash
# 容器以 UID 1000 非 root 用户运行，首次部署前需授权 data 目录：
sudo chown -R 1000:1000 data
docker compose up -d --build
docker compose logs -f        # 查看启动日志，确认管理员已创建
curl http://127.0.0.1:3000/api/health   # 本机自检
```

> 容器端口只绑定回环地址 `127.0.0.1:3000`（`docker-compose.yml` 中 `"127.0.0.1:3000:3000"`），公网无法直连 3000 端口；HTTPS 由宿主机 Caddy 反代（见下）。容器根文件系统只读、丢弃全部 capabilities，运行数据仅写入 `./data` 卷与 `/tmp`（tmpfs）。

## 五、Cloudflare DNS 与 HTTPS

1. 打开 Cloudflare 控制台 → `izturn.me` → **DNS → 添加记录**：
   - 类型 `A`，名称 `pv`，IPv4 地址填**服务器公网 IP**，代理状态选 **已代理（橙色云朵）**。
2. 几秒后访问 **https://pv.izturn.me** 即可（Cloudflare 自动签发 HTTPS 证书，无需在服务器配置证书）。
3.（可选）限制访问：Cloudflare → Security → WAF 可加地区/速率规则。

## 六、日常运维

```bash
docker compose logs -f        # 日志
docker compose restart        # 重启
docker compose pull && docker compose up -d   # 更新（需重新 build）
# 数据持久化在 ./data 目录（法规库/用户/历史/缓存），备份它即备份全部：
tar -czf backup-$(date +%F).tar.gz data
```

## 七、⚠️ 公网安全清单（务必确认）

| 项目 | 状态 |
|---|---|
| `AUTO_FIRST_ADMIN=false` + 已配置 `ADMIN_USERNAME/PASSWORD` | ✅ 部署前确认 |
| 管理员密码为强密码（12-128 位混合） | ✅ 前后端双重校验 |
| 普通用户每日 AI 问答限额（设置页可调，默认 20 次/天）+ 60 秒 20 次限流 + 并发保护 | ✅ 防 API 费用滥用 |
| 上传/清洗/删除/设置等管理接口全部需管理员 token | ✅ 含 `/api/ingest/upload` |
| 法规 ID 白名单校验（防目录穿越）、爬虫 SSRF 防护（公网地址逐跳校验 + 5MB 响应上限 + 超时） | ✅ |
| 设置/用户/历史等 JSON 原子写入（临时文件 + rename + 0600） | ✅ |
| DeepSeek API Key 仅存服务器端，不随页面下发、不回显 | ✅ |
| 容器非 root（UID 1000）+ 只读根文件系统 + 丢弃全部 capabilities + 端口仅回环 | ✅ |
| 建议：Cloudflare 开启"机器人防护/速率限制" | 可选 |
| 建议：定期备份 `data/` 目录 | ✅ 养成习惯 |

## 八、常见问题

- **502/523**：容器没起来 → `docker compose logs` 查看；或 DNS 未生效/代理状态异常。
- **忘记管理员密码**：`docker compose exec pvqa node -e "..."` 修改，或停止容器后编辑 `data/state/users.json` 中该用户 `passwordHash/passwordSalt` 并重启（需要按 scrypt 重新生成，建议直接删掉该用户行后重启，再用 AUTO_FIRST_ADMIN 重新注册）。
- **上传 .doc 旧格式**：服务器为 Linux，`textutil` 不可用，请将文件另存为 .docx/.txt/.pdf 后上传。
- **想升级法规库**：在管理控制台 → 清洗任务 → 手动添加候选 / 上传文件；或重新运行 `node scripts/ingest-raw.js`（在容器内：`docker compose exec pvqa node scripts/ingest-raw.js`）。
