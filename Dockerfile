# 药物警戒法规 AI 问答库 — 生产镜像
FROM node:22-slim

WORKDIR /app

# 先装依赖（利用层缓存）
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 复制代码与初始数据
COPY --chown=node:node server ./server
COPY --chown=node:node web ./web
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node data ./data
COPY --chown=node:node README.md ./

# 数据目录可写
ENV NODE_ENV=production
EXPOSE 3000

# 数据卷（法规库/用户/历史等持久化）
VOLUME ["/app/data"]

USER node

CMD ["node", "server/index.js"]
