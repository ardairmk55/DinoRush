/*
 * DinoRush kayıt ve mağaza mantığı (saf fonksiyonlar).
 * Tarayıcıda window.DinoRush.SaveCore, Node'da module.exports olarak yüklenir;
 * localStorage veya DOM kullanmaz, böylece birim testle doğrulanabilir.
 *
 * Kayıt anahtarı değişmez (dinorush-save-v1). Eski alanlar korunur:
 *   best, fossils, sound, vibration, lowEffects, owned, selected
 * Yeni alanlar geriye uyumlu eklenir; eksikse varsayılan değer alır.
 */
(function (root, factory) {
  "use strict";
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./progress-core.js") : (root.DinoRush || {}).ProgressCore);
  if (node) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).SaveCore = api;
})(typeof self !== "undefined" ? self : this, function (Progress) {
  "use strict";

  const SAVE_VERSION = 4;

  // Kozmetik türü -> kayıttaki sahip olunanlar / seçili alanı.
  // "skin" eski kayıttaki owned/selected alanlarını aynen kullanır.
  const SLOTS = {
    skin: { owned: "owned", selected: "selected", list: "skins" },
    trail: { owned: "ownedTrails", selected: "selectedTrail", list: "trails" },
    scene: { owned: "ownedScenes", selected: "selectedScene", list: "scenes" },
    accessory: { owned: "ownedAccessories", list: "accessories", multi: true }
  };

  // Önceki sürümde satılan görünüm kimlikleri yeni kataloğa eşlenir.
  const LEGACY_IDS = { skin: { lagoon: "midnight" } };

  // İlerleme dışındaki tercihler (sıfırlamada korunur).
  // Aksesuar yuvaları: aynı yuvada tek aksesuar, farklı yuvalar birlikte kuşanılır.
  const ACCESSORY_SLOTS = ["head", "face", "gear"];

  const SETTING_KEYS = ["sound", "vibration", "lowEffects", "masterVolume", "sfxVolume", "music", "menuMusicVolume", "gameMusicVolume", "particles", "performance", "reduceMotion", "screenShake", "flash", "scanlines", "sceneCycle", "highContrast", "tutorialDone"];

  function defaultId(catalog, kind) {
    const list = catalog[SLOTS[kind].list] || [];
    const free = list.find(item => item.cost === 0) || list[0];
    return free ? free.id : null;
  }

  function defaults(catalog, env) {
    const reduced = !!(env && env.reducedMotion);
    return {
      best: 0,
      fossils: 0,
      sound: true,
      vibration: false,
      lowEffects: false,
      owned: [defaultId(catalog, "skin")],
      selected: defaultId(catalog, "skin"),
      ownedTrails: [defaultId(catalog, "trail")],
      selectedTrail: defaultId(catalog, "trail"),
      ownedScenes: [defaultId(catalog, "scene")],
      selectedScene: defaultId(catalog, "scene"),
      masterVolume: 80,
      sfxVolume: 80,
      music: true,
      menuMusicVolume: 70,
      gameMusicVolume: 70,
      particles: true,
      performance: false,
      reduceMotion: reduced,
      ownedAccessories: [],
      accessories: { head: null, face: null, gear: null },
      savedAt: null,
      // v4: istatistik, başarım, günlük seri, öğretici ve erişilebilirlik
      stats: Progress.emptyStats(),
      achievements: {},
      daily: { last: null, streak: 0, best: 0 },
      tutorialDone: false,
      sceneCycle: true,
      highContrast: false,
      screenShake: !reduced,
      flash: !reduced,
      scanlines: false,
      playTime: 0,
      saveVersion: SAVE_VERSION
    };
  }

  function int(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function bool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function normalizeSlot(value, catalog, kind) {
    const slot = SLOTS[kind];
    const list = catalog[slot.list] || [];
    const known = id => list.some(item => item.id === id);
    const legacy = LEGACY_IDS[kind] || {};
    const fallback = defaultId(catalog, kind);
    const mapId = id => (Object.prototype.hasOwnProperty.call(legacy, id) ? legacy[id] : id);

    const raw = Array.isArray(value[slot.owned]) ? value[slot.owned] : [];
    const owned = [];
    raw.map(mapId).forEach(id => { if (known(id) && !owned.includes(id)) owned.push(id); });
    if (fallback && !owned.includes(fallback)) owned.unshift(fallback);

    let selected = mapId(value[slot.selected]);
    if (!owned.includes(selected)) selected = fallback;

    value[slot.owned] = owned;
    value[slot.selected] = selected;
  }

  /** Ham (eski veya bozuk) kaydı geçerli, güncel biçime getirir. Bilinmeyen alanlar korunur. */
  function normalize(raw, catalog, env) {
    const base = defaults(catalog, env);
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const value = Object.assign({}, base, source);

    value.best = int(source.best, 0, Number.MAX_SAFE_INTEGER);
    value.fossils = int(source.fossils, 0, Number.MAX_SAFE_INTEGER);
    value.sound = source.sound !== false;
    value.vibration = source.vibration === true;
    value.lowEffects = source.lowEffects === true;
    value.masterVolume = source.masterVolume === undefined ? base.masterVolume : int(source.masterVolume, 0, 100);
    value.sfxVolume = source.sfxVolume === undefined ? base.sfxVolume : int(source.sfxVolume, 0, 100);
    value.music = source.music !== false;
    // v2 tek "musicVolume" alanı menü ve oyun müziğine taşınır.
    const legacyMusic = source.musicVolume === undefined ? base.menuMusicVolume : int(source.musicVolume, 0, 100);
    value.menuMusicVolume = source.menuMusicVolume === undefined ? legacyMusic : int(source.menuMusicVolume, 0, 100);
    value.gameMusicVolume = source.gameMusicVolume === undefined ? legacyMusic : int(source.gameMusicVolume, 0, 100);
    delete value.musicVolume;
    value.particles = bool(source.particles, true);
    value.performance = bool(source.performance, false);
    value.reduceMotion = bool(source.reduceMotion, base.reduceMotion);
    value.savedAt = Number.isFinite(source.savedAt) && source.savedAt > 0 ? source.savedAt : null;
    value.stats = Progress.normalizeStats(source.stats);
    value.achievements = Progress.normalizeAchievements(source.achievements);
    value.daily = Progress.normalizeDaily(source.daily);
    // Daha önce oynamış oyuncuya öğretici gösterilmez.
    value.tutorialDone = source.tutorialDone === undefined ? value.best > 0 : source.tutorialDone === true;
    delete value.lang;
    value.sceneCycle = bool(source.sceneCycle, true);
    value.highContrast = bool(source.highContrast, false);
    value.screenShake = bool(source.screenShake, base.screenShake);
    value.flash = bool(source.flash, base.flash);
    value.scanlines = bool(source.scanlines, false);
    value.playTime = Math.max(0, Number(source.playTime) || 0);

    Object.keys(SLOTS).forEach(kind => { if (!SLOTS[kind].multi) normalizeSlot(value, catalog, kind); });
    normalizeAccessories(value, catalog, source);
    value.saveVersion = SAVE_VERSION;
    return value;
  }

  function normalizeAccessories(value, catalog, source) {
    const list = catalog.accessories || [];
    const byId = id => list.find(item => item.id === id);
    const raw = Array.isArray(source.ownedAccessories) ? source.ownedAccessories : [];
    const owned = [];
    raw.forEach(id => { if (byId(id) && !owned.includes(id)) owned.push(id); });
    const eq = source.accessories && typeof source.accessories === "object" && !Array.isArray(source.accessories) ? source.accessories : {};
    const accessories = {};
    ACCESSORY_SLOTS.forEach(slot => {
      const item = byId(eq[slot]);
      accessories[slot] = item && item.slot === slot && owned.includes(item.id) ? item.id : null;
    });
    value.ownedAccessories = owned;
    value.accessories = accessories;
  }

  function findItem(catalog, kind, id) {
    const slot = SLOTS[kind];
    if (!slot) return null;
    return (catalog[slot.list] || []).find(item => item.id === id) || null;
  }

  function isOwned(data, kind, id) {
    const slot = SLOTS[kind];
    return !!slot && Array.isArray(data[slot.owned]) && data[slot.owned].includes(id);
  }

  function isSelected(data, kind, id) {
    const slot = SLOTS[kind];
    if (!slot) return false;
    if (slot.multi) return !!data.accessories && Object.values(data.accessories).includes(id);
    return data[slot.selected] === id;
  }

  /** Kart durumu: "selected" | "owned" | "buy" | "locked" (bakiye yetersiz). */
  function itemState(data, catalog, kind, id) {
    const item = findItem(catalog, kind, id);
    if (!item) return null;
    if (isSelected(data, kind, id)) return { state: "selected", missing: 0, item };
    if (isOwned(data, kind, id)) return { state: "owned", missing: 0, item };
    const missing = Math.max(0, item.cost - data.fossils);
    return { state: missing > 0 ? "locked" : "buy", missing, item };
  }

  /**
   * Satın alma. Girdi kaydı değiştirilmez; başarıda yeni kayıt döner.
   * Satın alınan öğe otomatik kuşanılmaz (KUŞAN düğmesi ayrı adımdır).
   */
  function buy(data, catalog, kind, id) {
    const item = findItem(catalog, kind, id);
    if (!item) return { ok: false, reason: "unknown", data };
    if (isOwned(data, kind, id)) return { ok: false, reason: "owned", data };
    const missing = item.cost - data.fossils;
    if (missing > 0) return { ok: false, reason: "insufficient", missing, data };
    const slot = SLOTS[kind];
    const next = Object.assign({}, data);
    next.fossils = data.fossils - item.cost;
    next[slot.owned] = data[slot.owned].concat(id);
    return { ok: true, spent: item.cost, data: next };
  }

  function equip(data, catalog, kind, id) {
    if (!findItem(catalog, kind, id)) return { ok: false, reason: "unknown", data };
    if (!isOwned(data, kind, id)) return { ok: false, reason: "not_owned", data };
    const next = Object.assign({}, data);
    if (SLOTS[kind].multi) next.accessories = Object.assign({}, data.accessories, { [findItem(catalog, kind, id).slot]: id });
    else next[SLOTS[kind].selected] = id;
    return { ok: true, data: next };
  }

  /** Aksesuarı çıkarır (yuvası boşalır). Diğer türlerde her zaman bir seçim olduğu için desteklenmez. */
  function unequip(data, catalog, kind, id) {
    const item = findItem(catalog, kind, id);
    if (!item || !SLOTS[kind].multi) return { ok: false, reason: "unsupported", data };
    if (!data.accessories || data.accessories[item.slot] !== id) return { ok: false, reason: "not_equipped", data };
    const next = Object.assign({}, data);
    next.accessories = Object.assign({}, data.accessories, { [item.slot]: null });
    return { ok: true, data: next };
  }

  /** İlerlemeyi sıfırlar; ses/görüntü tercihleri korunur. */
  function resetProgress(data, catalog, env) {
    const fresh = defaults(catalog, env);
    SETTING_KEYS.forEach(key => { if (data && data[key] !== undefined) fresh[key] = data[key]; });
    return normalize(fresh, catalog, env);
  }

  return { SAVE_VERSION, SLOTS, LEGACY_IDS, SETTING_KEYS, ACCESSORY_SLOTS, defaults, normalize, findItem, isOwned, isSelected, itemState, buy, equip, unequip, resetProgress };
});
