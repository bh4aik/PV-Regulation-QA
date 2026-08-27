// 合并后回归测试：三路路由 / 地区均衡 / 条款命中 / GCP 法规解析 / 安全校验
import { rebuildIndex } from '../server/rag/indexer.js';
import { searchRegulations, detectRegion, detectExplicitCitations, resolveExplicitCitation } from '../server/rag/qa.js';
import { getRegulation } from '../server/ingest/store.js';
import { assertSafeRegulationId, isPrivateAddress } from '../server/security.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const isCn = (r) => String(r.country || '') === '中国';
const isEu = (r) => /欧盟|European Union|EU|Europe/i.test(String(r.country || ''));

const stats = rebuildIndex();
console.log(`索引: ${stats.regulations} 部法规 / ${stats.chunks} 分块`);
check('索引 81 部', stats.regulations === 81, `(实际 ${stats.regulations})`);

// ---------- 1) 地区路由 ----------
console.log('\n[1] detectRegion 路由');
check('对比问题 → cn', detectRegion('中国和欧盟对药物警戒负责人任职要求有什么异同？') === 'cn');
check('中国单地区 → cn', detectRegion('中国的MAH药物警戒负责人具体职责有哪些？') === 'cn');
check('欧盟单地区 → eu', detectRegion('欧盟GVP对药物警戒系统主文件检查的要求是什么？') === 'eu');
check('无地区 → neutral', detectRegion('药物警戒的定义是什么？') === 'neutral');

// ---------- 2) 对比问题双侧均衡（"异同"问法必须走对比分路） ----------
console.log('\n[2] 对比问题检索双侧均衡（"异同"问法）');
const q1 = '中国和欧盟对药物警戒负责人的要求有什么异同？';
const r1 = searchRegulations(q1, 30, { diverse: false }).results;
const cn1 = r1.filter(isCn).length;
const eu1 = r1.filter(isEu).length;
console.log(`  raw30: 中国 ${cn1} / 欧盟 ${eu1}`);
check('双侧都有且接近', cn1 >= 6 && eu1 >= 6, `(cn=${cn1}, eu=${eu1})`);
check('交错合并（前6条含双侧）', r1.slice(0, 6).some(isCn) && r1.slice(0, 6).some(isEu));

// ---------- 3) 中国单地区问题命中 GVP 第二十五条 ----------
console.log('\n[3] 中国单地区问题 → GVP 第二十五条（药物警戒负责人）');
const q2 = '中国的MAH药物警戒负责人具体职责有哪些？';
const r2 = searchRegulations(q2, 30, { diverse: false }).results;
const hit25 = r2.findIndex((r) => r.articleNum === '第二十五条' && r.regTitle.includes('药物警戒质量管理规范'));
check('第二十五条进入 raw30', hit25 >= 0, `(idx=${hit25})`);
check('raw30 无欧盟混入', r2.filter(isEu).length === 0, `(eu=${r2.filter(isEu).length})`);

// ---------- 4) 欧盟单地区问题命中 GVP Module III ----------
console.log('\n[4] 欧盟单地区问题 → GVP Module III（检查）');
const q3 = '欧盟GVP对药物警戒系统检查有什么要求？';
const r3 = searchRegulations(q3, 30, { diverse: false }).results;
const hitM3 = r3.findIndex((r) => r.regTitle.includes('Module III'));
check('Module III 进入 raw30', hitM3 >= 0, `(idx=${hitM3})`);
check('raw30 无中国法规混入', r3.filter(isCn).length === 0, `(cn=${r3.filter(isCn).length})`);

// ---------- 5) 显式条款定位 ----------
console.log('\n[5] 显式条款定位（《法规》第X条）');
const cit = detectExplicitCitations('《药物警戒质量管理规范》第二十五条对药物警戒负责人有什么要求？');
check('识别到显式引用', cit.length > 0 && cit[0].regTitle === '药物警戒质量管理规范' && cit[0].articleNum === 25, JSON.stringify(cit));
const loc = resolveExplicitCitation('《药物警戒质量管理规范》第二十五条');
check('定位到具体条款', loc.mode === 'exact' && loc.results[0]?.articleNum === '第二十五条' && loc.results[0]?.regTitle.includes('药物警戒质量管理规范'), JSON.stringify(loc.mode));

// ---------- 6) GCP 法规解析（id 含中文/连字符） ----------
console.log('\n[6] GCP 法规解析（id 含中文/连字符）');
const gcp = getRegulation('药物临床试验质量管理规范-2026年修订');
check('getRegulation 解析成功', !!gcp && gcp.title?.includes('药物临床试验质量管理规范'), `(title=${gcp?.title?.slice(0, 30)})`);
check('getRegulation 拒绝非法 id', (() => { try { getRegulation('../etc/passwd'); return false; } catch { return true; } })());

// ---------- 7) 安全校验 ----------
console.log('\n[7] 安全校验');
check('assertSafeRegulationId 拒绝路径穿越', (() => { try { assertSafeRegulationId('../../etc/passwd'); return false; } catch { return true; } })());
check('assertSafeRegulationId 接受中文id', assertSafeRegulationId('药物临床试验质量管理规范-2026年修订') === '药物临床试验质量管理规范-2026年修订');
check('isPrivateAddress 拦截私网', isPrivateAddress('127.0.0.1') && isPrivateAddress('10.0.0.1') && isPrivateAddress('169.254.169.254'));
check('isPrivateAddress 放行公网', isPrivateAddress('114.116.8.210') === false && isPrivateAddress('8.8.8.8') === false);

console.log(`\n════════ 结果: ${pass} 通过 / ${fail} 失败 ════════`);
process.exit(fail ? 1 : 0);
