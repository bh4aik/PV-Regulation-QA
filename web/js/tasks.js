// 清洗任务视图：爬虫候选 + 上传/清洗任务
App.views.tasks = function () {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">清洗任务</div>
    <div class="page-sub">每日爬虫发现的新法规、上传的文档，经 AI 清洗后确认入库</div>
    <div class="tabs">
      <button class="tab active" data-tab="crawl">🕷️ 爬虫发现</button>
      <button class="tab" data-tab="tasks">🧹 清洗任务</button>
    </div>
    <div id="tab-crawl"></div>
    <div id="tab-tasks" class="hidden"></div>`;

  const tabCrawl = document.getElementById('tab-crawl');
  const tabTasks = document.getElementById('tab-tasks');

  document.querySelectorAll('.tab').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === el));
      tabCrawl.classList.toggle('hidden', el.dataset.tab !== 'crawl');
      tabTasks.classList.toggle('hidden', el.dataset.tab !== 'tasks');
    });
  });

  loadCrawl();
  loadTasks();
  App.refreshTaskBadge();

  // ---------- 爬虫发现 ----------
  async function loadCrawl() {
    let data;
    try { data = await Api.get('/crawler/candidates'); } catch (e) { tabCrawl.innerHTML = errHtml(e); return; }
    const state = await Api.get('/crawler/state').catch(() => ({}));
    const pending = data.pending || [];
    const recent = (data.recent || []).filter((c) => c.status !== 'pending');

    tabCrawl.innerHTML = `
      <div class="panel" style="padding:16px 18px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <button class="btn primary" id="crawl-run">🔍 立即检查新法规</button>
            <button class="btn" id="crawl-manual" style="margin-left:8px">＋ 手动添加候选</button>
            <span class="crawl-info" style="margin-left:12px">
              上次检查：${state.lastRunAt ? new Date(state.lastRunAt).toLocaleString('zh-CN') : '尚未运行'}
              ${state.lastRunAdded ? `（新增 ${state.lastRunAdded} 条）` : ''}
            </span>
          </div>
          <div class="crawl-info">定时：${state.scheduler?.enabled ? state.scheduler.schedule + '（每日自动）' : '已停用'}　·　默认来源：安徽省药监局（TRS 接口，可在设置中增改）</div>
        </div>
        <div id="crawl-run-result" class="muted" style="font-size:12px;margin-top:8px"></div>
      </div>
      <div class="panel" style="padding:8px 10px">
        <table class="list">
          <thead><tr><th style="width:44%">标题</th><th>来源</th><th>日期</th><th>操作</th></tr></thead>
          <tbody id="crawl-tbody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('crawl-tbody');
    if (!pending.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty" style="padding:28px 0"><div class="big">🌤️</div>暂无可确认的新法规候选</div></td></tr>';
    } else {
      tbody.innerHTML = pending.map((c) => `
        <tr>
          <td class="cand-title">${App.esc(c.title)}</td>
          <td class="muted" style="font-size:12px">${App.esc(c.sourceName || '')}</td>
          <td class="muted" style="white-space:nowrap">${App.esc(c.date || '')}</td>
          <td style="white-space:nowrap">
            <button class="btn sm green" data-id="${c.id}" data-act="clean">AI 清洗入库</button>
            <button class="btn sm" data-id="${c.id}" data-act="ignore">忽略</button>
          </td>
        </tr>`).join('');
    }
    if (recent.length) {
      tbody.innerHTML += `<tr><td colspan="4" class="muted" style="font-size:12px">已处理：${recent.map((c) => App.esc(c.title).slice(0, 18) + (c.title.length > 18 ? '…' : '') + `（${c.status === 'ignored' ? '忽略' : '已生成清洗任务'}）`).join('、')}</td></tr>`;
    }

    document.getElementById('crawl-run').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const resEl = document.getElementById('crawl-run-result');
      resEl.textContent = '正在抓取各来源…';
      try {
        const out = await Api.post('/crawler/run');
        const parts = (out.results || []).map((r) => `${r.source}：${r.ok ? `发现 ${r.found} 条` : '失败(' + r.error + ')'}`);
        resEl.textContent = `检查完成：新增 ${out.added} 条候选，待确认 ${out.pending} 条。` + parts.join('；');
        App.toast(`检查完成，新增 ${out.added} 条候选`, 'ok');
        loadCrawl();
      } catch (e) {
        resEl.textContent = '检查失败：' + e.message;
        App.toast(e.message, 'err');
      } finally {
        btn.disabled = false;
      }
    });

    tbody.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (btn.dataset.act === 'ignore') {
          try {
            await Api.post(`/crawler/candidates/${id}/decide`, { action: 'ignore' });
            App.toast('已忽略', 'ok');
            loadCrawl();
          } catch (e) { App.toast(e.message, 'err'); }
        } else {
          btn.disabled = true;
          btn.textContent = '抓取中…';
          try {
            const data = await Api.post(`/crawler/candidates/${id}/decide`, { action: 'clean' });
            App.toast('已抓取正文并生成清洗任务，请到「清洗任务」页处理', 'ok');
            document.querySelector('.tab[data-tab="tasks"]').click();
            loadTasks();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'AI 清洗入库';
            App.toast(e.message, 'err');
          }
        }
      });
    });

    document.getElementById('crawl-manual').addEventListener('click', () => {
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML = `
        <div class="modal" style="width:min(520px,92vw)">
          <div class="modal-head"><h3>手动添加候选</h3><button class="btn sm" id="cm-close">✕</button></div>
          <div class="modal-body">
            <div class="form-row"><label>标题</label><input type="text" id="cm-title" placeholder="如：国家药监局关于发布《××》的公告" /></div>
            <div class="form-row"><label>原文链接</label><input type="text" id="cm-url" placeholder="https://…" /></div>
            <div class="form-row"><label>发布日期（可选）</label><input type="text" id="cm-date" placeholder="2026-08-01" /></div>
            <div class="hint">适合：国家药监局等有反爬的网站，把你在浏览器里看到的法规页面链接粘贴进来，系统抓取正文后走 AI 清洗入库。</div>
          </div>
          <div class="modal-foot"><button class="btn" id="cm-cancel">取消</button><button class="btn primary" id="cm-add">添加</button></div>
        </div>`;
      document.body.appendChild(mask);
      const close = () => mask.remove();
      mask.querySelector('#cm-close').addEventListener('click', close);
      mask.querySelector('#cm-cancel').addEventListener('click', close);
      mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
      mask.querySelector('#cm-add').addEventListener('click', async () => {
        const title = mask.querySelector('#cm-title').value.trim();
        const url = mask.querySelector('#cm-url').value.trim();
        const date = mask.querySelector('#cm-date').value.trim();
        if (!title || !url) { App.toast('标题和链接不能为空', 'err'); return; }
        try {
          const data = await Api.post('/crawler/candidates', { title, url, date });
          if (data.candidate) {
            App.toast('已添加候选', 'ok');
            close();
            loadCrawl();
          } else {
            App.toast('该链接已在候选库中', 'err');
          }
        } catch (e) { App.toast(e.message, 'err'); }
      });
    });
  }

  // ---------- 清洗任务 ----------
  async function loadTasks() {
    let data;
    try { data = await Api.get('/ingest/tasks'); } catch (e) { tabTasks.innerHTML = errHtml(e); return; }
    const active = data.active || [];
    const recent = (data.recent || []).filter((t) => !active.some((a) => a.id === t.id));

    tabTasks.innerHTML = `
      <div class="panel" style="padding:8px 10px">
        <table class="list">
          <thead><tr><th style="width:40%">任务</th><th>类型</th><th>状态</th><th>清洗结果</th><th>操作</th></tr></thead>
          <tbody id="task-tbody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('task-tbody');
    const rows = [...active, ...recent];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty" style="padding:28px 0"><div class="big">🗂️</div>暂无清洗任务，可上传法规或从爬虫发现中导入</div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((t) => {
      const statusMap = { parsed: ['已解析', 'amber'], cleaned: ['已清洗', 'green'], committed: ['已入库', 'gray'], ignored: ['已忽略', 'gray'], failed: ['失败', 'red'] };
      const [st, stc] = statusMap[t.status] || [t.status, 'gray'];
      const c = t.cleaned;
      const articles = c ? (c.chapters || []).reduce((s, ch) => s + (ch.articles || []).length, 0) : 0;
      return `
        <tr data-id="${t.id}">
          <td>
            <div style="font-weight:500">${App.esc(t.title)}</div>
            ${t.source?.url ? `<div class="muted" style="font-size:11px;word-break:break-all"><a href="${App.esc(t.source.url)}" target="_blank" rel="noreferrer">${App.esc(t.source.sourceName || '来源链接')} ↗</a></div>` : ''}
            <div class="muted" style="font-size:11px">${t.filename || t.kind === 'crawl' ? (t.filename ? '文件：' + App.esc(t.filename) : '') : ''} ${t.createdAt ? '· ' + new Date(t.createdAt).toLocaleString('zh-CN') : ''}</div>
            ${t.error ? `<div class="tag red">${App.esc(t.error.slice(0, 60))}</div>` : ''}
          </td>
          <td><span class="tag ${t.kind === 'upload' ? '' : 'amber'}">${t.kind === 'upload' ? '上传' : '爬虫'}</span></td>
          <td><span class="tag ${stc}">${st}</span></td>
          <td style="max-width:220px">
            ${c ? `<div style="font-size:12px">《${App.esc(c.title || '')}》<br/><span class="muted">${(c.chapters || []).length} 章 / ${articles} 条 · ${c._cleanedBy === 'ai' ? 'AI' : '启发式'}</span></div>` : '<span class="muted" style="font-size:12px">—</span>'}
          </td>
          <td style="white-space:nowrap">
            ${['parsed', 'failed'].includes(t.status) ? `<button class="btn sm primary" data-id="${t.id}" data-act="clean">清洗</button>` : ''}
            ${t.status === 'cleaned' ? `<button class="btn sm green" data-id="${t.id}" data-act="commit">确认入库</button>
              <button class="btn sm" data-id="${t.id}" data-act="preview">预览</button>` : ''}
            ${['parsed', 'cleaned', 'failed'].includes(t.status) ? `<button class="btn sm danger" data-id="${t.id}" data-act="del">删除</button>` : ''}
            ${t.status === 'committed' ? `<span class="muted" style="font-size:12px">→ <a href="#/library/${App.esc(t.regId)}">查看法规</a></span>` : ''}
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act === 'del') {
          if (!confirm('删除该任务？')) return;
          try { await Api.del('/ingest/tasks/' + id); App.toast('已删除', 'ok'); loadTasks(); App.refreshTaskBadge(); } catch (e) { App.toast(e.message, 'err'); }
        } else if (act === 'clean') {
          btn.disabled = true;
          btn.innerHTML = '<span class="spin"></span>';
          try {
            const data = await Api.post(`/ingest/tasks/${id}/clean`);
            App.toast(`清洗完成：${(data.task.cleaned.chapters || []).length} 章`, 'ok');
            loadTasks();
          } catch (e) { btn.disabled = false; btn.textContent = '清洗'; App.toast(e.message, 'err'); }
        } else if (act === 'commit') {
          btn.disabled = true;
          try {
            const data = await Api.post(`/ingest/tasks/${id}/commit`);
            App.toast(`已入库：${data.regId}`, 'ok');
            loadTasks(); App.refreshSidebar();
          } catch (e) { btn.disabled = false; App.toast(e.message, 'err'); }
        } else if (act === 'preview') {
          const row = tbody.querySelector(`tr[data-id="${id}"]`);
          const c = (data.recent || []).find((t) => t.id === id)?.cleaned;
          if (c) showCleanPreview(c);
        }
      });
    });
  }

  function showCleanPreview(c) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>清洗结果预览</h3><button class="btn sm" id="cp-close">✕</button></div>
        <div class="modal-body">
          <div class="meta-grid">
            <div><div class="k">标题</div><div class="v">${App.esc(c.title || '')}</div></div>
            <div><div class="k">文号</div><div class="v">${App.esc(c.documentNumber || '')}</div></div>
            <div><div class="k">发布机关</div><div class="v">${App.esc(c.issuingAuthority || '')}</div></div>
            <div><div class="k">施行日期</div><div class="v">${App.esc(c.effectiveDate || '')}</div></div>
          </div>
          ${(c.chapters || []).map((ch, i) => `
            <details class="chapter" ${i === 0 ? 'open' : ''}><summary>${App.esc(ch.title || '正文')}（${ch.articles.length} 条）</summary>
            <div class="articles">${ch.articles.slice(0, 30).map((a) => `<div class="article"><span class="num">${App.esc(a.num)}</span>${App.esc(a.text.slice(0, 100))}${a.text.length > 100 ? '…' : ''}</div>`).join('')}</div></details>`).join('')}
        </div>
        <div class="modal-foot"><button class="btn" id="cp-close2">关闭</button></div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelector('#cp-close').addEventListener('click', close);
    mask.querySelector('#cp-close2').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  }

  function errHtml(e) {
    return `<div class="empty"><div class="big">⚠️</div>${App.esc(e.message)}</div>`;
  }
};
