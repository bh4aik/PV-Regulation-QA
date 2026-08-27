# 维护手册

> 版本：0.4.0｜运行环境：Node.js 22 / Docker Compose

## 日常检查

```bash
docker compose ps
docker compose logs --tail=100
curl http://127.0.0.1:3000/api/health
```

## 更新

更新前先备份运行数据：

```bash
sudo scripts/deploy/backup.sh
PVQA_SERVER_IP=203.0.113.10 \
PVQA_PUBLIC_URL=https://pv.example.com \
bash scripts/deploy/upload.sh
```

更新脚本不会从本地覆盖服务器上的 `data/state/` 和 `data/pending/`，但会同步法规库。容器使用 UID/GID 1000 写入 `data/`。

## 数据管理

- `data/regulations/`：结构化法规知识库。
- `data/raw/`：原始法规文本。
- `data/state/`：用户、会话、设置、历史、分析和缓存，包含敏感数据。
- `data/pending/`：待清洗任务与爬虫候选。

JSON 写入采用临时文件和原子重命名，降低进程中断造成的数据损坏，但仍只支持单实例。需要多实例、高并发或审计能力时，应迁移到数据库。

## 安全维护

- 定期轮换管理员密码和 DeepSeek API Key。
- 备份应加密，并定期验证恢复流程。
- 不要把 `.env`、`data/state/`、`data/pending/` 或备份提交到 Git。
- 定期运行 `npm audit`、`npm test` 并更新受支持的 Node.js LTS 镜像。
- 爬虫导入及 AI 清洗结果必须由管理员核对来源、完整性和条款编号后再提交。

## 常见问题

- 无法写入数据：执行 `sudo chown -R 1000:1000 data` 后重启容器。
- 502：检查容器健康状态和 Caddy 是否代理到 `127.0.0.1:3000`。
- 没有 API Key：问答会退化为本地法规检索，清洗会使用启发式解析。
- 扫描 PDF：当前不包含 OCR，应先转换为可复制文本的 PDF 或 TXT。

