/*
 * DinoRush çarpışma ve engel geometrisi (saf fonksiyonlar).
 * Tarayıcıda window.DinoRush.Rules, Node'da module.exports. DOM veya durum kullanmaz.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).Rules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Kenarlarda 4 (yatay) / 3 (dikey) birim tolerans: sıyırma temasları affedilir.
  function collide(a, b) {
    return a.x + a.w > b.x + 4 && a.x < b.x + b.w - 4 && a.y + a.h > b.y + 3 && a.y < b.y + b.h - 3;
  }

  function playerBox(p, C) {
    const cfg = C.dinoSprite, shape = p.duck ? cfg.hitboxes.duck : cfg.hitboxes.standing, s = cfg.worldPixel, spriteBottom = cfg.footRow + 1;
    return { x: p.x + shape.x * s, y: p.y - spriteBottom * s + shape.y * s, w: shape.w * s, h: shape.h * s };
  }

  function obstacleBox(o, C) {
    const g = C.artAssets.hitboxInset;
    const ins = o.type === "flyer" ? C.ptero.hitboxInset : { x: g, y: g };
    return { x: o.x + o.w * ins.x, y: o.y + o.h * ins.y, w: o.w * (1 - ins.x * 2), h: o.h * (1 - ins.y * 2) };
  }

  /** Pterosaur sprite boyutu (dünya birimi). Uçuş boyunca sabittir. */
  function pteroSize(C) {
    const [w, h] = C.artAssets.sizes.ptero, k = C.artAssets.pixelWorld * C.ptero.scale;
    return { w: w * k, h: h * k };
  }

  /** Şeridin sprite üst kenarı: çarpışma kutusunun alt kenarı zeminden lanes[lane] birim yukarıda olacak şekilde. */
  function pteroY(lane, ground, C) {
    const { h } = pteroSize(C), ins = C.ptero.hitboxInset.y;
    return ground - C.ptero.lanes[lane] - h * (1 - ins);
  }

  /** Skora göre şerit: önce yalnız alçak (zıplanır), highFromScore sonrası yarı yarıya yüksek (eğilinir). */
  function pteroLane(score, r, C) {
    if (score < C.ptero.highFromScore) return "low";
    return r < 0.5 ? "low" : "high";
  }

  /** Pterosaur bu skorda çıkabilir mi? */
  function pteroAllowed(score, C) {
    return score >= C.ptero.minScore;
  }

  return { collide, playerBox, obstacleBox, pteroSize, pteroY, pteroLane, pteroAllowed };
});
