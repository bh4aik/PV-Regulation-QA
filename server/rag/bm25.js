// BM25 检索索引（k1=1.5, b=0.75），内存驻留
export class BM25Index {
  constructor() {
    this.docs = [];
    this.docFreq = new Map(); // token -> 文档数
    this.avgdl = 0;
    this.k1 = 1.5;
    this.b = 0.75;
  }

  add(doc) {
    const tokens = doc.tokens || [];
    const termFreq = new Map();
    for (const t of tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
    doc._tf = termFreq;
    doc._len = tokens.length;
    this.docs.push(doc);
  }

  finalize() {
    this.avgdl = this.docs.reduce((s, d) => s + d._len, 0) / Math.max(1, this.docs.length);
    const seen = new Map();
    for (const d of this.docs) {
      const uniq = new Set(d.tokens);
      for (const t of uniq) seen.set(t, (seen.get(t) || 0) + 1);
    }
    this.docFreq = seen;
  }

  size() {
    return this.docs.length;
  }

  search(queryTokens, topK = 8) {
    if (!this.docs.length) return [];
    const N = this.docs.length;
    const qSet = [...new Set(queryTokens)].filter((t) => this.docFreq.has(t));
    if (!qSet.length) return [];
    const idf = (t) => Math.log(1 + (N - this.docFreq.get(t) + 0.5) / (this.docFreq.get(t) + 0.5));
    const scored = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of qSet) {
        const f = d._tf.get(t) || 0;
        if (!f) continue;
        score += idf(t) * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d._len) / this.avgdl)));
      }
      if (score > 0) scored.push({ doc: d, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ doc, score }) => ({ ...doc, score: Math.round(score * 1000) / 1000 }));
  }
}
