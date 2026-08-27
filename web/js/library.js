// 法规库视图 + 上传入库弹窗
App.views.library = function (param) {
  // 解析 param：regId 或 regId?article=第七条
  let regId = param || '';
  let targetArticle = '';
  if (regId && regId.includes('?')) {
    const [r, q] = regId.split('?');
    regId = r;
    targetArticle = decodeURIComponent(q.replace(/^article=/, '') || '');
  }
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">法规库</div>
    <div class="page-sub">已收录的药品安全相关法规全文，可搜索、查看、上传新法规</div>
    <div class="lib-toolbar">
      <input type="text" id="lib-search" placeholder="搜索法规名称、文号…" />
      <select id="lib-cat">
        <option value="">全部类别</option>
        <option>法律</option>
        <option>行政法规</option>
        <option>部门规章</option>
        <option>规范性文件</option>
        <option>指导原则</option>
        <option>指南</option>
        <option>法规</option>
      </select>
      <select id="lib-country">
        <option value="">全部国家/地区</option>
        <option value="中国">中国</option>
        <option value="欧盟">欧盟</option>
        <option value="美国">美国</option>
        <option value="ICH">ICH</option>
      </select>
      <button class="btn" id="lib-refresh">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        刷新
      </button>
      <button class="btn primary hidden" id="lib-upload">＋ 上传新法规</button>
    </div>
    <div id="lib-list"></div>`;

  const listEl = document.getElementById('lib-list');
  let regs = [];

  async function load() {
    listEl.innerHTML = '<div class="empty"><div class="big">⏳</div>加载中…</div>';
    try {
      const data = await Api.get('/regulations');
      regs = data.regulations || [];
      render();
    } catch (e) {
      listEl.innerHTML = `<div class="empty"><div class="big">⚠️</div>${App.esc(e.message)}</div>`;
    }
  }

  function render() {
    const isAdmin = App.state.user?.role === 'admin';
    document.getElementById('lib-upload').classList.toggle('hidden', !isAdmin);
    const kw = (document.getElementById('lib-search').value || '').trim().toLowerCase();
    const cat = document.getElementById('lib-cat').value;
    const country = document.getElementById('lib-country').value;
    const list = regs.filter((r) => {
      // 搜索：不区分大小写（英文标题/文号/机关名统一转小写比对）
      const okKw = !kw || (r.title + ' ' + r.shortTitle + ' ' + r.documentNumber + ' ' + r.issuingAuthority + ' ' + (r.country || '')).toLowerCase().includes(kw);
      const okCat = !cat || r.category === cat;
      const okCountry = !country || (r.country || '') === country;
      // 类别与国家/地区为 AND 关系
      return okKw && okCat && okCountry;
    });
    if (!list.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">📚</div>暂无匹配的法规</div>';
      return;
    }
    listEl.innerHTML = list.map((r) => `
      <div class="panel reg-card">
        <div class="reg-title">${App.esc(r.title)}${r.shortTitle && r.shortTitle !== r.title ? ` <span class="muted" style="font-weight:400">（${App.esc(r.shortTitle)}）</span>` : ''}</div>
        <div class="reg-meta">
          ${r.documentNumber ? `<span>文号：${App.esc(r.documentNumber)}</span>` : ''}
          ${r.issuingAuthority ? `<span>${App.esc(r.issuingAuthority)}</span>` : ''}
          ${r.issueDate ? `<span>发布：${App.esc(r.issueDate)}</span>` : ''}
          ${r.effectiveDate ? `<span>施行：${App.esc(r.effectiveDate)}</span>` : ''}
          <span>${r.chapterCount} 章 / ${r.articleCount} 条</span>
        </div>
        <div style="margin-bottom:8px">
          <span class="tag ${r.country ? 'blue' : 'gray'}">🌐 ${App.esc(r.country || '未知国家')}</span>
          <span class="tag ${r.category === '法律' ? 'green' : r.category === '行政法规' ? 'amber' : ''}">${App.esc(r.category || '未分类')}</span>
          <span class="tag gray">${App.esc(r.status || '')}</span>
          ${(r.tags || []).map((t) => `<span class="tag">${App.esc(t)}</span>`).join('')}
          ${r.cleanedBy ? `<span class="tag gray">${r.cleanedBy === 'ai' ? 'AI 清洗' : '启发式清洗'}</span>` : ''}
        </div>
        <div class="reg-actions">
          <button class="btn sm primary" data-id="${r.id}" data-act="view">查看全文</button>
          ${isAdmin ? `<button class="btn sm" data-id="${r.id}" data-act="edit">编辑</button>
          <button class="btn sm danger" data-id="${r.id}" data-act="del">删除</button>` : ''}
        </div>
      </div>`).join('');

    listEl.querySelectorAll('button[data-id]').forEach((btn) => {
      const id = btn.dataset.id;
      const act = btn.dataset.act || 'view';
      if (act === 'view') btn.addEventListener('click', () => viewDetail(id));
      else if (act === 'edit') btn.addEventListener('click', () => openEditModal(id, () => { load(); App.refreshSidebar(); }));
      else if (act === 'del') btn.addEventListener('click', async () => {
        if (!confirm('确定删除该法规？索引将同步重建。')) return;
        try { await Api.del('/regulations/' + id); App.toast('已删除', 'ok'); load(); App.refreshSidebar(); } catch (e) { App.toast(e.message, 'err'); }
      });
    });
  }

  function viewDetail(id, targetArticle = '') {
    const main = document.getElementById('main');
    main.innerHTML = '<div class="empty"><div class="big">⏳</div>加载中…</div>';
    Api.get('/regulations/' + id).then(({ regulation: r }) => {
      main.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
          <button class="btn sm back-btn" id="back" style="margin-bottom:0">← 返回列表</button>
          ${App.state.user?.role === 'admin' ? `<button class="btn sm" id="edit-reg">✏️ 编辑</button>` : ''}
        </div>
        <div class="panel reg-detail">
          <h1>${App.esc(r.title)}</h1>
          <div class="meta-line">
            ${r.country ? `<span class="tag blue">🌐 ${App.esc(r.country)}</span>` : ''}
            ${r.documentNumber ? `文号：${App.esc(r.documentNumber)}　` : ''}${App.esc(r.issuingAuthority || '')}　
            发布：${App.esc(r.issueDate || '-')}　施行：${App.esc(r.effectiveDate || '-')}　
            <span class="tag">${App.esc(r.category || '')}</span><span class="tag gray">${App.esc(r.status || '')}</span>
            ${(r.tags || []).map((t) => `<span class="tag">${App.esc(t)}</span>`).join('')}
            ${r.sourceUrl ? `<span class="muted">来源：<a href="${App.esc(r.sourceUrl)}" target="_blank" rel="noreferrer">原始页面 ↗</a></span>` : ''}
          </div>
          ${(r.chapters || []).map((c, i) => `
            <details class="chapter" ${i === 0 ? 'open' : ''}>
              <summary>${App.esc(c.title || '正文')}（${c.articles.length} 条）</summary>
              <div class="articles">
                ${c.articles.map((a) => `<div class="article" data-num="${App.esc(a.num)}"><span class="num">${App.esc(a.num)}</span>${App.esc(a.text)}</div>`).join('')}
              </div>
            </details>`).join('')}
        </div>`;
      document.getElementById('back').addEventListener('click', () => App.views.library());
      const editBtn = document.getElementById('edit-reg');
      if (editBtn) editBtn.addEventListener('click', () => openEditModal(id, () => viewDetail(id)));
      main.scrollTop = 0;
      // 定位到目标法条（滚动 + 高亮）
      if (targetArticle) {
        setTimeout(() => {
          const articles = main.querySelectorAll('.article[data-num]');
          for (const el of articles) {
            if (el.dataset.num === targetArticle) {
              const chapter = el.closest('details');
              if (chapter) chapter.open = true;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('article-highlight');
              setTimeout(() => el.classList.remove('article-highlight'), 3200);
              break;
            }
          }
        }, 180);
      }
    }).catch((e) => {
      main.innerHTML = `<div class="empty"><div class="big">⚠️</div>${App.esc(e.message)}</div>`;
    });
  }

  document.getElementById('lib-search').addEventListener('input', render);
  document.getElementById('lib-cat').addEventListener('change', render);
  document.getElementById('lib-country').addEventListener('change', render);
  document.getElementById('lib-refresh').addEventListener('click', () => { load(); App.refreshSidebar(); });
  document.getElementById('lib-upload').addEventListener('click', () => openUploadModal(() => { load(); App.refreshSidebar(); }));

  if (regId) viewDetail(regId, targetArticle);
  else load();
};

// ---------- 上传入库弹窗 ----------
function openUploadModal(onCommitted) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>上传新法规入库</h3><button class="btn sm" id="um-close">✕</button></div>
      <div class="modal-body">
        <div class="steps">
          <span class="step now" id="step1">1 上传文件</span><span class="step-arrow">→</span>
          <span class="step" id="step2">2 AI 清洗</span><span class="step-arrow">→</span>
          <span class="step" id="step3">3 确认入库</span>
        </div>
        <div class="drop-zone" id="um-drop">
          <div class="big">📄</div>
          <div>点击选择或拖拽文件到此处</div>
          <div class="muted" style="font-size:12px;margin-top:6px">支持 .txt / .md / .docx / .pdf（≤30MB）</div>
          <input type="file" id="um-file" accept=".txt,.md,.markdown,.docx,.pdf" hidden />
        </div>
        <div id="um-body" class="hidden">
          <div class="meta-grid" id="um-meta"></div>
          <div class="crawl-info">正文预览（前 600 字）：</div>
          <div class="clean-preview" id="um-preview"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" id="um-cancel">取消</button>
        <button class="btn primary hidden" id="um-clean">开始清洗</button>
        <button class="btn green hidden" id="um-commit">确认入库</button>
      </div>
    </div>`;
  document.body.appendChild(mask);

  let task = null;
  const drop = mask.querySelector('#um-drop');
  const fileInput = mask.querySelector('#um-file');
  const body = mask.querySelector('#um-body');
  const metaEl = mask.querySelector('#um-meta');
  const previewEl = mask.querySelector('#um-preview');
  const cleanBtn = mask.querySelector('#um-clean');
  const commitBtn = mask.querySelector('#um-commit');
  const step = (n, done) => {
    mask.querySelectorAll('.step').forEach((el, i) => {
      el.className = 'step' + (i + 1 === n ? ' now' : done >= i + 1 ? ' done' : '');
    });
  };

  const close = () => mask.remove();
  mask.querySelector('#um-close').addEventListener('click', close);
  mask.querySelector('#um-cancel').addEventListener('click', close);
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFile(fileInput.files[0]); });

  async function handleFile(file) {
    step(1);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await Api.post('/ingest/upload', fd);
      task = data.task;
      drop.classList.add('hidden');
      body.classList.remove('hidden');
      cleanBtn.classList.remove('hidden');
      const m = task.meta || {};
      metaEl.innerHTML = `
        <div><div class="k">文件</div><div class="v">${App.esc(task.filename || '')}</div></div>
        <div><div class="k">任务 ID</div><div class="v">${task.id}</div></div>
        <div><div class="k">正文长度</div><div class="v">${task.rawCharCount ?? '?'} 字</div></div>
        ${Object.entries(m).filter(([, v]) => v).map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${App.esc(v)}</div></div>`).join('')}`;
      previewEl.textContent = task.rawTextPreview || '（无原文预览，可直接清洗）';
      App.toast('文件解析完成，共 ' + (task.rawCharCount ?? '?') + ' 字', 'ok');
    } catch (e) {
      App.toast(e.message, 'err');
    }
  }

  cleanBtn.addEventListener('click', async () => {
    step(2);
    cleanBtn.disabled = true;
    cleanBtn.innerHTML = '<span class="spin"></span> 清洗中（AI 可能需 1-2 分钟）';
    try {
      const data = await Api.post(`/ingest/tasks/${task.id}/clean`);
      task = data.task;
      cleanBtn.classList.add('hidden');
      commitBtn.classList.remove('hidden');
      const c = task.cleaned || {};
      const articles = (c.chapters || []).reduce((s, ch) => s + (ch.articles || []).length, 0);
      metaEl.innerHTML = `
        <div><div class="k">标题</div><div class="v">${App.esc(c.title || '')}</div></div>
        <div><div class="k">简称</div><div class="v">${App.esc(c.shortTitle || '')}</div></div>
        <div><div class="k">文号</div><div class="v">${App.esc(c.documentNumber || '')}</div></div>
        <div><div class="k">发布机关</div><div class="v">${App.esc(c.issuingAuthority || '')}</div></div>
        <div><div class="k">发布日期</div><div class="v">${App.esc(c.issueDate || '')}</div></div>
        <div><div class="k">施行日期</div><div class="v">${App.esc(c.effectiveDate || '')}</div></div>
        <div><div class="k">清洗方式</div><div class="v">${c._cleanedBy === 'ai' ? 'AI 清洗' : '启发式解析'}</div></div>
        <div><div class="k">结构</div><div class="v">${(c.chapters || []).length} 章 / ${articles} 条</div></div>`;
      previewEl.innerHTML = (c.chapters || []).map((ch, i) => `
        <details ${i === 0 ? 'open' : ''}><summary><b>${App.esc(ch.title || '正文')}</b>（${ch.articles.length} 条）</summary>
        ${ch.articles.slice(0, 8).map((a) => `<div style="margin:6px 0">${App.esc(a.num)}　${App.esc(a.text.slice(0, 80))}${a.text.length > 80 ? '…' : ''}</div>`).join('')}
        ${ch.articles.length > 8 ? `<div class="muted">…共 ${ch.articles.length} 条</div>` : ''}</details>`).join('');
      App.toast('清洗完成，请核对后确认入库', 'ok');
    } catch (e) {
      cleanBtn.disabled = false;
      cleanBtn.textContent = '开始清洗';
      App.toast(e.message, 'err');
    }
  });

  commitBtn.addEventListener('click', async () => {
    step(3);
    commitBtn.disabled = true;
    try {
      const data = await Api.post(`/ingest/tasks/${task.id}/commit`);
      App.toast(`入库成功：${data.regId}（共 ${data.stats.regulations} 部法规）`, 'ok');
      close();
      onCommitted && onCommitted();
    } catch (e) {
      commitBtn.disabled = false;
      App.toast(e.message, 'err');
    }
  });
}

// ---------- 编辑法规弹窗（管理员） ----------
const TAG_OPTIONS = ['药物警戒', '临床试验', '不良反应', '信号检测', '风险管理', '上市后', '注册', '生产', '经营', '疫苗', '医疗器械', '化妆品', '安全性报告', '委托管理'];

function openEditModal(regId, onSaved) {
  Api.get('/regulations/' + regId).then(({ regulation: r }) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:min(620px,94vw)">
        <div class="modal-head"><h3>✏️ 编辑法规</h3><button class="btn sm" id="ed-close">✕</button></div>
        <div class="modal-body">
          <div class="meta-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-row"><label>标题</label><input type="text" id="ed-title" value="${App.esc(r.title)}" /></div>
            <div class="form-row"><label>简称</label><input type="text" id="ed-short" value="${App.esc(r.shortTitle || '')}" /></div>
            <div class="form-row"><label>文号</label><input type="text" id="ed-docnum" value="${App.esc(r.documentNumber || '')}" /></div>
            <div class="form-row"><label>发布机关</label><input type="text" id="ed-auth" value="${App.esc(r.issuingAuthority || '')}" /></div>
            <div class="form-row"><label>发布日期</label><input type="text" id="ed-issuedate" value="${App.esc(r.issueDate || '')}" placeholder="YYYY-MM-DD" /></div>
            <div class="form-row"><label>施行日期</label><input type="text" id="ed-effectdate" value="${App.esc(r.effectiveDate || '')}" placeholder="YYYY-MM-DD" /></div>
            <div class="form-row"><label>状态</label><input type="text" id="ed-status" value="${App.esc(r.status || '')}" placeholder="现行有效" /></div>
            <div class="form-row"><label>类别</label><input type="text" id="ed-category" value="${App.esc(r.category || '')}" placeholder="法律/行政法规/部门规章/规范性文件/指导原则" /></div>
            <div class="form-row"><label>国家/地区/组织</label><input type="text" id="ed-country" value="${App.esc(r.country || '')}" placeholder="如：中国 / 美国 / 欧盟 / WHO" /></div>
          </div>
          <div class="form-row"><label>原文链接</label><input type="text" id="ed-url" value="${App.esc(r.sourceUrl || '')}" placeholder="https://…" /></div>
          <div class="form-row">
            <label>标签（可多选，也可自定义）</label>
            <div class="tag-picker" id="ed-tags"></div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <input type="text" id="ed-tag-new" placeholder="自定义标签，回车添加" style="flex:1" />
              <button class="btn sm" id="ed-tag-add">添加</button>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" id="ed-cancel">取消</button>
          <button class="btn primary" id="ed-save">保存</button>
        </div>
      </div>`;
    document.body.appendChild(mask);

    const close = () => mask.remove();
    mask.querySelector('#ed-close').addEventListener('click', close);
    mask.querySelector('#ed-cancel').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

    // 标签选择
    const tagWrap = mask.querySelector('#ed-tags');
    let tags = r.tags || [];
    function renderTags() {
      const customs = tags.filter((t) => !TAG_OPTIONS.includes(t));
      tagWrap.innerHTML = TAG_OPTIONS.map((t) =>
        `<span class="fb-tag ${tags.includes(t) ? 'active' : ''}" data-t="${App.esc(t)}">${App.esc(t)}</span>`).join('') +
        customs.map((t) =>
        `<span class="fb-tag active" data-t="${App.esc(t)}">${App.esc(t)} ✕</span>`).join('');
      tagWrap.querySelectorAll('.fb-tag').forEach((el) => {
        el.addEventListener('click', () => {
          const t = el.dataset.t;
          tags = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
          renderTags();
        });
      });
    }
    renderTags();

    const addCustomTag = () => {
      const input = mask.querySelector('#ed-tag-new');
      const v = input.value.trim();
      if (v && !tags.includes(v)) { tags = [...tags, v]; renderTags(); }
      input.value = '';
    };
    mask.querySelector('#ed-tag-add').addEventListener('click', addCustomTag);
    mask.querySelector('#ed-tag-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } });

    // 保存
    mask.querySelector('#ed-save').addEventListener('click', async () => {
      const payload = {
        title: mask.querySelector('#ed-title').value.trim(),
        shortTitle: mask.querySelector('#ed-short').value.trim(),
        documentNumber: mask.querySelector('#ed-docnum').value.trim(),
        issuingAuthority: mask.querySelector('#ed-auth').value.trim(),
        issueDate: mask.querySelector('#ed-issuedate').value.trim(),
        effectiveDate: mask.querySelector('#ed-effectdate').value.trim(),
        status: mask.querySelector('#ed-status').value.trim(),
        category: mask.querySelector('#ed-category').value.trim(),
        country: mask.querySelector('#ed-country').value.trim(),
        sourceUrl: mask.querySelector('#ed-url').value.trim(),
        tags,
      };
      try {
        await Api.patch('/regulations/' + regId, payload);
        App.toast('法规信息已更新', 'ok');
        close();
        onSaved && onSaved();
      } catch (e) { App.toast(e.message, 'err'); }
    });
  }).catch((e) => App.toast(e.message, 'err'));
}
