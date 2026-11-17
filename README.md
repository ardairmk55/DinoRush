# DinoRush

HTML Canvas ile çizilen, React veya zorunlu dış kütüphane kullanmayan özgün piksel sanat koşu oyunu. `index.html` çift tıklamayla Chrome/Edge'de açılır; ağ bağlantısı ve paket kurulumu gerekmez.

## Kontroller

- `Space`, `↑` veya `W`: zıpla; basılı tutmak daha yüksek sıçratır.
- `↓` veya `S`: eğil.
- `P` veya `Esc`: duraklat/devam et.
- `H`: yalnız adres `?debug` ile açıldığında çarpışma kutularını göster/gizle (geliştirme).
- Dokunmatik ekranda: oyun alanına dokun = zıpla; parmağını aşağı kaydır = eğil (havadaysan hızla iner). Alt köşelerdeki ZIPLA/EĞİL düğmeleri de çalışır.
- Sağ üstteki düğme tam ekranı açar; oyun sırasında yanındaki düğme sesi kapatır/açar.
- Ses, görüntü, kontrol şeması ve kayıt verileri **AYARLAR** panelindedir (SES, GÖRÜNTÜ, KONTROLLER, VERİ sekmeleri). Duraklat ekranından da açılır.

## Mağaza

Yalnızca kozmetik öğeler satılır; hız, zıplama, hitbox veya skor değişmez.

- **GÖRÜNÜMLER:** Orman (ücretsiz), Amber, Gece Mavisi, Lavanta, Kızıl, Altın. Her biri `assets/dino/dino_sheet_<id>.png` sprite sayfasıdır; dosya yüklenemezse `dino_sheet.png` kullanılır.
- **İZLER:** Toz (ücretsiz), Yaprak, Kıvılcım, Ateş Böceği — yalnızca koşu adımı partikülünün çizimi değişir.
- **SAHNE:** Gece (ücretsiz), Şafak, Gün Batımı — yalnızca renk derecelendirme ve sis tonu değişir.

Varyant sayfaları `python tools/make_dino_variants.py` ile yeniden üretilir; betik 8 gövde/karın/diken/kontur rengini birebir eşler, göz/ağız/yanak renklerine dokunmaz ve boyut ile alfanın değişmediğini doğrular. Renk değişimi çalışma zamanında yapılmaz (file:// altında piksel okuması yoktur).

## Yerel kayıt

Rekor, amber fosil bakiyesi, açılan/seçili kozmetikler ve tercihler `localStorage` içinde `dinorush-save-v1` anahtarıyla tutulur. Anahtar değişmedi; eski alanlar (`best`, `fossils`, `sound`, `vibration`, `lowEffects`, `owned`, `selected`) aynen korunur. Yeni alanlar eksikse varsayılan değer alır: `ownedTrails`, `selectedTrail`, `ownedScenes`, `selectedScene`, `masterVolume`, `sfxVolume`, `screenShake`, `flash`, `scanlines`, `playTime`, `saveVersion`. Eski sürümün `lagoon` görünümü `midnight` (Gece Mavisi) olarak taşınır. Tarayıcı verileri temizlenirse kayıt da silinir.

Kayıt ve satın alma mantığı tarayıcısız test edilir:

```
node --test tests/save.test.js tests/rules.test.js
```

## Yapı

- `index.html` — semantik menüler, inline SVG ikonları, HUD ve modallar.
- `css/style.css` — oyun içi malzeme token'ları, metal/amber plakalar, safe-area ve responsive yerleşim.
- `game.js` — durum makinesi, sabit 60 Hz simülasyon, çarpışma ve skor.
- `js/config.js` — tema, fizik, sprite kareleri ve çarpışma kutuları.
- `js/scene.js` — DPR/ResizeObserver boyutlandırma, offscreen arka plan, parallax ve Canvas piksel çizimleri.
- `js/entities.js` — parçacık, engel ve fosil nesne havuzları.
- `js/input.js` — klavye ve Pointer Events kontrolleri.
- `js/save-core.js` — saf kayıt/migrasyon/satın alma mantığı (Node testleri bunu kullanır).
- `js/storage.js`, `js/audio.js`, `js/ui.js` — güvenli yerel kayıt, Web Audio/titreşim, ekranlar.
- `js/panels.js` — mağaza (sekmeler, kart durumları, onay, önizlemeler) ve ayarlar paneli.
- `tools/make_dino_variants.py`, `tests/save.test.js` — varyant üretimi ve birim testleri.
- `assets/dino/dino_sheet.png` — 44×36 hücreli, beş animasyon satırlı dinozor sprite sayfası.
- `assets/` — palete indirgenmiş arka plan, çit, zemin, ön plan bitkileri, fosiller, engeller, pterosaur pozları ve logo PNG'leri.
- `assets/manifest.js` ve `js/assets.js` — yerel PNG yükleyicisi; görsel yüklenemezse eski prosedürel çizimler kullanılır. Boyutlar ve animasyon kareleri `js/config.js` içindedir; JSON isteği yapılmaz.

`DINO_PIXEL_WORLD` değeri 2'dir. Ayakta dino hitbox'ı kaynak pikselinde `{x:11,y:6,w:25,h:29}`, eğilmede `{x:9,y:17,w:30,h:18}` olarak kalır ve bu katsayıyla dünya birimine çevrilir. Engel hitbox'ları sprite sınırlarının her kenarından yüzde 12 içeri alınır. Özgün `assets/art_src/` dosyaları işleme sırasında değiştirilmez.

Arka plan, engeller ve arayüz Canvas/CSS ile çizilir; dinozor çizimi yerel sprite sayfasından yüklenir. PNG'ler paletli ve kutu filtresiyle küçültülmüş olarak `assets/` altında bulunur. Harici CDN, `fetch` veya görsel piksel okuması yoktur. Sistem yazı tipleri Türkçe karakterleri gösterecek fallback zinciriyle ayarlanmıştır.

## Arayüz PNG çerçeveleri (Aşama 2)

- Kaynaklar `assets/ui_src/` altındadır ve değiştirilmez. `python tools/make_ui_assets.py` magenta zemini yumuşak alfaya çevirir (kenar şeridinden ölçülen tolerans, despill), kırpar, LANCZOS ile 2x boyuta küçültür, 9 parçalı kesim / iç sınır / opak bant değerlerini **ölçer**, Bayer titreşimli 256 renk palete sıkıştırır (algısal hata eşiği aşılırsa RGBA bırakır) ve sonuçları `assets/ui/`, `assets/ui/ui_slices.json`, `js/config.js` (`DR.UISlices`) ve `css/style.css` içindeki `UI_SLICES` bloğuna yazar. Esneme ve renk halkası temas sayfaları `tests/screenshots/ui_stretch_*.png`, `ui_fringe.png`.
- `js/ui-skin.js` her PNG'yi ayrı yükler; yüklenen çerçeve için `<html>` üzerine `png-<ad>` sınıfı ekler, ikonlarda SVG `<symbol>` içeriğini PNG ile değiştirir. Bir PNG yüklenemezse o bileşen Aşama 1 CSS görünümünde kalır; geometri iki modda aynı olduğu için yerleşim kaymaz.

## Dikey (mobil) ekran

Dikey ekranda görünür dünya 640 yerine 440 birimdir (`viewport.portraitWidth`) ve çizim 76 birim sola kayar (`viewport.portraitShift`); böylece dino ~1,45 kat büyük görünür ve önündeki alan genişler. Bu yalnız görüntüdür: fizik, çarpışma ve engel aralıkları değişmez, engeller görünür kenarın dışında doğar. Oyun sırasında uzak sahne çitin arkasına iner. Geri sayımda dokunmatik düzende kısa bir kontrol ipucu görünür. Yatay ekranlar etkilenmez.

## Pterosaur

Pterosaur sabit boyutlu (eski en büyük halinin ~%65'i) ve iki şeritte uçar; kurallar `js/rules.js` içindedir ve `tests/rules.test.js` ile kare kare simüle edilerek doğrulanır.

- **Alçak şerit:** yere yakın; ayakta ve eğilmiş dinoya çarpar, ZIPLA ile geçilir. Zıplama penceresi kütük ve kayadan daha geniştir.
- **Yüksek şerit:** baş hizasında; ayakta dinoya çarpar, EĞİL ile altından geçilir (eğilmiş dinonun 11 birim üstünden geçer).
- İlk 120 puanda pterosaur çıkmaz, yüksek şerit 300 puandan sonra gelir. Ekrana girmeden önce sağ kenarda geleceği yükseklikte uyarı işareti yanıp söner; yerde gölgesi ve etrafında açık bir kontur vardır. Kanat sallantısı yalnız görüntüdür, çarpışma kutusu sabittir.

## Yayınlama

```
python tools/build_dist.py
```

`dist/` klasörü yayına hazır pakettir (~880 KB, 65 dosya): yalnız çalışma zamanında kullanılan dosyalar, `404.html`, `robots.txt`, `site.webmanifest`, `_headers` ve içerik özetiyle sürümlenmiş `sw.js`. Kaynak görseller, testler ve araçlar pakete girmez. Bu klasörü olduğu gibi herhangi bir statik barındırmaya yükleyin (Netlify, Cloudflare Pages, GitHub Pages, kendi sunucunuz).

- `dist/index.html` çift tıklamayla da çalışır; web uygulaması manifesti ve çevrimdışı önbellek yalnız `http(s)` altında etkinleşir.
- `_headers` (güvenlik ve önbellek başlıkları) Netlify ve Cloudflare Pages'te otomatik uygulanır; başka barındırmalarda aynı başlıkları sunucu ayarına ekleyin. GitHub Pages bu dosyayı yok sayar.
- Yeni sürümde `js/config.js` içindeki `version` değerini artırıp paketi yeniden üretin; önbellek adı içerik özetine bağlı olduğu için oyuncular bir sonraki açılışta yeni sürümü alır ve eski önbellek silinir.
- Paylaşım önizlemesi (`og:image`) göreli yoldur; alan adı belli olunca bazı platformlar için `index.html` içinde tam adrese çevirmek önerilir.
- Statik denetim: `node tools/audit.js` (veya `node tools/audit.js dist`) eksik dosya, yinelenen kimlik, adsız düğme ve alt metni eksik görselleri raporlar.
- Önyüklemede bir betik eksik ya da boş yüklenirse oyun bozuk açılmaz; Türkçe açıklama ve "YENİDEN YÜKLE" düğmesi gösterilir.

## GitHub'a yükleme ve GitHub Pages yayını

Depo GitHub'a hazırdır: `.gitignore` yayın paketini (`dist/`) ve test çıktılarını (`tests/screenshots/`, ~150 MB) dışarıda bırakır; yüklenecek içerik ~25 MB / ~100 dosyadır. `.github/workflows/pages.yml` her `main` (veya `master`) yüklemesinde testleri çalıştırır, `dist/` paketini üretir ve GitHub Pages'e yayınlar.

1. GitHub'da yeni, **public** bir depo oluştur (ör. `DinoRush`). README, .gitignore veya lisans ekleme seçeneklerini boş bırak.
2. Bu klasörü yükle. `.gitignore`'un uygulanması için **GitHub Desktop** veya `git` kullan:
   - GitHub Desktop: *File → Add local repository* → bu klasörü seç → "create a repository" → *Commit to main* → *Publish repository*.
   - Komut satırı (klasörün içinde):
     ```
     git init
     git add .
     git commit -m "DinoRush ilk sürüm"
     git branch -M main
     git remote add origin https://github.com/KULLANICI_ADIN/DinoRush.git
     git push -u origin main
     ```
   - Web arayüzüyle sürükle-bırak yükleme `.gitignore`'u uygulamaz; o yolu seçersen `dist/` ve `tests/screenshots/` klasörlerini yükleme, `.github` klasörünün de yüklendiğinden emin ol.
3. Depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seç.
4. **Actions** sekmesinde "Test ve GitHub Pages yayını" iş akışı bitince site `https://KULLANICI_ADIN.github.io/DinoRush/` adresinde yayında olur. Sonraki her yükleme siteyi otomatik günceller; testlerden biri başarısız olursa yayın yapılmaz.

Yerelde aynı adımlar: `npm test`, `npm run audit`, `npm run build` (Python 3 ve Node 20+ gerekir; ek paket kurulumu gerekmez). Varlıkları kaynaklardan yeniden üretmek için `python tools/make_ui_assets.py` ve `python tools/make_dino_variants.py` (bu ikisi için Pillow ve numpy gerekir).

Not: Depoda lisans dosyası yok. Kodun başkaları tarafından nasıl kullanılabileceğini belirlemek istersen GitHub'da *Add file → Create new file → LICENSE* ile bir lisans seçebilirsin.
