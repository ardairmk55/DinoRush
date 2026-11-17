"""DinoRush arayüz PNG hattı (tekrar çalıştırılabilir).

Kaynak: assets/ui_src/*.png (magenta #FF00FF zeminli, DEĞİŞTİRİLMEZ)
Çıktı:  assets/ui/*.png, assets/ui/ui_slices.json,
        js/config.js ve css/style.css içindeki işaretli bloklar,
        tests/screenshots/ui_fringe.png, ui_stretch_<ad>.png

Çalıştırma: python tools/make_ui_assets.py
Bunlar piksel sanat değildir: alfa yumuşaktır, küçültme LANCZOS'tur.
"""
from pathlib import Path
import json
import re
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "ui_src"
OUT = ROOT / "assets" / "ui"
SHOTS = ROOT / "tests" / "screenshots"

# Magenta ekseni: m = min(R,B) - G. Saf magenta ~255, ön plan renkleri <= ~0.
# m <= KEY_IN tamamen opak, m >= KEY_OUT tamamen saydam, arası lineer.
KEY_IN, KEY_OUT = 40, 215
LAST_KEY = {}

# Çerçeveler: hedef genişlik (2x retina), esneme yönü.
FRAMES = {
    "btn_primary": dict(width=1000, stretch="x"),
    "btn_secondary": dict(width=700, stretch="x"),
    "panel_frame": dict(width=1200, stretch="xy", clean_sides=True),
    "card_frame": dict(width=700, stretch="xy"),
    "plate_record": dict(width=900, stretch="x"),
    "pill_counter": dict(width=700, stretch="x"),
    "plank_tagline": dict(width=1000, stretch="x"),
}
ICON_NAMES = ["icon_ammonite", "icon_trophy", "icon_gear", "icon_lock", "icon_check",
              "icon_close", "icon_back", "icon_play", "icon_fullscreen"]
ICON_H, MOSS_H = 96, 160

# Kesim ölçümü eşikleri (0-255 ölçeği)
PROFILE_T = 14.0     # kenar profilinin orta profile ortalama mutlak farkı
ALPHA_T = 0.04       # alfa profili farkı
SAFETY = 3           # güvenlik payı (px)
FLAT_T = 9.0         # orta bölge, esneme yönünde ortalama std sınırı


# ---------------------------------------------------------------- anahtar
def key_magenta(rgb):
    """RGB (uint8) -> RGBA float [0,1], yumuşak alfa + despill."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    m = np.minimum(r, b) - g
    # Dış tolerans zemin dağılımından ölçülür: kenar şeridindeki magentanın %0.01 persentili - 6 (köşe vinyeti dahil)
    h, w = m.shape; e = max(4, int(min(h, w) * 0.02))
    border = np.concatenate([m[:e].ravel(), m[-e:].ravel(), m[:, :e].ravel(), m[:, -e:].ravel()])
    border = border[border > 120]  # kenara değen ön plan (yosun vb.) hariç
    key_out = min(KEY_OUT, float(np.percentile(border, 0.01)) - 6) if border.size else KEY_OUT
    LAST_KEY["out"] = round(key_out, 1)
    a = np.clip((key_out - m) / (key_out - KEY_IN), 0.0, 1.0)
    a[a < 0.04] = 0.0
    bg = np.array([255.0, 0.0, 255.0], np.float32)
    # 1) Karışımı çöz: P = a*F + (1-a)*M  =>  F = (P - (1-a)M) / a
    safe = np.maximum(a, 1e-3)[..., None]
    fg = (f - (1.0 - a[..., None]) * bg) / safe
    fg = np.clip(fg, 0, 255)
    # 2) Magenta taşmasını kes: min(R,B) G'yi aşamaz
    fr, fgc, fb = fg[..., 0], fg[..., 1], fg[..., 2]
    excess = np.maximum(np.minimum(fr, fb) - fgc - 8.0, 0.0)
    fr -= excess; fb -= excess
    fg = np.stack([fr, fgc, fb], -1)
    # 3) Yarı saydam pikselleri komşu opak renklere doğru çek
    opaque = (a >= 0.97).astype(np.float32)
    acc = fg * opaque[..., None]
    wsum = opaque.copy()
    for _ in range(6):
        acc = box3(acc); wsum = box3(wsum)
    neigh = acc / np.maximum(wsum, 1e-6)[..., None]
    has = (wsum > 1e-4)[..., None]
    edge = ((a > 0) & (a < 0.97))[..., None]
    w = a[..., None] ** 1.5  # düşük alfada komşu rengi baskın
    mixed = np.where(has, neigh * (1 - w) + fg * w, fg)
    fg = np.where(edge, mixed, fg)
    fg[a <= 0] = 0
    return np.concatenate([fg / 255.0, a[..., None]], -1)


def box3(x):
    p = np.pad(x, [(1, 1), (1, 1)] + [(0, 0)] * (x.ndim - 2), mode="edge")
    s = 0
    for dy in range(3):
        for dx in range(3):
            s = s + p[dy:dy + x.shape[0], dx:dx + x.shape[1]]
    return s / 9.0


def to_image(rgba):
    return Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def crop_alpha(img, thr=8):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > thr)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def resize(img, w=None, h=None):
    if w is not None:
        h = round(img.height * w / img.width)
    else:
        w = round(img.width * h / img.height)
    # Ön çarpımlı alfa ile küçült (kenarda koyu/pembe hale olmaz)
    return img.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")


# ---------------------------------------------------------------- ölçüm
def measure_axis(arr, axis):
    """axis=1: sol/sağ (sütun profilleri), axis=0: üst/alt (satır profilleri).
    Kenardan içeri tarar; profil orta profile yaklaştığı ilk noktadan itibaren düz kabul eder."""
    rgb = arr[..., :3].astype(np.float32) * (arr[..., 3:4] / 255.0)  # ön çarpımlı
    alpha = arr[..., 3].astype(np.float32) / 255.0
    if axis == 0:
        rgb = rgb.transpose(1, 0, 2); alpha = alpha.T
    n = rgb.shape[1]
    mid0, mid1 = int(n * 0.40), int(n * 0.60)
    ref = np.median(rgb[:, mid0:mid1], axis=1)
    refa = np.median(alpha[:, mid0:mid1], axis=1)
    d = np.abs(rgb - ref[:, None, :]).mean(axis=(0, 2))
    da = np.abs(alpha - refa[:, None]).mean(axis=0)
    flat = (d < PROFILE_T) & (da < ALPHA_T)

    # Ortadan kenara doğru yürü: düz olmayan ilk 3'lü dizide dur. Köşe = o noktaya kadar + güvenlik payı.
    half = n // 2
    def walk(rng):
        run = 0
        for i in rng:
            run = run + 1 if not flat[i] else 0
            if run >= 3:
                return i
        return None
    i0 = walk(range(half, -1, -1))
    i1 = walk(range(half, n))
    start = (i0 + 3 if i0 is not None else 0) + SAFETY
    end_ = (n - i1 + 2 if i1 is not None else 0) + SAFETY
    return start, end_, d


def flatness(arr, sl, xonly=False):
    t, r, b, l = sl
    if xonly:  # yalnız yatay esneme: orta sütunlar, yüz bandı (yüksekliğin %25-%75'i)
        h = arr.shape[0]
        c = arr[int(h * .25):int(h * .75), l:arr.shape[1] - r].astype(np.float32)
        return float(c[..., :3].std(axis=1).mean()), 0.0
    c = arr[t:arr.shape[0] - b, l:arr.shape[1] - r].astype(np.float32)
    if c.shape[0] < 2 or c.shape[1] < 2:
        return 0.0, 0.0
    rgb = c[..., :3]
    sx = rgb.std(axis=1).mean()  # satır boyunca (yatay esnemede önemli)
    sy = rgb.std(axis=0).mean()  # sütun boyunca (dikey esnemede önemli)
    return float(sx), float(sy)


# ---------------------------------------------------------------- 9 parça çizim (esneme testi)
def nine(img, sl, W, H, bw, repeat="stretch"):
    """CSS border-image: slice=sl (t,r,b,l), width=bw (t,r,b,l), fill; repeat=stretch|round."""
    t, r, b, l = sl
    T, R, B, L = bw
    sw, sh = img.size
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    xs_src = [0, l, sw - r, sw]; ys_src = [0, t, sh - b, sh]
    xs_dst = [0, L, W - R, W]; ys_dst = [0, T, H - B, H]
    sy_scale = [T / max(1, t), T / max(1, t), B / max(1, b)]  # orta satır üst kenarın ölçeğini kullanır
    sx_scale = [L / max(1, l), L / max(1, l), R / max(1, r)]
    for i in range(3):
        for j in range(3):
            sx0, sx1 = xs_src[j], xs_src[j + 1]; sy0, sy1 = ys_src[i], ys_src[i + 1]
            dx0, dx1 = xs_dst[j], xs_dst[j + 1]; dy0, dy1 = ys_dst[i], ys_dst[i + 1]
            if sx1 <= sx0 or sy1 <= sy0 or dx1 <= dx0 or dy1 <= dy0:
                continue
            src = img.crop((sx0, sy0, sx1, sy1)).convert("RGBa")
            nx = ny = 1
            if repeat == "round":
                if j == 1: nx = max(1, round((dx1 - dx0) / max(1, (sx1 - sx0) * sy_scale[i])))
                if i == 1: ny = max(1, round((dy1 - dy0) / max(1, (sy1 - sy0) * sx_scale[j])))
            xs = [dx0 + (dx1 - dx0) * k // nx for k in range(nx + 1)]
            ys = [dy0 + (dy1 - dy0) * k // ny for k in range(ny + 1)]
            for a in range(ny):
                for c in range(nx):
                    tw, th = xs[c + 1] - xs[c], ys[a + 1] - ys[a]
                    if tw > 0 and th > 0:
                        out.alpha_composite(src.resize((tw, th), Image.LANCZOS).convert("RGBA"), (xs[c], ys[a]))
    return out


# ---------------------------------------------------------------- köşe pahı (iç parıltı çizgisi)
def glow_pos(strip, axis):
    """Şeritteki iç amber parıltı çizgisinin konumu. axis=1: her satır için x, axis=0: her sütun için y."""
    f = strip.astype(np.float32)
    score = f[..., 0] + 0.6 * f[..., 1] - 1.6 * f[..., 2]
    score[strip[..., 3] < 200] = -1e9
    return score.argmax(axis=axis)


def medfilt(x, k=9):
    p = np.pad(x.astype(np.float32), k // 2, mode="edge")
    return np.array([np.median(p[i:i + k]) for i in range(len(x))])


def refine_corner(pos, lo, hi, tol=5):
    """pos: kenar boyunca parıltı konumu. Ortadaki medyandan ±tol dışına çıkan ilk 3'lü diziye kadar
    ortadan iki yöne yürür; (baştan pah uzunluğu, sondan pah uzunluğu) döner."""
    pos = medfilt(pos); n = len(pos)
    med = np.median(pos[int(n * .4):int(n * .6)])
    bad = np.abs(pos - med) > tol
    def walk(rng):
        run = 0
        for i in rng:
            run = run + 1 if bad[i] else 0
            if run >= 3: return i
        return None
    i0 = walk(range(n // 2, -1, -1)); i1 = walk(range(n // 2, n))
    return (i0 + 3 if i0 is not None else 0), (n - i1 + 2 if i1 is not None else 0)


def refine_slices(arr, sl):
    t, r, b, l = sl
    h, w = arr.shape[:2]
    sw, sh = int(w * .2), int(h * .3)  # parıltı çizgisini kesin içeren kenar şeritleri
    lt, lb = refine_corner(glow_pos(arr[:, :sw], 1), 0, h)
    rt, rb = refine_corner(glow_pos(arr[:, w - sw:], 1), 0, h)
    tl, tr = refine_corner(glow_pos(arr[:sh], 0), 0, w)
    bl, br = refine_corner(glow_pos(arr[h - sh:], 0), 0, w)
    return [max(t, lt + SAFETY, rt + SAFETY), max(r, tr + SAFETY, br + SAFETY),
            max(b, lb + SAFETY, rb + SAFETY), max(l, tl + SAFETY, bl + SAFETY)]


# ---------------------------------------------------------------- panel yan plakası
def side_edge_std(arr, sl):
    """Sol/sağ kenar şeridinin dikey (esneme yönü) ortalama std'si."""
    t, r, b, l = sl
    h, w = arr.shape[:2]
    left = arr[t:h - b, :l, :3].astype(np.float32); right = arr[t:h - b, w - r:, :3].astype(np.float32)
    return float((left.std(axis=0).mean() + right.std(axis=0).mean()) / 2)


def clean_side_plates(img, sl):
    """Perçinli yan plakayı (kenar ortasındaki detay) aynı kenarın düz taş satırlarıyla değiştirir.
    Plaka satırları: dış 4..40 px şeritte R-B > 120 olan en uzun bitişik bölge; iki kenarın birleşimi + 24 px pay."""
    a = np.asarray(img).copy()
    t, r, b, l = sl
    h, w = a.shape[:2]
    spans = []
    for side in ("sol", "sag"):
        outer = a[:, 4:40] if side == "sol" else a[:, w - 40:w - 4]
        sat = (outer[..., 0].astype(np.int32) - outer[..., 2]).mean(1)
        rows = np.where(sat[t:h - b] > 120)[0] + t
        if rows.size < 20:
            continue
        groups, g0, prev = [], rows[0], rows[0]
        for y in rows[1:]:
            if y - prev > 30: groups.append((g0, prev)); g0 = y
            prev = y
        groups.append((g0, prev))
        spans.append(max(groups, key=lambda g: g[1] - g[0]))
    if not spans:
        return img, {}
    y0 = max(t, min(g[0] for g in spans) - 24); y1 = min(h - b, max(g[1] for g in spans) + 25)
    plain = np.concatenate([np.arange(t + 12, y0 - 4), np.arange(y1 + 4, h - b - 12)])
    fill = np.resize(plain, y1 - y0)
    edge = int(w * .06)  # yalnız dış taş kenar + parıltı çizgisi; iç dolgu tonuna dokunma
    for xs in (slice(0, edge), slice(w - edge, w)):
        a[y0:y1, xs] = a[fill, xs]
    return Image.fromarray(a, "RGBA"), {"satir": [int(y0), int(y1)]}


# ---------------------------------------------------------------- bileşen tespiti
def components(alpha, scale=4, dilate=3, min_frac=0.004):
    small = alpha[::scale, ::scale] > 20
    m = small.copy()
    for _ in range(dilate):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    h, w = m.shape
    lab = np.zeros((h, w), np.int32); boxes = []; cur = 0
    for y in range(h):
        for x in range(w):
            if m[y, x] and not lab[y, x]:
                cur += 1; q = deque([(y, x)]); lab[y, x] = cur
                y0 = y1 = y; x0 = x1 = x; area = 0
                while q:
                    cy, cx = q.popleft(); area += 1
                    y0 = min(y0, cy); y1 = max(y1, cy); x0 = min(x0, cx); x1 = max(x1, cx)
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur; q.append((ny, nx))
                boxes.append((area, (x0 * scale, y0 * scale, (x1 + 1) * scale, (y1 + 1) * scale)))
    total = h * w
    boxes = [b for a, b in boxes if a / total >= min_frac]
    return boxes


def sort_grid(boxes):
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows, row = [], []
    for b in boxes:
        if row and (b[1] + b[3]) / 2 - (row[-1][1] + row[-1][3]) / 2 > (b[3] - b[1]) * 0.5:
            rows.append(row); row = []
        row.append(b)
    if row: rows.append(row)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


# ---------------------------------------------------------------- yardımcılar
def save_png(img, path):
    img.save(path, optimize=True)
    return path.stat().st_size


Q_T = 2.6  # algısal hata sınırı (5x5 bulanık ön çarpımlı RGB RMSE). btn_primary 2.34 değerinde bantlanmasız olduğu gözle doğrulandı.


def blur5(x):
    return box3(box3(x))


BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) + 0.5) / 16 - 0.5


def quantize_dither(img, amp=10.0):
    """Octree paleti (256 RGBA) + Bayer 4x4 sıralı titreşimle en yakın renge eşleme."""
    base = img.quantize(256, method=Image.Quantize.FASTOCTREE)
    raw = np.array(base.getpalette("RGBA"), np.float32).reshape(-1, 4)
    pal4 = np.zeros((256, 4), np.float32); pal4[:len(raw)] = raw[:256]
    pal = pal4[:, :3]; pa = pal4[:, 3]
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    noise = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w] * amp
    x = a.copy(); x[..., :3] += noise[..., None]
    flat = x.reshape(-1, 4)
    idx = np.empty(flat.shape[0], np.uint8)
    pal_n = (pal4 ** 2).sum(1)
    for i in range(0, flat.shape[0], 65536):
        c = flat[i:i + 65536]
        d = pal_n[None, :] - 2 * c @ pal4.T
        idx[i:i + 65536] = d.argmin(1)
    out = Image.fromarray(idx.reshape(h, w), "P")
    out.putpalette(pal.astype(np.uint8).flatten().tolist())
    out.info["transparency"] = bytes(pa.astype(np.uint8))
    return out


def save_ui(img, path):
    """Titreşimli 256 renk palet dene; algısal hata (5x5 bulanık) Q_T altındaysa paletli, değilse tam RGBA."""
    pal = quantize_dither(img)
    q = pal.convert("RGBA")
    a = np.asarray(img).astype(np.float32); b = np.asarray(q).astype(np.float32)
    pa = blur5(a[..., :3] * a[..., 3:4] / 255); pb = blur5(b[..., :3] * b[..., 3:4] / 255)
    vis = a[..., 3] > 0
    err = float(np.sqrt(((pa - pb) ** 2)[vis].mean())) if vis.any() else 0.0
    if err <= Q_T:
        pal.save(path, optimize=True, transparency=pal.info["transparency"]); mode = "palet256+bayer"
    else:
        img.save(path, optimize=True); mode = "rgba"
    return path.stat().st_size, mode, round(err, 2)


def fringe_sheet(items, path):
    """Koyu ve açık zeminde önizleme + kenar büyütmesi."""
    tiles = []
    for name, img in items:
        th = img.copy(); th.thumbnail((360, 200), Image.LANCZOS)
        a = np.asarray(img)[..., 3]
        ys, xs = np.where((a > 30) & (a < 220))
        cx, cy = (int(xs[len(xs) // 3]), int(ys[len(ys) // 3])) if len(xs) else (0, 0)
        zoom = img.crop((cx - 24, cy - 24, cx + 24, cy + 24)).resize((192, 192), Image.NEAREST)
        row = Image.new("RGB", (360 * 2 + 192 * 2 + 50, 210), (60, 60, 60))
        for k, bg in enumerate([(18, 18, 22), (236, 236, 230)]):
            tile = Image.new("RGBA", (360, 200), bg + (255,)); tile.alpha_composite(th, ((360 - th.width) // 2, (200 - th.height) // 2))
            row.paste(tile.convert("RGB"), (k * 370, 5))
            z = Image.new("RGBA", (192, 192), bg + (255,)); z.alpha_composite(zoom)
            row.paste(z.convert("RGB"), (740 + k * 202, 9))
        ImageDraw.Draw(row).text((4, 196), name, fill=(255, 255, 0))
        tiles.append(row)
    sheet = Image.new("RGB", (tiles[0].width, sum(t.height for t in tiles)), (60, 60, 60))
    y = 0
    for t in tiles: sheet.paste(t, (0, y)); y += t.height
    sheet.save(path)


def stretch_sheet(name, img, sl, bw_css, sizes, path):
    """CSS piksel boyutlarında (1x) 9 parça render; koyu zemin."""
    scale = 0.5  # 2x asset -> 1x CSS
    pad = 16
    tiles = []
    for (W, H, label) in sizes:
        bw = bw_css(W, H)
        r = nine(img, sl, W, H, bw)
        tile = Image.new("RGBA", (W + pad * 2, H + pad * 2 + 14), (14, 32, 36, 255))
        tile.alpha_composite(r, (pad, pad))
        ImageDraw.Draw(tile).text((pad, H + pad + 2), f"{label} {W}x{H}", fill=(255, 220, 140, 255))
        tiles.append(tile)
    maxw = max(t.width for t in tiles)
    # satırlara yerleştir
    rows, row, rw = [], [], 0
    for t in tiles:
        if row and rw + t.width > max(1400, maxw):
            rows.append(row); row, rw = [], 0
        row.append(t); rw += t.width
    rows.append(row)
    W = max(sum(t.width for t in r) for r in rows); H = sum(max(t.height for t in r) for r in rows)
    sheet = Image.new("RGBA", (W, H), (30, 30, 30, 255)); y = 0
    for r in rows:
        x = 0
        for t in r: sheet.alpha_composite(t, (x, y)); x += t.width
        y += max(t.height for t in r)
    sheet.convert("RGB").save(path)


# ---------------------------------------------------------------- yazma
def write_block(path, start, end, body):
    s = path.read_text(encoding="utf8")
    block = f"{start}\n{body}\n{end}"
    if start in s:
        s = re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _: block, s, flags=re.S)
    else:
        raise SystemExit(f"{path}: işaret bulunamadı {start}")
    path.write_text(s, encoding="utf8")


def measure_insets(arr):
    """İç sınır: kenar şeritlerinde iç amber parıltı çizgisinin medyan konumu (t, r, b, l, px).
    İçerik dolgusu bu değerden türetilir."""
    h, w = arr.shape[:2]
    sw, sh = int(w * .2), int(h * .3)
    mid_r = slice(int(h * .4), int(h * .6)); mid_c = slice(int(w * .4), int(w * .6))
    l = int(np.median(glow_pos(arr[mid_r, :sw], 1)))
    r = int(w - sw + np.median(glow_pos(arr[mid_r, w - sw:], 1)))
    t = int(np.median(glow_pos(arr[:sh, mid_c], 0)))
    b = int(h - sh + np.median(glow_pos(arr[h - sh:, mid_c], 0)))
    return [t, w - 1 - r, h - 1 - b, l]


def opaque_band(arr):
    """Orta sütunlarda alfa > 200 olan satır aralığı (tahta bandı)."""
    h, w = arr.shape[:2]
    col = (arr[:, int(w * .4):int(w * .6), 3] > 200).mean(1) > .9
    ys = np.where(col)[0]
    return [int(ys.min()), int(h - 1 - ys.max())]


def hex_slot(arr, x1):
    """pill_counter: sol dilimdeki altıgen yuvanın İÇ alanı. Kaba merkezden (dış amber kutusu) başlayıp
    satır ve sütun boyunca amber çerçeveye çarpana kadar yürür -> iç merkez, iç genişlik ve yükseklik."""
    f = arr[:, :x1].astype(np.int32)
    amber = (f[..., 0] > 190) & (f[..., 1] > 110) & (f[..., 2] < 90) & (f[..., 3] > 200)
    h = arr.shape[0]
    xs = np.where(amber[int(h * .2):int(h * .8)].any(0))[0]
    xs = xs[xs > x1 * .15]
    cx = int((xs.min() + xs.max()) / 2)
    rows = np.where(amber[:, xs.min():xs.max()].any(1))[0]
    rows = rows[(rows > h * .1) & (rows < h * .9)]
    cy = int((rows.min() + rows.max()) / 2)
    def walk(line, start, step):
        i = start
        while 0 < i < len(line) - 1 and not line[i]:
            i += step
        return i
    xl, xr = walk(amber[cy], cx, -1), walk(amber[cy], cx, 1)
    yt, yb = walk(amber[:, cx], cy, -1), walk(amber[:, cx], cy, 1)
    return {"cx": round((xl + xr) / 2, 1), "cy": round((yt + yb) / 2, 1), "w": int(xr - xl), "h": int(yb - yt)}


def face_rows(arr, jump=40):
    """Yatay bileşenin yazı yüzü: orta sütunlarda opak bandın merkezinden yukarı/aşağı yürür,
    ardışık satırlar arasında ani renk değişimi (vurgu çizgisi, taş kenar) görülünce durur.
    Dönen değer: (üstten yüz başlangıcı, alttan yüz bitişine uzaklık)."""
    h, w = arr.shape[:2]
    col = np.median(arr[:, int(w * .45):int(w * .55), :3].astype(float), axis=1)
    op = np.where(arr[:, int(w * .5), 3] > 200)[0]
    c = (op.min() + op.max()) // 2
    y0 = c
    while y0 > 0 and np.abs(col[y0 - 1] - col[y0]).max() < jump:
        y0 -= 1
    y1 = c
    while y1 < h - 1 and np.abs(col[y1 + 1] - col[y1]).max() < jump:
        y1 += 1
    return [int(y0), int(h - 1 - y1)]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    report = {"frames": {}, "icons": {}, "moss": {}, "total_bytes": 0}
    fringe_items = []

    for name, opt in FRAMES.items():
        rgb = np.asarray(Image.open(SRC / f"{name}.png").convert("RGB"))
        img = crop_alpha(to_image(key_magenta(rgb)))
        key_out = LAST_KEY["out"]
        img = resize(img, w=opt["width"])
        arr = np.asarray(img)
        l, r, _ = measure_axis(arr, 1)
        t, b, _ = measure_axis(arr, 0)
        if "y" not in opt["stretch"]:
            # Yalnız yatay esneyen bileşen: dikeyde tam yükseklik iki yarıya bölünür (orta satır 0).
            t = img.height // 2; b = img.height - t
        sl = [t, r, b, l]
        extra = {}
        if "y" in opt["stretch"]:
            rough = list(sl)
            if opt.get("clean_sides"):
                before = side_edge_std(arr, sl)
                sl = refine_slices(arr, sl)  # plaka satırları kenar ortasında; köşe pahı ölçümünü bozmaz
                img, rows = clean_side_plates(img, sl)
                arr = np.asarray(img)
                extra = {"side_plate_rows": rows, "side_edge_std_before": round(before, 2), "side_edge_std_after": round(side_edge_std(arr, sl), 2)}
            sl = refine_slices(arr, sl)
            extra["slice_pass1"] = rough
        fx, fy = flatness(arr, sl, xonly="y" not in opt["stretch"])
        size, mode, err = save_ui(img, OUT / f"{name}.png")
        extra["inset"] = measure_insets(arr) if name != "plank_tagline" else None
        if "y" not in opt["stretch"]:
            extra["band"] = opaque_band(arr)  # opak çerçeve bandı (üst/alt saydam pay hariç)
            extra["face"] = face_rows(arr)    # yazı yüzü (metin bu alanın ortasına hizalanır)
        if name == "pill_counter": extra["slot"] = hex_slot(arr, sl[3])
        report["frames"][name] = {"size": [img.width, img.height], "key_out": key_out, "slice": sl, "stretch": opt["stretch"],
                                  "flat_x": round(fx, 2), "flat_y": round(fy, 2), "bytes": size, "png": mode, "quant_rmse": err,
                                  "flat_ok": (fx <= FLAT_T) and ("y" not in opt["stretch"] or fy <= FLAT_T), **extra}
        fringe_items.append((name, img))

    # ikonlar
    rgb = np.asarray(Image.open(SRC / "icons_sheet.png").convert("RGB"))
    full = to_image(key_magenta(rgb))
    boxes = sort_grid(components(np.asarray(full)[..., 3]))
    assert len(boxes) == 9, f"ikon sayısı {len(boxes)}"
    for nm, bx in zip(ICON_NAMES, boxes):
        ic = crop_alpha(full.crop(bx))
        ic = resize(ic, h=ICON_H) if ic.height >= ic.width else resize(ic, w=ICON_H)
        canvas = Image.new("RGBA", (ICON_H, ICON_H), (0, 0, 0, 0))
        canvas.alpha_composite(ic, ((ICON_H - ic.width) // 2, (ICON_H - ic.height) // 2))
        report["icons"][nm] = {"size": [ICON_H, ICON_H], "bytes": save_ui(canvas, OUT / f"{nm}.png")[0]}
        if nm in ("icon_ammonite", "icon_check"): fringe_items.append((nm, canvas))

    rgb = np.asarray(Image.open(SRC / "moss_sheet.png").convert("RGB"))
    full = to_image(key_magenta(rgb))
    boxes = sort_grid(components(np.asarray(full)[..., 3]))
    assert len(boxes) == 6, f"yosun sayısı {len(boxes)}"
    for i, bx in enumerate(boxes, 1):
        mo = resize(crop_alpha(full.crop(bx)), h=MOSS_H)
        report["moss"][f"moss_{i}"] = {"size": [mo.width, mo.height], "bytes": save_ui(mo, OUT / f"moss_{i}.png")[0]}
        if i == 1: fringe_items.append(("moss_1", mo))

    report["total_bytes"] = sum(p.stat().st_size for p in OUT.glob("*.png"))
    fringe_sheet(fringe_items, SHOTS / "ui_fringe.png")

    # Esneme testleri (CSS px). Kenar kalınlığı: köşe dilimi * kullanım ölçeği.
    def bw_x(img, sl, H):  # yatay bileşen: yükseklik H'ye göre ölçek
        return lambda W, H2: (H2 // 2, round(sl[1] * H2 / img.height), H2 - H2 // 2, round(sl[3] * H2 / img.height))
    def bw_xy(sl, k):
        return lambda W, H: tuple(max(1, round(v * k)) for v in sl)
    tests = {
        "btn_primary": [(220, 52, "en küçük"), (300, 60, "tipik"), (620, 96, "en büyük"), (1100, 70, "aşırı geniş"), (120, 140, "aşırı uzun")],
        "btn_secondary": [(140, 48, "en küçük"), (280, 56, "tipik"), (420, 80, "en büyük"), (900, 56, "aşırı geniş"), (90, 120, "aşırı uzun")],
        "plate_record": [(240, 52, "en küçük"), (360, 74, "tipik"), (460, 96, "en büyük"), (900, 74, "aşırı geniş"), (160, 140, "aşırı uzun")],
        "pill_counter": [(150, 46, "en küçük"), (220, 60, "tipik"), (300, 84, "en büyük"), (700, 60, "aşırı geniş"), (110, 120, "aşırı uzun")],
        "plank_tagline": [(220, 28, "en küçük"), (360, 36, "tipik"), (520, 48, "en büyük"), (1000, 36, "aşırı geniş"), (120, 90, "aşırı uzun")],
        "panel_frame": [(300, 300, "en küçük"), (480, 420, "tipik"), (780, 700, "en büyük"), (1200, 300, "aşırı geniş"), (300, 900, "aşırı uzun")],
        "card_frame": [(220, 150, "en küçük"), (300, 170, "tipik"), (380, 200, "en büyük"), (760, 150, "aşırı geniş"), (200, 420, "aşırı uzun")],
    }
    for name, sizes in tests.items():
        img = Image.open(OUT / f"{name}.png").convert("RGBA"); sl = report["frames"][name]["slice"]
        fn = bw_xy(sl, FRAME_SCALE[name]) if "y" in FRAMES[name]["stretch"] else bw_x(img, sl, None)
        stretch_sheet(name, img, sl, fn, sizes, SHOTS / f"ui_stretch_{name}.png")

    (OUT / "ui_slices.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf8")

    # config.js ve CSS değişkenleri
    js = ",".join(f'{k}:{{w:{v["size"][0]},h:{v["size"][1]},slice:[{",".join(map(str, v["slice"]))}]}}' for k, v in report["frames"].items())
    write_block(ROOT / "js" / "config.js", "  /*UI_SLICES_START*/", "  /*UI_SLICES_END*/", f"  DR.UISlices=Object.freeze({{{js}}});")
    css = [":root{"]
    for k, v in report["frames"].items():
        t, r, b, l = v["slice"]; w, h = v["size"]
        line = f"  --{k}-slice:{t} {r} {b} {l};--{k}-w:{w};--{k}-h:{h};--{k}-t:{t};--{k}-r:{r};--{k}-b:{b};--{k}-l:{l};"
        if v.get("inset"):
            it, ir, ib, il = v["inset"]; line += f"--{k}-it:{it};--{k}-ir:{ir};--{k}-ib:{ib};--{k}-il:{il};"
        if v.get("band"):
            line += f"--{k}-bt:{v['band'][0]};--{k}-bb:{v['band'][1]};"
        if v.get("slot"):
            line += f"--{k}-sx:{v['slot']['cx']};--{k}-sy:{v['slot']['cy']};--{k}-sw:{v['slot']['w']};--{k}-sh:{v['slot']['h']};"
        if v.get("face"):
            line += f"--{k}-ft:{v['face'][0]};--{k}-fb:{v['face'][1]};"
        css.append(line)
    css.append("}")
    write_block(ROOT / "css" / "style.css", "/*UI_SLICES_START*/", "/*UI_SLICES_END*/", "\n".join(css))

    print(json.dumps(report, indent=1, ensure_ascii=False))


# Çok yönlü çerçevelerin CSS'teki ölçeği (2x asset -> ekranda köşe ölçeği)
FRAME_SCALE = {"panel_frame": 0.42, "card_frame": 0.36}

if __name__ == "__main__":
    main()
