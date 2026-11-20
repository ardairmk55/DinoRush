// Arka plan müziği senaryoları. node tests/e2e/music.e2e.js
const { chromium } = require('playwright-core');
const H = require('./helpers');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = H.ROOT;
const REF = JSON.parse(fs.readFileSync(H.fixture('music_ref.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.json': 'application/json', '.md': 'text/plain' };
process.on('exit', () => { if (fails) process.exitCode = 1; });
let fails = 0;
const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'GEÇTİ ' : 'KALDI ') + n + (info !== undefined ? '  ' + info : '')); };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const st = page => page.evaluate(() => DinoRush.Music.state());
async function waitFor(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (_) { return false; } }
// Oyun dışı boş bir noktaya dokun (tuvale düşen ilk nokta)
async function blankPoint(page) {
  // Mobil Chrome dokunuşu yakındaki düğmeye kaydırır: çevresi 40 px boyunca da boş olan bir nokta seç
  return page.evaluate(() => { const blank = (x, y) => { const e = document.elementFromPoint(x, y); return e && ['gameCanvas', 'gameApp', 'menuLayer'].includes(e.id); };
    for (let y = 80; y < innerHeight - 60; y += 20) for (let x = innerWidth - 50; x > 50; x -= 20) if ([[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40], [30, 30], [-30, -30], [30, -30], [-30, 30]].every(([dx, dy]) => blank(x + dx, y + dy))) return { x, y }; return null; });
}

function noOverlap(log) {
  const s = log.slice().sort((a, b) => a.from - b.from);
  for (let i = 1; i < s.length; i++) { const prev = s[i - 1]; if (prev.to === null || s[i].from < prev.to - 0.005) return `${prev.name}[${prev.from.toFixed(2)}-${prev.to}] ile ${s[i].name}@${s[i].from.toFixed(2)}`; }
  return null;
}

async function open(browser, url, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts && opts.ctx));
  if (opts && opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage(); page.errs = []; page.mp3 = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
  page.on('request', r => { if (r.url().endsWith('.mp3')) page.mp3.push(r.url().split('/').pop()); });
  await page.goto(url); await page.waitForTimeout(2200);
  return page;
}

(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });

  // 1) Otomatik oynatma kuralı: etkileşimden önce sessiz, dosya da inmez
  let page = await open(browser, BASE);
  let s = await st(page);
  check('etkileşimden önce müzik başlamaz, AudioContext yok, MP3 indirilmez', !s.unlocked && s.ctx === null && page.mp3.length === 0, JSON.stringify({ u: s.unlocked, ctx: s.ctx, mp3: page.mp3 }));

  // 2) İlk etkileşim -> menü müziği
  const pt = await blankPoint(page); await page.mouse.click(pt.x, pt.y);
  let ok = await waitFor(page, () => DinoRush.Music.state().active === 'menu');
  s = await st(page);
  check('ilk etkileşimden sonra menü müziği çalar (Web Audio, bağlam çalışıyor)', ok && s.mode === 'webaudio' && s.ctx === 'running', JSON.stringify({ mode: s.mode, ctx: s.ctx, active: s.active }));
  await page.waitForTimeout(1500);
  s = await st(page);
  check('menü çalınca oyun parçası önceden hazırlanır; her dosya bir kez iner', s.loaded.includes('gameplay') && page.mp3.filter(f => f === 'menu-theme.mp3').length === 1 && page.mp3.filter(f => f === 'gameplay-theme.mp3').length === 1, page.mp3.join(','));
  check('etkileşim dinleyicileri bağlam çalışınca kaldırılır', s.hooked === false);

  // 3) Döngü noktaları: kodlayıcı boşluğu atlanır, içerik örnek düzeyinde hizalı (gerçek içerik referansla çapraz ilintiyle bulunur)
  const seam = await page.evaluate(async ref => {
    const out = {};
    for (const name of ['menu', 'gameplay']) {
      const r = ref[name];
      const data = await (await fetch(`assets/audio/${name}-theme.mp3`)).arrayBuffer();
      const buf = await new OfflineAudioContext(1, 1, r.sr).decodeAudioData(data);
      const x = buf.getChannelData(0);
      const bestLag = (seg, at, span) => { let best = -1e9, lag = 0; for (let L = -span; L <= span; L++) { let sum = 0; for (let i = 0; i < 2048; i++) sum += (x[at + L + i] || 0) * seg[i]; if (sum > best) { best = sum; lag = L; } } return at + lag; };
      const realStart = bestLag(r.head, 1105, 1100), realEnd = bestLag(r.tail, 1105 + r.len - 4096, 1100) + 4096;
      const t = DinoRush.Config.music.tracks[name], d = t.delay / t.rate;
      out[name] = { realStart, realEnd, cfgStart: Math.round(d * r.sr), cfgEnd: Math.round((d + t.samples / t.rate) * r.sr), lp: DinoRush.Music.loopPoints(name), sr: r.sr };
    }
    return out;
  }, REF);
  for (const name of ['menu', 'gameplay']) {
    const z = seam[name], lpS = Math.round(z.lp.start * z.sr), lpE = Math.round(z.lp.end * z.sr);
    check(`${name}: döngü başı ve sonu gerçek içerikle örneği örneğine aynı (çalışma anında da)`, z.realStart === z.cfgStart && z.realEnd === z.cfgEnd && Math.abs(lpS - z.realStart) <= 1 && Math.abs(lpE - z.realEnd) <= 1, JSON.stringify(z));
  }

  // 4) Mağaza ve ayarlar: menü müziği kesilmeden sürer
  const before = (await st(page)).log.length;
  await page.click('#collectionButton'); await page.waitForTimeout(700);
  s = await st(page); check('mağaza açıkken menü müziği sürer (yeniden başlamaz)', s.active === 'menu' && s.log.length === before);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('#settingsButton'); await page.waitForTimeout(700);
  s = await st(page); check('ayarlar açıkken menü müziği sürer', s.active === 'menu' && s.log.length === before);

  // 5) Müzik kapat/aç, ses düzeyi, sessiz
  await page.click('[data-setting="music"]'); await page.waitForTimeout(800);
  s = await st(page); const saved1 = await page.evaluate(() => JSON.parse(localStorage.getItem('dinorush-save-v1')).music);
  check('MÜZİK kapalı: müzik yumuşakça durur, tercih kaydedilir', s.active === null && s.level === 0 && saved1 === false, JSON.stringify({ active: s.active, saved: saved1 }));
  await page.waitForTimeout(400);
  const silent = await page.evaluate(() => { const m = DinoRush.Music.state(); return m.log.every(e => e.to !== null && e.to <= m.time); });
  check('kapalıyken hiçbir parça çalmıyor', silent);
  await page.click('[data-setting="music"]'); ok = await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 4000);
  check('MÜZİK yeniden açılınca menü müziği döner', ok);
  await page.waitForTimeout(900); await page.evaluate(() => { const r = document.querySelector('[data-range="menuMusicVolume"]'); r.value = '30'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(500);
  s = await st(page);
  const vol = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('dinorush-save-v1')); return { mv: v.menuMusicVolume, master: v.masterVolume, out: document.querySelector('[data-range="menuMusicVolume"]').parentElement.querySelector('output').textContent }; });
  check('MENÜ MÜZİĞİ %30: düzey anında uygulanır ve kaydedilir', vol.mv === 30 && vol.out === '%30' && Math.abs(s.level - vol.master / 100) < 1e-6 && Math.abs(s.trackVolume.menu - 0.3) < 1e-6 && Math.abs(s.voiceGain - 0.3) < 0.03, JSON.stringify(Object.assign(vol, { gain: s.voiceGain })));
  await page.click('[data-setting="sound"]'); await page.waitForTimeout(700);
  s = await st(page); check('TÜM SESLER kapanınca müzik de susar', s.active === null && s.level === 0);
  await page.click('[data-setting="sound"]'); await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 4000);

  // 6) Yenileme: tercihler korunur
  await page.reload(); await page.waitForTimeout(2200);
  const persisted = await page.evaluate(() => { const s = DinoRush.Storage.get(); return { music: s.music, musicVolume: s.menuMusicVolume, slider: document.querySelector('[data-range="menuMusicVolume"]').value }; });
  check('sayfa yenilenince müzik tercihleri korunur', persisted.music === true && persisted.musicVolume === 30, JSON.stringify(persisted));
  const p2 = await blankPoint(page); await page.mouse.click(p2.x, p2.y);
  await waitFor(page, () => DinoRush.Music.state().active === 'menu');
  await page.waitForTimeout(1200);

  // 7) Oyuna giriş -> oyun müziği, üst üste binmeden
  await page.evaluate(() => DinoRush.Storage.update({ tutorialDone: true })); // öğretici bu testin konusu değil
  await page.click('#playButton');
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 3000);
  s = await st(page);
  const lastMenu = s.log.filter(e => e.name === 'menu').pop(), gp = s.log.filter(e => e.name === 'gameplay').pop();
  check('OYNA: oyun müziğine geçiş', ok);
  check('geçiş: menü 0,45 sn'+"'de kısılıp biter, oyun parçası ardından 0,7 sn'de açılır (üst üste binme yok)", lastMenu && gp && lastMenu.to !== null && gp.from >= lastMenu.to - 0.005 && gp.from - lastMenu.to < 0.1, JSON.stringify({ menuBitis: lastMenu && lastMenu.to && lastMenu.to.toFixed(3), oyunBaslangic: gp && gp.from.toFixed(3) }));

  // 8) Duraklat / devam: kaldığı yerden
  await waitFor(page, () => DinoRush.Game.mode === 'playing', null, 5000);
  await page.evaluate(() => { window.__keep = setInterval(() => { DinoRush.Game.model.obstacles.length = 0; }, 20); }); // koşu sürsün
  await page.waitForTimeout(1500);
  const posBefore = (await st(page)).position;
  await page.keyboard.press('p'); await page.waitForTimeout(600);
  s = await st(page);
  check('duraklatma: oyun müziği yumuşakça susar', s.active === null && s.paused === true, JSON.stringify({ active: s.active, paused: s.paused }));
  await page.waitForTimeout(800);
  await page.keyboard.press('p'); await page.waitForTimeout(200);
  s = await st(page);
  check('devam: oyun müziği kaldığı yerden sürer (baştan başlamaz)', s.active === 'gameplay' && s.position > posBefore && s.position < posBefore + 1.2, JSON.stringify({ duraklatmadanOnce: posBefore && posBefore.toFixed(2), devamda: s.position && s.position.toFixed(2) }));

  // 9) Arka plana alma (sekme gizli) ve dönüş
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  s = await st(page);
  const gm = await page.evaluate(() => DinoRush.Game.mode);
  check('sekme gizlenince ses bağlamı askıya alınır, oyun da kendini duraklatır', s.ctx === 'suspended' && gm === 'paused', JSON.stringify({ ctx: s.ctx, oyun: gm }));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  s = await st(page);
  check('sekmeye dönünce bağlam sürer; oyun duraklı olduğu için müzik sessiz bekler', s.ctx === 'running' && s.active === null, JSON.stringify({ ctx: s.ctx, active: s.active }));
  await page.keyboard.press('p'); ok = await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 3000);
  check('devam edince oyun müziği geri gelir', ok);

  // 10) Oyun sonu -> menü müziği
  await page.evaluate(() => clearInterval(window.__keep));
  ok = await waitFor(page, () => DinoRush.Game.mode === 'game_over', null, 25000);
  ok = ok && await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 4000);
  s = await st(page);
  check('oyun bitince menü müziğine yumuşak geçiş', ok, JSON.stringify(s.log.slice(-2).map(e => e.name)));
  // Yeniden oyna: oyun müziği baştan
  await waitFor(page, () => !document.getElementById('retryButton').disabled, null, 3000);
  await page.click('#retryButton'); await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 3000);
  await page.waitForTimeout(300);
  s = await st(page);
  const lpG = await page.evaluate(() => DinoRush.Music.loopPoints('gameplay'));
  check('yeni koşuda oyun müziği baştan başlar', s.active === 'gameplay' && s.position - lpG.start < 1.5, s.position && s.position.toFixed(2));
  // Duraklat -> menüye dön
  await waitFor(page, () => DinoRush.Game.mode === 'playing', null, 5000);
  await page.keyboard.press('p'); await page.waitForTimeout(300);
  const quit = await page.$('#pausePanel [data-return-menu]');
  if (quit) { await quit.click(); ok = await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 4000); check('duraklatmadan ana menüye dönünce menü müziği', ok); }
  else check('duraklatmadan ana menüye dönüş düğmesi bulundu', false);
  s = await st(page);
  const ov = noOverlap(s.log);
  check('tüm akışta iki müzik hiçbir an üst üste çalmadı', ov === null, ov || `${s.log.length} çalma aralığı`);
  check('aynı anda en fazla bir aktif parça', s.log.filter(e => e.to === null).length <= 1);
  check('masaüstü akışında sayfa hatası yok', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // 11) Mobil: dokunma ile başlar
  page = await open(browser, BASE, { ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
  s = await st(page);
  const before0 = !s.unlocked && page.mp3.length === 0;
  const mp = await blankPoint(page); await page.touchscreen.tap(mp.x, mp.y);
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 8000);
  s = await st(page);
  check('mobil 390x844: ilk dokunuştan önce sessiz, dokununca menü müziği', before0 && ok && s.ctx === 'running', JSON.stringify({ before0, ctx: s.ctx }));
  const box = await page.locator('#playButton').boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 4000);
  check('mobil: OYNA dokunuşuyla oyun müziği', ok, JSON.stringify({ oyun: await page.evaluate(() => DinoRush.Game.mode), m: await st(page).then(m => ({ a: m.active, w: m.want, ctx: m.ctx, log: m.log, loaded: m.loaded })), box }));
  check('mobil: sayfa hatası yok', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // 12) İlk etkileşim doğrudan OYNA ise: menü atlanır, oyun müziği gelir
  page = await open(browser, BASE);
  await page.click('#playButton');
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 6000);
  s = await st(page);
  check('ilk etkileşim OYNA: doğrudan oyun müziği, menü parçası duyulmaz', ok && !s.log.some(e => e.name === 'menu' && (e.to === null || e.to - e.from > 0.05)), JSON.stringify(s.log.map(e => e.name)));
  await page.context().close();

  // 13) Müzik kapalı kayıtla açılış: hiçbir MP3 inmez
  page = await open(browser, BASE, { init: () => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('dinorush-save-v1', JSON.stringify({ music: false })); } } });
  const bp = await blankPoint(page); await page.mouse.click(bp.x, bp.y); await page.waitForTimeout(1500);
  s = await st(page);
  check('müzik kapalıyken etkileşimden sonra da dosya inmez, çalmaz', s.active === null && page.mp3.length === 0, page.mp3.join(','));
  await page.context().close();

  // 14) file:// (yerel dosya): <audio> yedeği
  page = await open(browser, pathToFileURL(ROOT + '/index.html').href);
  const fp = await blankPoint(page); await page.mouse.click(fp.x, fp.y);
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'menu', null, 6000);
  await page.waitForTimeout(1200);
  s = await st(page);
  check('file:// açılışta <audio> yedeği ile menü müziği', ok && s.mode === 'element', JSON.stringify({ mode: s.mode, active: s.active }));
  await page.click('#playButton');
  ok = await waitFor(page, () => DinoRush.Music.state().active === 'gameplay', null, 4000);
  await page.waitForTimeout(1500);
  s = await st(page);
  check('file://: oyun müziğine geçiş, üst üste binme yok', ok && noOverlap(s.log) === null, noOverlap(s.log) || '');
  check('file://: sayfa hatası yok', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  await browser.close(); srv.close();
  console.log(fails ? `${fails} KALDI` : 'hepsi geçti');
})();
