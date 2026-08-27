// 轻量 Markdown 渲染器（无依赖，支持问答回答常用语法）
// 安全策略：所有文本先 HTML 转义，再应用行内格式；链接仅允许 http(s)/# 协议

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内格式：代码、加粗、斜体、链接
function inlineMd(s) {
  let out = escHtml(s);
  // 行内代码
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // 加粗（先处理双星号）
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // 斜体（避免误伤加粗标记）
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // 链接（仅 http/https 或站内 #/ 链接）
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s()<>]+|#\/[^\s()<>]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  return out;
}

function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let listType = null; // 'ul' | 'ol'
  let listBuf = [];
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      out.push('<p>' + paraBuf.map(inlineMd).join('<br/>') + '</p>');
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      out.push('<' + tag + '>' + listBuf.map((x) => '<li>' + inlineMd(x) + '</li>').join('') + '</' + tag + '>');
      listBuf = [];
      listType = null;
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // 代码块
    if (t.startsWith('```')) {
      if (!inCode) {
        flushPara(); flushList();
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        out.push('<pre><code>' + escHtml(codeBuf.join('\n')) + '</code></pre>');
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (!t) { flushPara(); continue; } // 空行不打断列表（AI 回答的列表项间常有空行）

    // 标题
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const level = h[1].length;
      out.push('<h' + level + '>' + inlineMd(h[2]) + '</h' + level + '>');
      continue;
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara(); flushList();
      out.push('<hr/>');
      continue;
    }

    // 引用
    const quote = t.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara(); flushList();
      out.push('<blockquote>' + inlineMd(quote[1]) + '</blockquote>');
      continue;
    }

    // 无序列表
    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuf.push(ul[1]);
      continue;
    }

    // 有序列表
    const ol = t.match(/^\d{1,3}[.、)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuf.push(ol[1]);
      continue;
    }

    // 普通段落
    flushList();
    paraBuf.push(line.trim());
  }

  flushPara();
  flushList();
  if (inCode) {
    // 代码块未闭合：按代码输出
    out.push('<pre><code>' + escHtml(codeBuf.join('\n')) + '</code></pre>');
  }
  return out.join('\n');
}
