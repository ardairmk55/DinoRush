// Riko tarayıcı senaryoları. node tests/e2e/riko.e2e.js
const { chromium } = require('playwright-core');
const H = require('./helpers');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const URL = pathToFileURL(H.ROOT + '/index.html').href;
const OUT = H.ROOT + '/tests/screenshots/riko'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'GEÇTİ ' : 'KALDI ') + n + (info !== undefined ? '  ' + info : '')); };
const bub = page => page.evaluate(() => { const b = document.querySelector('.riko-bubble'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { id: +b.dataset.id, trig: b.dataset.trigger, x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, count: document.querySelectorAll('.riko-bubble').length }; });
const inView = b => !!b && b.x >= 0 && b.y >= 0 && b.x + b.w <= b.vw && b.y + b.h <= b.vh;

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts && opts.ctx));
  if (opts && opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
  await page.goto(URL); await page.waitForTimeout(2200);
  return page;
}

(async () => {
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true, args: ['--no-sandbox'] });

  // 1-2) İlk ziyaret ve yenileme (oyun kaydı var, Riko kaydı yok)
  let page = await open(browser, { init: () => { if (!localStorage.getItem('dinorush-save-v1')) localStorage.setItem('dinorush-save-v1', JSON.stringify({ best: 99999, fossils: 120 })); } });
  let b = await bub(page);
  check('ilk ziyaret: tanıtım mesajı (1) ve ekranda', b && b.id === 1 && inView(b), b && b.id);
  await page.screenshot({ path: `${OUT}/1366x768_ilk_ziyaret.png` });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dinorush-riko-v1')));
  check('geçmiş localStorage\'a yazıldı', stored && stored.firstVisit === false && stored.recentMessages.includes(1) && stored.lastSeen > 0, JSON.stringify(stored));
  await page.reload(); await page.waitForTimeout(2200);
  b = await bub(page);
  const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('dinorush-riko-v1')));
  check('yenileme: geçmiş korundu, tanıtım tekrar gelmedi', b && b.id !== 1 && b.trig === 'menu' && stored2.recentMessages.includes(1), `id ${b && b.id}, geçmiş ${stored2.recentMessages}`);

  // 3) Art arda tıklama
  const ids = [];
  for (let i = 0; i < 12; i++) { await page.click('.riko-hit', { force: true }); await page.waitForTimeout(120); const x = await bub(page); if (x) ids.push(x.id); }
  b = await bub(page);
  check('art arda 12 tıklama: tek balon, en fazla 3 farklı mesaj, hata yok', b && b.count === 1 && new Set(ids).size <= 3 && page.errs.length === 0, `farklı mesaj ${new Set(ids).size}`);
  const seq = [];
  for (let i = 0; i < 14; i++) { await page.evaluate(() => DinoRush.Riko.hide(true)); await page.waitForTimeout(950); await page.click('.riko-hit', { force: true }); await page.waitForTimeout(80); const x = await bub(page); if (x) seq.push(x.id); }
  let dupe = false; for (let i = 1; i < seq.length; i++) { if (seq.slice(Math.max(0, i - 5), i).includes(seq[i])) dupe = true; }
  check('tıklama mesajları: son 5 içinde tekrar yok', seq.length >= 12 && !dupe, seq.join(','));
  await page.evaluate(() => DinoRush.Riko.hide(true));

  // 4) Mağaza / ayarlar
  await page.click('#collectionButton'); await page.waitForTimeout(400);
  b = await bub(page); check('mağaza mesajı (50/51), modalın üstünde ekranda', b && [50, 51].includes(b.id) && inView(b), b && b.id);
  await page.screenshot({ path: `${OUT}/1366x768_magaza.png` });
  await page.keyboard.press('Escape'); await page.evaluate(() => DinoRush.Riko.hide(true)); await page.waitForTimeout(200);
  await page.click('#settingsButton'); await page.waitForTimeout(400);
  b = await bub(page); check('ayarlar mesajı (52)', b && b.id === 52, b && b.id);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // 5) Hareketsizlik
  await page.evaluate(() => { DinoRush.Riko.hide(true); DinoRush.Riko.setIdleDelay(600); });
  await page.waitForTimeout(1000);
  b = await bub(page); check('hareketsizlik mesajı (idle/motivasyon)', b && b.trig === 'idle' && ([49, 53, 54, 55].includes(b.id) || (b.id >= 9 && b.id <= 16)), b && b.id);

  // 6) Oyun başlangıcı
  await page.evaluate(() => DinoRush.Riko.hide(true));
  await page.click('#playButton'); await page.waitForTimeout(500);
  b = await bub(page); check('oyun başlangıcı: macera mesajı (25-32), ekranda', b && b.id >= 25 && b.id <= 32 && inView(b), b && b.id);
  await page.screenshot({ path: `${OUT}/1366x768_baslangic.png` });
  await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  await page.evaluate(() => { window.__clr = setInterval(() => { DinoRush.Game.model.obstacles.length = 0; }, 20); });
  await page.waitForTimeout(3700);
  check('başlangıç mesajı oyunda en fazla 3,5 sn sonra kaybolur', (await bub(page)) === null);

  // 7) Fosil eşiği (oyunun kendi çağırdığı DR.UI.updateFossils ile)
  const fossilIds = await page.evaluate(() => { const r = []; for (let n = 1; n <= 12; n++) { DinoRush.UI.updateFossils(n, 100 + n); const b = document.querySelector('.riko-bubble'); r.push(b.hidden ? 0 : +b.dataset.id); } return r; });
  const firstAt = fossilIds.findIndex(x => x);
  check('fosil: her fosilde değil, 10. fosilde konuşur', firstAt === 9 && fossilIds[firstAt] >= 33 && fossilIds[firstAt] <= 38, fossilIds.join(','));
  // 8) Rekor (koşu içi, bir kez; fosil mesajını keser)
  const rec = await page.evaluate(() => { DinoRush.UI.updateRecord(99999, true); const a = +document.querySelector('.riko-bubble').dataset.id; DinoRush.Riko.hide(true); DinoRush.UI.updateRecord(99999, true); const b = document.querySelector('.riko-bubble'); return { a, again: b.hidden ? 0 : +b.dataset.id }; });
  check('yeni rekor: 39 bir kez, aynı koşuda tekrar yok; fosil mesajını keser', rec.a === 39 && rec.again === 0, JSON.stringify(rec));
  // 9) Duraklatma
  await page.evaluate(() => DinoRush.Riko.say('fossil'));
  await page.evaluate(() => DinoRush.Game.pause()); await page.waitForTimeout(100);
  check('duraklatınca balon kapanır', (await bub(page)) === null);
  await page.evaluate(() => DinoRush.Game.resume());
  // 10) Oyun sonu (gerçek çarpışma)
  await page.evaluate(() => { clearInterval(window.__clr); const m = DinoRush.Game.model; m.obstacles.length = 0; m.obstacles.push({ type: 'rock', x: m.player.x + 10, y: m.ground - 44, w: 80, h: 44, phase: 0, scale: 1, progress: 0, passed: false }); });
  await page.waitForFunction(() => DinoRush.Game.mode === 'game_over', null, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1300);
  b = await bub(page);
  const result = await page.evaluate(() => DinoRush.Game.model.gameOverResult);
  check('oyun sonu: rekorsuzsa moral mesajı (41-48), rekorluysa 40', !!b && !!result && (result.record ? b.id === 40 : b.id >= 41 && b.id <= 48) && inView(b), `id ${b && b.id}, rekor ${result && result.record}`);
  await page.screenshot({ path: `${OUT}/1366x768_oyun_sonu.png` });
  check('masaüstü senaryolarında sayfa hatası yok', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // 10b) İlk koşu (rekor 0): koşu içinde erken "Yeni rekor!" yok
  page = await open(browser);
  await page.evaluate(() => DinoRush.Riko.hide(true)); await page.click('#playButton');
  await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  await page.evaluate(() => setInterval(() => { DinoRush.Game.model.obstacles.length = 0; }, 20));
  const seen = await page.evaluate(async () => { const s = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 2500) { const b = document.querySelector('.riko-bubble'); if (!b.hidden) s.add(+b.dataset.id); await new Promise(r => setTimeout(r, 50)); } return [...s]; });
  check('ilk koşu: koşu içinde erken rekor mesajı (39) yok', !seen.includes(39), seen.join(','));
  await page.context().close();

  // 11) Bozuk kayıt
  page = await open(browser, { init: () => { if (!sessionStorage.getItem('x')) { localStorage.setItem('dinorush-riko-v1', '{bozuk json'); sessionStorage.setItem('x', '1'); } } });
  b = await bub(page);
  const repaired = await page.evaluate(() => { try { return Array.isArray(JSON.parse(localStorage.getItem('dinorush-riko-v1')).recentMessages); } catch (_) { return false; } });
  check('bozuk Riko kaydı: hata yok, karşılama gösterilir, kayıt onarılır', b && b.id === 1 && page.errs.length === 0 && repaired, page.errs.join(' | '));
  // 12) Uzun mesaj
  const long = await page.evaluate(() => { const R = DinoRush.Riko; for (let i = 0; i < 400; i++) { R.hide(true); const m = R.say('click'); if (m && m.id >= 56) return m.id; } return 0; });
  b = await bub(page);
  check('özel (uzun) mesaj sarılarak ekrana sığar', long >= 56 && inView(b) && b.w <= 330, `id ${long}, ${Math.round(b && b.w)}x${Math.round(b && b.h)}`);
  await page.screenshot({ path: `${OUT}/1366x768_uzun_mesaj.png` });
  await page.context().close();

  // 13) Mobil ve kısa yatay (dokunmatik)
  for (const s of ['375x812', '320x568', '844x390']) {
    const [w, h] = s.split('x').map(Number);
    page = await open(browser, { ctx: { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
    b = await bub(page);
    const overlap = await page.evaluate(() => { const bb = document.querySelector('.riko-bubble').getBoundingClientRect(); return ['playButton', 'collectionButton', 'settingsButton'].filter(id => { const r = document.getElementById(id).getBoundingClientRect(); return bb.left < r.right && bb.right > r.left && bb.top < r.bottom && bb.bottom > r.top; }); });
    const pe = await page.evaluate(() => getComputedStyle(document.querySelector('.riko-bubble')).pointerEvents);
    check(`${s} menü: balon ekranda, düğmelerin üstüne binmez, dokunmayı engellemez`, inView(b) && pe === 'none' && overlap.length === 0, `üstüne geldiği düğme: ${overlap.join(',') || 'yok'}`);
    await page.screenshot({ path: `${OUT}/${s}_menu.png` });
    await page.evaluate(() => DinoRush.Riko.hide(true));
    await page.tap('.riko-hit'); await page.waitForTimeout(300); b = await bub(page);
    check(`${s} Riko'ya dokunma çalışır`, b && b.trig === 'click', b && b.trig);
    await page.evaluate(() => DinoRush.Riko.hide(true)); await page.waitForTimeout(950); await page.tap('#playButton'); await page.waitForTimeout(500);
    b = await bub(page);
    const ctrl = await page.evaluate(() => { const bb = document.querySelector('.riko-bubble').getBoundingClientRect(); return ['pauseButton', 'jumpButton', 'crouchButton'].filter(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && bb.left < r.right && bb.right > r.left && bb.top < r.bottom && bb.bottom > r.top; }); });
    check(`${s} oyun: başlangıç balonu ekranda, oyun kontrollerini kapatmaz`, inView(b) && ctrl.length === 0, `çakışan: ${ctrl.join(',') || 'yok'}`);
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${s}_oyun.png` });
    check(`${s} sayfa hatası yok`, page.errs.length === 0, page.errs.join(' | '));
    await page.context().close();
  }
  await browser.close();
  console.log(fails ? fails + ' KALDI' : 'hepsi geçti'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
