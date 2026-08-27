// 设置视图
App.views.settings = function () {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">设置</div>
    <div class="page-sub">配置 DeepSeek API、爬虫计划与数据源</div>

    <div class="panel settings-card">
      <h3>🔑 DeepSeek API</h3>
      <div class="form-row">
        <label>API Key（保存在本地 data/state/settings.json，也可写入 .env 的 DEEPSEEK_API_KEY）</label>
        <div style="display:flex;gap:8px">
          <input type="password" id="set-key" placeholder="sk-…" autocomplete="off" />
          <button class="btn" id="set-test">测试连接</button>
        </div>
        <div class="hint" id="set-key-status"></div>
      </div>
      <div class="form-row">
        <label>模型</label>
        <select id="set-model" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px">
          <option value="deepseek-v4-flash">deepseek-v4-flash（V4 快速，推荐）</option>
          <option value="deepseek-v4-pro">deepseek-v4-pro（V4 深度推理）</option>
          <option value="deepseek-chat">deepseek-chat（旧别名，已停用）</option>
          <option value="deepseek-reasoner">deepseek-reasoner（旧别名，已停用）</option>
        </select>
        <div class="hint">deepseek-chat / deepseek-reasoner 为旧别名，DeepSeek 已于 2026-07-24 停用，请使用 V4 系列。</div>
      </div>
      <button class="btn primary" id="set-save-key">保存 API 设置</button>
    </div>

    <div class="panel settings-card">
      <h3>🕷️ 每日爬虫</h3>
      <div class="form-row" style="display:flex;align-items:center;gap:10px">
        <label class="switch" style="margin:0">
          <input type="checkbox" id="set-crawl-enabled" />
          <span class="slider"></span>
        </label>
        <span id="set-crawl-enabled-label">启用每日自动检查</span>
      </div>
      <div class="form-row">
        <label>普通用户每日 AI 问答限额（管理员不受限）</label>
        <input type="number" id="set-qa-limit" min="1" max="10000" style="max-width:140px" />
        <div class="hint">用于防止公网开放注册后 API 费用被滥用，超出后当日提示明日再试。</div>
      </div>
      <div class="form-row">
        <label>定时表达式（cron，默认每天 09:00）</label>
        <input type="text" id="set-cron" placeholder="0 9 * * *" style="max-width:220px" />
        <div class="hint">格式：分 时 日 月 周。示例：<code>0 9 * * *</code> 每天 9 点；<code>0 */6 * * *</code> 每 6 小时。</div>
      </div>
      <div class="form-row">
        <label>数据源（JSON 配置，type 支持 trs-label / html-list）</label>
        <textarea class="sources-json" id="set-sources" spellcheck="false"></textarea>
        <div class="hint">TRS 标签接口（如各省药监局政务公开）：type=trs-label，url=接口地址，form=提交参数。也可添加静态列表页：type=html-list，url=列表页，selectors.link=链接选择器。国家药监局官网（nmpa.gov.cn）有 JS 反爬，需用镜像源或手动上传。</div>
      </div>
      <button class="btn primary" id="set-save-crawl">保存爬虫设置</button>
      <button class="btn" id="set-rebuild" style="margin-left:8px">重建检索索引</button>
      <span id="set-rebuild-status" class="muted" style="margin-left:10px;font-size:12px"></span>
    </div>

    <div class="panel settings-card">
      <h3>🛡️ 注册防护</h3>
      <div class="form-row" style="display:flex;align-items:center;gap:10px">
        <label class="switch" style="margin:0">
          <input type="checkbox" id="set-signup-enabled" />
          <span class="slider"></span>
        </label>
        <span id="set-signup-label">开放注册</span>
      </div>
      <div class="form-row">
        <label>邀请码（留空则不校验；填写后注册需输入此码）</label>
        <input type="text" id="set-invite-code" placeholder="留空 = 不限制" style="max-width:240px" />
        <div class="hint">防机器人/恶意注册：可临时关闭注册，或设置邀请码限制注册来源。系统已内置同 IP 速率限制（注册每分钟最多 5 次）。</div>
      </div>
      <div style="border-top:1px dashed var(--border);margin:14px 0"></div>
      <div class="form-row" style="display:flex;align-items:center;gap:10px">
        <label class="switch" style="margin:0">
          <input type="checkbox" id="set-turnstile-enabled" />
          <span class="slider"></span>
        </label>
        <span id="set-turnstile-label">启用 Cloudflare Turnstile 人机验证</span>
      </div>
      <div class="form-row">
        <label>Turnstile Site Key（前端公开）</label>
        <input type="text" id="set-turnstile-site" placeholder="0x4AAAA..." />
      </div>
      <div class="form-row">
        <label>Turnstile Secret Key（后端保密）</label>
        <input type="password" id="set-turnstile-secret" placeholder="0x4AAAA..." autocomplete="off" />
      </div>
      <button class="btn primary" id="set-save-signup">保存注册防护设置</button>
    </div>

    <div class="panel settings-card">
      <h3>ℹ️ 关于</h3>
      <div class="form-row" style="margin:0">
        <div class="hint">
          药物警戒法规 AI 问答库 · 本地运行 · 数据存储于 <code>data/</code> 目录<br/>
          回答仅供参考，不构成法律意见；具体监管要求请以官方原文与主管机关解释为准。
        </div>
      </div>
    </div>`;

  const statusEl = document.getElementById('set-key-status');

  // 加载当前设置
  Api.get('/settings').then((s) => {
    const keyInput = document.getElementById('set-key');
    keyInput.placeholder = s.hasApiKey ? '已配置（输入新 Key 可覆盖）' : 'sk-…';
    document.getElementById('set-model').value = s.deepseekModel || 'deepseek-chat';
    document.getElementById('set-cron').value = s.crawlSchedule || '0 9 * * *';
    document.getElementById('set-crawl-enabled').checked = s.crawlEnabled !== false;
    document.getElementById('set-crawl-enabled-label').textContent = s.crawlEnabled !== false ? '启用每日自动检查' : '已停用每日自动检查';
    document.getElementById('set-qa-limit').value = s.dailyQaLimit || 20;
    document.getElementById('set-signup-enabled').checked = s.signupEnabled !== false;
    document.getElementById('set-signup-label').textContent = s.signupEnabled !== false ? '开放注册' : '注册已关闭';
    document.getElementById('set-invite-code').value = s.inviteCode || '';
    document.getElementById('set-turnstile-enabled').checked = !!s.turnstileEnabled;
    document.getElementById('set-turnstile-label').textContent = s.turnstileEnabled ? '已启用 Turnstile 人机验证' : '启用 Cloudflare Turnstile 人机验证';
    document.getElementById('set-turnstile-site').value = s.turnstileSiteKey || '';
    document.getElementById('set-turnstile-secret').placeholder = s.hasTurnstileSecretKey
      ? '已配置（输入新 Secret 可覆盖）'
      : '0x4AAAA...';
  });

  Api.get('/crawler/sources').then(({ sources }) => {
    document.getElementById('set-sources').value = JSON.stringify(sources, null, 2);
  });

  document.getElementById('set-test').addEventListener('click', async () => {
    const key = document.getElementById('set-key').value.trim();
    statusEl.textContent = '测试中…';
    const btn = document.getElementById('set-test');
    btn.disabled = true;
    try {
      const data = await Api.post('/settings/test-key', { deepseekApiKey: key, deepseekModel: document.getElementById('set-model').value });
      statusEl.textContent = data.ok ? '✅ ' + data.message : '❌ ' + data.message;
      if (data.ok) statusEl.style.color = 'var(--green)';
      else statusEl.style.color = 'var(--red)';
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = 'var(--red)';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('set-save-key').addEventListener('click', async () => {
    const patch = {
      deepseekApiKey: document.getElementById('set-key').value.trim(),
      deepseekModel: document.getElementById('set-model').value,
    };
    try {
      await Api.post('/settings', patch);
      App.toast('API 设置已保存', 'ok');
      document.getElementById('set-key').value = '';
      App.refreshSidebar();
      statusEl.textContent = '';
    } catch (e) { App.toast(e.message, 'err'); }
  });

  document.getElementById('set-save-crawl').addEventListener('click', async () => {
    try {
      const sources = JSON.parse(document.getElementById('set-sources').value);
      const patch = {
        crawlEnabled: document.getElementById('set-crawl-enabled').checked,
        crawlSchedule: document.getElementById('set-cron').value.trim(),
        dailyQaLimit: Number(document.getElementById('set-qa-limit').value) || 20,
      };
      await Api.post('/crawler/sources', { sources });
      await Api.post('/settings', patch);
      App.toast('爬虫设置已保存', 'ok');
      App.refreshSidebar();
    } catch (e) {
      App.toast('保存失败（JSON 可能不合法）：' + e.message, 'err');
    }
  });

  document.getElementById('set-crawl-enabled').addEventListener('change', (e) => {
    document.getElementById('set-crawl-enabled-label').textContent = e.target.checked ? '启用每日自动检查' : '已停用每日自动检查';
  });

  document.getElementById('set-save-signup').addEventListener('click', async () => {
    try {
      await Api.post('/settings', {
        signupEnabled: document.getElementById('set-signup-enabled').checked,
        inviteCode: document.getElementById('set-invite-code').value.trim(),
        turnstileEnabled: document.getElementById('set-turnstile-enabled').checked,
        turnstileSiteKey: document.getElementById('set-turnstile-site').value.trim(),
        turnstileSecretKey: document.getElementById('set-turnstile-secret').value.trim(),
      });
      App.toast('注册防护设置已保存', 'ok');
    } catch (e) { App.toast(e.message, 'err'); }
  });

  document.getElementById('set-turnstile-enabled').addEventListener('change', (e) => {
    document.getElementById('set-turnstile-label').textContent = e.target.checked ? '已启用 Turnstile 人机验证' : '启用 Cloudflare Turnstile 人机验证';
  });

  document.getElementById('set-signup-enabled').addEventListener('change', (e) => {
    document.getElementById('set-signup-label').textContent = e.target.checked ? '开放注册' : '注册已关闭';
  });

  document.getElementById('set-rebuild').addEventListener('click', async () => {
    const st = document.getElementById('set-rebuild-status');
    st.textContent = '重建中…';
    try {
      const data = await Api.post('/ingest/rebuild');
      st.textContent = `完成：${data.stats.regulations} 部 / ${data.stats.articles} 条 / ${data.stats.chunks} 分块`;
      App.refreshSidebar();
      App.toast('索引已重建', 'ok');
    } catch (e) {
      st.textContent = '失败：' + e.message;
    }
  });
};
