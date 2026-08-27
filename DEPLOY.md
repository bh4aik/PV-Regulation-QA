# 公网部署指南

推荐拓扑：互联网 → Cloudflare（可选）→ Caddy 80/443 → `127.0.0.1:3000` → PVQA 容器。

## 1. 前置条件

- Linux 服务器，建议至少 1 核 CPU、2 GB 内存。
- Docker Engine 与 Docker Compose 插件。
- 域名已解析到服务器；公网防火墙只开放 80/443，SSH 仅允许可信来源。

## 2. 配置

```bash
cp .env.example .env
chmod 600 .env
```

至少修改：

```ini
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD=至少12位的强密码
AUTO_FIRST_ADMIN=false
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_MODEL=deepseek-v4-flash
```

不要提交 `.env`。`data/state/` 同样包含敏感数据。

## 3. 准备数据权限并启动

容器以 UID/GID 1000 的非 root 用户运行：

```bash
mkdir -p data/state data/pending
sudo chown -R 1000:1000 data
docker compose up -d --build
docker compose logs --tail=100
curl http://127.0.0.1:3000/api/health
```

Compose 仅把应用端口绑定到回环地址，不能从公网直接访问 3000。

## 4. Caddy

将 `scripts/deploy/Caddyfile` 中的示例域名替换为实际域名，再安装到 `/etc/caddy/Caddyfile`：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

首次签发证书时确保域名能够直接到达服务器 80/443。启用 Cloudflare 代理时，应正确配置 TLS 模式并保留源站 HTTPS。

## 5. 更新与备份

```bash
PVQA_SERVER_IP=203.0.113.10 \
PVQA_PUBLIC_URL=https://pv.example.com \
bash scripts/deploy/upload.sh
```

运行数据位于 `data/state/` 和 `data/pending/`。备份中可能包含用户信息、问答历史、会话和 API Key，应加密保存并限制读取权限。

## 6. 上线检查

- `AUTO_FIRST_ADMIN=false`，且管理员密码至少 12 位。
- 3000 端口没有公网暴露。
- `.env`、`data/state/` 和备份文件只有服务账号可读。
- 已运行 `npm test`，并检查 `docker compose logs`。
- 已配置 API/WAF 限流和定期备份恢复演练。

