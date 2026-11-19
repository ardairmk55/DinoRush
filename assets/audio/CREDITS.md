# Müzik kaynakları ve lisansları

İki parça da **CC0 1.0 (kamu malı)** lisanslıdır. Ticari kullanım serbesttir, atıf zorunlu değildir; yine de kaynaklar burada kayıtlıdır.

| Dosya | Özgün parça | Sanatçı | Kaynak | Lisans |
|---|---|---|---|---|
| `menu-theme.mp3` | 8-bit Forest Theme (`TheForest_0.wav`) | Wolfgang_ | https://opengameart.org/content/8-bit-forest-theme | CC0 |
| `gameplay-theme.mp3` | Level 1, "5 Chiptunes (Action)" / Retro Game Music Pack | Juhani Junkala (SubspaceAudio) | https://opengameart.org/content/5-chiptunes-action | CC0 (paketteki INFO.txt: "released under CC0 creative commons license") |

CC0 metni: https://creativecommons.org/publicdomain/zero/1.0/

## İşleme

Özgün WAV dosyaları 2026-11-19'da OpenGameArt'tan indirildi ve lamejs ile MP3'e çevrildi. Özgün dosyalar depoya eklenmedi.

- **Baş/son sessizlik:** -50 dB altındaki kısım kırpıldı. Menü parçasında başta 83 ms, sonda 66 ms; oyun parçasında kırpılacak sessizlik yoktu.
- **Ses düzeyi:** iki parçanın algılanan sesi yakın olsun diye menü +4 dB, oyun -6 dB ayarlandı. Kırpılma (clipping) yok.
- **`menu-theme.mp3`:** 48 kHz mono, 80 kbps, 170,7 sn, 1,7 MB.
- **`gameplay-theme.mp3`:** 44,1 kHz stereo, 128 kbps, 74,3 sn, 1,2 MB. Parça, yazarının belirttiği gibi kesintisiz döngü olarak bestelenmiş.

Döngü noktaları çalışma anında belirlenir: `js/music.js`, çözülen sesin başındaki ve sonundaki kodlayıcı boşluğunu aynı eşikle atlar.
