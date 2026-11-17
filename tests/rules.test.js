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
