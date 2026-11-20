/*
 * DinoRush ilerleme çekirdeği (saf fonksiyonlar): istatistikler, başarımlar, günlük seri ve koşu sonu bonusu.
 * Tarayıcıda window.DinoRush.ProgressCore, Node'da module.exports (tests/progress.test.js).
 * DOM, zamanlayıcı veya localStorage kullanmaz; girdi kaydını değiştirmez, yeni nesne döner.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).ProgressCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEATHS = ["log", "rock", "bush", "flyer", "faller"];

  function emptyStats() {
    return { runs: 0, totalScore: 0, totalFossils: 0, bestRunFossils: 0, nearMisses: 0, bestRunNearMisses: 0, chains: 0, bestChain: 0, pterosDodged: 0, jumps: 0, longestRun: 0, deaths: { log: 0, rock: 0, bush: 0, flyer: 0, faller: 0 } };
  }
  const num = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max || Number.MAX_SAFE_INTEGER) : 0; };

  /** Bozuk/eksik istatistik ve ilerleme alanlarını güvenli değerlere çevirir. */
  function normalizeStats(raw) {
    const s = emptyStats(), src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    for (const k of Object.keys(s)) if (k !== "deaths" && k !== "longestRun") s[k] = num(src[k]);
    s.longestRun = Math.max(0, Number(src.longestRun) || 0);
    const d = src.deaths && typeof src.deaths === "object" ? src.deaths : {};
    for (const k of DEATHS) s.deaths[k] = num(d[k]);
    return s;
  }
  function normalizeAchievements(raw) {
    const out = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) for (const a of ACHIEVEMENTS) { const t = Number(raw[a.id]); if (Number.isFinite(t) && t > 0) out[a.id] = t; }
    return out;
  }
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function normalizeDaily(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return { last: typeof src.last === "string" && DAY_RE.test(src.last) ? src.last : null, streak: num(src.streak, 9999), best: num(src.best, 9999) };
  }

  /** Yerel takvim günü (YYYY-MM-DD). Günlük seri cihaz saatine göre sayılır. */
  function dayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayDiff(a, b) { // b - a, gün olarak (yaz saatinden etkilenmez)
    const p = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(b) - p(a)) / 86400000);
  }

  /*
   * Başarımlar. metric: değerin kaynağı; target: hedef; reward: açılınca verilen fosil.
   * Ad ve açıklamalar dil dosyasındadır (js/i18n.js, ach.<id>.name / .desc).
   */
  const ACHIEVEMENTS = [
    { id: "first-run", metric: "runs", target: 1, reward: 10, icon: "play" },
    { id: "score-500", metric: "best", target: 500, reward: 20, icon: "trophy" },
    { id: "score-1000", metric: "best", target: 1000, reward: 40, icon: "trophy" },
    { id: "score-2500", metric: "best", target: 2500, reward: 80, icon: "trophy" },
    { id: "score-5000", metric: "best", target: 5000, reward: 150, icon: "trophy" },
    { id: "fossils-100", metric: "totalFossils", target: 100, reward: 20, icon: "fossil" },
    { id: "fossils-1000", metric: "totalFossils", target: 1000, reward: 80, icon: "fossil" },
    { id: "fossils-5000", metric: "totalFossils", target: 5000, reward: 200, icon: "fossil" },
    { id: "run-fossils-50", metric: "bestRunFossils", target: 50, reward: 40, icon: "fossil" },
    { id: "near-miss-1", metric: "nearMisses", target: 1, reward: 10, icon: "spark" },
    { id: "near-miss-25", metric: "nearMisses", target: 25, reward: 50, icon: "spark" },
    { id: "near-miss-run-5", metric: "bestRunNearMisses", target: 5, reward: 60, icon: "spark" },
    { id: "ptero-10", metric: "pterosDodged", target: 10, reward: 30, icon: "ptero" },
    { id: "ptero-50", metric: "pterosDodged", target: 50, reward: 80, icon: "ptero" },
    { id: "chain-1", metric: "chains", target: 1, reward: 10, icon: "chain" },
    { id: "chain-x4", metric: "bestChain", target: 4, reward: 50, icon: "chain" },
    { id: "runs-25", metric: "runs", target: 25, reward: 40, icon: "restart" },
    { id: "runs-100", metric: "runs", target: 100, reward: 120, icon: "restart" },
    { id: "marathon", metric: "longestRun", target: 120, reward: 60, icon: "clock" },
    { id: "streak-3", metric: "streakBest", target: 3, reward: 30, icon: "calendar" },
    { id: "streak-7", metric: "streakBest", target: 7, reward: 100, icon: "calendar" },
    { id: "hat-collector", metric: "hatsOwned", target: 6, reward: 100, icon: "hat" },
    { id: "fashion", metric: "slotsEquipped", target: 3, reward: 30, icon: "hat" }
  ];

  // Başarım adları ve açıklamaları (profil ekranı ve bildirimler aynı metni kullanır).
  const TEXT = {
    "first-run": ["İlk Adım", "İlk koşunu tamamla."],
    "score-500": ["Isınma Turu", "Tek koşuda 500 puana ulaş."],
    "score-1000": ["Kaçak Yıldız", "Tek koşuda 1.000 puana ulaş."],
    "score-2500": ["Park Efsanesi", "Tek koşuda 2.500 puana ulaş."],
    "score-5000": ["Durdurulamaz Riko", "Tek koşuda 5.000 puana ulaş."],
    "fossils-100": ["Cep Dolusu", "Toplam 100 fosil kazan."],
    "fossils-1000": ["Arkeolog", "Toplam 1.000 fosil kazan."],
    "fossils-5000": ["Müze Küratörü", "Toplam 5.000 fosil kazan."],
    "run-fossils-50": ["Fosil Fırtınası", "Tek koşuda 50 fosil topla."],
    "near-miss-1": ["Kıl Payı", "Bir engeli kıl payı geç."],
    "near-miss-25": ["Tehlike Dansçısı", "Toplam 25 kez kıl payı geç."],
    "near-miss-run-5": ["Cesaret Gösterisi", "Tek koşuda 5 kez kıl payı geç."],
    "ptero-10": ["Gökyüzü Gözcüsü", "10 pterosauru atlat."],
    "ptero-50": ["Kanat Avcısı", "50 pterosauru atlat."],
    "chain-1": ["İlk Zincir", "Bir fosil kümesini eksiksiz topla."],
    "chain-x4": ["Zincir Ustası", "Bir koşuda x4 zincire ulaş."],
    "runs-25": ["Düzenli Kaşif", "25 koşu tamamla."],
    "runs-100": ["Parkın Demirbaşı", "100 koşu tamamla."],
    "marathon": ["Maraton", "Tek koşuda 2 dakika hayatta kal."],
    "streak-3": ["Üç Gün Üst Üste", "3 gün art arda oyna."],
    "streak-7": ["Haftalık Kaşif", "7 gün art arda oyna."],
    "hat-collector": ["Şapka Koleksiyoncusu", "Altı şapkanın hepsine sahip ol."],
    "fashion": ["Tepeden Tırnağa", "Üç aksesuar yuvasını birden kuşan."]
  };

  /** Bir başarımın şu anki değeri (ilerleme çubuğu için). */
  function metricValue(save, catalog, metric) {
    const st = save.stats || emptyStats();
    switch (metric) {
      case "best": return save.best || 0;
      case "streakBest": return (save.daily && save.daily.best) || 0;
      case "hatsOwned": return (save.ownedAccessories || []).filter(id => ((catalog.accessories || []).find(a => a.id === id) || {}).slot === "head").length;
      case "slotsEquipped": return Object.values(save.accessories || {}).filter(Boolean).length;
      default: return Number(st[metric]) || 0;
    }
  }
  function progress(save, catalog) {
    return ACHIEVEMENTS.map(a => {
      const value = metricValue(save, catalog, a.metric);
      return { id: a.id, icon: a.icon, reward: a.reward, target: a.target, value: Math.min(value, a.target), unlockedAt: (save.achievements || {})[a.id] || null };
    });
  }
  /** Koşulu sağlanan ama henüz açılmamış başarımları açar; ödül fosilleri bakiyeye eklenir. */
  function unlock(save, catalog, now) {
    const achievements = Object.assign({}, save.achievements || {}), unlocked = [];
    let reward = 0;
    for (const a of ACHIEVEMENTS) {
      if (achievements[a.id]) continue;
      if (metricValue(save, catalog, a.metric) >= a.target) { achievements[a.id] = now || Date.now(); unlocked.push(a); reward += a.reward; }
    }
    if (!unlocked.length) return { save, unlocked, reward: 0 };
    return { save: Object.assign({}, save, { achievements, fossils: (save.fossils || 0) + reward }), unlocked, reward };
  }

  /**
   * Günlük seri: günün ilk koşusu sayılır. Dün oynandıysa seri artar, daha eskiyse 1'e döner.
   * Ödül: base × min(seri, cap) fosil, günde bir kez.
   */
  function dailyRun(daily, today, R) {
    const d = normalizeDaily(daily);
    if (d.last === today) return { daily: d, first: false, bonus: 0 };
    const streak = d.last && dayDiff(d.last, today) === 1 ? d.streak + 1 : 1;
    const next = { last: today, streak, best: Math.max(d.best, streak) };
    return { daily: next, first: true, bonus: R.dailyBase * Math.min(streak, R.dailyCap) };
  }

  /**
   * Koşu bitince: istatistikleri günceller, koşu sonu bonusunu hesaplar, günlük seriyi ilerletir, başarımları açar.
   * run: { score, fossils (toplanan), bonusFossils (kıl payı + zincir, koşu sırasında verildi), nearMisses, chains, maxChain,
   *        pterosDodged, jumps, duration (sn), death (engel türü), record (bool) }
   * Dönen save'e skor/rekor/dailyRun/başarım ödülleri işlenmiştir; koşu içi fosiller çağıran tarafından zaten eklenmiştir.
   */
  function applyRun(save, catalog, run, opts) {
    const R = opts.rewards, now = opts.now || Date.now(), today = opts.today || dayKey(now);
    const st = normalizeStats(save.stats);
    const earnedInRun = (run.fossils || 0) + (run.bonusFossils || 0);
    st.runs += 1;
    st.totalScore += Math.max(0, run.score | 0);
    st.nearMisses += run.nearMisses | 0;
    st.bestRunNearMisses = Math.max(st.bestRunNearMisses, run.nearMisses | 0);
    st.chains += run.chains | 0;
    st.bestChain = Math.max(st.bestChain, run.maxChain | 0);
    st.pterosDodged += run.pterosDodged | 0;
    st.jumps += run.jumps | 0;
    st.longestRun = Math.max(st.longestRun, Math.round((run.duration || 0) * 10) / 10);
    if (DEATHS.includes(run.death)) st.deaths[run.death] += 1;
    const scoreBonus = Math.floor(Math.max(0, run.score) / R.scorePer);
    const recordBonus = run.record ? R.recordBonus : 0;
    const daily = dailyRun(save.daily, today, R);
    const endBonus = scoreBonus + recordBonus + daily.bonus;
    st.totalFossils += earnedInRun + endBonus;
    st.bestRunFossils = Math.max(st.bestRunFossils, run.fossils | 0);
    let next = Object.assign({}, save, { stats: st, daily: daily.daily, fossils: (save.fossils || 0) + endBonus });
    const ach = unlock(next, catalog, now);
    next = ach.save;
    if (ach.reward) next.stats = Object.assign({}, next.stats, { totalFossils: next.stats.totalFossils + ach.reward });
    return {
      save: next,
      breakdown: { collected: run.fossils | 0, nearMiss: run.nearMissFossils | 0, chain: run.chainFossils | 0, score: scoreBonus, record: recordBonus, daily: daily.bonus, achievements: ach.reward, total: earnedInRun + endBonus + ach.reward },
      daily: daily, unlocked: ach.unlocked
    };
  }

  /** Zincir: tamamen toplanan her kümede seviye artar (en çok max); kaçan fosil zinciri sıfırlar. Ödül = seviye × perLevel. */
  function chainReward(level, R) { return Math.min(level, R.chainMax) * R.chainPerLevel; }

  return { ACHIEVEMENTS, TEXT, DEATHS, emptyStats, normalizeStats, normalizeAchievements, normalizeDaily, dayKey, dayDiff, metricValue, progress, unlock, dailyRun, applyRun, chainReward };
});
