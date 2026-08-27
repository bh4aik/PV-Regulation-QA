#!/usr/bin/env bash
# ============================================================
# 一键更新：本机改完代码后，一条命令完成部署
#   打包 → 上传 → 构建 → 清缓存 → 健康检查
# 用法：bash scripts/deploy/upload.sh
# ============================================================
set -e

SERVER_IP="${PVQA_SERVER_IP:?请通过 PVQA_SERVER_IP 指定服务器地址}"
SERVER_USER="${PVQA_SERVER_USER:-root}"
APP_DIR="${PVQA_APP_DIR:-/opt/pvqa}"
PUBLIC_URL="${PVQA_PUBLIC_URL:-https://pv.example.com}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.."          # 定位到项目根目录

echo "════════════════════════════════════════"
echo "  药物警戒法规问答库 · 一键更新部署"
echo "════════════════════════════════════════"

# 1) 打包（排除 node_modules/.git/backups/.env；排除运行数据，避免覆盖服务器上的用户/历史/设置；
#    --no-xattrs 去掉 macOS 扩展属性，避免服务器 tar 报 SCHILY.fflags/xattr 警告）
echo "▶ [1/4] 打包项目（代码 + 法规库；不含 data/state 运行数据）..."
tar --no-xattrs --exclude='node_modules' --exclude='.git' --exclude='backups' --exclude='*.tar.gz' --exclude='.env' \
    --exclude='./data/state' --exclude='./data/pending' \
    -czf /tmp/pvqa-deploy.tar.gz .
echo "  打包完成：$(du -h /tmp/pvqa-deploy.tar.gz | cut -f1)"

# 2) 上传
echo "▶ [2/4] 上传到 $SERVER_USER@$SERVER_IP:$APP_DIR ..."
scp /tmp/pvqa-deploy.tar.gz "$SERVER_USER@$SERVER_IP:$APP_DIR/"

# 3) 解压 + 备份运行数据 + 构建 + 清缓存 + 重启
echo "▶ [3/4] 解压 → 备份数据 → 构建 → 清缓存 → 重启 ..."
ssh "$SERVER_USER@$SERVER_IP" "cd $APP_DIR && \
    mkdir -p /opt/pvqa-data-backup && \
    tar -czf /opt/pvqa-data-backup/state-$(date +%F-%H%M).tar.gz data/state data/pending 2>/dev/null; \
    tar -xzf pvqa-deploy.tar.gz && \
    mkdir -p data/state data/pending && chown -R 1000:1000 data && \
    docker compose up -d --build && \
    sleep 3 && \
    echo '[]' > data/state/qa-cache.json && \
    echo '  缓存已清空（用户/历史/设置数据已保留）'"

# 4) 健康检查
echo "▶ [4/4] 健康检查 ..."
sleep 2
HEALTH=$(ssh "$SERVER_USER@$SERVER_IP" "curl -s --max-time 10 http://127.0.0.1:3000/api/health" 2>/dev/null || echo '{"ok":false}')
echo "  服务状态: $HEALTH"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ 部署完成！"
echo "  公网地址: $PUBLIC_URL"
echo ""
echo "  如需查看日志："
echo "    ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && docker compose logs --tail=50'"
echo "════════════════════════════════════════"
