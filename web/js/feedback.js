// 反馈功能：所有用户可提交反馈（问题/功能建议），查看自己的反馈
App.openFeedback = function () {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:min(640px,94vw)">
      <div class="modal-head"><h3>💬 意见反馈</h3><button class="btn sm" id="fb-close">✕</button></div>
      <div class="modal-body">
        <div class="form-row">
          <label>反馈类型</label>
          <select id="fb-type" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px">
            <option value="bug">问题反馈</option>
            <option value="feature">功能建议</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="form-row">
          <label>反馈内容（请描述你遇到的问题，或希望增加的功能）</label>
          <textarea id="fb-content" rows="5" placeholder="例如：希望增加法规打印导出功能…" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;resize:vertical"></textarea>
        </div>
        <div class="form-row">
          <label>联系方式（选填，方便我们回复你）</label>
          <input type="text" id="fb-contact" placeholder="邮箱 / 微信 / 手机号" />
        </div>
        <button class="btn primary" id="fb-submit" style="margin-top:4px">提交反馈</button>
        <div class="login-msg" id="fb-msg"></div>
        <hr style="margin:16px 0;border:none;border-top:1px solid var(--border)" />
        <h4 style="font-size:14px;margin-bottom:10px">我的反馈记录</h4>
        <div id="fb-mine" class="fb-list"></div>
      </div>
    </div>`;
  document.body.appendChild(mask);

  const close = () => mask.remove();
  mask.querySelector('#fb-close').addEventListener('click', close);
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

  const msgEl = mask.querySelector('#fb-msg');
  mask.querySelector('#fb-submit').addEventListener('click', async () => {
    const content = mask.querySelector('#fb-content').value.trim();
    if (!content) { msgEl.textContent = '请输入反馈内容'; msgEl.style.color = 'var(--red)'; return; }
    const payload = {
      type: mask.querySelector('#fb-type').value,
      content,
      contact: mask.querySelector('#fb-contact').value.trim(),
    };
    try {
      await Api.post('/feedback', payload);
      msgEl.textContent = '✅ 反馈已提交，感谢！';
      msgEl.style.color = 'var(--green)';
      mask.querySelector('#fb-content').value = '';
      mask.querySelector('#fb-contact').value = '';
      loadMine();
    } catch (e) {
      msgEl.textContent = e.message;
      msgEl.style.color = 'var(--red)';
    }
  });

  const statusText = { pending: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭' };
  const statusTag = { pending: 'amber', processing: 'blue', resolved: 'green', closed: 'gray' };

  async function loadMine() {
    const el = mask.querySelector('#fb-mine');
    try {
      const { feedbacks } = await Api.get('/feedback/mine');
      if (!feedbacks.length) {
        el.innerHTML = '<div class="muted" style="font-size:12.5px">暂无反馈记录</div>';
        return;
      }
      el.innerHTML = feedbacks.map((f) => `
        <div class="fb-item">
          <div class="fb-item-head">
            <span class="tag ${statusTag[f.status] || 'gray'}">${statusText[f.status] || f.status}</span>
            <span class="tag gray">${f.type === 'bug' ? '问题' : f.type === 'feature' ? '建议' : '其他'}</span>
            <span class="muted" style="font-size:11.5px;margin-left:auto">${new Date(f.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <div class="fb-item-body">${App.esc(f.content)}</div>
          ${f.adminNote ? `<div class="fb-note">💬 管理员回复：${App.esc(f.adminNote)}</div>` : ''}
        </div>`).join('');
    } catch (e) {
      el.innerHTML = `<div class="muted">加载失败：${App.esc(e.message)}</div>`;
    }
  }
  loadMine();
};
