#!/usr/bin/env bash
# ============================================================
# 每日自动备份：data/state + data/pending → /opt/pvqa-data-backup/
# 保留 7 天，超出自动清理
# 用法：/usr/local/bin/pvqa-backup.sh（由 crontab 每天调用）
# ============================================================
set -u

BACKUP_DIR=/opt/pvqa-data-backup
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F-%H%M)
tar -czf "$BACKUP_DIR/state-$STAMP.tar.gz" -C /opt/pvqa data/state data/pending 2>/dev/null

# 清理 7 天前的备份
find "$BACKUP_DIR" -name 'state-*.tar.gz' -mtime +$KEEP_DAYS -delete

echo "✅ 备份完成: state-$STAMP.tar.gz ($(du -h "$BACKUP_DIR/state-$STAMP.tar.gz" | cut -f1))"
