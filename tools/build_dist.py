"""DinoRush yayın paketi: python tools/build_dist.py

dist/ klasörüne yalnız çalışma zamanında kullanılan dosyaları kopyalar ve
içerik özetiyle sürümlenmiş bir service worker (dist/sw.js) üretir.
Kaynak görseller (assets/art_src, assets/ui_src), testler, araçlar ve
referanssız varlıklar pakete girmez. dist/ klasörü her çalıştırmada yeniden oluşturulur.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PUBLIC = ROOT / "public"


def text(p):
    return (ROOT / p).read_text(encoding="utf8")


def collect():
    files = {"index.html", "favicon.ico", "css/style.css"}
    html = text("index.html")
    for m in re.finditer(r'(?:href|src|content)="([^"#:?]+\.(?:js|css|png|jpg|ico|webmanifest))"', html):
        files.add(m.group(1))
    css = text("css/style.css")
    for m in re.finditer(r"url\(([^)]+)\)", css):
        u = m.group(1).strip("'\"")
        if not u.startswith("data:"):
            files.add(str(Path("css", u).as_posix()).replace("css/../", ""))
    # JS içindeki varlık yolları (manifestler, görünüm sayfaları)
    for js in [f for f in list(files) if f.endswith(".js")]:
        for m in re.finditer(r"[\"'`](assets/[^\"'`]+\.(?:png|jpg|webp|mp3))[\"'`]", text(js)):
            files.add(m.group(1))
    files.add("site.webmanifest")
    manifest = json.loads(text("site.webmanifest"))
    for icon in manifest["icons"]:
        files.add(icon["src"])
    files = {f for f in files if not f.startswith(("assets/art_src/", "assets/ui_src/"))}
    missing = [f for f in files if not (ROOT / f).exists()]
    if missing:
        raise SystemExit("Eksik dosyalar: " + ", ".join(sorted(missing)))
    return sorted(files)


SW_TEMPLATE = """/* DinoRush çevrimdışı önbellek. tools/build_dist.py üretir; elle düzenlemeyin. */
const CACHE = "%(cache)s";
const ASSETS = %(assets)s;
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("dinorush-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Sayfa: önce ağ (yeni sürüm hemen gelsin), ağ yoksa önbellek.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./", copy)); }
      return res;
    }).catch(() => caches.match("./").then(m => m || caches.match("index.html"))));
    return;
  }
  // Varlıklar: önce önbellek (sürüm adı içerik özetine bağlı olduğu için güvenli).
  e.respondWith(caches.match(req).then(m => m || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
"""


def main():
    files = collect()
    # Klasörleri silmeden dosyaların üstüne yazılır; sonra pakette olmaması gereken eski dosyalar temizlenir.
    # (OneDrive veya açık bir sunucu klasörü kilitleyebilir; tümden silmek Windows'ta "Erişim engellendi" verir.)
    DIST.mkdir(exist_ok=True)
    for f in files:
        dst = DIST / f
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / f, dst)
    for p in PUBLIC.iterdir():
        shutil.copy2(p, DIST / p.name)
    # Paket işareti: js/pwa.js yalnız bunu görünce service worker kaydeder.
    idx = DIST / "index.html"
    html = idx.read_text(encoding="utf8")
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="dinorush-build" content="dist">', 1)
    idx.write_text(html, encoding="utf8")
    # Önbellek listesi ve içerik özeti
    # Tekil liste: cache.addAll yinelenen istekte kurulumu reddeder (service worker kaydı silinir).
    # Müzik (~3 MB) kurulumda indirilmez; ilk çalındığında fetch işleyicisi önbelleğe alır.
    precache = ["./"] + sorted((set(files) | {"404.html", "site.webmanifest"}) - {f for f in files if f.endswith(".mp3")})
    h = hashlib.sha256()
    for f in sorted(set(files) | {"404.html", "site.webmanifest"}):
        h.update(f.encode()); h.update((DIST / f).read_bytes())
    version = re.search(r'version:"([^"]+)"', text("js/config.js")).group(1)
    cache = f"dinorush-{version}-{h.hexdigest()[:10]}"
    (DIST / "sw.js").write_text(SW_TEMPLATE % {"cache": cache, "assets": json.dumps(precache, ensure_ascii=False, indent=1)}, encoding="utf8")
    keep = set(files) | {p.name for p in PUBLIC.iterdir()} | {"sw.js"}
    stale = [p for p in DIST.rglob("*") if p.is_file() and p.relative_to(DIST).as_posix() not in keep]
    for p in stale:
        try:
            p.unlink()
        except OSError:
            print(f"uyarı: silinemedi (kilitli olabilir): {p.relative_to(DIST).as_posix()}")
    for d in sorted((p for p in DIST.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        try:
            d.rmdir()  # yalnız boşsa siler
        except OSError:
            pass
    total =sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    count = sum(1 for p in DIST.rglob("*") if p.is_file())
    print(f"dist/: {count} dosya, {total / 1024:.0f} KB, önbellek {cache}")


if __name__ == "__main__":
    main()
