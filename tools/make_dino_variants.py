"""DinoRush dino görünüm varyantlarını üretir.

Kaynak: assets/dino/dino_sheet.png (değiştirilmez).
Çıktı:  assets/dino/dino_sheet_<id>.png

Yalnızca aşağıdaki 8 RGBA rengi birebir eşlenir; göz, ağız, yanak, beyaz
parıltı ve saydam pikseller olduğu gibi kalır. Çalıştırma:
    python tools/make_dino_variants.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "dino" / "dino_sheet.png"
OUT = ROOT / "assets" / "dino"

# Sıra: gövde ana, gövde gölge, gövde ışık, karın, karın gölge, diken, diken gölge, kontur
KEYS = ["body", "body_shadow", "body_light", "belly", "belly_shadow", "spike", "spike_shadow", "outline"]
SOURCE = {
    "body": (96, 190, 64), "body_shadow": (58, 138, 48), "body_light": (158, 226, 104),
    "belly": (244, 230, 170), "belly_shadow": (212, 188, 118),
    "spike": (238, 84, 46), "spike_shadow": (178, 46, 30), "outline": (20, 52, 34),
}
# Dokunulmayan renkler (göz, beyaz parıltı, yanak, ağız)
UNTOUCHED = [(28, 22, 40), (255, 255, 255), (246, 132, 112), (228, 80, 92)]

VARIANTS = {
    "fern": dict(SOURCE),
    "amber": {
        "body": (224, 150, 46), "body_shadow": (164, 94, 30), "body_light": (252, 204, 104),
        "belly": (252, 238, 196), "belly_shadow": (222, 192, 132),
        "spike": (150, 58, 34), "spike_shadow": (98, 34, 22), "outline": (60, 30, 12),
    },
    "midnight": {
        "body": (66, 116, 200), "body_shadow": (40, 72, 144), "body_light": (124, 172, 236),
        "belly": (216, 228, 242), "belly_shadow": (162, 180, 210),
        "spike": (255, 196, 72), "spike_shadow": (198, 128, 30), "outline": (12, 24, 58),
    },
    "lavender": {
        "body": (166, 134, 216), "body_shadow": (114, 88, 166), "body_light": (210, 186, 246),
        "belly": (248, 234, 216), "belly_shadow": (214, 190, 168),
        "spike": (82, 196, 164), "spike_shadow": (40, 132, 112), "outline": (42, 26, 66),
    },
    "ember": {
        "body": (204, 64, 48), "body_shadow": (140, 36, 34), "body_light": (242, 122, 86),
        "belly": (250, 216, 162), "belly_shadow": (214, 170, 112),
        "spike": (255, 202, 70), "spike_shadow": (204, 134, 30), "outline": (54, 14, 16),
    },
    "gold": {
        "body": (234, 186, 54), "body_shadow": (178, 126, 24), "body_light": (255, 234, 124),
        "belly": (255, 249, 218), "belly_shadow": (232, 210, 152),
        "spike": (186, 42, 62), "spike_shadow": (122, 22, 42), "outline": (72, 44, 8),
    },
}


def build(src, mapping):
    table = {SOURCE[k] + (255,): mapping[k] + (255,) for k in KEYS}
    out = src.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            q = table.get(p)
            if q is not None:
                px[x, y] = q
    return out


def verify(src, out, mapping, name):
    assert out.size == src.size, f"{name}: boyut farklı {out.size} != {src.size}"
    a, b = src.load(), out.load()
    w, h = src.size
    forward = {SOURCE[k] + (255,): mapping[k] + (255,) for k in KEYS}
    for y in range(h):
        for x in range(w):
            p, q = a[x, y], b[x, y]
            assert p[3] == q[3], f"{name}: alfa değişti ({x},{y})"
            if p[3] == 0:
                continue
            if p in forward:
                assert q == forward[p], f"{name}: eşleme hatalı ({x},{y})"
            else:
                assert q == p, f"{name}: dokunulmaması gereken renk değişti ({x},{y}) {p}->{q}"
    # Yeni palet dokunulmayan renklerle çakışmasın ve kendi içinde benzersiz olsun.
    vals = [mapping[k] for k in KEYS]
    assert len(set(vals)) == len(vals), f"{name}: palet içinde tekrar eden renk"
    for c in vals:
        assert c not in UNTOUCHED, f"{name}: {c} göz/ağız/yanak rengiyle çakışıyor"


def main():
    src = Image.open(SRC).convert("RGBA")
    for name, mapping in VARIANTS.items():
        out = build(src, mapping)
        verify(src, out, mapping, name)
        path = OUT / f"dino_sheet_{name}.png"
        out.save(path, optimize=True)
        re = Image.open(path).convert("RGBA")
        verify(src, re, mapping, name + " (diskten)")
        print(f"{path.relative_to(ROOT)}  {re.size[0]}x{re.size[1]}  doğrulandı")


if __name__ == "__main__":
    main()
