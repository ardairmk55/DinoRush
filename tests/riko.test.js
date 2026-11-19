// Riko diyalog çekirdeği: node --test tests/riko.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Core = require(path.join(__dirname, "..", "js", "riko-core.js"));

// Tekrarlanabilir rastgelelik (mulberry32)
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function run(trigger, n, ctx, history) {
  let h = history || Object.assign(Core.defaults(), { firstVisit: false });
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = Core.choose(trigger, h, Object.assign({ rng: ctx.rng, now: 1e12 + i }, ctx));
    if (!m) { out.push(null); continue; }
    out.push(m); h = Core.remember(h, m, 1e12 + i);
  }
  return { out, h };
}

test("60 mesajın tamamı, benzersiz kimlik 1..60, metinler korunmuş", () => {
  assert.equal(Core.messages.length, 60);
  assert.deepEqual(Core.messages.map(m => m.id), Array.from({ length: 60 }, (_, i) => i + 1));
  const t = id => Core.messages.find(m => m.id === id).text;
  assert.equal(t(1), "Selam! Ben Riko! Dinozor parkının en cesur maceracısı… En azından kendi gözümde öyleyim!");
  assert.equal(t(23), "T-Rex'in kolları neden kısa biliyor musun? Çünkü o da benim gibi oyun kumandasına uzanamıyor!");
  assert.equal(t(30), "Hazır mısın? Üç, iki, bir… Macera başlasın!");
  assert.equal(t(60), "Hey macera arkadaşım! Unutma, bu parkta yalnız değilsin. Ben Riko'yum ve seninle daha keşfedecek çok şeyimiz var!");
});

test("kategori dağılımı istenen gruplara uygun", () => {
  const count = c => Core.byCat[c].length;
  assert.deepEqual({ greeting: count("greeting"), motivation: count("motivation"), funny: count("funny"), gameplay: count("gameplay"), fossil: count("fossil"), achievement: count("achievement"), gameover: count("gameover"), idle: count("idle"), store: count("store"), settings: count("settings"), special: count("special") },
    { greeting: 8, motivation: 8, funny: 8, gameplay: 8, fossil: 6, achievement: 2, gameover: 8, idle: 4, store: 2, settings: 1, special: 5 });
});

test("ilk ziyaret: tanıtım mesajı bir kez, sonra hiç otomatik gelmez", () => {
  let h = Core.defaults();
  const first = Core.choose("menu", h, { rng: seeded(1) });
  assert.equal(first.id, 1);
  h = Core.remember(h, first);
  assert.equal(h.firstVisit, false);
  const { out } = run("menu", 200, { rng: seeded(2) }, h);
  assert.ok(out.every(m => m && m.id !== 1));
});

test("uzun aradan dönüş: 3 günden eski lastSeen ile karşılama 6", () => {
  const h = Object.assign(Core.defaults(), { firstVisit: false, lastSeen: 1e12 - Core.LONG_RETURN_MS - 1000 });
  assert.equal(Core.choose("menu", h, { now: 1e12, rng: seeded(3) }).id, 6);
  const recent = Object.assign(Core.defaults(), { firstVisit: false, lastSeen: 1e12 - 3600e3 });
  assert.notEqual(Core.choose("menu", recent, { now: 1e12, rng: () => 0.99 }).id, 6);
});

test("tekrar önleme: art arda aynı mesaj yok; büyük havuzlarda son 5 içinde tekrar yok", () => {
  for (const trig of ["click", "menu", "start", "gameover", "idle"]) {
    const { out } = run(trig, 400, { rng: seeded(trig.length * 7), best: 2000 });
    const ids = out.filter(Boolean).map(m => m.id);
    for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `${trig}: art arda tekrar`);
    if (trig === "idle") continue; // idle+motivasyon havuzu 12 mesaj; aşağıda ayrıca kontrol
    for (let i = 5; i < ids.length; i++) assert.ok(!ids.slice(i - 5, i).includes(ids[i]), `${trig}: son 5'te tekrar (${ids[i]})`);
  }
});

test("8+ mesajlık kategoride son 5 içinde tekrar olmaz", () => {
  const { out } = run("gameover", 300, { rng: seeded(11) });
  const ids = out.map(m => m.id);
  for (let i = 5; i < ids.length; i++) assert.ok(!ids.slice(i - 5, i).includes(ids[i]));
});

test("tek mesajlı kategori (ayarlar) art arda gelmez: ikinci kez null döner", () => {
  let h = Object.assign(Core.defaults(), { firstVisit: false });
  const a = Core.choose("settings", h, { rng: seeded(4) }); assert.equal(a.id, 52);
  h = Core.remember(h, a);
  assert.equal(Core.choose("settings", h, { rng: seeded(5) }), null);
});

test("özel mesajlar seyrek: tıklamaların %15'inden azı, 10'luk pencerede en fazla 1", () => {
  const { out } = run("click", 2000, { rng: seeded(9), best: 5000 });
  const ids = out.filter(Boolean).map(m => m.id);
  const special = ids.filter(id => id >= 56).length / ids.length;
  assert.ok(special > 0 && special < 0.15, `özel oranı ${special}`);
  for (let i = 0; i + 10 <= ids.length; i++) assert.ok(ids.slice(i, i + 10).filter(id => id >= 56).length <= 1);
});

test("tıklama çeşitliliği: komik ağırlıklı ama selamlama ve motivasyon da gelir", () => {
  const { out } = run("click", 600, { rng: seeded(21), best: 100 });
  const cats = out.filter(Boolean).reduce((a, m) => (a[m.cat] = (a[m.cat] || 0) + 1, a), {});
  assert.ok(cats.funny > cats.greeting && cats.greeting > 0 && cats.motivation > 0, JSON.stringify(cats));
});

test("rekor: koşu içinde 39, rekorlu oyun sonunda 40; aynı rekor mesajı art arda gelmez", () => {
  let h = Object.assign(Core.defaults(), { firstVisit: false });
  const r = Core.choose("record", h, {}); assert.equal(r.id, 39);
  h = Core.remember(h, r);
  assert.equal(Core.choose("record", h, {}), null);
  assert.equal(Core.choose("gameover", h, { record: true }).id, 40);
  assert.equal(Core.choose("gameover", h, { record: false, rng: seeded(6) }).cat, "gameover");
});

test("oyuncu tonu: katmanlar mevcut rekordan türetilir", () => {
  assert.deepEqual([0, 299, 300, 1499, 1500, 3999, 4000].map(Core.tierFor), ["new", "new", "growing", "growing", "experienced", "experienced", "pro"]);
});

test("öncelik: aktif düşük öncelikli mesajı yüksek olay keser, tersi olmaz; süre bitince her şey geçer", () => {
  const active = { priority: Core.PRIORITY.fossil, until: 5000 };
  assert.equal(Core.canInterrupt(active, "record", 1000), true);
  assert.equal(Core.canInterrupt(active, "gameover", 1000), true);
  assert.equal(Core.canInterrupt(active, "click", 1000), false);
  assert.equal(Core.canInterrupt(active, "idle", 1000), false);
  assert.equal(Core.canInterrupt(active, "idle", 6000), true);
  const P = Core.PRIORITY;
  assert.ok(P.record > P.gameover && P.gameover > P.start && P.start > P.fossil && P.fossil > P.store && P.store > P.click && P.click > P.menu && P.menu > P.idle);
});

test("fosil konuşması yalnız eşiklerde ve en az 15 sn arayla", () => {
  assert.equal(Core.fossilMilestone(9, null, 0), false);
  assert.equal(Core.fossilMilestone(10, null, 0), true);
  assert.equal(Core.fossilMilestone(25, 1, 10000), false);
  assert.equal(Core.fossilMilestone(25, 1, 16001), true);
  assert.equal(Core.fossilMilestone(200, 1, 20000), true);
  assert.equal(Core.fossilMilestone(150, 1, 20000), false);
});

test("süre: kısa ~3 sn, uzun 6–7 sn; koşu sırasında en fazla 3,5 sn", () => {
  const short = Core.messages.find(m => m.id === 20).text, long = Core.messages.find(m => m.id === 58).text;
  assert.ok(Core.durationFor(short) >= 3000 && Core.durationFor(short) <= 4000, String(Core.durationFor(short)));
  assert.ok(Core.durationFor(long) >= 6000 && Core.durationFor(long) <= 7000, String(Core.durationFor(long)));
  assert.equal(Core.durationFor(long, true), 3500);
});

test("bozuk/eksik kayıt varsayılanlara döner, bilinmeyen kimlikler atılır, en fazla 10 kayıt", () => {
  for (const raw of [null, "x", 42, [], { recentMessages: "bozuk" }, { recentMessages: [999, -1, "a", 3], lastMessageId: 777, lastSeen: "dün", firstVisit: "evet" }]) {
    const n = Core.normalize(raw);
    assert.ok(Array.isArray(n.recentMessages) && n.recentMessages.every(id => id >= 1 && id <= 60));
    assert.ok(n.lastMessageId === null || (n.lastMessageId >= 1 && n.lastMessageId <= 60));
    assert.ok(n.lastSeen === null || Number.isFinite(n.lastSeen));
  }
  assert.deepEqual(Core.normalize({ recentMessages: [999, 3] }).recentMessages, [3]);
  assert.equal(Core.normalize({ recentMessages: Array.from({ length: 30 }, (_, i) => (i % 60) + 1) }).recentMessages.length, 10);
});
