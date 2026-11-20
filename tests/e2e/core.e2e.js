// Headless Chromium uçtan uca kontrol + ekran görüntüleri.
const { chromium } = require('playwright-core');
const H = require('./helpers');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = pathToFileURL(H.ROOT + '/index.html').href;
const SIZES = (process.argv[2] || '320x568,390x844,844x390,1366x768').split(',');
const ONLY = process.argv[3] || 'all';
const SEED = { best: 1520, achievements: { 'score-500': 1, 'score-1000': 1 }, fossils: 300, owned: ['fern', 'amber'], selected: 'amber', ownedTrails: ['dust', 'leaf'], selectedTrail: 'leaf' };
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); console.log((ok ? 'GEÇTİ ' : 'KALDI ') + name + (info ? '  ' + info : '')); };

async function newPage(browser, w, h, seed, opts) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: (opts && opts.reducedMotion) || 'no-preference' });
  if (seed !== null) await ctx.addInitScript(s => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('dinorush-save-v1', s); sessionStorage.setItem('seeded', '1'); } } catch (_) {} }, JSON.stringify(seed || SEED));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => document.getElementById('preloader') === null || document.getElementById('preloader').classList.contains('done'), null, { timeout: 8000 });
  await page.waitForTimeout(700);
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('dinorush-save-v1') || 'null'));

(async () => {
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true, args: ['--no-sandbox'] });
  for (const size of SIZES) {
    const [w, h] = size.split('x').map(Number);
    const page = await newPage(browser, w, h);
    // Ana menü
    await shot(page, `${size}_menu`);
    const overflow = await page.evaluate(() => {
      const r = document.getElementById('menuRecord'); const p = r.closest('.record-plaque');
      const vis = el => { const b = el.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1; };
      return { recordClipped: r.scrollWidth > r.clientWidth + 1 || r.getBoundingClientRect().right > p.getBoundingClientRect().right, play: vis(document.getElementById('playButton')), shop: vis(document.getElementById('collectionButton')), settings: vis(document.getElementById('settingsButton')), plaque: vis(document.querySelector('.menu-fossil-plaque')) };
    });
    check(`${size} menü: rekor kesilmiyor, düğmeler ekranda`, !overflow.recordClipped && overflow.play && overflow.shop && overflow.settings && overflow.plaque, JSON.stringify(overflow));
    if (ONLY === 'menu') { await page.context().close(); continue; }
    // Mağaza: üç sekme
    await page.click('#collectionButton');
    await page.waitForTimeout(350);
    for (const kind of ['skin', 'trail', 'scene']) {
      await page.click(`#shopTab-${kind}`);
      await page.waitForTimeout(400);
      await shot(page, `${size}_shop_${kind}`);
    }
    await page.click('#shopTab-skin'); await page.waitForTimeout(200);
    const states = await page.$$eval('.shop-card', cards => cards.map(c => c.dataset.id + ':' + c.className.match(/is-(\w+)/)[1]));
    check(`${size} mağaza kart durumları`, states.join(',') === 'fern:owned,amber:selected,midnight:buy,lavender:locked,ember:locked,gold:locked', states.join(','));
    // Ayarlar: dört sekme
    await page.click('[data-close-modal]');
    await page.waitForTimeout(150);
    await page.click('#settingsButton');
    await page.waitForTimeout(300);
    for (const tab of ['audio', 'display', 'controls', 'data']) {
      await page.click(`#setTab-${tab}`);
      await page.waitForTimeout(200);
      await shot(page, `${size}_settings_${tab}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // Duraklat
    await page.click('#playButton');
    await page.waitForTimeout(2900);
    await shot(page, `${size}_playing`);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(350);
    await shot(page, `${size}_pause`);
    const pauseButtons = await page.$$eval('#pausePanel button', b => b.map(x => x.textContent.trim()));
    check(`${size} duraklat düğmeleri`, ['DEVAM ET', 'YENİDEN BAŞLA', 'ANA MENÜ', 'AYARLAR'].every(t => pauseButtons.includes(t)), pauseButtons.join(' | '));
    if (page.errors.length) check(`${size} konsol hatası yok`, false, page.errors.join(' / ')); else check(`${size} konsol hatası yok`, true);
    await page.context().close();
  }

  if (ONLY === 'all' || ONLY === 'flows') {
    const page = await newPage(browser, 1366, 768);
    // Yetersiz bakiye
    await page.click('#collectionButton'); await page.waitForTimeout(300);
    await page.click('.shop-card[data-id="gold"] .shop-action');
    await page.waitForTimeout(120);
    const warn = await page.textContent('#shopStatus');
    check('yetersiz bakiye uyarısı "N fosil eksik"', /900 fosil/.test(warn), warn);
    const missingLine = await page.textContent('.shop-card[data-id="gold"] .shop-missing');
    check('kilitli kartta eksik miktar', missingLine.trim() === '900 fosil eksik', missingLine);
    check('yetersiz bakiyede kayıt değişmedi', (await save(page)).fossils === 300);
    // Satın alma onayı
    await page.click('.shop-card[data-id="midnight"] .shop-action');
    await page.waitForTimeout(150);
    const confirmVisible = await page.isVisible('#shopConfirm');
    const confirmText = await page.textContent('#shopConfirmText');
    check('satın alma onay kutusu açılır', confirmVisible && /200/.test(confirmText) && /100/.test(confirmText), confirmText.replace(/\s+/g, ' '));
    await shot(page, '1366x768_shop_confirm');
    // Vazgeç -> değişiklik yok
    await page.click('#shopConfirmCancel'); await page.waitForTimeout(100);
    check('vazgeçince bakiye aynı', (await save(page)).fossils === 300);
    await page.click('.shop-card[data-id="midnight"] .shop-action'); await page.waitForTimeout(100);
    await page.click('#shopConfirmOk');
    await page.waitForTimeout(140);
    const sparks = await page.$$eval('.amber-spark', s => s.length);
    await shot(page, '1366x768_shop_burst');
    check('satın alınca amber parçacık patlaması', sparks > 0, sparks + ' parçacık');
    await page.waitForTimeout(800);
    const s1 = await save(page);
    check('satın alma: bakiye 300 -> 100, sahip olunan', s1.fossils === 100 && s1.owned.includes('midnight') && s1.selected === 'amber', JSON.stringify({ fossils: s1.fossils, owned: s1.owned, selected: s1.selected }));
    check('cüzdan ve menü bakiyesi güncellendi', (await page.textContent('#collectionWallet')).trim() === '100' && (await page.textContent('#menuFossils')).trim() === '100');
    const midState = await page.getAttribute('.shop-card[data-id="midnight"]', 'class');
    check('satın alınan kart KUŞAN durumunda', /is-owned/.test(midState) && (await page.textContent('.shop-card[data-id="midnight"] .shop-action')).includes('KUŞAN'));
    await page.click('.shop-card[data-id="midnight"] .shop-action'); await page.waitForTimeout(150);
    await shot(page, '1366x768_shop_equipped');
    // Kalıcılık: yeniden yükle
    await page.reload(); await page.waitForTimeout(1600);
    const s2 = await save(page);
    check('seçili varyant yeniden yüklemede kalıcı', s2.selected === 'midnight' && s2.fossils === 100);
    const sheetUsed = await page.evaluate(() => DinoRush.Scene.sheetFor().src.split('/').pop());
    check('oyunda seçili sheet kullanılıyor', sheetUsed === 'dino_sheet_midnight.png', sheetUsed);
    await shot(page, '1366x768_menu_midnight');
    // İz ve sahne seçimi oyunda
    await page.evaluate(() => { DinoRush.Storage.update({ fossils: 1200 }); });
    await page.click('#collectionButton'); await page.waitForTimeout(200);
    await page.click('#shopTab-scene'); await page.waitForTimeout(150);
    await page.click('.shop-card[data-id="sunset"] .shop-action'); await page.click('#shopConfirmOk'); await page.waitForTimeout(100);
    await page.click('.shop-card[data-id="sunset"] .shop-action'); await page.waitForTimeout(100);
    await page.click('#shopTab-trail'); await page.waitForTimeout(150);
    await page.click('.shop-card[data-id="firefly"] .shop-action'); await page.click('#shopConfirmOk'); await page.waitForTimeout(100);
    await page.click('.shop-card[data-id="firefly"] .shop-action'); await page.waitForTimeout(100);
    const s3 = await save(page);
    check('iz ve sahne satın alındı ve kuşanıldı', s3.selectedScene === 'sunset' && s3.selectedTrail === 'firefly' && s3.fossils === 1200 - 400 - 700, JSON.stringify({ scene: s3.selectedScene, trail: s3.selectedTrail, fossils: s3.fossils }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await shot(page, '1366x768_menu_sunset');
    await page.click('#playButton'); await page.waitForTimeout(3300);
    const trailKinds = await page.evaluate(() => [...new Set(DinoRush.Game.model.particles.map(p => p.kind))]);
    check('koşuda ateş böceği iz partikülü', trailKinds.includes('trail-firefly'), trailKinds.join(','));
    await shot(page, '1366x768_playing_sunset_firefly');
    // Oyun sonu (seçili varyant)
    await page.evaluate(() => { const m = DinoRush.Game.model; m.obstacles.push({ type: 'rock', x: m.player.x + 10, y: m.ground - 44, w: 80, h: 44, cx: 0, startX: 0, progress: 0, scale: 1, phase: 0, passed: false }); });
    await page.waitForTimeout(1700);
    await shot(page, '1366x768_gameover_variant');
    check('oyun sonu ekranı açıldı', await page.isVisible('#gameOverPanel'));
    // Ayarlar kalıcılığı
    await page.click('#gameOverPanel [data-return-menu]'); await page.waitForTimeout(300);
    await page.click('#settingsButton'); await page.waitForTimeout(200);
    await page.$eval('[data-range="masterVolume"]', el => { el.value = '35'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#setTab-display'); await page.waitForTimeout(100);
    await page.click('[data-setting="scanlines"]');
    await page.click('[data-setting="screenShake"]');
    const s4 = await save(page);
    check('ayarlar kaydedildi (ses %35, tarama açık, sarsıntı kapalı)', s4.masterVolume === 35 && s4.scanlines === true && s4.screenShake === false);
    check('tarama çizgisi katmanı görünür', await page.evaluate(() => getComputedStyle(document.querySelector('.scanline-overlay')).display === 'block'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await shot(page, '1366x768_menu_scanlines');
    // Sıfırlama: kısa basış iptal, 2 sn basılı tutma + ikinci uyarı
    await page.click('#settingsButton'); await page.waitForTimeout(200);
    await page.click('#setTab-data'); await page.waitForTimeout(150);
    const playTime = await page.textContent('#dataPlayTime');
    check('VERİ: oynama süresi > 0 gösteriliyor', !/^0 sn$/.test(playTime.trim()), playTime);
    const box = await page.locator('#resetHold').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); await page.waitForTimeout(150);
    check('kısa basış sıfırlamaz', (await page.isHidden('#resetConfirm')) && (await save(page)).best > 0);
    await page.mouse.down(); await page.waitForTimeout(1000);
    await shot(page, '1366x768_settings_data_holding');
    await page.waitForTimeout(1250); await page.mouse.up(); await page.waitForTimeout(150);
    check('2 sn basılı tutunca ikinci uyarı', await page.isVisible('#resetConfirm'));
    await shot(page, '1366x768_settings_data_warning');
    await page.click('#resetConfirmOk'); await page.waitForTimeout(200);
    const s5 = await save(page);
    check('sıfırlama: ilerleme silindi, ayarlar korundu', s5.best === 0 && s5.fossils === 0 && s5.owned.length === 1 && s5.selected === 'fern' && s5.masterVolume === 35 && s5.scanlines === true, JSON.stringify({ best: s5.best, fossils: s5.fossils, owned: s5.owned, vol: s5.masterVolume }));
    check('akış testinde konsol hatası yok', page.errors.length === 0, page.errors.join(' / '));
    await page.context().close();

    // Eski v1 kaydı tarayıcıda
    const legacy = await newPage(browser, 1366, 768, { best: 777, fossils: 12, sound: true, vibration: false, lowEffects: false, owned: ['fern', 'lagoon'], selected: 'lagoon' });
    const l = await legacy.evaluate(() => DinoRush.Storage.get());
    check('tarayıcıda eski kayıt: lagoon -> midnight, rekor korunur', l.selected === 'midnight' && l.best === 777 && (await legacy.textContent('#menuRecord')).includes('777'));
    await legacy.context().close();

    // Hareket azaltma: sarsıntı/flaş kapalı başlar ve panelde belirtilir
    const rm = await newPage(browser, 1366, 768, {}, { reducedMotion: 'reduce' });
    await rm.evaluate(() => localStorage.removeItem('dinorush-save-v1'));
    await rm.reload(); await rm.waitForTimeout(1500);
    await rm.click('#settingsButton'); await rm.waitForTimeout(150); await rm.click('#setTab-display'); await rm.waitForTimeout(100);
    const rmState = await rm.evaluate(() => ({ shake: document.querySelector('[data-setting="screenShake"]').getAttribute('aria-checked'), flash: document.querySelector('[data-setting="flash"]').getAttribute('aria-checked'), note: !document.getElementById('motionNote').hidden }));
    check('reduced-motion: sarsıntı ve flaş kapalı, not görünür', rmState.shake === 'false' && rmState.flash === 'false' && rmState.note, JSON.stringify(rmState));
    await shot(rm, '1366x768_settings_display_reducedmotion');
    await rm.context().close();

    // Dosya yoksa varsayılan sheet'e düşme
    const fb = await newPage(browser, 1366, 768, { selected: 'gold', owned: ['fern', 'gold'] });
    const fallback = await fb.evaluate(async () => { const real = DinoRush.Assets.get; DinoRush.Assets.get = n => (n === 'dinoSheet_gold' ? null : real(n)); const src = DinoRush.Scene.sheetFor().src.split('/').pop(); DinoRush.Assets.get = real; return src; });
    check('varyant dosyası yoksa varsayılan sheet', fallback === 'dino_sheet.png', fallback);
    await fb.context().close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
