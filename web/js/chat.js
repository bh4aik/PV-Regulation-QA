// 智能问答视图（含问询历史记录）
App.views.chat = function () {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-head">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div class="page-title">智能问答</div>
            <div class="page-sub">基于法规库检索增强，回答引用具体条款。示例问题：</div>
            <div>
              <span class="sample-q">药品不良反应如何报告？</span>
              <span class="sample-q">药物警戒质量管理规范对药品上市许可持有人有什么要求？</span>
              <span class="sample-q">临床试验期间 SUSAR 快速报告的时限是多少？</span>
              <span class="sample-q">药品召回分几级？</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn" id="chat-new" title="清空当前对话">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              新对话
            </button>
            <button class="btn" id="chat-history" title="查看问询历史记录">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              历史记录
              <span class="hist-badge" id="hist-count" hidden>0</span>
            </button>
          </div>
        </div>
      </div>
      <div class="chat-log" id="chat-log"></div>
      <div class="chat-input-bar">
        <textarea id="chat-input" rows="1" placeholder="请输入与药物警戒、药品安全法规相关的问题…（Enter 发送，Shift+Enter 换行）"></textarea>
        <button class="btn primary chat-send" id="chat-send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
          发送
        </button>
      </div>
    </div>`;

  const log = document.getElementById('chat-log');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  let busy = false;

  const WELCOME_HTML = `你好！我是<b>药物警戒法规问答助手</b>。我可以回答关于《药品管理法》《疫苗管理法》《药物警戒质量管理规范》《药品不良反应报告和监测管理办法》等法规，以及 CDE 发布的药物警戒/安全性相关技术指导原则的问题，回答会标注引用条款。`;

  function addWelcome() {
    const welcome = document.createElement('div');
    welcome.className = 'msg assistant';
    welcome.innerHTML = WELCOME_HTML;
    log.appendChild(welcome);
  }

  // 恢复上次的聊天记录（点引用跳转法规库后返回时，能继续阅读之前的回答）
  if (App.state.chatLogHTML) {
    log.innerHTML = App.state.chatLogHTML;
  } else {
    addWelcome();
  }

  function saveChatState() {
    App.state.chatLogHTML = log.innerHTML;
  }

  // 事件委托：引用跳转 + 反馈评分（恢复快照后依然有效）
  log.addEventListener('click', (e) => {
    // 引用法条点击 → 跳转定位 + 埋点
    const cit = e.target.closest('.citation');
    if (cit) {
      const regId = cit.dataset.regId || '';
      const regTitle = cit.dataset.regTitle || '';
      const articleNum = cit.dataset.articleNum || '';
      location.hash = `#/library/${regId}?article=${encodeURIComponent(articleNum)}`;
      Api.post('/analytics/citation-click', { regId, regTitle, articleNum, question: '' }).catch(() => {});
      return;
    }
    // 复制按钮 → 复制回答全文 + 引用法条
    const copyBtn = e.target.closest('.fb-btn[data-act="copy"]');
    if (copyBtn) {
      const wrap = copyBtn.closest('.qa-feedback');
      const citWrap = wrap.previousElementSibling;   // .citations
      const aMsg = citWrap?.previousElementSibling;  // .msg.assistant
      let content = (aMsg?.innerText || '').trim();
      const cites = citWrap ? [...citWrap.querySelectorAll('.citation')].map((c) => c.textContent.trim()) : [];
      if (cites.length) {
        content += (content ? '\n\n' : '') + '引用法条：\n' + cites.join('\n');
      }
      if (!content) { App.toast('没有可复制的内容', 'err'); return; }
      copyToClipboard(content).then(() => {
        const btn = copyBtn;
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 1500);
        App.toast('回答已复制（含引用法条）', 'ok');
      }).catch(() => App.toast('复制失败，请手动选择复制', 'err'));
      return;
    }
    // 反馈标签点击 → 切换选中
    const fbTag = e.target.closest('.fb-tag');
    if (fbTag) { fbTag.classList.toggle('active'); return; }
    // 👎 直接提交
    const fbSkip = e.target.closest('.fb-skip');
    if (fbSkip) {
      const wrap = fbSkip.closest('.qa-feedback');
      const tagBox = fbSkip.closest('.fb-tags');
      const tags = [...tagBox.querySelectorAll('.fb-tag.active')].map((x) => x.dataset.t);
      const historyId = wrap.querySelector('.fb-btn[data-r="down"]').dataset.historyId;
      tagBox.remove();
      submitRating(wrap, historyId, 'down', tags);
      return;
    }
    // 👍/👎 按钮
    const fbBtn = e.target.closest('.fb-btn');
    if (fbBtn) {
      const wrap = fbBtn.closest('.qa-feedback');
      const historyId = fbBtn.dataset.historyId;
      const rating = fbBtn.dataset.r;
      if (rating === 'up') {
        submitRating(wrap, historyId, 'up', []);
      } else {
        const existing = wrap.querySelector('.fb-tags');
        if (existing) { existing.remove(); return; }
        const tagBox = document.createElement('div');
        tagBox.className = 'fb-tags';
        tagBox.innerHTML = `
          <span class="fb-tag" data-t="答非所问">答非所问</span>
          <span class="fb-tag" data-t="引用错误">引用错误</span>
          <span class="fb-tag" data-t="不够全面">不够全面</span>
          <span class="fb-tag" data-t="内容过时">内容过时</span>
          <button class="btn sm fb-skip">直接提交</button>`;
        wrap.appendChild(tagBox);
      }
    }
  });

  function scrollBottom() {
    log.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);
  document.querySelectorAll('.sample-q').forEach((el) => {
    el.addEventListener('click', () => { input.value = el.textContent; autoGrow(); send(); });
  });

  // 新对话：清空聊天区
  document.getElementById('chat-new').addEventListener('click', () => {
    if (busy) return;
    log.innerHTML = '';
    addWelcome();
    saveChatState();
    refreshHistoryCount();
  });

  // 历史记录面板
  document.getElementById('chat-history').addEventListener('click', openHistory);
  refreshHistoryCount();

  async function refreshHistoryCount() {
    try {
      const data = await Api.get('/history?limit=500');
      const el = document.getElementById('hist-count');
      el.hidden = !data.total;
      el.textContent = data.total > 99 ? '99+' : data.total;
    } catch { /* ignore */ }
  }

  async function openHistory() {
    let data;
    try {
      data = await Api.get('/history?limit=500');
    } catch (e) {
      App.toast(e.message, 'err');
      return;
    }
    const items = data.items || [];

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:min(720px,94vw)">
        <div class="modal-head">
          <h3>🕘 问询历史（${data.total || 0} 条）</h3>
          <div style="display:flex;gap:8px;align-items:center">
            ${items.length ? '<button class="btn sm danger" id="hist-clear">清空全部</button>' : ''}
            <button class="btn sm" id="hist-close">✕</button>
          </div>
        </div>
        <div class="modal-body" style="padding:10px 14px">
          ${items.length ? '' : '<div class="empty"><div class="big">🕘</div>暂无问询记录<br/>在智能问答页提问后会自动保存</div>'}
          <div class="hist-list" id="hist-list"></div>
        </div>
      </div>`;
    document.body.appendChild(mask);

    const listEl = mask.querySelector('#hist-list');
    listEl.innerHTML = items.map((h) => `
      <div class="hist-item" data-id="${h.id}">
        <div class="hist-q">${h.fallback ? '<span class="tag amber">检索模式</span>' : ''}${App.esc(h.question)}</div>
        <div class="hist-meta">
          <span>${new Date(h.createdAt).toLocaleString('zh-CN')}</span>
          <span>${h.citationsCount ? `引用 ${h.citationsCount} 条` : ''}</span>
          <span class="hist-ans">${h.answerPreview ? App.esc(h.answerPreview) + '…' : '（仅检索结果）'}</span>
        </div>
        <div class="hist-actions">
          <button class="btn sm" data-act="view">查看</button>
          <button class="btn sm danger" data-act="del">删除</button>
        </div>
      </div>`).join('') || '';

    const close = () => mask.remove();
    mask.querySelector('#hist-close').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    if (items.length) {
      mask.querySelector('#hist-clear').addEventListener('click', async () => {
        if (!confirm('确定清空全部问询历史？')) return;
        try {
          await Api.del('/history');
          App.toast('已清空历史记录', 'ok');
          close();
          refreshHistoryCount();
        } catch (e) { App.toast(e.message, 'err'); }
      });
    }
    listEl.querySelectorAll('.hist-item').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="view"]').addEventListener('click', async () => {
        try {
          const { item } = await Api.get('/history/' + id);
          close();
          renderHistoryItem(item);
        } catch (e) { App.toast(e.message, 'err'); }
      });
      row.querySelector('[data-act="del"]').addEventListener('click', async () => {
        try {
          await Api.del('/history/' + id);
          row.remove();
          App.toast('已删除', 'ok');
          refreshHistoryCount();
        } catch (e) { App.toast(e.message, 'err'); }
      });
    });
  }

  // 在聊天区渲染一条历史问答（只读）
  function renderHistoryItem(item) {
    const uMsg = document.createElement('div');
    uMsg.className = 'msg user';
    uMsg.textContent = item.question;
    log.appendChild(uMsg);

    const aMsg = document.createElement('div');
    aMsg.className = 'msg assistant';
    aMsg.innerHTML = `<div class="hist-note">🕘 历史记录 · ${new Date(item.createdAt).toLocaleString('zh-CN')}${item.mode === 'fallback' ? ' · 检索模式' : ''}</div>`;
    if (item.answer) {
      const body = document.createElement('div');
      body.innerHTML = mdToHtml(item.answer);
      aMsg.appendChild(body);
    } else {
      aMsg.appendChild(document.createTextNode('（该次问答为检索模式，未生成 AI 回答，见下方引用条文）'));
    }
    log.appendChild(aMsg);

    if (item.citations && item.citations.length) {
      const citWrap = document.createElement('div');
      citWrap.className = 'citations';
      item.citations.forEach((r) => {
        const btn = document.createElement('button');
        btn.className = 'citation';
        btn.textContent = `《${r.regTitle}》${r.articleNum || ''}`;
        btn.title = r.chapterTitle || '';
        btn.dataset.regId = r.regId || '';
        btn.dataset.regTitle = r.regTitle || '';
        btn.dataset.articleNum = r.articleNum || '';
        citWrap.appendChild(btn);
      });
      log.appendChild(citWrap);
    }
    saveChatState();
    scrollBottom();
  }

  async function send() {
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = ''; autoGrow();
    busy = true;
    sendBtn.disabled = true;

    const uMsg = document.createElement('div');
    uMsg.className = 'msg user';
    uMsg.textContent = q;
    log.appendChild(uMsg);

    const aMsg = document.createElement('div');
    aMsg.className = 'msg assistant';
    aMsg.innerHTML = '<span class="blink"></span>';
    log.appendChild(aMsg);
    const citWrap = document.createElement('div');
    citWrap.className = 'citations';
    log.appendChild(citWrap);
    const fbWrap = document.createElement('div');
    fbWrap.className = 'qa-feedback';
    log.appendChild(fbWrap);
    scrollBottom();

    let text = '';
    const finalize = (fallbackNote) => {
      aMsg.querySelector('.blink')?.remove();
      if (fallbackNote) {
        const note = document.createElement('div');
        note.className = 'fallback-note';
        note.textContent = fallbackNote;
        aMsg.prepend(note);
      }
      busy = false;
      sendBtn.disabled = false;
      input.focus();
      saveChatState();
      refreshHistoryCount();
    };

    try {
      await Api.qa(q, {
        onMeta(results) {
          renderCitations(citWrap, results, q);
        },
        onDelta(d) {
          text += d;
          // 实时渲染 Markdown（加粗/列表/标题等），保留闪烁光标
          aMsg.innerHTML = mdToHtml(text) + '<span class="blink"></span>';
          scrollBottom();
        },
        onFallback(evt) {
          aMsg.textContent = '';
          finalize(evt.message || '当前仅展示检索结果（未配置 API Key）');
          App.refreshUser(); // 检索模式也算一次问答，同步侧栏计数
          if (evt.results && evt.results.length) {
            renderCitations(citWrap, evt.results, q);
            const detail = document.createElement('details');
            detail.className = 'clean-preview';
            detail.innerHTML = '<summary>查看检索到的条文（' + evt.results.length + ' 条）</summary>' +
              evt.results.map((r) => `<div style="margin:8px 0"><b>《${App.esc(r.regTitle)}》${App.esc(r.articleNum || '')}条</b><br/>${App.esc(r.text)}</div>`).join('');
            log.appendChild(detail);
            scrollBottom();
          }
        },
        onError(msg) {
          aMsg.innerHTML = mdToHtml(text);
          finalize(msg || '出错了');
        },
        onDone(historyId) {
          finalize();
          if (historyId) renderFeedback(fbWrap, historyId);
          App.refreshUser(); // 问答完成 → 刷新侧栏"问答 N 次"
        },
      });
    } catch (e) {
      aMsg.textContent = '';
      finalize('请求失败：' + e.message);
    }
  }

  function renderCitations(wrap, results, question = '') {
    wrap.innerHTML = '';
    const seen = new Set();
    for (const r of results) {
      const key = r.regId + '|' + r.articleNum;
      if (seen.has(key)) continue;
      seen.add(key);
      const btn = document.createElement('button');
      btn.className = 'citation';
      btn.textContent = `《${r.regTitle}》${r.articleNum || ''}`;
      btn.title = r.chapterTitle || '';
      btn.dataset.regId = r.regId || '';
      btn.dataset.regTitle = r.regTitle || '';
      btn.dataset.articleNum = r.articleNum || '';
      wrap.appendChild(btn);
    }
  }

  // 复制到剪贴板（navigator.clipboard 优先，fallback 兼容）
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  // 提交评分（事件委托调用）
  async function submitRating(wrap, historyId, rating, tags = []) {
    try {
      await Api.post('/analytics/rating', { historyId, rating, tags });
      const up = wrap.querySelector('[data-r="up"]');
      const down = wrap.querySelector('[data-r="down"]');
      const thanks = wrap.querySelector('.fb-thanks');
      if (up) up.classList.toggle('active', rating === 'up');
      if (down) down.classList.toggle('active', rating === 'down');
      if (thanks) thanks.classList.remove('hidden');
      saveChatState();
    } catch { /* 静默 */ }
  }

  // 回答反馈：👍/👎 一键评分（纯渲染，事件走委托）
  function renderFeedback(wrap, historyId) {
    wrap.innerHTML = `
      <button class="fb-btn" data-act="copy" title="复制回答与引用法条">📋</button>
      <button class="fb-btn" data-r="up" data-history-id="${historyId}" title="回答有帮助">👍</button>
      <button class="fb-btn" data-r="down" data-history-id="${historyId}" title="回答有问题">👎</button>
      <span class="fb-thanks hidden">感谢反馈！</span>`;
    saveChatState();
  }
};
