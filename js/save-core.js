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
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).SaveCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SAVE_VERSION = 2;

  // Kozmetik türü -> kayıttaki sahip olunanlar / seçili alanı.
  // "skin" eski kayıttaki owned/selected alanlarını aynen kullanır.
  const SLOTS = {
    skin: { owned: "owned", selected: "selected", list: "skins" },
    trail: { owned: "ownedTrails", selected: "selectedTrail", list: "trails" },
    scene: { owned: "ownedScenes", selected: "selectedScene", list: "scenes" }
  };

  // Önceki sürümde satılan görünüm kimlikleri yeni kataloğa eşlenir.
  const LEGACY_IDS = { skin: { lagoon: "midnight" } };

  // İlerleme dışındaki tercihler (sıfırlamada korunur).
  const SETTING_KEYS = ["sound", "vibration", "lowEffects", "masterVolume", "sfxVolume", "screenShake", "flash", "scanlines"];

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
    value.screenShake = bool(source.screenShake, base.screenShake);
    value.flash = bool(source.flash, base.flash);
    value.scanlines = bool(source.scanlines, false);
    value.playTime = Math.max(0, Number(source.playTime) || 0);

    Object.keys(SLOTS).forEach(kind => normalizeSlot(value, catalog, kind));
    value.saveVersion = SAVE_VERSION;
    return value;
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
    return !!slot && data[slot.selected] === id;
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
    next[SLOTS[kind].selected] = id;
    return { ok: true, data: next };
  }

  /** İlerlemeyi sıfırlar; ses/görüntü tercihleri korunur. */
  function resetProgress(data, catalog, env) {
    const fresh = defaults(catalog, env);
    SETTING_KEYS.forEach(key => { if (data && data[key] !== undefined) fresh[key] = data[key]; });
    return normalize(fresh, catalog, env);
  }

  return { SAVE_VERSION, SLOTS, LEGACY_IDS, SETTING_KEYS, defaults, normalize, findItem, isOwned, isSelected, itemState, buy, equip, resetProgress };
});
