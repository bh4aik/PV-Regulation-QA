// 文档解析：txt/md/docx/pdf → 纯文本 + 基础元数据探测
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export function detectType(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (['txt', 'md', 'markdown'].includes(ext)) return 'text';
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc') return 'doc';
  return 'unknown';
}

export async function parseBuffer(filename, buffer) {
  const type = detectType(filename);
  let text = '';
  if (type === 'text') {
    text = buffer.toString('utf-8');
  } else if (type === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (type === 'pdf') {
    let pdf;
    let timer;
    try {
      pdf = await getDocumentProxy(new Uint8Array(buffer), {
        isEvalSupported: false,
        maxImageSize: 16_777_216,
      });
      if (pdf.numPages > 1000) throw new Error('PDF 页数超过 1000 页限制');
      const { text: extracted } = await Promise.race([
        extractText(pdf, { mergePages: true }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('PDF 解析超过 60 秒限制')), 60000);
        }),
      ]);
      text = extracted || '';
    } catch (e) {
      throw new Error(`PDF 解析失败：${e.message}`);
    } finally {
      clearTimeout(timer);
      await pdf?.destroy?.();
    }
  } else if (type === 'doc') {
    throw new Error('暂不支持旧版 .doc 格式，请另存为 .docx 或 .txt 后上传');
  } else {
    throw new Error(`不支持的文件类型：${filename}`);
  }
  if (!text.trim()) throw new Error('未能从文件中提取到文本内容');
  const meta = detectMeta(text, filename);
  return { text: text.trim(), type, meta };
}

// 探测标题、文号、日期、发布机关
export function detectMeta(text, filename) {
  const meta = { title: '', documentNumber: '', issuingAuthority: '', issueDate: '', effectiveDate: '' };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length) meta.title = lines[0].slice(0, 120);
  if (filename && !meta.title) meta.title = filename.replace(/\.[^.]+$/, '');

  const numRe = /([（(]?[^\n]{0,30}?(?:令|公告|通告|通知|办法|条例|规定)[^\n]{0,40}?第?\s*\d{1,4}\s*号[）)]?)/;
  const numMatch = text.match(numRe);
  if (numMatch) meta.documentNumber = numMatch[1].slice(0, 120);

  const authRe = /(全国人民代表大会常务委员会|国务院|国家市场监督管理总局|国家药品监督管理局|国家卫生健康委员会|卫生部|国家食品药品监督管理总局|中华人民共和国主席)/;
  const authMatch = text.match(authRe);
  if (authMatch) meta.issuingAuthority = authMatch[1];

  const dateRe = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  const dates = [...text.matchAll(dateRe)].slice(0, 6).map((m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  if (dates.length >= 1) meta.issueDate = dates[0];
  if (dates.length >= 2) meta.effectiveDate = dates[1];
  return meta;
}
