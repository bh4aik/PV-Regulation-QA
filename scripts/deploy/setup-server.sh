#!/usr/bin/env bash
# ============================================================
# 药物警戒法规问答库 · 服务器一键初始化脚本
# 适用：Ubuntu 22.04 / 24.04 / Debian 12（轻量应用服务器/ECS）
# 用法：在服务器上执行  bash setup-server.sh
# ============================================================
set -e

echo "========================================"
echo " 药物警戒法规问答库 · 服务器初始化"
echo "========================================"

# 1. 安装 Docker（官方脚本，支持 Ubuntu/Debian）
if command -v docker >/dev/null 2>&1; then
  echo "✅ Docker 已安装：$(docker --version)"
else
  echo "▶ 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "✅ Docker 安装完成：$(docker --version)"
fi

# 2. 创建部署目录
APP_DIR=/opt/pvqa
mkdir -p "$APP_DIR"
echo "✅ 部署目录：$APP_DIR"

# 3. 安装 Caddy（可选，用于 HTTPS 反向代理；如不用可跳过）
if ! command -v caddy >/dev/null 2>&1; then
  echo "▶ 安装 Caddy（HTTPS 自动证书）..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null 2>&1 || true
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null 2>&1 || true
  apt-get update >/dev/null 2>&1 || true
  apt-get install -y caddy >/dev/null 2>&1 || echo "  （Caddy 安装失败可忽略，改用 HTTP 或 Cloudflare 代理）"
  echo "✅ Caddy：$(caddy version 2>/dev/null || echo 未安装)"
fi

echo ""
echo "========================================"
echo " 初始化完成！接下来："
echo " 1) 把项目文件上传到服务器 $APP_DIR："
echo "    在本机项目目录执行："
echo "    tar --exclude='node_modules' --exclude='.git' --exclude='backups' -czf /tmp/pvqa-deploy.tar.gz ."
echo "    scp /tmp/pvqa-deploy.tar.gz root@<服务器IP>:/opt/pvqa/"
echo "    ssh root@<服务器IP> \"cd /opt/pvqa && tar -xzf pvqa-deploy.tar.gz\""
echo ""
echo " 2) 配置 .env（管理员账号 + API Key）："
echo "    ssh root@<服务器IP> \"cd /opt/pvqa && cp .env.example .env && nano .env\""
echo ""
echo " 3) 启动："
echo "    ssh root@<服务器IP> \"cd /opt/pvqa && docker compose up -d --build\""
echo ""
echo " 4) HTTPS（可选）：配置 /etc/caddy/Caddyfile 后 systemctl restart caddy"
echo "========================================"
