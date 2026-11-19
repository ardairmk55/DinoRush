// Tarayıcısız birim testleri: node --test tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const Core = require(path.join(ROOT, "js", "save-core.js"));
const KEY = "dinorush-save-v1";

function makeStore(initial) {
  const map = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    raw: () => map.get(KEY)
  };
}

/** config.js + save-core.js + storage.js'i sahte bir window içinde çalıştırır. */
function boot(store, opts) {
  const reduced = !!(opts && opts.reducedMotion);
  const window = {
    localStorage: store,
    matchMedia: q => ({ matches: reduced && q.includes("reduce") })
  };
  window.self = window;
  const ctx = vm.createContext({ window, self: window });
  for (const file of ["js/config.js", "js/save-core.js", "js/storage.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  const DR = window.DinoRush;
  // vm bağlamındaki diziler farklı prototipe sahip; karşılaştırma için düz kopya döndür.
  const rawGet = DR.Storage.get;
  DR.Storage.get = () => JSON.parse(JSON.stringify(rawGet()));
  return DR;
}

function catalog() {
  return JSON.parse(JSON.stringify(boot(makeStore()).Config.cosmetics));
}

test("katalog: 6 görünüm, 4 iz, 3 sahne; varsayılanlar ücretsiz, Altın en pahalı görünüm", () => {
  const c = catalog();
  assert.deepEqual(c.skins.map(s => s.id), ["fern", "amber", "midnight", "lavender", "ember", "gold"]);
  assert.deepEqual(c.trails.map(s => s.id), ["dust", "leaf", "spark", "firefly"]);
  assert.deepEqual(c.scenes.map(s => s.id), ["night", "dawn", "sunset"]);
  assert.equal(c.skins[0].cost, 0); assert.equal(c.trails[0].cost, 0); assert.equal(c.scenes[0].cost, 0);
  const max = Math.max(...c.skins.map(s => s.cost));
  assert.equal(c.skins.find(s => s.cost === max).id, "gold");
  // Her görünümün sprite dosyası diskte mevcut olmalı.
  for (const s of c.skins) assert.ok(fs.existsSync(path.join(ROOT, s.sheet)), s.sheet);
});

test("boş kayıt: varsayılan alanlar", () => {
  const DR = boot(makeStore());
  const d = DR.Storage.get();
  assert.equal(d.best, 0); assert.equal(d.fossils, 0);
  assert.deepEqual(d.owned, ["fern"]); assert.equal(d.selected, "fern");
  assert.deepEqual(d.ownedTrails, ["dust"]); assert.equal(d.selectedTrail, "dust");
  assert.deepEqual(d.ownedScenes, ["night"]); assert.equal(d.selectedScene, "night");
  assert.equal(d.scanlines, false); assert.equal(d.screenShake, true); assert.equal(d.flash, true);
  assert.equal(d.saveVersion, 3);
});

test("eski (v1) kayıt migrasyonu: alanlar korunur, lagoon -> midnight, yeni alanlar eklenir", () => {
  const legacy = { best: 4210, fossils: 37, sound: false, vibration: true, lowEffects: true, owned: ["fern", "amber", "lagoon", "ember"], selected: "lagoon" };
  const store = makeStore(JSON.stringify(legacy));
  const DR = boot(store);
  const d = DR.Storage.get();
  assert.equal(d.best, 4210);
  assert.equal(d.fossils, 37);
  assert.equal(d.sound, false); assert.equal(d.vibration, true); assert.equal(d.lowEffects, true);
  assert.deepEqual(d.owned, ["fern", "amber", "midnight", "ember"]);
  assert.equal(d.selected, "midnight");
  assert.deepEqual(d.ownedTrails, ["dust"]); assert.equal(d.selectedTrail, "dust");
  assert.deepEqual(d.ownedScenes, ["night"]); assert.equal(d.selectedScene, "night");
  assert.equal(d.masterVolume, 80); assert.equal(d.sfxVolume, 80); assert.equal(d.playTime, 0);
  // Yükleme tek başına kaydı yazmaz; ilk değişiklikte yeni biçim aynı anahtara yazılır.
  DR.Storage.addFossils(1);
  const written = JSON.parse(store.raw());
  assert.equal(written.fossils, 38);
  assert.deepEqual(written.owned, ["fern", "amber", "midnight", "ember"]);
  assert.equal(written.saveVersion, 3);
});

test("bozuk/yanlış tipli kayıt çökmez ve güvenli değerlere döner", () => {
  for (const raw of ["{bozuk json", "null", "[]", "42", JSON.stringify({ best: "abc", fossils: -5, owned: "fern", selected: "yok", ownedTrails: [null, "leaf", "leaf", "x"], selectedTrail: "leaf", masterVolume: 400, sfxVolume: -3 })]) {
    const d = boot(makeStore(raw)).Storage.get();
    assert.ok(Number.isInteger(d.best) && d.best >= 0);
    assert.ok(Number.isInteger(d.fossils) && d.fossils >= 0);
    assert.ok(d.owned.includes("fern"));
    assert.ok(d.owned.includes(d.selected));
    assert.ok(d.masterVolume >= 0 && d.masterVolume <= 100);
    assert.ok(d.sfxVolume >= 0 && d.sfxVolume <= 100);
    assert.equal(new Set(d.ownedTrails).size, d.ownedTrails.length);
  }
  const d = boot(makeStore(JSON.stringify({ ownedTrails: ["leaf", "leaf"], selectedTrail: "leaf", masterVolume: 400 }))).Storage.get();
  assert.deepEqual(d.ownedTrails, ["dust", "leaf"]);
  assert.equal(d.selectedTrail, "leaf");
  assert.equal(d.masterVolume, 100);
});

test("satın alma: bakiye düşer, öğe sahip olunur ama otomatik kuşanılmaz", () => {
  const store = makeStore(JSON.stringify({ fossils: 300 }));
  const DR = boot(store);
  assert.equal(DR.Storage.state("skin", "midnight").state, "buy");
  const r = DR.Storage.buy("skin", "midnight");
  assert.equal(r.ok, true); assert.equal(r.spent, 200);
  const d = DR.Storage.get();
  assert.equal(d.fossils, 100);
  assert.ok(d.owned.includes("midnight"));
  assert.equal(d.selected, "fern");
  assert.equal(DR.Storage.state("skin", "midnight").state, "owned");
  assert.equal(JSON.parse(store.raw()).fossils, 100);
  // Aynı öğe ikinci kez satın alınamaz, bakiye değişmez.
  const again = DR.Storage.buy("skin", "midnight");
  assert.equal(again.ok, false); assert.equal(again.reason, "owned");
  assert.equal(DR.Storage.get().fossils, 100);
});

test("yetersiz bakiye: reddedilir, eksik miktar raporlanır, kayıt değişmez", () => {
  const store = makeStore(JSON.stringify({ fossils: 20 }));
  const DR = boot(store);
  const st = DR.Storage.state("trail", "spark");
  assert.equal(st.state, "locked"); assert.equal(st.missing, 280);
  const before = store.raw();
  const r = DR.Storage.buy("trail", "spark");
  assert.equal(r.ok, false); assert.equal(r.reason, "insufficient"); assert.equal(r.missing, 280);
  assert.equal(DR.Storage.get().fossils, 20);
  assert.ok(!DR.Storage.get().ownedTrails.includes("spark"));
  assert.equal(store.raw(), before);
  // Sınır: bakiye tam fiyata eşitse alınabilir ve sıfıra iner.
  const exact = boot(makeStore(JSON.stringify({ fossils: 90 })));
  assert.equal(exact.Storage.buy("trail", "leaf").ok, true);
  assert.equal(exact.Storage.get().fossils, 0);
});

test("kuşanma: yalnızca sahip olunan öğe; seçim yeniden yüklemede kalıcı", () => {
  const store = makeStore(JSON.stringify({ fossils: 3000 }));
  let DR = boot(store);
  assert.equal(DR.Storage.equip("skin", "gold").ok, false);
  assert.equal(DR.Storage.equip("skin", "gold").reason, "not_owned");
  assert.equal(DR.Storage.buy("skin", "gold").ok, true);
  assert.equal(DR.Storage.buy("trail", "firefly").ok, true);
  assert.equal(DR.Storage.buy("scene", "sunset").ok, true);
  assert.equal(DR.Storage.equip("skin", "gold").ok, true);
  assert.equal(DR.Storage.equip("trail", "firefly").ok, true);
  assert.equal(DR.Storage.equip("scene", "sunset").ok, true);
  assert.equal(DR.Storage.state("skin", "gold").state, "selected");
  // Sayfa yeniden açılmış gibi: aynı depodan yeni örnek.
  DR = boot(store);
  const d = DR.Storage.get();
  assert.equal(d.selected, "gold"); assert.equal(d.selectedTrail, "firefly"); assert.equal(d.selectedScene, "sunset");
  assert.equal(d.fossils, 3000 - 1200 - 700 - 400);
});

test("eski API buySkin/selectSkin çalışmaya devam eder", () => {
  const DR = boot(makeStore(JSON.stringify({ fossils: 100 })));
  assert.equal(DR.Storage.buySkin("amber"), true);
  assert.equal(DR.Storage.get().selected, "amber");
  assert.equal(DR.Storage.selectSkin("fern"), true);
  assert.equal(DR.Storage.selectSkin("gold"), false);
});

test("ilerlemeyi sıfırla: skor, fosil, satın alımlar ve süre silinir; ayarlar korunur", () => {
  const store = makeStore(JSON.stringify({ best: 999, fossils: 300, owned: ["fern", "gold"], selected: "gold", sound: false, masterVolume: 35, scanlines: true, playTime: 1234 }));
  const DR = boot(store);
  DR.Storage.resetProgress();
  const d = DR.Storage.get();
  assert.equal(d.best, 0); assert.equal(d.fossils, 0); assert.equal(d.playTime, 0);
  assert.deepEqual(d.owned, ["fern"]); assert.equal(d.selected, "fern");
  assert.equal(d.sound, false); assert.equal(d.masterVolume, 35); assert.equal(d.scanlines, true);
  assert.equal(JSON.parse(store.raw()).best, 0);
});

test("prefers-reduced-motion: sarsıntı ve flaş kapalı başlar, kayıtlı tercih öncelikli", () => {
  assert.equal(boot(makeStore(), { reducedMotion: true }).Storage.get().screenShake, false);
  assert.equal(boot(makeStore(), { reducedMotion: true }).Storage.get().flash, false);
  const explicit = boot(makeStore(JSON.stringify({ screenShake: true })), { reducedMotion: true }).Storage.get();
  assert.equal(explicit.screenShake, true);
});

test("localStorage erişilemezse oyun bellekte çalışır", () => {
  const broken = { getItem() { throw new Error("engelli"); }, setItem() { throw new Error("engelli"); } };
  const DR = boot(broken);
  assert.equal(DR.Storage.get().fossils, 0);
  DR.Storage.addFossils(3);
  assert.equal(DR.Storage.get().fossils, 3);
  assert.equal(DR.Storage.save(), false);
});

test("oynama süresi birikir ve kalıcıdır", () => {
  const store = makeStore();
  let DR = boot(store);
  DR.Storage.addPlayTime(12.5); DR.Storage.addPlayTime(-4); DR.Storage.addPlayTime(NaN);
  DR = boot(store);
  assert.equal(DR.Storage.get().playTime, 12.5);
});

test("SaveCore saf: buy girdi kaydını değiştirmez", () => {
  const c = catalog();
  const d = Core.normalize({ fossils: 150 }, c);
  const snapshot = JSON.stringify(d);
  const r = Core.buy(d, c, "skin", "amber");
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(d), snapshot);
  assert.equal(Core.buy(d, c, "skin", "yok").reason, "unknown");
});

test("müzik ayarları: v2 musicVolume menü ve oyun müziğine taşınır, bozuk değer sınırlanır, yenilemede ve sıfırlamada korunur", () => {
  const d = boot(makeStore(JSON.stringify({ best: 50, masterVolume: 40, musicVolume: 55 }))).Storage.get();
  assert.equal(d.music, true); assert.equal(d.menuMusicVolume, 55); assert.equal(d.gameMusicVolume, 55); assert.equal(d.masterVolume, 40);
  assert.equal("musicVolume" in d, false);
  const fresh = boot(makeStore()).Storage.get();
  assert.equal(fresh.menuMusicVolume, 70); assert.equal(fresh.gameMusicVolume, 70);
  assert.equal(boot(makeStore(JSON.stringify({ menuMusicVolume: 250 }))).Storage.get().menuMusicVolume, 100);
  assert.equal(boot(makeStore(JSON.stringify({ gameMusicVolume: "abc" }))).Storage.get().gameMusicVolume, 0);
  const store = makeStore();
  boot(store).Storage.update({ music: false, menuMusicVolume: 35, gameMusicVolume: 15 });
  const b = boot(store).Storage.get();
  assert.equal(b.music, false); assert.equal(b.menuMusicVolume, 35); assert.equal(b.gameMusicVolume, 15);
  const after = boot(store); after.Storage.resetProgress();
  assert.equal(after.Storage.get().menuMusicVolume, 35); assert.equal(after.Storage.get().gameMusicVolume, 15);
});

test("görüntü ayarları: parçacık, performans, animasyon azaltma; varsayılanlar ve kalıcılık", () => {
  const d = boot(makeStore()).Storage.get();
  assert.equal(d.particles, true); assert.equal(d.performance, false); assert.equal(d.reduceMotion, false);
  assert.equal(boot(makeStore(), { reducedMotion: true }).Storage.get().reduceMotion, true);
  const store = makeStore();
  boot(store).Storage.update({ particles: false, performance: true, reduceMotion: true });
  const b = boot(store).Storage.get();
  assert.deepEqual([b.particles, b.performance, b.reduceMotion], [false, true, true]);
  assert.equal(boot(makeStore(JSON.stringify({ particles: "evet" }))).Storage.get().particles, true);
});

test("ekonomi: her kozmetiğin nadirliği var ve fiyatı nadirlik aralığında; ücretsiz yalnız varsayılanlar", () => {
  const c = catalog(), ranges = { starter: [80, 120], standard: [150, 250], rare: [300, 500], epic: [600, 900], legendary: [1000, 1500] };
  for (const list of ["skins", "trails", "scenes", "accessories"]) {
    c[list].forEach((item, i) => {
      assert.ok(ranges[item.rarity], list + "/" + item.id + " nadirlik");
      if (item.cost === 0) { assert.equal(i, 0, list + "/" + item.id + " ücretsiz ama varsayılan değil"); return; }
      const [lo, hi] = ranges[item.rarity];
      assert.ok(item.cost >= lo && item.cost <= hi, list + "/" + item.id + " " + item.cost + " " + item.rarity + " aralığında değil");
    });
  }
  assert.equal(c.accessories.length, 17);
  assert.deepEqual([...new Set(c.accessories.map(a => a.slot))].sort(), ["face", "gear", "head"]);
});

test("aksesuar: bağımsız satın alma, yuva başına tek, farklı yuvalar birlikte, çıkarma, kalıcılık", () => {
  const store = makeStore(JSON.stringify({ fossils: 5000 }));
  let DR = boot(store);
  assert.deepEqual(DR.Storage.get().accessories, { head: null, face: null, gear: null });
  assert.equal(DR.Storage.state("accessory", "gold-crown").state, "buy");
  assert.equal(DR.Storage.equip("accessory", "gold-crown").reason, "not_owned");
  for (const id of ["gold-crown", "explorer-hat", "sunglasses", "backpack"]) assert.equal(DR.Storage.buy("accessory", id).ok, true, id);
  assert.equal(DR.Storage.buy("accessory", "gold-crown").reason, "owned");
  assert.equal(DR.Storage.get().fossils, 5000 - 1400 - 120 - 160 - 220);
  DR.Storage.equip("accessory", "gold-crown"); DR.Storage.equip("accessory", "sunglasses"); DR.Storage.equip("accessory", "backpack");
  assert.deepEqual(DR.Storage.get().accessories, { head: "gold-crown", face: "sunglasses", gear: "backpack" });
  DR.Storage.equip("accessory", "explorer-hat"); // aynı yuva: taç çıkar
  assert.equal(DR.Storage.get().accessories.head, "explorer-hat");
  assert.equal(DR.Storage.state("accessory", "gold-crown").state, "owned");
  assert.equal(DR.Storage.state("accessory", "explorer-hat").state, "selected");
  assert.equal(DR.Storage.unequip("accessory", "sunglasses").ok, true);
  assert.equal(DR.Storage.unequip("accessory", "sunglasses").reason, "not_equipped");
  assert.equal(DR.Storage.unequip("skin", "fern").reason, "unsupported");
  DR = boot(store);
  assert.deepEqual(DR.Storage.get().accessories, { head: "explorer-hat", face: null, gear: "backpack" });
  assert.deepEqual(DR.Storage.get().ownedAccessories.slice().sort(), ["backpack", "explorer-hat", "gold-crown", "sunglasses"]);
  DR.Storage.resetProgress();
  assert.deepEqual(DR.Storage.get().ownedAccessories, []); assert.deepEqual(DR.Storage.get().accessories, { head: null, face: null, gear: null });
});

test("aksesuar kaydı bozuksa güvenli: bilinmeyen, sahip olunmayan ve yanlış yuva temizlenir", () => {
  const d = boot(makeStore(JSON.stringify({ ownedAccessories: ["x", "sunglasses", "sunglasses", 7], accessories: { head: "sunglasses", face: "sunglasses", gear: "backpack" } }))).Storage.get();
  assert.deepEqual(d.ownedAccessories, ["sunglasses"]);
  assert.deepEqual(d.accessories, { head: null, face: "sunglasses", gear: null });
  assert.deepEqual(boot(makeStore(JSON.stringify({ accessories: "bozuk" }))).Storage.get().accessories, { head: null, face: null, gear: null });
});

test("v2 kaydı v3 sürümüne taşınır: sahip olunanlar, bakiye ve seçimler korunur", () => {
  const v2 = { saveVersion: 2, best: 2400, fossils: 37, owned: ["fern", "amber", "gold"], selected: "gold", ownedTrails: ["dust", "spark"], selectedTrail: "spark", ownedScenes: ["night", "dawn"], selectedScene: "dawn", music: true, musicVolume: 40, playTime: 99 };
  const d = boot(makeStore(JSON.stringify(v2))).Storage.get();
  assert.equal(d.saveVersion, 3); assert.equal(d.fossils, 37); assert.equal(d.best, 2400);
  assert.deepEqual(d.owned, ["fern", "amber", "gold"]); assert.equal(d.selected, "gold");
  assert.equal(d.selectedTrail, "spark"); assert.equal(d.selectedScene, "dawn");
  assert.equal(d.menuMusicVolume, 40); assert.deepEqual(d.ownedAccessories, []);
});

test("kayıt durumu ve tam silme: savedAt yazılır; wipeAll iki anahtarı siler ve varsayılana döner", () => {
  const store = makeStore(JSON.stringify({ fossils: 10, masterVolume: 20 }));
  store.setItem("dinorush-riko-v1", "{}");
  const DR = boot(store);
  DR.Storage.addFossils(1);
  const st = DR.Storage.status();
  assert.equal(st.ok, true); assert.ok(st.savedAt > 0); assert.ok(st.bytes > 50);
  DR.Storage.wipeAll(["dinorush-riko-v1"]);
  assert.equal(store.getItem("dinorush-riko-v1"), null);
  assert.equal(DR.Storage.get().fossils, 0); assert.equal(DR.Storage.get().masterVolume, 80);
  const broken = boot({ getItem() { return null; }, setItem() { throw new Error("dolu"); } });
  broken.Storage.addFossils(1);
  assert.equal(broken.Storage.status().ok, false);
});
