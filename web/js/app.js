// 应用核心：路由、API（带 token）、toast、会话状态
const App = {
  views: {},
  VERSION: '0.4.0',
  state: { view: 'chat', stats: null, settings: null, user: null, chatLogHTML: '' },

  async init() {
    this.bindNav();
    // 恢复会话
    const token = localStorage.getItem('pvqa_token');
    if (token) {
      try {
        const { user } = await Api.get('/auth/me');
        this.state.user = user;
      } catch {
        localStorage.removeItem('pvqa_token');
      }
    }
    if (!this.state.user) {
      return this.showLogin();
    }
    this.enterApp();
  },

  // 进入应用主界面
  enterApp() {
    document.getElementById('login-mask')?.remove();
    document.body.style.overflow = '';
    this.renderNav();
    this.refreshSidebar();
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  // 显示登录界面
  showLogin() {
    document.getElementById('main').innerHTML = '';
    const mask = document.createElement('div');
    mask.id = 'login-mask';
    mask.className = 'login-mask';
    mask.innerHTML = `
      <div class="login-card panel">
        <div class="login-brand"><span class="brand-logo">💊</span></div>
        <h1>药物警戒法规问答库 <span class="beta-tag">BETA</span></h1>
        <div class="login-sub">中国药物警戒 / 药品安全法规 AI 问答</div>
        <div class="login-tabs">
          <button class="login-tab active" data-tab="login">登 录</button>
          <button class="login-tab" data-tab="register">注 册</button>
        </div>
        <div id="login-form">
          <div class="form-row"><label>邮箱</label><input type="email" id="lg-account" autocomplete="email" placeholder="也可用用户名登录" /></div>
          <div class="form-row"><label>密码</label><input type="password" id="lg-pass" autocomplete="current-password" /></div>
          <button class="btn primary login-btn" id="lg-submit">登 录</button>
          <div class="login-msg" id="lg-msg"></div>
        </div>
        <div id="register-form" class="hidden">
          <div class="form-row"><label>邮箱（必填）</label><input type="email" id="rg-email" autocomplete="email" placeholder="用于登录，例如 you@example.com" /></div>
          <div class="form-row"><label>密码（12-128 位）</label><input type="password" id="rg-pass" minlength="12" maxlength="128" autocomplete="new-password" /></div>
          <div class="form-row"><label>用户名（选填，留空则用邮箱）</label><input type="text" id="rg-name" autocomplete="username" placeholder="2-30 字符" /></div>
          <div class="form-row"><label>手机号（选填）</label><input type="text" id="rg-phone" placeholder="11 位手机号" /></div>
          <div id="turnstile-container" style="margin:10px 0"></div>
          <button class="btn primary login-btn" id="rg-submit">注 册</button>
          <div class="login-msg" id="rg-msg"></div>
        </div>
        <div class="login-foot" id="login-foot"></div>
      </div>`;
    document.body.appendChild(mask);

    // tab 切换
    mask.querySelectorAll('.login-tab').forEach((t) => {
      t.addEventListener('click', () => {
        mask.querySelectorAll('.login-tab').forEach((x) => x.classList.toggle('active', x === t));
        document.getElementById('login-form').classList.toggle('hidden', t.dataset.tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', t.dataset.tab !== 'register');
      });
    });

    // 提示：首个注册用户为管理员（仅 AUTO_FIRST_ADMIN 开启且无用户时）
    Api.get('/public/needs-admin').then((d) => {
      if (d.needsAdmin) {
        document.getElementById('login-foot').innerHTML =
          '<div class="tag amber">系统尚无用户，首个注册的账号将自动成为管理员</div>';
      }
    }).catch(() => {});

    document.getElementById('lg-submit').addEventListener('click', () => this.doLogin());
    document.getElementById('lg-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.doLogin(); });
    document.getElementById('rg-submit').addEventListener('click', () => this.doRegister());
    this.loadTurnstile();
  },

  // 加载 Cloudflare Turnstile 人机验证（若已启用）
  async loadTurnstile() {
    const container = document.getElementById('turnstile-container');
    if (!container) return;
    try {
      const cfg = await Api.get('/public/turnstile');
      if (!cfg.enabled || !cfg.siteKey) return;
      container.innerHTML = '<div id="turnstile-widget"></div>';
      // 动态加载 Turnstile API（显式渲染模式）
      if (!window.turnstile) {
        await new Promise((resolve) => {
          const sc = document.createElement('script');
          sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          sc.async = true;
          sc.onload = () => resolve();
          sc.onerror = () => resolve();
          document.head.appendChild(sc);
        });
      }
      if (window.turnstile && document.getElementById('turnstile-widget')) {
        window.turnstile.render('#turnstile-widget', { sitekey: cfg.siteKey, theme: 'light' });
      }
    } catch { /* 未配置则跳过 */ }
  },

  async doLogin() {
    const account = document.getElementById('lg-account').value.trim();
    const password = document.getElementById('lg-pass').value;
    const msg = document.getElementById('lg-msg');
    msg.textContent = '';
    try {
      const data = await Api.request('POST', '/auth/login', { account, password });
      localStorage.setItem('pvqa_token', data.token);
      this.state.user = data.user;
      this.enterApp();
    } catch (e) {
      msg.textContent = e.message;
      msg.style.color = 'var(--red)';
    }
  },

  async doRegister() {
    const email = document.getElementById('rg-email').value.trim();
    const username = document.getElementById('rg-name').value.trim();
    const password = document.getElementById('rg-pass').value;
    const phone = document.getElementById('rg-phone').value.trim();
    const turnstileToken = window.turnstile?.getResponse?.() || '';
    const msg = document.getElementById('rg-msg');
    msg.textContent = '';
    if (!email) { msg.textContent = '请输入邮箱地址'; msg.style.color = 'var(--red)'; return; }
    try {
      const data = await Api.request('POST', '/auth/register', { email, username, password, phone, turnstileToken });
      localStorage.setItem('pvqa_token', data.token);
      this.state.user = data.user;
      if (data.isFirst) this.toast('已创建管理员账号（首个注册用户）', 'ok');
      else this.toast('注册成功', 'ok');
      this.enterApp();
    } catch (e) {
      msg.textContent = e.message;
      msg.style.color = 'var(--red)';
    }
  },

  async logout() {
    try { await Api.request('POST', '/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('pvqa_token');
    this.state.user = null;
    this.showLogin();
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.addEventListener('click', () => this.setView(el.dataset.view));
    });
  },

  // 按角色渲染导航
  renderNav() {
    const isAdmin = this.state.user?.role === 'admin';
    document.querySelectorAll('.nav-item').forEach((el) => {
      const v = el.dataset.view;
      const adminOnly = ['tasks', 'settings', 'admin'].includes(v);
      el.classList.toggle('hidden', adminOnly && !isAdmin);
    });
    // 侧栏底部用户信息
    const foot = document.getElementById('sidebar-foot');
    foot.innerHTML = `
      <button class="btn sm feedback-btn" id="feedback-btn" title="意见反馈">
        💬 反馈
      </button>
      <div class="user-row">
        <div class="user-avatar">${App.esc((this.state.user?.username || '?')[0].toUpperCase())}</div>
        <div class="user-info">
          <div class="user-name">${App.esc(this.state.user?.username || '')} <span class="tag ${isAdmin ? 'amber' : 'gray'}">${isAdmin ? '管理员' : '用户'}</span></div>
          <div class="user-meta">问答 ${this.state.user?.qaCount ?? 0} 次</div>
        </div>
        <button class="btn sm" id="logout-btn" title="退出登录">退出</button>
      </div>
      <div class="stat-row"><span>法规库</span><b id="stat-regs">-</b></div>
      <div class="stat-row"><span>条款</span><b id="stat-articles">-</b></div>
      ${isAdmin ? '<div class="stat-row"><span>API 状态</span><b id="stat-api" class="dot-off">-</b></div>' : ''}
      <div class="version">v${App.VERSION}</div>`;
    document.getElementById('logout-btn').addEventListener('click', () => {
      if (confirm('确定退出登录？')) this.logout();
    });
    document.getElementById('feedback-btn').addEventListener('click', () => this.openFeedback());
    this.bindNav();
  },

  // 刷新当前用户信息（问答后调用，让侧栏"问答 N 次"实时更新）
  async refreshUser() {
    try {
      const { user } = await Api.get('/auth/me');
      this.state.user = user;
      const metaEl = document.querySelector('.user-meta');
      if (metaEl) metaEl.textContent = `问答 ${user?.qaCount ?? 0} 次`;
    } catch { /* 静默失败，下次问答再试 */ }
  },

  route() {
    const hash = location.hash.replace(/^#\//, '') || 'chat';
    const [view, param] = hash.split('/');
    this.setView(view || 'chat', param);
  },

  setView(view, param) {
    const isAdmin = this.state.user?.role === 'admin';
    if (['tasks', 'settings', 'admin'].includes(view) && !isAdmin) view = 'chat';
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
    const render = this.views[view];
    if (!render) return;
    this.state.view = view;
    render(param);
  },

  async refreshSidebar() {
    try {
      const stats = await Api.get('/stats');
      document.getElementById('stat-regs').textContent = stats.regulations;
      const artEl = document.getElementById('stat-articles');
      if (artEl) artEl.textContent = stats.articles;
      this.state.stats = stats;
    } catch { /* ignore */ }
    if (this.state.user?.role === 'admin') {
      try {
        const settings = await Api.get('/settings');
        const apiEl = document.getElementById('stat-api');
        if (apiEl) {
          apiEl.textContent = settings.hasApiKey ? '已配置' : '未配置';
          apiEl.className = settings.hasApiKey ? 'dot-on' : 'dot-off';
        }
        this.state.settings = settings;
      } catch { /* ignore */ }
    }
    this.refreshTaskBadge();
  },

  async refreshTaskBadge() {
    if (this.state.user?.role !== 'admin') return;
    try {
      const data = await Api.get('/ingest/tasks');
      const active = (data.active || []).length;
      const cand = await Api.get('/crawler/candidates');
      const n = active + (cand.pending || []).length;
      const badge = document.getElementById('task-badge');
      badge.hidden = n === 0;
      badge.textContent = n > 99 ? '99+' : n;
    } catch { /* ignore */ }
  },

  toast(msg, type = '') {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

const Api = {
  async request(method, path, body) {
    const opts = { method, headers: {} };
    const token = localStorage.getItem('pvqa_token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body instanceof FormData) {
      opts.body = body;
    } else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch('/api' + path, opts);
    if (resp.status === 401 && !path.startsWith('/auth/') && !path.startsWith('/public/')) {
      localStorage.removeItem('pvqa_token');
      App.state.user = null;
      App.showLogin();
      throw new Error('请先登录');
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  },
  get: (p) => Api.request('GET', p),
  post: (p, b) => Api.request('POST', p, b),
  patch: (p, b) => Api.request('PATCH', p, b),
  del: (p) => Api.request('DELETE', p),

  async qa(question, { onMeta, onDelta, onFallback, onDone, onError }) {
    const resp = await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('pvqa_token') || '') },
      body: JSON.stringify({ question }),
    });
    if (resp.status === 401) {
      localStorage.removeItem('pvqa_token');
      App.state.user = null;
      App.showLogin();
      throw new Error('请先登录');
    }
    if (!resp.ok || !resp.body) throw new Error('问答请求失败');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (evt.type === 'meta') onMeta && onMeta(evt.results || []);
        else if (evt.type === 'delta') onDelta && onDelta(evt.text);
        else if (evt.type === 'fallback') onFallback && onFallback(evt);
        else if (evt.type === 'error') onError && onError(evt.message);
        else if (evt.type === 'done') onDone && onDone(evt.historyId || '');
      }
    }
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
