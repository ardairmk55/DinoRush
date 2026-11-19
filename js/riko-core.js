/*
 * Riko mesaj seçim çekirdeği (saf fonksiyonlar; DOM ve zamanlayıcı yok).
 * Tarayıcıda window.DinoRush.RikoCore, Node'da module.exports (tests/riko.test.js).
 */
(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./riko-messages.js") : (root.DinoRush || {}).RikoMessages);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).RikoCore = api;
})(typeof self !== "undefined" ? self : this, function (data) {
  "use strict";
  const { messages, roles } = data;
  const byId = new Map(messages.map(m => [m.id, m]));
  const byCat = messages.reduce((acc, m) => ((acc[m.cat] = acc[m.cat] || []).push(m), acc), {});

  // Öncelik: büyük sayı önce. Aktif mesajdan düşük öncelikli olay gelirse yok sayılır (kuyruk birikmez).
  const PRIORITY = Object.freeze({ record: 8, gameover: 7, start: 6, fossil: 5, store: 4, settings: 4, click: 3, menu: 2, idle: 1 });

  // Tetikleyici -> kategori ağırlıkları
  const TRIGGERS = Object.freeze({
    menu: { greeting: 1 },
    click: { funny: 5, greeting: 2, motivation: 1 },
    start: { gameplay: 1 },
    fossil: { fossil: 1 },
    gameover: { gameover: 1 },
    store: { store: 1 },
    settings: { settings: 1 },
    idle: { idle: 3, motivation: 2 }
  });

  const HISTORY_MAX = 10, HARD_BLOCK = 5;
  const LONG_RETURN_MS = 3 * 24 * 60 * 60 * 1000; // 3 gün

  function defaults() {
    return { v: 1, recentMessages: [], lastMessageId: null, firstVisit: true, lastSeen: null };
  }

  /** Bozuk/eksik kaydı güvenli varsayılanlara çevirir. */
  function normalize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
    const recent = Array.isArray(raw.recentMessages) ? raw.recentMessages.filter(id => byId.has(id)) : [];
    d.recentMessages = recent.slice(-HISTORY_MAX);
    d.lastMessageId = byId.has(raw.lastMessageId) ? raw.lastMessageId : (d.recentMessages[d.recentMessages.length - 1] || null);
    d.firstVisit = raw.firstVisit !== false;
    d.lastSeen = Number.isFinite(raw.lastSeen) && raw.lastSeen > 0 ? raw.lastSeen : null;
    return d;
  }

  /** Mevcut rekor verisinden ton katmanı (yeni seviye sistemi değil). */
  function tierFor(best) {
    best = Number(best) || 0;
    if (best < 300) return "new";
    if (best < 1500) return "growing";
    if (best < 4000) return "experienced";
    return "pro";
  }
  // Katmana göre ek kategori olasılıkları: gelişen oyuncuya motivasyon, deneyimliye özgüvenli/özel.
  const TIER_MIX = {
    new: { motivation: 0, special: 0.04 },
    growing: { motivation: 0.25, special: 0.06 },
    experienced: { motivation: 0.15, special: 0.09 },
    pro: { motivation: 0.1, special: 0.12 }
  };

  /** Tekrar önleme: son 10'u dışla; yetmezse son 5'i; yetmezse yalnız sonuncuyu. Sonuncu asla tekrar etmez. */
  function filterFresh(pool, history) {
    const recent = history.recentMessages;
    const tiers = [recent.slice(-HISTORY_MAX), recent.slice(-HARD_BLOCK), [history.lastMessageId]];
    for (const block of tiers) {
      const left = pool.filter(m => !block.includes(m.id));
      if (left.length) return left;
    }
    return [];
  }

  function weightedCat(weights, rng, avoidCat) {
    const entries = Object.entries(weights).filter(([c, w]) => w > 0 && byCat[c]);
    // Çeşitlilik: son mesajın kategorisi tekrar gelirse ağırlığını yarıya indir.
    const adj = entries.map(([c, w]) => [c, c === avoidCat && entries.length > 1 ? w / 2 : w]);
    const total = adj.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [c, w] of adj) { if ((r -= w) < 0) return c; }
    return adj[adj.length - 1][0];
  }

  /**
   * Bir tetikleyici için mesaj seçer. ctx: { best, now, rng, record }
   * Döner: mesaj nesnesi veya null (uygun taze mesaj yoksa — aynı mesaj art arda gösterilmez).
   */
  function choose(trigger, history, ctx) {
    ctx = ctx || {};
    const rng = ctx.rng || Math.random, now = ctx.now || Date.now();
    const last = byId.get(history.lastMessageId);
    // Öncelikli olaylar sabit mesaj kullanır (rastgele havuzdan bağımsız)
    if (trigger === "record") return pick([byId.get(roles.recordInRun)], history);
    if (trigger === "gameover" && ctx.record) return pick([byId.get(roles.recordGameOver)], history) || pick(byCat.gameover, history, rng);
    if (trigger === "menu") {
      if (history.firstVisit) return byId.get(roles.firstVisit);
      if (history.lastSeen && now - history.lastSeen > LONG_RETURN_MS && history.lastMessageId !== roles.longReturn) return byId.get(roles.longReturn);
    }
    const weights = Object.assign({}, TRIGGERS[trigger]);
    if (!Object.keys(weights).length) return null;
    // Menü ve tıklamada katmana göre motivasyon ve nadir özel mesaj
    if (trigger === "menu" || trigger === "click") {
      const mix = TIER_MIX[tierFor(ctx.best)];
      const specialRecently = history.recentMessages.some(id => (byId.get(id) || {}).cat === "special");
      if (!specialRecently && rng() < mix.special) {
        const sp = pick(byCat.special, history, rng);
        if (sp) return sp;
      }
      if (trigger === "menu" && rng() < mix.motivation) {
        const mo = pick(byCat.motivation, history, rng);
        if (mo) return mo;
      }
    }
    const cat = weightedCat(weights, rng, last && last.cat);
    let pool = byCat[cat];
    if (trigger === "menu") pool = pool.filter(m => m.id !== roles.firstVisit && m.id !== roles.longReturn);
    return pick(pool, history, rng) || pick(Object.keys(weights).flatMap(c => byCat[c]).filter(m => m.id !== roles.firstVisit), history, rng);
  }

  function pick(pool, history, rng) {
    const fresh = filterFresh((pool || []).filter(Boolean), history);
    if (!fresh.length) return null;
    return fresh[Math.floor((rng || Math.random)() * fresh.length)];
  }

  /** Gösterilen mesajı geçmişe ekler (yeni nesne döner). */
  function remember(history, msg, now) {
    const h = normalize(history);
    h.recentMessages = h.recentMessages.concat(msg.id).slice(-HISTORY_MAX);
    h.lastMessageId = msg.id;
    if (msg.id === roles.firstVisit) h.firstVisit = false;
    h.lastSeen = now || Date.now();
    return h;
  }

  /** Okuma süresi: kısa ~3 sn, orta 4–5 sn, uzun 6–7 sn. Koşu sırasında en fazla 3,5 sn (dikkat dağıtmasın). */
  function durationFor(text, inPlay) {
    const ms = Math.min(7000, Math.max(3000, 1400 + text.length * 42));
    return inPlay ? Math.min(ms, 3500) : ms;
  }

  /** Öncelik kararı: aktif mesaj sürerken yalnız eşit veya daha yüksek öncelik onu değiştirir. */
  function canInterrupt(active, trigger, now) {
    if (!active || now >= active.until) return true;
    return (PRIORITY[trigger] || 0) >= active.priority;
  }

  /** Fosil konuşması: koşu içi eşiklerde (10, 25, 50, 100, sonra her 100), en az 15 sn arayla. */
  const FOSSIL_MILESTONES = [10, 25, 50, 100];
  function fossilMilestone(runFossils, lastSpokeAt, now) {
    const hit = FOSSIL_MILESTONES.includes(runFossils) || (runFossils > 100 && runFossils % 100 === 0);
    return hit && (!lastSpokeAt || now - lastSpokeAt >= 15000);
  }

  return { messages, roles, PRIORITY, TRIGGERS, HISTORY_MAX, HARD_BLOCK, LONG_RETURN_MS, defaults, normalize, tierFor, choose, remember, durationFor, canInterrupt, fossilMilestone, byCat };
});
