// Mağaza / aksesuar / ayarlar / gizlilik / hakkında işlev testleri (http üzerinden). node tests/e2e/store-settings.e2e.js
const { chromium } = require('playwright-core');
const H = require('./helpers');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = H.ROOT;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
process.on('exit', () => { if (fails) process.exitCode = 1; });
let fails = 0;
const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'GEÇTİ ' : 'KALDI ') + n + (info !== undefined && info !== '' ? '  ' + info : '')); };
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('dinorush-save-v1')));

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    localStorage.setItem('dinorush-riko-v1', JSON.stringify({ firstVisit: false, recentMessages: [], lastMessageId: null, lastSeen: Date.now() }));
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('dinorush-save-v1', JSON.stringify({ best: 1520, achievements: { 'score-500': 1, 'score-1000': 1 }, fossils: 700, owned: ['fern', 'amber'], selected: 'amber' })); }
    // Aksesuar çizim çağrılarını say (hangi sprite satırında, hangi aksesuarlarla)
    const hook = setInterval(() => { const A = window.DinoRush && DinoRush.AccessoryArt; if (!A || A.__spy) return; const orig = A.draw; window.__accRows = {}; A.draw = function (ctx, row, frame, x, y, px, loadout) { if (loadout && Object.values(loadout).some(Boolean)) window.__accRows[row] = (window.__accRows[row] || 0) + 1; return orig.apply(this, arguments); }; A.__spy = true; clearInterval(hook); }, 5);
  });
  // Portföy sitesine gerçek istek atma: yeni sekme isteğini yerelde yanıtla
  await ctx.route('https://ardaportfoy.vercel.app/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>portfoy</title>ok' }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE); await page.waitForTimeout(2000);
  await page.evaluate(() => DinoRush.Riko.setIdleDelay(9e9));

  // 1) Kategoriler
  await page.click('#collectionButton'); await page.waitForTimeout(400);
  const counts = {};
  for (const k of ['skin', 'trail', 'scene', 'accessory']) { await page.click('#shopTab-' + k); await page.waitForTimeout(150); counts[k] = await page.$$eval('.shop-card', c => c.length); }
  check('4 kategori: 6 görünüm, 4 iz, 3 sahne, 17 aksesuar', counts.skin === 6 && counts.trail === 4 && counts.scene === 3 && counts.accessory === 17, JSON.stringify(counts));
  const sel = await page.$eval('#shopTab-accessory', t => t.getAttribute('aria-selected') === 'true' && t.classList.contains('selected'));
  check('seçili kategori belirgin (aria-selected + sınıf)', sel);
  const filt = {};
  for (const s of ['head', 'face', 'gear', 'all']) { await page.click(`#slotFilter [data-slot="${s}"]`); await page.waitForTimeout(100); filt[s] = await page.$$eval('.shop-card', c => c.length); }
  check('yuva süzgeci: 6 şapka, 5 gözlük, 6 diğer', filt.head === 6 && filt.face === 5 && filt.gear === 6 && filt.all === 17, JSON.stringify(filt));
  const tags = await page.$$eval('.shop-card', cs => cs.map(c => [c.dataset.rarity, c.querySelector('.rarity-tag').textContent]));
  check('her kartta nadirlik etiketi', tags.every(([r, t]) => r && t.length > 2), [...new Set(tags.map(t => t[1]))].join(','));
  // klavye: ok tuşuyla sekme geçişi
  await page.focus('#shopTab-accessory'); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
  check('ok tuşu ile kategori değişir', await page.$eval('#shopTab-scene', t => t.getAttribute('aria-selected') === 'true'));
  await page.click('#shopTab-accessory'); await page.waitForTimeout(150);

  // 2) Satın alma: onay, anında bakiye, çift tıklamada tek satın alma, tekrar alınamaz
  await page.click('.shop-card[data-id="sunglasses"] .shop-action'); await page.waitForTimeout(100);
  check('satın almadan önce onay penceresi', await page.isVisible('#shopConfirm') && /160/.test(await page.textContent('#shopConfirmText')));
  await page.evaluate(() => { const b = document.getElementById('shopConfirmOk'); b.click(); b.click(); b.click(); });
  await page.waitForTimeout(800);
  let s = await save(page);
  check('hızlı çoklu onay tıklaması: tek satın alma (700 -> 540)', s.fossils === 540 && s.ownedAccessories.filter(x => x === 'sunglasses').length === 1, JSON.stringify({ f: s.fossils, o: s.ownedAccessories }));
  check('bakiye mağaza başlığında anında güncellendi', (await page.textContent('#collectionWallet')).trim() === '540');
  const st1 = await page.$eval('.shop-card[data-id="sunglasses"] .shop-action', b => b.textContent.trim());
  check('satın alınan ürün tekrar satın alınamaz, KUŞAN gösterir', st1 === 'KUŞAN', st1);
  // yetersiz bakiye
  await page.click('.shop-card[data-id="gold-crown"] .shop-action'); await page.waitForTimeout(120);
  check('yetersiz bakiye uyarısı anlaşılır', /Yetersiz bakiye: Altın Taç için 860 fosil/.test(await page.textContent('#shopStatus')), await page.textContent('#shopStatus'));
  check('yetersiz bakiyede onay açılmaz', !(await page.isVisible('#shopConfirm')));

  // 3) Kuşanma ve yuvalar
  await page.evaluate(() => DinoRush.Storage.update({ fossils: 3000 }));
  await page.click('#shopTab-skin'); await page.click('#shopTab-accessory'); await page.waitForTimeout(150);
  for (const id of ['explorer-hat', 'gold-crown', 'backpack']) { await page.click(`.shop-card[data-id="${id}"] .shop-action`); await page.click('#shopConfirmOk'); await page.waitForTimeout(80); }
  await page.click('.shop-card[data-id="sunglasses"] .shop-action'); await page.waitForTimeout(80);
  await page.click('.shop-card[data-id="explorer-hat"] .shop-action'); await page.waitForTimeout(80);
  await page.click('.shop-card[data-id="backpack"] .shop-action'); await page.waitForTimeout(80);
  s = await save(page);
  check('farklı yuvalar birlikte kuşanılır', s.accessories.head === 'explorer-hat' && s.accessories.face === 'sunglasses' && s.accessories.gear === 'backpack', JSON.stringify(s.accessories));
  await page.click('.shop-card[data-id="gold-crown"] .shop-action'); await page.waitForTimeout(80);
  s = await save(page);
  check('aynı yuvada tek aksesuar (taç şapkanın yerine geçer)', s.accessories.head === 'gold-crown', JSON.stringify(s.accessories));
  check('durum mesajı değişeni söyler', /Kaşif Şapkası çıkarıldı/.test(await page.textContent('#shopStatus')));
  const loadout = await page.$$eval('#loadoutSlots .loadout-item', l => l.map(x => x.textContent));
  check('kuşanılanlar listesi anında güncellenir', loadout.join('|') === 'Altın Taç|Güneş Gözlüğü|Sırt Çantası', loadout.join('|'));
  await page.click('#loadoutSlots [data-slot="face"] .loadout-remove'); await page.waitForTimeout(80);
  s = await save(page);
  check('çıkar düğmesi aksesuarı çıkarır', s.accessories.face === null);
  await page.click('.shop-card[data-id="sunglasses"] .shop-action'); await page.waitForTimeout(80);
  // önizleme tuvali boş değil (aksesuar çizildi)
  const previewDrawn = await page.evaluate(() => { const c = document.getElementById('loadoutCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  check('Riko önizlemesi çizildi', previewDrawn > 500, previewDrawn + ' piksel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);

  // 4) Aksesuarlar menüde ve oyunda (koşu, zıplama, eğilme, düşüş satırları)
  await page.evaluate(() => { window.__accRows = {}; }); await page.waitForTimeout(400);
  const menuRows = await page.evaluate(() => Object.assign({}, window.__accRows));
  check('menüde Riko aksesuarlarla çizilir (idle satırı)', menuRows[0] > 5, JSON.stringify(menuRows));
  await page.screenshot({ path: ROOT + '/tests/screenshots/redesign/menu_accessories.png' });
  await page.evaluate(() => { window.__accRows = {}; });
  await page.click('#playButton');
  await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  await page.evaluate(() => { window.__keep = setInterval(() => { DinoRush.Game.model.obstacles.length = 0; }, 20); });
  await page.waitForTimeout(600); await page.keyboard.down('Space'); await page.waitForTimeout(200); await page.keyboard.up('Space'); await page.waitForTimeout(500);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(400);
  await page.screenshot({ path: ROOT + '/tests/screenshots/redesign/game_accessories_duck.png' });
  await page.keyboard.up('ArrowDown');
  await page.evaluate(() => clearInterval(window.__keep));
  await page.waitForFunction(() => DinoRush.Game.mode === 'game_over', null, { timeout: 25000 }); await page.waitForTimeout(600);
  const rows = await page.evaluate(() => Object.assign({}, window.__accRows));
  check('oyunda aksesuarlar koşu/zıplama/eğilme/düşüş karelerinde çizilir', rows[1] > 5 && rows[2] > 0 && rows[3] > 0 && rows[4] > 0, JSON.stringify(rows));
  await page.screenshot({ path: ROOT + '/tests/screenshots/redesign/gameover_accessories.png' });
  await page.evaluate(() => DinoRush.Game.stopToMenu()); await page.waitForTimeout(300);

  // 5) Kalıcılık
  await page.reload(); await page.waitForTimeout(1800);
  s = await page.evaluate(() => DinoRush.Storage.get());
  check('yeniden açılışta sahiplik ve kuşanılanlar korunur', s.ownedAccessories.length === 4 && s.accessories.head === 'gold-crown' && s.accessories.face === 'sunglasses', JSON.stringify(s.accessories));

  // 6) Ayarlar: gerçek etkiler
  await page.mouse.click(1300, 120); await page.waitForTimeout(1200); // müziği aç (ilk etkileşim)
  await page.click('#settingsButton'); await page.waitForTimeout(300);
  check('6 ayar bölümü', (await page.$$eval('#settingsTabs [role=tab]', t => t.map(x => x.textContent.trim()))).join(',') === 'SES,GÖRÜNTÜ,KONTROLLER,VERİ,GİZLİLİK,HAKKINDA');
  const setRange = (k, v) => page.evaluate(([k, v]) => { const r = document.querySelector(`[data-range="${k}"]`); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
  await page.waitForFunction(() => DinoRush.Music.state().active === 'menu', null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  await setRange('menuMusicVolume', 40); await setRange('gameMusicVolume', 20); await setRange('masterVolume', 60); await page.waitForTimeout(500);
  let m = await page.evaluate(() => DinoRush.Music.state());
  check('MENÜ MÜZİĞİ kaydırıcısı çalan müziği ayarlar', Math.abs(m.trackVolume.menu - .4) < 1e-6 && Math.abs(m.voiceGain - .4) < .03 && Math.abs(m.level - .6) < 1e-6, JSON.stringify({ g: m.voiceGain, lv: m.level }));
  check('OYUN MÜZİĞİ ayrı kaydedilir', (await save(page)).gameMusicVolume === 20 && Math.abs(m.trackVolume.gameplay - .2) < 1e-6);
  await page.click('[data-setting="sound"]'); await page.waitForTimeout(600);
  m = await page.evaluate(() => DinoRush.Music.state());
  check('TÜM SESLER kapalı: müzik susar, kaydedilir', m.active === null && (await save(page)).sound === false);
  await page.click('[data-setting="sound"]'); await page.waitForTimeout(300);
  await page.click('#setTab-display'); await page.waitForTimeout(150);
  await page.click('[data-setting="performance"]'); await page.waitForTimeout(300);
  check('PERFORMANS MODU: tuval 1x çözünürlük', await page.evaluate(() => DinoRush.Scene.metrics.dpr) === 1, String(await page.evaluate(() => DinoRush.Scene.metrics.dpr)));
  await page.click('[data-setting="performance"]'); await page.waitForTimeout(300);
  const dprBack = await page.evaluate(() => [DinoRush.Scene.metrics.dpr, DinoRush.Scene.performanceFactor]); check('performans kapalı: yüksek çözünürlüğe döner (uyarlamalı kalite x2)', dprBack[0] > 1 && Math.abs(dprBack[0] - 2 * dprBack[1]) < .01, JSON.stringify(dprBack));
  await page.click('[data-quality="low"]'); await page.waitForTimeout(150);
  check('EFEKT KALİTESİ düşük: kaydedilir ve uygulanır', (await save(page)).lowEffects === true && await page.evaluate(() => document.documentElement.classList.contains('fx-low')));
  await page.click('[data-quality="high"]');
  await page.click('[data-setting="reduceMotion"]'); await page.waitForTimeout(150);
  check('ANİMASYONLARI AZALT: sınıf uygulanır, Riko pozu durur', await page.evaluate(() => document.documentElement.classList.contains('reduce-motion') && DinoRush.Riko.pose(1.3) === null));
  await page.click('[data-setting="reduceMotion"]');
  await page.click('[data-setting="particles"]'); await page.waitForTimeout(100);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('#playButton'); await page.waitForFunction(() => DinoRush.Game.mode === 'playing', null, { timeout: 6000 });
  await page.waitForTimeout(1200);
  check('PARÇACIK EFEKTLERİ kapalı: koşuda parçacık oluşmaz', await page.evaluate(() => DinoRush.Game.model.particles.length) === 0);
  await page.evaluate(() => DinoRush.Game.stopToMenu()); await page.waitForTimeout(200);
  await page.evaluate(() => DinoRush.Storage.update({ particles: true }));
  await page.reload(); await page.waitForTimeout(1800);
  s = await page.evaluate(() => DinoRush.Storage.get());
  check('ayarlar yeniden açılışta korunur', s.menuMusicVolume === 40 && s.gameMusicVolume === 20 && s.masterVolume === 60 && s.lowEffects === false, JSON.stringify({ a: s.menuMusicVolume, b: s.gameMusicVolume, c: s.masterVolume }));

  // 7) Veri ve kayıt
  await page.click('#settingsButton'); await page.click('#setTab-data'); await page.waitForTimeout(200);
  check('kayıt durumu ve son kayıt gösterilir', /KAYIT BU CİHAZDA/.test(await page.textContent('#saveStatusTitle')) && /Son kayıt: /.test(await page.textContent('#saveStatusText')), await page.textContent('#saveStatusText'));
  check('veri özeti: rekor, bakiye, kozmetik sayısı', (await page.textContent('#dataBest')).includes('1.520') && /\d+ \/ 30/.test(await page.textContent('#dataOwned')));
  // 1. adım yarıda bırakılırsa hiçbir şey silinmez
  const hb = await page.$('#resetHold'); const box = await hb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); await page.waitForTimeout(200);
  check('basılı tutma yarıda kalırsa onay açılmaz, veri silinmez', !(await page.isVisible('#resetConfirm')) && (await save(page)).best === 1520);
  await page.mouse.down(); await page.waitForTimeout(2300); await page.mouse.up(); await page.waitForTimeout(150);
  check('2 sn basılı tutunca son uyarı (2. adım) açılır', await page.isVisible('#resetConfirm'));
  await page.click('#resetCancel'); await page.waitForTimeout(100);
  check('vazgeçince veri yerinde', (await save(page)).best === 1520);
  await page.check('#resetEverything');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(2300); await page.mouse.up(); await page.waitForTimeout(150);
  check('tam sıfırlama uyarısı ayarları da anar', /ayarların ve Riko/.test(await page.textContent('#resetWarnText')));
  await page.click('#resetConfirmOk'); await page.waitForTimeout(300);
  s = await save(page);
  const riko = await page.evaluate(() => localStorage.getItem('dinorush-riko-v1'));
  check('tam sıfırlama: ilerleme, aksesuarlar ve ayarlar varsayılana döner', s.best === 0 && s.fossils === 0 && s.ownedAccessories.length === 0 && s.masterVolume === 80 && s.menuMusicVolume === 70, JSON.stringify({ b: s.best, mv: s.masterVolume }));
  check('Riko geçmişi silindi ve yeniden temiz başladı', !riko || JSON.parse(riko).recentMessages.length === 0, riko);

  // 8) Gizlilik
  await page.click('#setTab-privacy'); await page.waitForTimeout(150);
  const priv = await page.textContent('#set-privacy');
  check('gizlilik: gerçek anahtarlar, çerez yok, hukuki not, KVKK, silme, iletişim', ['dinorush-save-v1', 'dinorush-riko-v1', 'çerez kullanmaz', 'hukuki danışmanlık', 'KVKK', 'Verileri sıfırla', 'ardaportfoy.vercel.app', 'Üçüncü taraf'].every(t => priv.includes(t)));
  // Metin kendi içinde kayar (mobil)
  const mob = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const mp = await mob.newPage(); await mp.goto(BASE); await mp.waitForTimeout(1500);
  await mp.evaluate(() => document.getElementById('settingsButton').click()); await mp.evaluate(() => document.getElementById('setTab-privacy').click()); await mp.waitForTimeout(200);
  const sc = await mp.evaluate(() => { const s = document.getElementById('settingsScroll'), p = document.querySelector('#settingsModal .modal-plaque').getBoundingClientRect(); s.scrollTop = 99999; return { scrollable: s.scrollHeight > s.clientHeight + 50, top: s.scrollTop > 0, inView: p.bottom <= innerHeight && p.top >= 0 }; });
  check('mobil: gizlilik metni panelin içinde kayar, panel ekranda kalır', sc.scrollable && sc.top && sc.inView, JSON.stringify(sc));
  await mob.close();

  // 9) Hakkında ve portföy bağlantısı
  await page.click('#setTab-about'); await page.waitForTimeout(150);
  const link = await page.$eval('.portfolio-btn', a => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent.replace(/\s+/g, ' ').trim(), w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height }));
  check('portföy düğmesi: doğru adres, yeni sekme, noopener, metin', link.href === 'https://ardaportfoy.vercel.app/' && link.target === '_blank' && /noopener/.test(link.rel) && link.text.startsWith('TASARIMCI & GELİŞTİRİCİ') && link.text.includes("DinoRush'ın arkasındaki geliştiriciyi ve diğer projelerini keşfet."), JSON.stringify(link));
  check('portföy düğmesi büyük ve belirgin', link.w >= 300 && link.h >= 56, link.w + 'x' + link.h);
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('.portfolio-btn')]);
  await popup.waitForLoadState(); check('tıklayınca yeni sekmede açılır', popup.url() === 'https://ardaportfoy.vercel.app/', popup.url()); await popup.close();
  check('hakkında: geliştirici adı, sürüm, telif', (await page.textContent('#set-about')).includes('Arda Irmak') && (await page.textContent('#aboutVersion')) === '1.2.0' && (await page.textContent('#set-about')).includes('© 2026'));

  // 10) Modal davranışı: arka plan engelli, Esc önce iç onayı kapatır
  const blocked = await page.evaluate(() => { const r = document.getElementById('playButton').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e.closest('.modal-shell'); });
  check('modal açıkken arka plandaki OYNA tıklanamaz', blocked);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Esc ayarları kapatır', !(await page.isVisible('#settingsModal')));
  await page.evaluate(() => DinoRush.Storage.update({ fossils: 500 }));
  await page.click('#collectionButton'); await page.click('#shopTab-accessory'); await page.click('.shop-card[data-id="winter-beanie"] .shop-action'); await page.waitForTimeout(100);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('Esc önce satın alma onayını kapatır, mağaza açık kalır', !(await page.isVisible('#shopConfirm')) && await page.isVisible('#collectionModal') && (await save(page)).fossils === 500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('ikinci Esc mağazayı kapatır', !(await page.isVisible('#collectionModal')));
  check('sayfa hatası yok', errs.length === 0, errs.join(' | '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' KALDI' : 'hepsi geçti');
})();
