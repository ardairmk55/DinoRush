// İlerleme çekirdeği: node --test tests/progress.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const P = require(path.join(__dirname, "..", "js", "progress-core.js"));
const R = { nearMissPx: 12, nearMissFossils: 2, chainMax: 5, chainPerLevel: 2, scorePer: 100, recordBonus: 25, dailyBase: 10, dailyCap: 7 };
const catalog = { accessories: [
  { id: "a", slot: "head" }, { id: "b", slot: "head" }, { id: "c", slot: "head" }, { id: "d", slot: "head" }, { id: "e", slot: "head" }, { id: "f", slot: "head" }, { id: "g", slot: "face" }
] };
const base = () => ({ best: 0, fossils: 0, stats: P.emptyStats(), achievements: {}, daily: { last: null, streak: 0, best: 0 }, ownedAccessories: [], accessories: { head: null, face: null, gear: null } });
const run = o => Object.assign({ score: 0, fossils: 0, bonusFossils: 0, nearMisses: 0, chains: 0, maxChain: 0, pterosDodged: 0, jumps: 0, duration: 10, death: "log", record: false }, o);

test("başarım listesi: benzersiz kimlik, pozitif hedef ve ödül", () => {
  const ids = P.ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(P.ACHIEVEMENTS.length >= 20);
  for (const a of P.ACHIEVEMENTS) assert.ok(a.target > 0 && a.reward > 0, a.id);
});

test("koşu sonu: istatistik birikir, skor ve rekor bonusu bakiyeye eklenir", () => {
  const s = Object.assign(base(), { best: 1234, fossils: 50 });
  const r = P.applyRun(s, catalog, run({ score: 1234, fossils: 30, bonusFossils: 6, nearMissFossils: 4, chainFossils: 2, nearMisses: 2, chains: 1, maxChain: 1, pterosDodged: 3, jumps: 20, duration: 42.5, death: "flyer", record: true }), { rewards: R, now: Date.UTC(2026, 10, 20, 12), today: "2026-11-20" });
  const st = r.save.stats;
  assert.equal(st.runs, 1); assert.equal(st.totalScore, 1234); assert.equal(st.nearMisses, 2); assert.equal(st.pterosDodged, 3);
  assert.equal(st.deaths.flyer, 1); assert.equal(st.longestRun, 42.5); assert.equal(st.bestRunFossils, 30);
  assert.equal(r.breakdown.score, 12); assert.equal(r.breakdown.record, 25); assert.equal(r.breakdown.daily, 10);
  // bakiye: başlangıç 50 + skor 12 + rekor 25 + günlük 10 + başarım ödülleri (koşu içi fosiller çağıranda eklenir)
  assert.equal(r.save.fossils, 50 + 12 + 25 + 10 + r.breakdown.achievements);
  assert.equal(r.breakdown.total, 30 + 6 + 12 + 25 + 10 + r.breakdown.achievements);
  assert.equal(s.stats.runs, 0, "girdi değişmez");
});

test("başarımlar: koşul sağlanınca bir kez açılır, ödül bir kez verilir", () => {
  const s = Object.assign(base(), { best: 600 });
  let r = P.applyRun(s, catalog, run({ score: 600, nearMisses: 1 }), { rewards: R, today: "2026-11-20" });
  const ids = r.unlocked.map(a => a.id);
  assert.ok(ids.includes("first-run") && ids.includes("score-500") && ids.includes("near-miss-1"), ids.join(","));
  assert.ok(!ids.includes("score-1000"));
  assert.equal(r.breakdown.achievements, 10 + 20 + 10);
  r = P.applyRun(r.save, catalog, run({ score: 10 }), { rewards: R, today: "2026-11-20" });
  assert.ok(!r.unlocked.some(a => a.id === "first-run" || a.id === "score-500"));
});

test("aksesuar başarımları koşu dışında da açılır (unlock)", () => {
  const s = Object.assign(base(), { ownedAccessories: ["a", "b", "c", "d", "e", "f"], accessories: { head: "a", face: "g", gear: "x" } });
  const r = P.unlock(s, catalog, 1);
  assert.deepEqual(r.unlocked.map(a => a.id).sort(), ["fashion", "hat-collector"]);
  assert.equal(r.save.fossils, 130);
  assert.equal(P.unlock(r.save, catalog, 2).unlocked.length, 0);
});

test("günlük seri: art arda günler artar, gün atlanınca 1'e döner, günde bir ödül", () => {
  let r = P.dailyRun({ last: null, streak: 0, best: 0 }, "2026-11-18", R); assert.deepEqual([r.daily.streak, r.bonus, r.first], [1, 10, true]);
  r = P.dailyRun(r.daily, "2026-11-18", R); assert.deepEqual([r.daily.streak, r.bonus, r.first], [1, 0, false]);
  r = P.dailyRun(r.daily, "2026-11-19", R); assert.deepEqual([r.daily.streak, r.bonus], [2, 20]);
  r = P.dailyRun(r.daily, "2026-11-20", R); assert.equal(r.daily.streak, 3);
  r = P.dailyRun(r.daily, "2026-11-23", R); assert.deepEqual([r.daily.streak, r.daily.best, r.bonus], [1, 3, 10]);
  assert.equal(P.dailyRun({ last: "2026-01-01", streak: 20, best: 20 }, "2026-01-02", R).bonus, 70, "ödül 7 günde tavan yapar");
  assert.equal(P.dayDiff("2026-03-28", "2026-03-30"), 2, "yaz saati değişimi günü saymaz");
  assert.equal(P.dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("bozuk ilerleme kaydı güvenli değerlere döner", () => {
  const st = P.normalizeStats({ runs: -4, totalScore: "x", deaths: { log: 3, foo: 9 }, longestRun: "12.5" });
  assert.equal(st.runs, 0); assert.equal(st.totalScore, 0); assert.equal(st.deaths.log, 3); assert.equal(st.longestRun, 12.5); assert.ok(!("foo" in st.deaths));
  assert.deepEqual(P.normalizeAchievements({ "first-run": 5, "yok": 9, "score-500": "abc" }), { "first-run": 5 });
  assert.deepEqual(P.normalizeDaily({ last: "dün", streak: -2 }), { last: null, streak: 0, best: 0 });
});

test("ilerleme listesi: değer hedefle sınırlı, açılma zamanı görünür", () => {
  const s = Object.assign(base(), { best: 700, achievements: { "score-500": 99 } });
  const p = P.progress(s, catalog);
  const a = p.find(x => x.id === "score-500"), b = p.find(x => x.id === "score-1000");
  assert.equal(a.unlockedAt, 99); assert.equal(a.value, 500);
  assert.equal(b.unlockedAt, null); assert.equal(b.value, 700); assert.equal(b.target, 1000);
});

test("zincir ödülü seviyeyle artar ve tavanda durur", () => {
  assert.deepEqual([1, 2, 3, 5, 9].map(l => P.chainReward(l, R)), [2, 4, 6, 10, 10]);
});
