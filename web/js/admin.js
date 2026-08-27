// 管理员控制面板：概览（用量）+ 用户管理 + 反馈管理 + 系统日志（仅 admin 可见）
App.views.admin = function () {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">管理控制面板</div>
    <div class="page-sub">用户管理、用量分析、反馈处理、系统日志（管理员专属）</div>
    <div class="tabs">
      <button class="tab active" data-tab="overview">📈 概览</button>
      <button class="tab" data-tab="users">👥 用户管理</button>
      <button class="tab" data-tab="feedback">💬 反馈管理</button>
      <button class="tab" data-tab="analytics">📊 分析洞察</button>
      <button class="tab" data-tab="changelog">📜 系统日志</button>
    </div>
    <div id="tab-overview"></div>
    <div id="tab-users" class="hidden"></div>
    <div id="tab-feedback" class="hidden"></div>
    <div id="tab-analytics" class="hidden"></div>
    <div id="tab-changelog" class="hidden"></div>`;

  const tabOverview = document.getElementById('tab-overview');
  const tabUsers = document.getElementById('tab-users');
  const tabFeedback = document.getElementById('tab-feedback');
  const tabAnalytics = document.getElementById('tab-analytics');
  const tabChangelog = document.getElementById('tab-changelog');

  document.querySelectorAll('.tab').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === el));
      const t = el.dataset.tab;
      tabOverview.classList.toggle('hidden', t !== 'overview');
      tabUsers.classList.toggle('hidden', t !== 'users');
      tabFeedback.classList.toggle('hidden', t !== 'feedback');
      tabAnalytics.classList.toggle('hidden', t !== 'analytics');
      tabChangelog.classList.toggle('hidden', t !== 'changelog');
      if (t === 'users') loadUsers();
      if (t === 'feedback') loadFeedback();
      if (t === 'analytics') loadAnalytics();
      if (t === 'changelog') loadChangelog();
    });
  });

  // ---------- 概览 ----------
  tabOverview.innerHTML = `
    <div class="admin-cards" id="admin-cards"></div>
    <div class="panel" style="padding:16px 18px;margin-bottom:16px">
      <h3 style="font-size:15px;margin-bottom:12px">📈 每日问答量（近 14 天）</h3>
      <div class="day-chart" id="day-chart"></div>
    </div>`;

  const cardsEl = document.getElementById('admin-cards');
  const chartEl = document.getElementById('day-chart');

  async function loadOverview() {
    try {
      const stats = await Api.get('/admin/stats?days=14');
      cardsEl.innerHTML = `
        <div class="admin-card"><div class="ac-num">${stats.totalQa}</div><div class="ac-label">累计问答</div></div>
        <div class="admin-card"><div class="ac-num">${stats.todayQa}</div><div class="ac-label">今日问答</div></div>
        <div class="admin-card"><div class="ac-num">${stats.totalUsers}</div><div class="ac-label">注册用户</div></div>
        <div class="admin-card"><div class="ac-num">${stats.activeUsers}</div><div class="ac-label">活跃用户</div></div>`;
      const byDay = stats.byDay || [];
      const max = Math.max(1, ...byDay.map((d) => d.count));
      chartEl.innerHTML = `<div class="chart-bars">${byDay.map((d) => `
        <div class="chart-col" title="${d.date}：${d.count} 次">
          <div class="chart-bar" style="height:${Math.round((d.count / max) * 100)}%"></div>
          <div class="chart-num">${d.count || ''}</div>
          <div class="chart-label">${d.date.slice(5)}</div>
        </div>`).join('')}</div>`;
    } catch (e) {
      cardsEl.innerHTML = `<div class="empty"><div class="big">⚠️</div>${App.esc(e.message)}</div>`;
    }
  }

  // ---------- 用户管理 ----------
  tabUsers.innerHTML = `
    <div class="panel" style="padding:8px 10px">
      <table class="list">
        <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>问答次数</th><th>最后活跃</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody id="user-tbody"></tbody>
      </table>
    </div>`;
  const tbody = document.getElementById('user-tbody');

  async function loadUsers() {
    try {
      const { users } = await Api.get('/admin/users');
      renderUsers(users);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty">${App.esc(e.message)}</div></td></tr>`;
    }
  }

  function renderUsers(users) {
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty">暂无用户</div></td></tr>';
      return;
    }
    const me = App.state.user;
    tbody.innerHTML = users.map((u) => {
      const isMe = u.id === me.id;
      const isLastAdmin = u.role === 'admin' && users.filter((x) => x.role === 'admin' && x.status === 'active').length === 1;
      return `
        <tr data-id="${u.id}">
          <td><b>${App.esc(u.username)}</b>${isMe ? ' <span class="tag">我</span>' : ''}${u.email ? `<div class="muted" style="font-size:11px">✉️ ${App.esc(u.email)}</div>` : ''}${u.phone ? `<div class="muted" style="font-size:11px">📱 ${App.esc(u.phone)}</div>` : ''}</td>
          <td><span class="tag ${u.role === 'admin' ? 'amber' : 'gray'}">${u.role === 'admin' ? '管理员' : '用户'}</span></td>
          <td><span class="tag ${u.status === 'active' ? 'green' : 'red'}">${u.status === 'active' ? '正常' : '已禁用'}</span></td>
          <td>${u.qaCount}</td>
          <td class="muted" style="white-space:nowrap">${u.lastQaAt ? new Date(u.lastQaAt).toLocaleString('zh-CN').slice(0, 16) : '—'}</td>
          <td class="muted" style="white-space:nowrap">${new Date(u.createdAt).toLocaleString('zh-CN').slice(0, 10)}</td>
          <td style="white-space:nowrap">
            ${isMe ? `<button class="btn sm" data-act="pwd">修改密码</button>` : ''}
            ${u.status === 'active' && !isMe ? `<button class="btn sm" data-act="disable">禁用</button>` : u.status === 'disabled' ? `<button class="btn sm green" data-act="enable">启用</button>` : ''}
            ${u.role === 'user' && !isLastAdmin ? `<button class="btn sm" data-act="promote">设为管理员</button>` : u.role === 'admin' && !isMe && !isLastAdmin ? `<button class="btn sm" data-act="demote">取消管理</button>` : ''}
            ${!isMe ? `<button class="btn sm danger" data-act="del">删除</button>` : ''}
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = btn.closest('tr').dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', async () => {
        const actions = {
          disable: ['禁用该用户？', { status: 'disabled' }],
          enable: ['启用该用户？', { status: 'active' }],
          promote: ['将该用户设为管理员？', { role: 'admin' }],
          demote: ['取消该用户的管理员权限？', { role: 'user' }],
          del: ['删除该用户？此操作不可恢复。', null],
        };
        if (act === 'pwd') {
          const p1 = prompt('输入新密码（12-128 位）：');
          if (!p1) return;
          const p2 = prompt('再次输入新密码确认：');
          if (p1 !== p2) { App.toast('两次输入不一致', 'err'); return; }
          try { await Api.patch('/admin/users/' + id, { password: p1 }); App.toast('密码已更新', 'ok'); } catch (e) { App.toast(e.message, 'err'); }
          return;
        }
        if (!confirm(actions[act][0])) return;
        try {
          if (act === 'del') await Api.del('/admin/users/' + id);
          else await Api.patch('/admin/users/' + id, actions[act][1]);
          App.toast('操作成功', 'ok');
          loadUsers();
        } catch (e) { App.toast(e.message, 'err'); }
      });
    });
  }

  // ---------- 反馈管理 ----------
  tabFeedback.innerHTML = `
    <div class="fb-filter" id="fb-filter"></div>
    <div id="fb-stats" class="admin-cards" style="margin:0 0 12px"></div>
    <div id="fb-admin-list"></div>`;

  const statusText = { pending: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭' };
  const statusTag = { pending: 'amber', processing: 'blue', resolved: 'green', closed: 'gray' };
  let currentStatus = '';

  async function loadFeedback(status = currentStatus) {
    currentStatus = status;
    try {
      const data = await Api.get('/admin/feedback' + (status ? `?status=${status}` : ''));
      renderFeedback(data);
    } catch (e) {
      document.getElementById('fb-admin-list').innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
    }
  }

  function renderFeedback(data) {
    const stats = data.stats;
    document.getElementById('fb-stats').innerHTML = `
      <div class="admin-card"><div class="ac-num">${stats.total}</div><div class="ac-label">全部反馈</div></div>
      <div class="admin-card"><div class="ac-num" style="color:var(--amber)">${stats.pending}</div><div class="ac-label">待处理</div></div>
      <div class="admin-card"><div class="ac-num" style="color:var(--primary-dark)">${stats.processing}</div><div class="ac-label">处理中</div></div>
      <div class="admin-card"><div class="ac-num" style="color:var(--green)">${stats.resolved}</div><div class="ac-label">已解决</div></div>`;

    const statuses = [['', '全部'], ['pending', '待处理'], ['processing', '处理中'], ['resolved', '已解决'], ['closed', '已关闭']];
    document.getElementById('fb-filter').innerHTML = statuses.map(([v, label]) =>
      `<button class="btn sm ${currentStatus === v ? 'primary' : ''}" data-status="${v}">${label}</button>`).join(' ');
    document.querySelectorAll('#fb-filter button').forEach((b) => {
      b.addEventListener('click', () => loadFeedback(b.dataset.status));
    });

    const listEl = document.getElementById('fb-admin-list');
    const items = data.feedbacks || [];
    if (!items.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">💬</div>暂无反馈</div>';
      return;
    }
    listEl.innerHTML = items.map((f) => `
      <div class="panel fb-admin-item" data-id="${f.id}" style="padding:14px 18px;margin-bottom:10px">
        <div class="fb-item-head">
          <span class="tag ${statusTag[f.status] || 'gray'}">${statusText[f.status] || f.status}</span>
          <span class="tag gray">${f.type === 'bug' ? '问题反馈' : f.type === 'feature' ? '功能建议' : '其他'}</span>
          <b>${App.esc(f.username)}</b>
          <span class="muted" style="font-size:11.5px;margin-left:auto">${new Date(f.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        <div class="fb-item-body" style="margin:8px 0">${App.esc(f.content)}</div>
        ${f.contact ? `<div class="muted" style="font-size:12px">联系方式：${App.esc(f.contact)}</div>` : ''}
        ${f.statusHistory && f.statusHistory.length > 1 ? `<div class="muted" style="font-size:11px;margin-top:4px">流转：${f.statusHistory.map((h) => statusText[h.status] || h.status).join(' → ')}</div>` : ''}
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
          <select class="fb-status-select" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px">
            ${Object.entries(statusText).map(([v, label]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <input type="text" class="fb-note-input" placeholder="处理备注（可选）" value="${App.esc(f.adminNote || '')}" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:8px" />
          <button class="btn sm primary" data-act="save">保存</button>
          <button class="btn sm danger" data-act="del">删除</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.fb-admin-item').forEach((item) => {
      const id = item.dataset.id;
      item.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const status = item.querySelector('.fb-status-select').value;
        const adminNote = item.querySelector('.fb-note-input').value.trim();
        try {
          await Api.patch('/admin/feedback/' + id, { status, adminNote });
          App.toast('反馈已更新', 'ok');
          loadFeedback();
        } catch (e) { App.toast(e.message, 'err'); }
      });
      item.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirm('删除该反馈？')) return;
        try {
          await Api.del('/admin/feedback/' + id);
          App.toast('已删除', 'ok');
          loadFeedback();
        } catch (e) { App.toast(e.message, 'err'); }
      });
    });
  }

  // ---------- 分析洞察 ----------
  tabAnalytics.innerHTML = `
    <div id="analytics-insights" class="insight-list" style="margin-bottom:14px"></div>
    <div class="analytics-grid">
      <div class="panel" style="padding:14px 16px">
        <h3 style="font-size:14px;margin-bottom:10px">🔑 高频关键词（近 30 天）</h3>
        <div class="kw-cloud" id="analytics-keywords"></div>
      </div>
      <div class="panel" style="padding:14px 16px">
        <h3 style="font-size:14px;margin-bottom:10px">📚 被引用最多的法规条款</h3>
        <div id="analytics-cited"></div>
      </div>
      <div class="panel" style="padding:14px 16px">
        <h3 style="font-size:14px;margin-bottom:10px">👎 不满原因分布</h3>
        <div id="analytics-down"></div>
      </div>
      <div class="panel" style="padding:14px 16px">
        <h3 style="font-size:14px;margin-bottom:10px">👥 用户行为</h3>
        <div id="analytics-users"></div>
      </div>
    </div>
    <div class="panel" style="padding:14px 16px;margin-top:14px">
      <h3 style="font-size:14px;margin-bottom:10px">⚠️ 被检索到但未被引用的条款（召回精度待观察）</h3>
      <div id="analytics-notcited"></div>
    </div>`;

  async function loadAnalytics() {
    try {
      const d = await Api.get('/admin/analytics?days=30');
      const insEl = document.getElementById('analytics-insights');
      insEl.innerHTML = (d.insights || []).map((i) => `<div class="insight-item">💡 ${App.esc(i)}</div>`).join('') || '<div class="muted">暂无数据</div>';

      const kwEl = document.getElementById('analytics-keywords');
      kwEl.innerHTML = (d.keywords || []).map((k) => `<span class="kw-chip">${App.esc(k.keyword)} <b>${k.count}</b></span>`).join('') || '<div class="muted">暂无数据</div>';

      const citedEl = document.getElementById('analytics-cited');
      citedEl.innerHTML = (d.topCited || []).map((r) => `<div style="font-size:13px;padding:3px 0">《${App.esc(r.regTitle)}》${App.esc(r.articleNum || '')} <span class="muted">×${r.count}</span></div>`).join('') || '<div class="muted">暂无数据</div>';

      const downEl = document.getElementById('analytics-down');
      downEl.innerHTML = `<div style="font-size:13px;margin-bottom:6px">👍 ${d.upCount} · 👎 ${d.downCount} ${d.upRate !== null ? '· 满意率 ' + d.upRate + '%' : ''}</div>` +
        (d.downReasons || []).map((r) => `<div style="font-size:13px;padding:2px 0">${App.esc(r.tag)} <span class="muted">×${r.count}</span></div>`).join('') || '<div class="muted">暂无 👎 反馈</div>';

      const usersEl = document.getElementById('analytics-users');
      usersEl.innerHTML = (d.userActivity || []).map((u) => `<div style="font-size:13px;padding:3px 0">${App.esc(u.username)} <span class="muted">问答 ${u.qaCount} 次 · 反馈 ${u.ratingCount} 次</span></div>`).join('') || '<div class="muted">暂无数据</div>';

      const notCitedEl = document.getElementById('analytics-notcited');
      notCitedEl.innerHTML = (d.retrievedNotCited || []).map((r) => `<div style="font-size:13px;padding:3px 0">《${App.esc(r.regTitle)}》${App.esc(r.articleNum || '')} <span class="muted">×${r.count}</span></div>`).join('') || '<div class="muted">暂无（或检索与引用一致）</div>';
    } catch (e) {
      document.getElementById('analytics-insights').innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
    }
  }

  // ---------- 系统日志 ----------
  tabChangelog.innerHTML = `
    <div class="panel" style="padding:14px 16px;margin-bottom:14px">
      <h3 style="font-size:14px;margin-bottom:10px">➕ 新增日志</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="cl-version" placeholder="版本号，如 0.2.1" style="width:110px;padding:7px 10px;border:1px solid var(--border);border-radius:8px" />
        <select id="cl-kind" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px">
          <option value="upgrade">版本升级</option>
          <option value="feature">功能新增</option>
          <option value="fix">问题修正</option>
        </select>
        <input id="cl-title" placeholder="日志标题" style="flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--border);border-radius:8px" />
      </div>
      <textarea id="cl-items" placeholder="内容要点，每行一条" style="width:100%;min-height:70px;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;box-sizing:border-box" ></textarea>
      <button id="cl-add" class="btn sm primary" style="margin-top:8px">保存日志</button>
    </div>
    <div id="cl-list"></div>`;

  const kindTag = { upgrade: 'amber', feature: 'green', fix: 'red' };
  const kindText = { upgrade: '版本升级', feature: '功能新增', fix: '问题修正' };

  async function loadChangelog() {
    try {
      const { entries } = await Api.get('/admin/changelog');
      const listEl = document.getElementById('cl-list');
      if (!entries.length) {
        listEl.innerHTML = '<div class="empty"><div class="big">📜</div>暂无日志</div>';
        return;
      }
      listEl.innerHTML = entries.map((c) => `
        <div class="panel cl-item" data-id="${c.id}" style="padding:14px 18px;margin-bottom:10px">
          <div class="fb-item-head" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${c.version ? `<span class="tag primary">v${App.esc(c.version)}</span>` : ''}
            <span class="tag ${kindTag[c.kind] || 'gray'}">${kindText[c.kind] || c.kind}</span>
            <b>${App.esc(c.title)}</b>
            <span class="muted" style="font-size:11.5px;margin-left:auto">${App.esc(c.date || '')}${c.by ? ' · ' + App.esc(c.by) : ''}</span>
            <button class="btn sm danger" data-act="cl-del">删除</button>
          </div>
          <ul style="margin:8px 0 0;padding-left:20px">
            ${(c.items || []).map((s) => `<li style="font-size:13px;line-height:1.7">${App.esc(s)}</li>`).join('')}
          </ul>
        </div>`).join('');

      listEl.querySelectorAll('[data-act="cl-del"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('删除该条系统日志？')) return;
          try {
            await Api.del('/admin/changelog/' + btn.closest('.cl-item').dataset.id);
            App.toast('已删除', 'ok');
            loadChangelog();
          } catch (e) { App.toast(e.message, 'err'); }
        });
      });
    } catch (e) {
      document.getElementById('cl-list').innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
    }
  }

  document.getElementById('cl-add').addEventListener('click', async () => {
    const version = document.getElementById('cl-version').value.trim();
    const kind = document.getElementById('cl-kind').value;
    const title = document.getElementById('cl-title').value.trim();
    const items = document.getElementById('cl-items').value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!title) { App.toast('请填写日志标题', 'err'); return; }
    if (!items.length) { App.toast('请填写内容要点', 'err'); return; }
    try {
      await Api.post('/admin/changelog', { version, title, kind, items });
      App.toast('日志已保存', 'ok');
      document.getElementById('cl-version').value = '';
      document.getElementById('cl-title').value = '';
      document.getElementById('cl-items').value = '';
      loadChangelog();
    } catch (e) { App.toast(e.message, 'err'); }
  });

  // 初始化
  loadOverview();
  loadUsers();
};
