// 主服务器入口
import express from 'express';
import path from 'node:path';
import { PORT, WEB_DIR, getSettings } from './config.js';
import { rebuildIndex, getIndex } from './rag/indexer.js';
import { resyncScheduler } from './crawler/scheduler.js';

import qaRouter from './routes/qa.js';
import libraryRouter from './routes/library.js';
import ingestRouter from './routes/ingest.js';
import crawlerRouter from './routes/crawler.js';
import settingsRouter from './routes/settings.js';
import historyRouter from './routes/history.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import feedbackRouter from './routes/feedback.js';
import analyticsRouter from './routes/analytics.js';
import { getDeepSeekConfig } from './config.js';
import { loadChangelog } from './changelog.js';

const app = express();
// 安全加固：trust proxy（代理环境下正确识别客户端 IP，供限流用；TRUST_PROXY_HOPS 默认 0 表示不信任代理头）
const trustProxyHops = Math.max(0, Math.min(Number(process.env.TRUST_PROXY_HOPS) || 0, 5));
app.set('trust proxy', trustProxyHops);
app.disable('x-powered-by');
// JSON body 限制 1MB（上传文件走 multer，不受此限；防超大 JSON 请求 DoS）
app.use(express.json({ limit: '1mb' }));
// 安全响应头 + CSP（Cloudflare Turnstile 需放行 challenges.cloudflare.com）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "script-src 'self' https://challenges.cloudflare.com; " +
      "frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' data:"
  );
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  const idx = getIndex();
  res.json({
    ok: true,
    time: new Date().toISOString(),
    index: idx ? { chunks: idx.size() } : null,
  });
});

app.use('/api', qaRouter);
app.use('/api', libraryRouter);
app.use('/api', ingestRouter);
app.use('/api', crawlerRouter);
app.use('/api', settingsRouter);
app.use('/api', historyRouter);
app.use('/api', authRouter);
app.use('/api', feedbackRouter);
app.use('/api', analyticsRouter);
app.use('/api', adminRouter);

// 启动时：若 .env 配置了 ADMIN_USERNAME/ADMIN_PASSWORD 且无任何用户，则预置管理员
{
  const { findUserByUsername, createUser, countUsers } = await import('./auth.js');
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminUser && adminPass && countUsers() === 0) {
    createUser({ username: adminUser, password: adminPass, role: 'admin' });
    console.log(`  已通过环境变量创建管理员账号: ${adminUser}`);
  }
}

// 静态前端
app.use(express.static(WEB_DIR));

app.listen(PORT, () => {
  console.log(`\n=== 药物警戒法规 AI 问答库 ===`);
  console.log(`  服务已启动: http://localhost:${PORT}`);
  const { key, model } = getDeepSeekConfig();
  console.log(`  DeepSeek: ${key ? `已配置（${model}）` : '未配置（可在设置页填写，或写入 .env 的 DEEPSEEK_API_KEY）'}`);
  try {
    const stats = rebuildIndex();
    console.log(`  索引构建完成: ${stats.regulations} 部法规 / ${stats.chapters} 章 / ${stats.articles} 条 / ${stats.chunks} 分块`);
  } catch (e) {
    console.error(`  索引构建失败: ${e.message}`);
  }
  resyncScheduler(getSettings);
  loadChangelog(); // 预热系统日志（首次自动写入种子记录）
  console.log(`  爬虫定时任务: ${getSettings().crawlEnabled === false ? '已停用' : `已启用（${getSettings().crawlSchedule || '0 9 * * *'}）`}\n`);
});
