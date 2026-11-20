// Mağaza ve ayarlar: 10 çözünürlükte taşma / çakışma / kesilme / dokunma hedefi denetimi. node tests/e2e/layout.e2e.js
const { chromium } = require('playwright-core');
const H = require('./helpers');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const URL = pathToFileURL(H.ROOT + '/index.html').href;
const OUT = H.ROOT + '/tests/screenshots/redesign/'; fs.mkdirSync(OUT, { recursive: true });
const SIZES = (process.argv[2] || '320x568,360x640,375x667,390x844,430x932,768x1024,1024x768,1366x768,1440x900,1920x1080').split(',');
process.on('exit', () => { if (fails) process.exitCode = 1; });
let fails = 0; const problems = [];
const check = (n, ok, info) => { if (!ok) { fails++; problems.push(n + (info ? '  ' + info : '')); } };

const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const shell = document.querySelector('.modal-shell:not([hidden])'), plaque = shell.querySelector('.modal-plaque'), pr = plaque.getBoundingClientRect();
  if (document.documentElement.scrollWidth > vw + 1) out.push('sayfa yatay taşıyor ' + document.documentElement.scrollWidth);
  if (pr.left < -0.5 || pr.right > vw + 0.5 || pr.top < -0.5 || pr.bottom > vh + 0.5) out.push(`panel ekran dışında ${Math.round(pr.left)},${Math.round(pr.top)},${Math.round(pr.right)},${Math.round(pr.bottom)}`);
  plaque.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return; const r = e.getBoundingClientRect();
    if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1) && !e.closest('.shop-preview') && getComputedStyle(e).position !== 'absolute') out.push('panelden taşan öğe: ' + (e.id || e.className || e.tagName));
  });
  for (const sel of ['.sheet-head', '.sheet-tabs', '.sheet-foot']) { const el = plaque.querySelector(sel); if (!el) continue; const r = el.getBoundingClientRect(); if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.height < 10) out.push(sel + ' görünmüyor'); }
  const scroller = plaque.querySelector('.sheet-scroll'), sr = scroller.getBoundingClientRect();
  if (sr.height < Math.min(160, vh * 0.25)) out.push('içerik alanı çok küçük ' + Math.round(sr.height));
  if (scroller.scrollWidth > scroller.clientWidth + 1) out.push('içerik yatay taşıyor ' + scroller.scrollWidth + '>' + scroller.clientWidth);
  plaque.querySelectorAll('.ui-tab, .shop-name, .setting-row b, .shop-action span, .filter-chip, .loadout-label, .portfolio-title, .set-group').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') out.push('kesik metin: ' + e.textContent.trim().slice(0, 24));
  });
  const cards = [...plaque.querySelectorAll('.shop-card')].map(c => c.getBoundingClientRect());
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) { const a = cards[i], b = cards[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) { out.push(`kart çakışması ${i}-${j}`); i = cards.length; break; } }
  const small = [];
  plaque.querySelectorAll('button, a, input[type=range], input[type=checkbox]').forEach(e => { if (e.tagName === 'A' && e.closest('p')) return; // metin içi bağlantı (WCAG 2.5.8 istisnası)
    if (!e.getClientRects().length || e.closest('[hidden]')) return; const r = e.getBoundingClientRect();
    const minH = e.type === 'checkbox' ? 20 : 32; if (r.height < minH - .5 || r.width < 20) small.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  if (small.length) out.push('küçük dokunma hedefi: ' + [...new Set(small)].slice(0, 4).join(', '));
  return out;
};

(async () => {
  const browser = await chromium.launch({ ...H.launchOptions(), headless: true });
  for (const s of SIZES) {
    const [w, h] = s.split('x').map(Number), mobile = w < 768;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    await ctx.addInitScript(() => { localStorage.setItem('dinorush-riko-v1', JSON.stringify({ firstVisit: false, recentMessages: [], lastMessageId: null, lastSeen: Date.now() })); if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('dinorush-save-v1', JSON.stringify({ best: 900, fossils: 640, owned: ['fern', 'amber'], ownedAccessories: ['explorer-hat', 'sunglasses', 'backpack'], accessories: { head: 'explorer-hat', face: 'sunglasses', gear: 'backpack' } })); } });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL); await page.waitForTimeout(1800);
    await page.evaluate(() => { DinoRush.Riko && DinoRush.Riko.hide(true); DinoRush.Riko && DinoRush.Riko.setIdleDelay(9e9); });
    await page.evaluate(() => document.getElementById('collectionButton').click()); await page.waitForTimeout(500);
    for (const kind of ['skin', 'trail', 'scene', 'accessory']) {
      await page.evaluate(k => document.getElementById('shopTab-' + k).click(), kind); await page.waitForTimeout(350);
      await page.evaluate(() => DinoRush.Riko && DinoRush.Riko.hide(true));
      const issues = await page.evaluate(AUDIT);
      check(`${s} mağaza/${kind}`, issues.length === 0, issues.join(' | '));
      if (kind === 'skin' || kind === 'accessory') await page.screenshot({ path: `${OUT}${s}_shop_${kind}.png` });
    }
    await page.waitForTimeout(450);
    const lastOk = await page.evaluate(() => { const sc = document.getElementById('shopScroll'); sc.scrollTop = sc.scrollHeight; const last = [...document.querySelectorAll('.shop-card')].pop().getBoundingClientRect(), r = sc.getBoundingClientRect(); return last.bottom <= r.bottom + 1 && last.top >= r.top - 8 - Math.max(0, last.height - r.height); });
    check(`${s} mağaza: son kart kaydırınca tamamen görünür`, lastOk);
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await page.evaluate(() => document.getElementById('settingsButton').click()); await page.waitForTimeout(400);
    for (const tab of ['audio', 'display', 'controls', 'data', 'privacy', 'about']) {
      await page.evaluate(t => document.getElementById('setTab-' + t).click(), tab); await page.waitForTimeout(250);
      await page.evaluate(() => DinoRush.Riko && DinoRush.Riko.hide(true));
      const issues = await page.evaluate(AUDIT);
      check(`${s} ayarlar/${tab}`, issues.length === 0, issues.join(' | '));
      if (['audio', 'controls', 'data', 'privacy', 'about'].includes(tab)) await page.screenshot({ path: `${OUT}${s}_set_${tab}.png` });
    }
    // Kaşif karnesi (profil): başarımlar ve istatistikler
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('profileButton').click()); await page.waitForTimeout(400);
    for (const tab of ['ach', 'stats']) {
      await page.evaluate(t => document.getElementById('profTab-' + t).click(), tab); await page.waitForTimeout(250);
      await page.evaluate(() => DinoRush.Riko && DinoRush.Riko.hide(true));
      const issues = await page.evaluate(AUDIT);
      check(`${s} profil/${tab}`, issues.length === 0, issues.join(' | '));
      if (tab === 'ach') await page.screenshot({ path: `${OUT}${s}_profile.png` });
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    // Oyun sonu: tüm döküm kalemleri dolu; panel ekranda, düğmeler kaydırarak erişilebilir, yatay taşma yok
    const goIssues = await page.evaluate(() => {
      DinoRush.UI.showGameOver({ score: 4210, best: 5120, fossils: 37, record: false, breakdown: { collected: 37, nearMiss: 6, chain: 12, score: 42, record: 25, daily: 30, achievements: 140, total: 292 }, daily: { first: true, bonus: 30, daily: { streak: 3 } }, unlocked: [] });
      const out = [], panel = document.querySelector('#gameOverPanel .panel-inner'), r = panel.getBoundingClientRect();
      if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) out.push('panel ekran dışında');
      if (document.documentElement.scrollWidth > innerWidth + 1 || panel.scrollWidth > panel.clientWidth + 1) out.push('yatay taşma');
      for (const id of ['retryButton', 'shareButton', 'gameOverShop']) { const b = document.getElementById(id); b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); if (q.height < 44 || q.bottom > r.bottom + 1 || q.top < r.top - 1) out.push(id + ' erişilemez ' + Math.round(q.height)); }
      document.querySelectorAll('#runBreakdown dt, #runBreakdown dd').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) out.push('kesik: ' + e.textContent); });
      return out;
    });
    check(`${s} oyun sonu dökümü`, goIssues.length === 0, goIssues.join(' | '));
    await page.screenshot({ path: `${OUT}${s}_gameover.png` });
    check(`${s} sayfa hatası yok`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await browser.close();
  problems.forEach(p => console.log('KALDI ' + p));
  console.log(fails ? `${fails} KALDI` : `hepsi geçti (${SIZES.length} çözünürlük x 13 ekran)`);
})();
