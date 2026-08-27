// 设置路由（DeepSeek Key / 模型 / 爬虫计划 / 限额 / 注册防护）
import { Router } from 'express';
import { getSettings, updateSettings, getDeepSeekConfig } from '../config.js';
import { resyncScheduler } from '../crawler/scheduler.js';
import { DEEPSEEK_URL } from '../config.js';
import { adminRequired } from '../middleware.js';

const router = Router();

function publicView() {
  const s = getSettings();
  const { key } = getDeepSeekConfig();
  return {
    hasApiKey: !!key,
    deepseekModel: s.deepseekModel || 'deepseek-v4-flash',
    crawlSchedule: s.crawlSchedule || '0 9 * * *',
    crawlEnabled: s.crawlEnabled !== false,
    dailyQaLimit: Number(s.dailyQaLimit) || 20,
    signupEnabled: s.signupEnabled !== false,
    inviteCode: s.inviteCode || '',
    turnstileEnabled: !!s.turnstileEnabled,
    turnstileSiteKey: s.turnstileSiteKey || process.env.TURNSTILE_SITE_KEY || '',
    hasTurnstileSecretKey: !!(s.turnstileSecretKey || process.env.TURNSTILE_SECRET_KEY),
  };
}

router.get('/settings', adminRequired, (req, res) => {
  res.json(publicView());
});

router.post('/settings', adminRequired, (req, res) => {
  const {
    deepseekApiKey, deepseekModel, crawlSchedule, crawlEnabled,
    dailyQaLimit, signupEnabled, inviteCode, turnstileEnabled, turnstileSiteKey, turnstileSecretKey,
  } = req.body || {};
  const patch = {};
  if (typeof deepseekApiKey === 'string' && deepseekApiKey.trim()) patch.deepseekApiKey = deepseekApiKey.trim();
  if (typeof deepseekModel === 'string' && deepseekModel.trim()) patch.deepseekModel = deepseekModel.trim();
  if (typeof crawlSchedule === 'string' && crawlSchedule.trim()) patch.crawlSchedule = crawlSchedule.trim();
  if (typeof crawlEnabled === 'boolean') patch.crawlEnabled = crawlEnabled;
  if (dailyQaLimit !== undefined) {
    const n = Number(dailyQaLimit);
    if (Number.isFinite(n) && n >= 1 && n <= 10000) patch.dailyQaLimit = n;
  }
  if (typeof signupEnabled === 'boolean') patch.signupEnabled = signupEnabled;
  if (typeof inviteCode === 'string') patch.inviteCode = inviteCode.trim().slice(0, 50);
  if (typeof turnstileEnabled === 'boolean') patch.turnstileEnabled = turnstileEnabled;
  if (typeof turnstileSiteKey === 'string') patch.turnstileSiteKey = turnstileSiteKey.trim().slice(0, 100);
  if (typeof turnstileSecretKey === 'string' && turnstileSecretKey.trim()) patch.turnstileSecretKey = turnstileSecretKey.trim().slice(0, 100);
  if (Object.keys(patch).length) {
    updateSettings(patch);
    resyncScheduler(getSettings);
  }
  res.json(publicView());
});

// 测试 DeepSeek Key 与模型连通性
router.post('/settings/test-key', adminRequired, async (req, res) => {
  const { deepseekApiKey, deepseekModel } = req.body || {};
  const key = (deepseekApiKey || getDeepSeekConfig().key || '').trim();
  const model = (deepseekModel || getDeepSeekConfig().model || 'deepseek-v4-flash').trim();
  if (!key) return res.status(400).json({ ok: false, message: '未提供 API Key' });
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return res.json({ ok: false, message: `HTTP ${resp.status}：${body.slice(0, 200)}` });
    }
    res.json({ ok: true, message: `API Key 有效（模型 ${model} 可用）` });
  } catch (e) {
    res.json({ ok: false, message: `连接失败：${e.message}` });
  }
});

export default router;
