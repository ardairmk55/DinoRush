// Pterosaur ve çarpışma kuralları: node --test tests/rules.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const R = require(path.join(ROOT, "js", "rules.js"));
function loadConfig() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8"), { window });
  return JSON.parse(JSON.stringify(window.DinoRush.Config));
}
const C = loadConfig();
const P = C.physics;
const GROUND = 300;
const DT = P.step;

function pterosaur(lane, x) {
  const s = R.pteroSize(C);
  return { type: "flyer", lane, x, y: R.pteroY(lane, GROUND, C), w: s.w, h: s.h };
}

/**
 * Oyunun güncelleme sırasını taklit eder: action = "none" | "duck" | {jumpAt: saniye, hold: bool}.
 * Pterosaur dinonun önünden tamamen geçene kadar simüle eder; çarpışma olursa true döner.
 */
function run(lane, speed, action) {
  const p = { x: P.playerX, y: GROUND, vy: 0, duck: action === "duck", prep: 0, held: false, hold: 0 };
  const o = pterosaur(lane, P.playerX + 420);
  for (let t = 0; t < 4; t += DT) {
    if (action && action.jumpAt !== undefined && Math.abs(t - action.jumpAt) < DT / 2 && p.y >= GROUND - 1) {
      p.prep = P.jumpPrep; p.held = !!action.hold; p.hold = 0;
    }
    if (p.prep > 0) { p.prep -= DT; if (p.prep <= 0) p.vy = P.jumpVelocity; }
    else if (p.y < GROUND || p.vy < 0) {
      const holding = p.held && p.vy < 0 && p.hold < P.jumpHoldMax, g = holding ? P.jumpHoldGravity : P.gravity;
      p.y += p.vy * DT; p.vy += g * DT; if (holding) p.hold += DT;
      if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.held = false; }
    }
    o.x -= speed * C.ptero.speedFactor * DT;
    if (R.collide(R.playerBox(p, C), R.obstacleBox(o, C))) return true;
    if (o.x + o.w < P.playerX - 10) return false;
  }
  return false;
}

/** Zıplama anlarını tarar; çarpışmasız zıplama penceresinin genişliğini (saniye) döndürür. */
function jumpWindow(lane, speed, hold) {
  let ok = 0;
  for (let t = 0; t < 1.5; t += DT) if (!run(lane, speed, { jumpAt: t, hold })) ok += DT;
  return ok;
}

const SPEEDS = [P.runSpeed, P.maxSpeed];

test("pterosaur sabit boyutlu ve eskisinden küçük", () => {
  const s = R.pteroSize(C);
  // Eski tasarım dinonun önüne gelirken 1.16 ölçeğe kadar büyüyordu (93 x 60 birim).
  assert.ok(s.w < 40 * 2 * 1.16 && s.h < 26 * 2 * 1.16, `${s.w}x${s.h}`);
  assert.equal(s.w, 40 * 2 * C.ptero.scale);
});

test("alçak şerit: beklemek ve eğilmek çarpar, zıplamak kurtarır (her hızda)", () => {
  for (const v of SPEEDS) {
    assert.equal(run("low", v, "none"), true, `bekleme v=${v}`);
    assert.equal(run("low", v, "duck"), true, `eğilme v=${v}`);
    const w = jumpWindow("low", v, false);
    assert.ok(w >= 0.1, `kısa zıplama penceresi v=${v}: ${w.toFixed(3)} sn`);
  }
});

test("yüksek şerit: ayakta çarpar, eğilmek her hızda kurtarır", () => {
  for (const v of SPEEDS) {
    assert.equal(run("high", v, "none"), true, `bekleme v=${v}`);
    assert.equal(run("high", v, "duck"), false, `eğilme v=${v}`);
  }
});

test("yüksek şerit kutusu eğilmiş dinonun üstünde güvenli boşluk bırakır", () => {
  const o = R.obstacleBox(pterosaur("high", P.playerX), C);
  const duck = R.playerBox({ x: P.playerX, y: GROUND, duck: true }, C);
  const stand = R.playerBox({ x: P.playerX, y: GROUND, duck: false }, C);
  const bottom = o.y + o.h;
  assert.ok(duck.y - bottom >= 8, `eğilme boşluğu ${duck.y - bottom}`);
  assert.ok(bottom - stand.y >= 8, `ayakta örtüşme ${bottom - stand.y}`);
});

test("alçak şerit eğilmiş dinoya da çarpar (eğilerek kaçılamaz, karışıklık yok)", () => {
  const o = R.obstacleBox(pterosaur("low", P.playerX), C);
  const duck = R.playerBox({ x: P.playerX, y: GROUND, duck: true }, C);
  assert.ok(o.y + o.h > duck.y + 3);
});

test("zıplama hazırlık gecikmesi en fazla 2 sabit adım (~33 ms)", () => {
  let prep = P.jumpPrep, steps = 0;
  while (prep > 0) { prep -= DT; steps++; }
  assert.ok(steps <= 2, `${steps} adım`);
});

test("şerit seçimi skora göre kademeli", () => {
  assert.equal(R.pteroAllowed(C.ptero.minScore - 1, C), false);
  assert.equal(R.pteroAllowed(C.ptero.minScore, C), true);
  assert.equal(R.pteroLane(C.ptero.highFromScore - 1, 0.1, C), "low");
  assert.equal(R.pteroLane(C.ptero.highFromScore, 0.1, C), "low");
  assert.equal(R.pteroLane(C.ptero.highFromScore, 0.9, C), "high");
});

test("zemin engeli kutuları eski formülle aynı (değişmedi)", () => {
  const ins = C.artAssets.hitboxInset;
  const o = { type: "log", x: 400, y: 256, w: 88, h: 44 };
  assert.deepEqual(R.obstacleBox(o, C), { x: o.x + o.w * ins, y: o.y + o.h * ins, w: o.w * (1 - ins * 2), h: o.h * (1 - ins * 2) });
});

/* ---------- Yeni engel desenleri ve kıl payı ---------- */
const U = C.artAssets.pixelWorld;
function ground(type, x) { const [w, h] = C.artAssets.sizes[type].map(n => n * U); return { type, x, y: GROUND - h, w, h }; }
/** Zemin engelleri listesi üzerinden zıplama simülasyonu; en küçük dikey boşluğu da döndürür. */
function runGround(obs, speed, jumpAt, hold) {
  const p = { x: P.playerX, y: GROUND, vy: 0, duck: false, prep: 0, held: false, hold: 0 };
  let minClear = Infinity;
  for (let t = 0; t < 4; t += DT) {
    if (jumpAt !== undefined && Math.abs(t - jumpAt) < DT / 2 && p.y >= GROUND - 1) { p.prep = P.jumpPrep; p.held = !!hold; p.hold = 0; }
    if (p.prep > 0) { p.prep -= DT; if (p.prep <= 0) p.vy = P.jumpVelocity; }
    else if (p.y < GROUND || p.vy < 0) {
      const holding = p.held && p.vy < 0 && p.hold < P.jumpHoldMax, g = holding ? P.jumpHoldGravity : P.gravity;
      p.y += p.vy * DT; p.vy += g * DT; if (holding) p.hold += DT;
      if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.held = false; }
    }
    const pb = R.playerBox(p, C);
    for (const o of obs) { o.x -= speed * DT; const ob = R.obstacleBox(o, C); if (R.collide(pb, ob)) return { hit: true, minClear }; minClear = Math.min(minClear, R.clearance(pb, ob)); }
    if (obs.every(o => o.x + o.w < P.playerX - 10)) return { hit: false, minClear };
  }
  return { hit: false, minClear };
}
function windowFor(make, speed, hold) { let ok = 0; for (let t = 0; t < 1.5; t += DT) if (!runGround(make(), speed, t, hold).hit) ok += DT; return ok; }

test("çift engel (bitişik kütük + kaya) her hızda tek zıplamayla geçilebilir", () => {
  // Desen doubleFrom puanında açılır; o andaki hız ve tavan hız denenir. Tutarak zıplamada en az 0,05 sn pencere.
  const vFrom = Math.min(P.maxSpeed, P.runSpeed + C.patterns.doubleFrom * P.speedGain);
  for (const gap of C.patterns.doubleGap) for (const v of [vFrom, P.maxSpeed]) for (const pair of [["log", "rock"], ["rock", "log"], ["log", "log"]]) {
    const make = () => { const a = ground(pair[0], P.playerX + 420); return [a, ground(pair[1], a.x + a.w + gap)]; };
    const w = windowFor(make, v, true);
    assert.ok(w >= 0.05, `${pair.join("+")} gap=${gap} v=${v.toFixed(0)}: pencere ${w.toFixed(3)} sn`);
  }
});

test("pterosaur kombosu: alçağı zıpla, inince yüksek için eğilmeye zaman kalır", () => {
  // Alçak pterosaur dinoya t anında, yüksek olan t + comboDelay anında ulaşır; tutarak zıplama havada en uzun kalır.
  let air = 0; { let y = GROUND, vy = P.jumpVelocity, hold = 0; do { const g = hold < P.jumpHoldMax ? P.jumpHoldGravity : P.gravity; y += vy * DT; vy += g * DT; hold += DT; air += DT; } while (y < GROUND); }
  assert.ok(C.patterns.comboDelay - air >= 0.2, `iniş ile yüksek pterosaur arası ${(C.patterns.comboDelay - air).toFixed(2)} sn`);
});

test("kıl payı: eğilerek yüksek pterosaurun altından geçmek her zaman kıl payı sayılmaz", () => {
  const p = { x: P.playerX, y: GROUND, duck: true };
  const o = pterosaur("high", P.playerX);
  const c = R.clearance(R.playerBox(p, C), R.obstacleBox(o, C));
  assert.ok(c > C.rewards.nearMissPx, `eğilme boşluğu ${c.toFixed(1)} > eşik ${C.rewards.nearMissPx}`);
});

test("kıl payı: kütüğün üstünden geç zıplamada ölçülür, rahat zıplamada boşluk büyük", () => {
  const v = P.runSpeed, results = [];
  for (let t = 0; t < 1.5; t += DT) { const r = runGround([ground("log", P.playerX + 420)], v, t, false); if (!r.hit) results.push(r.minClear); }
  assert.ok(results.length > 5);
  assert.ok(Math.min(...results) <= C.rewards.nearMissPx, "en sıkı geçiş eşiğin altında: " + Math.min(...results).toFixed(1));
  assert.ok(Math.max(...results) > C.rewards.nearMissPx * 3, "rahat geçiş eşiğin çok üstünde");
  assert.equal(R.clearance({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 0, w: 10, h: 10 }), Infinity);
});

test("engel desenleri skor eşiklerinde açılır", () => {
  const p = C.patterns;
  assert.equal(R.patternFor(p.doubleFrom - 1, 0, C), "single");
  assert.equal(R.patternFor(p.doubleFrom, 0, C), "double");
  assert.equal(R.patternFor(p.fallerFrom, 0, C), "faller");
  assert.equal(R.patternFor(p.comboFrom, 0, C), "pteroCombo");
  assert.equal(R.patternFor(p.comboFrom, .99, C), "single");
  // Tüm desenler açıkken bile tek engel çoğunluktadır.
  assert.ok(p.comboChance + p.fallerChance + p.doubleChance < .5);
});
