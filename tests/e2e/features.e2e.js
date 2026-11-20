// Yeni özellikler: öğretici, kıl payı, zincir, desenler, sahne geçişi, oyun sonu, profil, paylaşım, sesler. node tests/e2e/features.e2e.js
const { chromium } = require('playwright-core');
const H = require('./helpers');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = H.ROOT;
const OUT = ROOT + '/tests/screenshots/features/'; fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' };
process.on('exit', () => { if (fails) process.exitCode = 1; });
let fails = 0; const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'GEÇTİ ' : 'KALDI ') + n + (info !== undefined && info !== '' ? '  ' + info : '')); };

// Sayfa içi otomatik pilot: yaklaşan engele göre zıpla/eğil (gerçek oyun girdisi API'si).
const AUTOPILOT = () => {
  const G = DinoRush.Game, R = DinoRush.Rules, C = DinoRush.Config;
  let release = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (window.__apOff || G.mode !== 'playing') return;
    const m = G.model, pb = R.playerBox(m.player, C), speed = Math.min(C.physics.maxSpeed, C.physics.runSpeed + m.score * C.physics.speedGain);
    if (release && performance.now() > release) { G.jump(false); release = 0; }
    let o = null, best = 1e9;
    for (const ob of m.obstacles) { const bx = R.obstacleBox(ob, C); const d = bx.x - (pb.x + pb.w); if (bx.x + bx.w > pb.x && d < best) { best = d; o = ob; } }
    if (!o) { G.setDuck(false); return; }
    if (o.type === 'flyer' && o.lane === 'high') { if (best < speed * 0.45) G.setDuck(true); return; }
    G.setDuck(false);
    if (best < speed * (window.__lead || 0.2) && best > -10 && m.player.y >= m.ground - 1 && !release) { G.jump(true); release = performance.now() + 170; }
  }
  tick();
};

async function open(browser, BASE, save, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {}));
  await ctx.addInitScript(s => { localStorage.setItem('dinorush-riko-v1', JSON.stringify({ firstVisit: false, recentMessages: [], lastSeen: Date.now() })); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); if (s) localStorage.setItem('dinorush-save-v1', JSON.stringify(s)); else localStorage.removeItem('dinorush-save-v1'); } }, save);
  const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
  await page.goto(BASE); await page.waitForTimeout(1800);
  await page.evaluate(() => { DinoRush.Riko && DinoRush.Riko.setIdleDelay(9e9); });
  return page;
}

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true });

  // 1) Öğretici: yeni oyuncuda adım adım; tamamlanınca kaydedilir
  let page = await open(browser, BASE, null);
  check('yeni oyuncu: öğretici açık', await page.evaluate(() => DinoRush.Storage.get().tutorialDone === false));
  await page.evaluate(AUTOPILOT);
  await page.click('#playButton');
  const hints = await page.evaluate(async () => { const seen = []; const t0 = performance.now(); while (performance.now() - t0 < 25000) { const e = document.getElementById('tutorialHint'); const k = e.hidden ? null : e.dataset.kind; if (k && seen[seen.length - 1] !== k) seen.push(k); if (DinoRush.Storage.get().tutorialDone || DinoRush.Game.mode === 'game_over') break; await new Promise(r => setTimeout(r, 50)); } return seen; });
  const done = await page.evaluate(() => DinoRush.Storage.get().tutorialDone);
  check('öğretici: zıpla > topla > eğil ipuçları sırayla, sonunda tamamlandı', hints.join('>') === 'jump>collect>duck' && done, hints.join('>') + ' bitti=' + done);
  await page.waitForTimeout(400);
  check('öğretici bitince "Hazırsın!" bildirimi', /Hazırsın/.test(await page.evaluate(() => document.getElementById('toastStack').textContent)));
  await page.context().close();
  page = await open(browser, BASE, { best: 120 });
  check('daha önce oynamış oyuncuya öğretici gösterilmez', await page.evaluate(() => DinoRush.Storage.get().tutorialDone === true));
  await page.context().close();

  // 2) Atlama düğmesi: öğretici atlanır ve kaydedilir
  page = await open(browser, BASE, null);
  await page.click('#playButton');
  await page.waitForFunction(() => !document.getElementById('tutorialHint').hidden, null, { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: OUT + 'tutorial_hint.png' });
  await page.click('#tutorialSkip'); await page.waitForTimeout(200);
  check('öğreticiyi atla: kaydedilir, ipucu gizlenir, normal üretim başlar', await page.evaluate(() => DinoRush.Storage.get().tutorialDone && document.getElementById('tutorialHint').hidden && !DinoRush.Game.model.tutorial));
  await page.context().close();

  // 3) Uzun koşu: kıl payı, zincir, desenler, sahne geçişi, oyun sonu dökümü
  page = await open(browser, BASE, { best: 300, fossils: 0, tutorialDone: true, ownedScenes: ['night', 'dawn', 'sunset'], selectedScene: 'night' });
  await page.evaluate(AUTOPILOT);
  await page.click('#playButton'); await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  // desenleri erken görmek için skoru ileri al; sahne geçiş eşiğini yakına çek
  await page.evaluate(() => { const m = DinoRush.Game.model; m.world = 1150 * 11; m.journey.nextAt = 1300;
    // Üretilen engelleri say (havuz nesneleri yeniden kullandığı için üretim çağrısından sayılır)
    window.__sp = { faller: 0, combo: 0 }; let lastLow = 0; const orig = DinoRush.Entities.obstacle;
    DinoRush.Entities.obstacle = d => { if (d.type === 'faller') window.__sp.faller++; if (d.type === 'flyer' && d.lane === 'low') lastLow = performance.now(); if (d.type === 'flyer' && d.lane === 'high' && performance.now() - lastLow < 1400) window.__sp.combo++; return orig(d); }; });
  const tally = await page.evaluate(async () => {
    const seen = { double: 0, faller: 0, combo: 0, journey: 0, fallerLanded: 0 }; const ids = new WeakSet(); let lastLow = 0; const t0 = performance.now();
    while (performance.now() - t0 < 100000 && DinoRush.Game.mode === 'playing') {
      const m = DinoRush.Game.model;
      const ground = m.obstacles.filter(o => o.type !== 'flyer' && o.type !== 'faller').sort((a, b) => a.x - b.x);
      for (let i = 1; i < ground.length; i++) if (ground[i].x - (ground[i - 1].x + ground[i - 1].w) < 40 && !ground[i].__d) { ground[i].__d = 1; seen.double++; }
      if (m.journey && m.journey.k < 1 && m.journey.from) seen.journey = 1;
      if (m.obstacles.some(o => o.type === 'faller' && !o.falling)) seen.fallerLanded = 1;
      if (seen.double && window.__sp.faller && seen.fallerLanded && window.__sp.combo && seen.journey) break;
      await new Promise(r => setTimeout(r, 30));
    }
    seen.faller = window.__sp.faller; seen.combo = window.__sp.combo;
    return Object.assign(seen, { run: Object.assign({}, DinoRush.Game.model.run), score: DinoRush.Game.model.score, mode: DinoRush.Game.mode });
  });
  check('yeni desenler koşuda görüldü (çift engel, düşen kaya, pterosaur kombosu)', tally.double > 0 && tally.faller > 0 && tally.combo > 0, JSON.stringify({ çift: tally.double, düşen: tally.faller, kombo: tally.combo, skor: tally.score, mod: tally.mode }));
  check('düşen kaya yere iner ve sıradan engel gibi kalır', tally.fallerLanded === 1);
  check('koşuda sahne geçişi yaşandı (sahip olunan sahneler arasında)', tally.journey === 1);
  check('koşu istatistikleri sayılıyor (pterosaur, zıplama)', tally.run.pterosDodged > 0 && tally.run.jumps > 0, JSON.stringify({ ptero: tally.run.pterosDodged, zıplama: tally.run.jumps }));
  await page.evaluate(() => { window.__apOff = true; });
  await page.waitForFunction(() => DinoRush.Game.mode === 'game_over' && !document.getElementById('gameOverPanel').hidden, null, { timeout: 30000 });
  await page.waitForTimeout(1600);
  const go = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#runBreakdown > div')].map(d => d.textContent), toasts: document.getElementById('toastStack').textContent, save: DinoRush.Storage.get(), res: DinoRush.Game.model.gameOverResult }));
  await page.screenshot({ path: OUT + 'gameover_breakdown.png' });
  check('oyun sonu dökümü: toplanan + bonuslar + toplam', go.rows.length >= 3 && /TOPLAM/.test(go.rows[go.rows.length - 1]), go.rows.join(' | '));
  const b = go.res.breakdown;
  check('döküm toplamı kalemlerin toplamı', b.total === b.collected + b.nearMiss + b.chain + b.score + b.record + b.daily + b.achievements, JSON.stringify(b));
  check('istatistikler ve günlük seri kaydedildi', go.save.stats.runs === 1 && go.save.daily.streak === 1 && go.save.stats.jumps > 0, JSON.stringify({ koşu: go.save.stats.runs, seri: go.save.daily }));
  check('başarım bildirimleri gösterildi ve ödül bakiyeye eklendi', /BAŞARIM/.test(go.toasts) && Object.keys(go.save.achievements).length > 0, Object.keys(go.save.achievements).join(','));
  // 3b) Kıl payı: geç zıplayan pilotla engellerin hemen üstünden geçilir
  const nm = await (async () => { const p2 = await open(browser, BASE, { best: 50, tutorialDone: true }); await p2.evaluate(AUTOPILOT); await p2.evaluate(() => { setInterval(() => { window.__lead = 0.08 + Math.random() * 0.2; }, 400); });
    await p2.click('#playButton'); await p2.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
    // Zamanlama her engelde değişir; ölünce yeniden başlar. Toplam kıl payı sayısı istatistikten okunur.
    const r = await p2.evaluate(async () => { const t0 = performance.now(); let n = 0, f = 0, runs = 1;
      while (performance.now() - t0 < 60000) { const g = DinoRush.Game; if (g.mode === 'playing') { const m = g.model.run; if (m.nearMisses > 0) { n = m.nearMisses; f = m.nearMissFossils; break; } } if (g.mode === 'game_over' && g.model.gameOverShown) { runs++; g.start(); } await new Promise(r => setTimeout(r, 40)); }
      return { n, f, runs }; });
    await p2.screenshot({ path: OUT + 'near_miss.png' }); await p2.context().close(); return r; })();
  check('kıl payı: sıkı geçişte sayılır ve +2 fosil verir', nm.n > 0 && nm.f === nm.n * 2, JSON.stringify(nm));

  // 3c) Zincir: fosiller koşu boyuna indirilir; küme tamamlanınca zincir artar, bir fosil kaçınca kopar
  const ch = await (async () => { const p3 = await open(browser, BASE, { best: 50, tutorialDone: true });
    await p3.click('#playButton'); await p3.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
    const r = await p3.evaluate(async () => { const m = DinoRush.Game.model; const iv = setInterval(() => { m.obstacles.length = 0; m.pickups.forEach(f => { f.y = m.ground - 40; }); }, 10);
      const t0 = performance.now(); while (performance.now() - t0 < 20000 && m.run.chains < 3) await new Promise(r => setTimeout(r, 50));
      const before = { chains: m.run.chains, max: m.run.maxChain, chainFossils: m.run.chainFossils, level: m.run.chain };
      // kopma: bir sonraki kümede bir fosili yukarı kaldır
      clearInterval(iv); let victim = null; const iv2 = setInterval(() => { m.obstacles.length = 0; m.pickups.forEach(f => { if (!victim && f.x > m.player.x + 120) victim = f; f.y = f === victim ? m.ground - 200 : m.ground - 40; }); }, 10);
      const t1 = performance.now(); while (performance.now() - t1 < 15000 && m.run.chain !== 0) await new Promise(r => setTimeout(r, 50)); clearInterval(iv2);
      return Object.assign(before, { after: m.run.chain }); });
    await p3.context().close(); return r; })();
  check('zincir: tam kümelerde seviye artar ve ödül büyür (2+4+6)', ch.chains >= 3 && ch.max >= 3 && ch.chainFossils >= 12, JSON.stringify(ch));
  check('zincir: kaçan fosil zinciri koparır', ch.after === 0);

  // 4) Profil
  await page.evaluate(() => DinoRush.Game.stopToMenu()); await page.waitForTimeout(300);
  const badge = await page.evaluate(() => document.getElementById('profileBadge').hidden === false);
  await page.click('#profileButton'); await page.waitForTimeout(400);
  const prof = await page.evaluate(() => ({ cards: document.querySelectorAll('.ach-card').length, done: document.querySelectorAll('.ach-card.is-done').length, count: document.getElementById('achCount').textContent, streak: document.getElementById('streakDays').textContent, bars: document.querySelectorAll('.ach-bar[role=progressbar]').length }));
  check('profil: 23 başarım kartı, açılanlar önde, ilerleme çubukları', prof.cards === 23 && prof.done > 0 && prof.bars === 23 - prof.done, JSON.stringify(prof));
  check('profil: günlük seri 1 gün', prof.streak === '1');
  check('menüde yeni başarım rozeti göründü, profil açılınca sıfırlandı', badge && await page.evaluate(() => document.getElementById('profileBadge').hidden));
  await page.screenshot({ path: OUT + 'profile.png' });
  await page.click('#profTab-stats'); await page.waitForTimeout(200);
  const stats = await page.evaluate(() => [...document.querySelectorAll('#statsList > div')].map(d => d.textContent));
  check('istatistik listesi dolu', stats.length >= 12, stats.slice(0, 3).join(' | '));
  await page.screenshot({ path: OUT + 'profile_stats.png' });
  await page.keyboard.press('Escape');
  // 5) Paylaşım kartı
  const card = await page.evaluate(() => { const cv = DinoRush.Share.draw(DinoRush.Game.model.gameOverResult); return { w: cv.width, h: cv.height, data: cv.toDataURL('image/png') }; });
  check('paylaşım kartı 1200x630 PNG olarak üretilir', card.w === 1200 && card.h === 630 && card.data.startsWith('data:image/png'));
  fs.writeFileSync(OUT + 'share_card.png', Buffer.from(card.data.split(',')[1], 'base64'));
  const how = await page.evaluate(() => DinoRush.Share.share(DinoRush.Game.model.gameOverResult));
  check('paylaş düğmesi: paylaşım yoksa görsel indirilir', ['downloaded', 'shared-image', 'shared-text'].includes(how), how);
  // 6) Sesler
  const sfx = await page.evaluate(() => { DinoRush.Audio.init(); for (const n of ['jump', 'nearMiss', 'record', 'hit', 'thud', 'achievement', 'streak', 'click', 'purchase', 'deny', 'test']) DinoRush.Audio[n](); for (let i = 0; i <= 5; i++) DinoRush.Audio.fossil(i); for (let i = 1; i <= 5; i++) DinoRush.Audio.chain(i); DinoRush.Audio.countdown(3); DinoRush.Audio.countdown(0); return DinoRush.Audio.cached; });
  check('ses efektleri üretildi ve önbelleğe alındı', sfx >= 20, sfx + ' ses');
  // 7) Ayarlar
  await page.click('#settingsButton'); await page.click('#setTab-display'); await page.click('[data-setting="highContrast"]'); await page.click('[data-setting="sceneCycle"]');
  await page.click('#setTab-controls'); await page.click('#replayTutorial'); await page.waitForTimeout(100);
  const st = await page.evaluate(() => DinoRush.Storage.get());
  check('yeni ayarlar kaydedilir: yüksek kontrast açık, sahne geçişi kapalı, öğretici tekrar', st.highContrast === true && st.sceneCycle === false && st.tutorialDone === false);
  check('sayfa hatası yok', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // 8) Yüksek kontrast pterosaur uyarısı (görsel)
  page = await open(browser, BASE, { best: 2000, tutorialDone: true, highContrast: true });
  await page.click('#playButton'); await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  await page.evaluate(() => { const m = DinoRush.Game.model, R = DinoRush.Rules, C = DinoRush.Config, s = R.pteroSize(C); m.obstacles.length = 0; for (const lane of ['low', 'high']) m.obstacles.push(DinoRush.Entities.obstacle({ type: 'flyer', lane, x: m.width + 30 + (lane === 'high' ? 50 : 0), y: R.pteroY(lane, m.ground, C), w: s.w, h: s.h })); DinoRush.Game.pause(); document.getElementById('pausePanel').hidden = true; });
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + 'warning_high_contrast.png' });
  await page.context().close();

  await browser.close(); srv.close();
  console.log(fails ? fails + ' KALDI' : 'hepsi geçti');
})();
