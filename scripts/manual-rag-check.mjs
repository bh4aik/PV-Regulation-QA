import { rebuildIndex } from '../server/rag/indexer.js';
import { searchRegulations } from '../server/rag/qa.js';
import { rerankCandidates } from '../server/rag/rerank.js';

rebuildIndex();
const q = '中国的MAH药物警戒负责人的具体职责有哪些？';
const { results: raw } = searchRegulations(q, 30, { diverse: false });
raw.forEach((r, i) => {
  if (r.articleNum === '第二十五条') console.log(`第二十五条在 raw30 #${i + 1}`);
});

console.log('\n=== rerank 精选 15 ===');
const final = await rerankCandidates(q, raw, { topN: 15 });
let has25 = false;
for (const r of final) {
  if (r.articleNum === '第二十五条') has25 = true;
  console.log(`  《${r.regTitle.slice(0, 35)}》${r.articleNum}`);
}
console.log('\n第二十五条入选:', has25);
