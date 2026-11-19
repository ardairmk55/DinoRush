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

Yalnızca kozmetik öğeler satılır; hız, zıplama, hitbox veya skor değişmez. Mağazada dört kategori vardır.

- **GÖRÜNÜMLER:** Orman (ücretsiz), Amber, Gece Mavisi, Lavanta, Kızıl, Altın. Her biri `assets/dino/dino_sheet_<id>.png` sprite sayfasıdır; dosya yüklenemezse `dino_sheet.png` kullanılır.
- **İZLER:** Toz (ücretsiz), Yaprak, Kıvılcım, Ateş Böceği. Yalnızca koşu adımı partikülünün çizimi değişir.
- **SAHNELER:** Gece (ücretsiz), Şafak, Gün Batımı. Yalnızca renk derecelendirme ve sis tonu değişir.
- **AKSESUARLAR:** Riko için 17 piksel aksesuar, üç yuvada toplanır:
  - Şapka: kaşif şapkası, kış beresi, korsan bandanası, ranger şapkası, yumurta başlık, altın taç.
  - Gözlük: bilim insanı, güneş, pilot, neon ve gece görüş gözlükleri.
  - Diğer: mini atkı, maceracı fuları, kaşif rozeti, sırt çantası, fosil kolyesi, ranger ekipmanı.

  Aynı yuvada aynı anda tek aksesuar kuşanılır; farklı yuvalar birlikte kuşanılabilir. Aksesuarlar çıkarılabilir.

  Çizimler `js/accessory-art.js` içindedir. Konum, sprite'taki ibik noktasına göre her kare için ölçülmüştür. Bu yüzden aksesuar menüde, koşuda, zıplamada, eğilmede ve düşüşte (dönerek) Riko'yla birlikte hareket eder.

**Nadirlik ve fiyat.** Her ürünün nadirliği vardır ve fiyatı o nadirliğin aralığındadır:

| Nadirlik | Aralık (fosil) | Ürünler |
|---|---|---|
| Başlangıç | 80–120 | Amber 100, Yaprak 90; Kaşif Şapkası 120, Kış Beresi 100, Bilim İnsanı Gözlüğü 90, Mini Atkı 80, Maceracı Fuları 110 |
| Standart | 150–250 | Gece Mavisi 200, Şafak 180; Korsan Bandanası 180, Ranger Şapkası 250, Güneş Gözlüğü 160, Kaşif Rozeti 150, Sırt Çantası 220 |
| Nadir | 300–500 | Lavanta 350, Kıvılcım 300, Gün Batımı 400; Pilot Gözlüğü 320, Fosil Kolyesi 450 |
| Epik | 600–900 | Kızıl 650, Ateş Böceği 700; Yumurta Başlık 800, Neon Gözlük 650, Gece Görüş 900 |
| Efsanevi | 1000–1500 | Altın 1200; Altın Taç 1400, Ranger Ekipmanı 1000 |

Tüm katalog 11.150 fosildir. Ölçülen kazanım dakikada yaklaşık 57 fosildir (engelsiz, düzenli zıplayan test botu). Buna göre:
- Başlangıç ürünleri 1–2 koşuda alınır.
- Efsanevi ürünler yaklaşık 20 koşu ister.
- Hepsi yaklaşık 3 saatlik koşuyla alınır.

Fosil kazanım hızı (oyun mekaniği) değiştirilmedi. `tests/save.test.js` her fiyatın kendi nadirlik aralığında olduğunu denetler.

**Satın alma:**
- Satın almadan önce onay penceresi açılır.
- Bakiye mağazanın üstünde sabit durur ve anında güncellenir.
- Yetersiz bakiyede eksik miktar yazılır.
- Hızlı çoklu tıklama tek satın alma yapar; sahip olunan ürün yeniden satın alınamaz.

Varyant sayfaları `python tools/make_dino_variants.py` ile yeniden üretilir; betik 8 gövde/karın/diken/kontur rengini birebir eşler, göz/ağız/yanak renklerine dokunmaz ve boyut ile alfanın değişmediğini doğrular. Renk değişimi çalışma zamanında yapılmaz (file:// altında piksel okuması yoktur).

## Yerel kayıt

Rekor, amber fosil bakiyesi, açılan/seçili kozmetikler ve tercihler `localStorage` içinde `dinorush-save-v1` anahtarıyla tutulur. Kayıt sürümü 3: `ownedAccessories`, `accessories` (`head`/`face`/`gear`), `menuMusicVolume`, `gameMusicVolume`, `particles`, `performance`, `reduceMotion` ve `savedAt` eklendi; v2'deki `musicVolume` iki müzik düzeyine taşınır. Sahip olunan ürünler, bakiye ve seçimler taşımada korunur. Anahtar değişmedi; eski alanlar (`best`, `fossils`, `sound`, `vibration`, `lowEffects`, `owned`, `selected`) aynen korunur. Yeni alanlar eksikse varsayılan değer alır: `ownedTrails`, `selectedTrail`, `ownedScenes`, `selectedScene`, `masterVolume`, `sfxVolume`, `screenShake`, `flash`, `scanlines`, `playTime`, `saveVersion`. Eski sürümün `lagoon` görünümü `midnight` (Gece Mavisi) olarak taşınır. Tarayıcı verileri temizlenirse kayıt da silinir.

Kayıt ve satın alma mantığı tarayıcısız test edilir:

```
node --test tests/save.test.js tests/rules.test.js tests/riko.test.js
```

(`npm test` aynı komutu çalıştırır.)

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
- `js/riko-messages.js`, `js/riko-core.js`, `js/riko.js` — Riko konuşma sistemi (aşağıya bakın).
- `js/accessory-art.js` — Riko aksesuarlarının piksel çizimleri ve kare başına bağlanma noktaları.
- `js/music.js`, `assets/audio/` — arka plan müziği (aşağıya bakın).
- `js/panels.js` — mağaza (sekmeler, kart durumları, onay, önizlemeler) ve ayarlar paneli.
- `tools/make_dino_variants.py`, `tests/save.test.js` — varyant üretimi ve birim testleri.
- `assets/dino/dino_sheet.png` — 44×36 hücreli, beş animasyon satırlı dinozor sprite sayfası.
- `assets/` — palete indirgenmiş arka plan, çit, zemin, ön plan bitkileri, fosiller, engeller, pterosaur pozları ve logo PNG'leri.
- `assets/manifest.js` ve `js/assets.js` — yerel PNG yükleyicisi; görsel yüklenemezse eski prosedürel çizimler kullanılır. Boyutlar ve animasyon kareleri `js/config.js` içindedir; JSON isteği yapılmaz.

`DINO_PIXEL_WORLD` değeri 2'dir. Ayakta dino hitbox'ı kaynak pikselinde `{x:11,y:6,w:25,h:29}`, eğilmede `{x:9,y:17,w:30,h:18}` olarak kalır ve bu katsayıyla dünya birimine çevrilir. Engel hitbox'ları sprite sınırlarının her kenarından yüzde 12 içeri alınır. Özgün `assets/art_src/` dosyaları işleme sırasında değiştirilmez.

Arka plan, engeller ve arayüz Canvas/CSS ile çizilir; dinozor çizimi yerel sprite sayfasından yüklenir. PNG'ler paletli ve kutu filtresiyle küçültülmüş olarak `assets/` altında bulunur. Harici CDN, `fetch` veya görsel piksel okuması yoktur. Sistem yazı tipleri Türkçe karakterleri gösterecek fallback zinciriyle ayarlanmıştır.

## Riko konuşma sistemi

Menüdeki dino (Riko) 60 sabit mesajla konuşur. Mesaj metinleri `js/riko-messages.js` içinde kimlik, kategori ve konuşma animasyonuyla birlikte durur.

- `js/riko-core.js` saf seçim mantığıdır; DOM ve zamanlayıcı içermez. Öncelik sırası: rekor > oyun sonu > başlangıç > fosil > mağaza/ayarlar > tıklama > menü > hareketsizlik. Aktif mesajdan düşük öncelikli olay gelirse yok sayılır; kuyruk birikmez.
- Tekrar önleme önce son 10 mesajı dışlar. Havuz tükenirse son 5'i, o da tükenirse yalnız son mesajı dışlar. Aynı mesaj art arda hiç gelmez.
- Tanıtım mesajı (1) yalnız ilk ziyarette çıkar. 3 günden uzun aradan sonra karşılama 6 gelir. Özel mesajlar (56–60) seyrektir.
- Ton, mevcut rekordan türetilir; yeni bir seviye sistemi yoktur.
- `js/riko.js` balonu (`textContent`, `aria-live`) ve Riko'ya dokunma alanını yönetir. Balon dokunmayı engellemez (`pointer-events:none`) ve düğmelerin üstüne binmeyecek yeri seçer.
- `js/riko.js` var olan `DR.UI` çağrılarını sarar: `enterCountdown`, `updateFossils`, `updateRecord`, `showGameOver`, `showPause`, `showMenu`. Oyun mekaniği değişmez.
- Duraklatınca ve sekme gizlenince balon kapanır. Hareketsizlik mesajı 50–60 sn sonra gelir.
- Konuşma hareketleri var olan sprite satırlarıyla yapılır: nefes, zıplama, eğilme. `prefers-reduced-motion` açıkken kapanır.
- Geçmiş `localStorage` içinde `dinorush-riko-v1` anahtarıyla tutulur: `recentMessages`, `lastMessageId`, `firstVisit`, `lastSeen`. Kayıt bozuksa varsayılana döner.

## Ayarlar

Ayarlar altı bölümden oluşur.

- **Ses:**
  - Genel ses, menü müziği, oyun müziği ve efekt sesi kaydırıcıları; hepsi gerçek ses sistemine bağlıdır.
  - Müzik ve tüm sesler için ayrı aç/kapat.
- **Görüntü:**
  - Tam ekran / pencere ve efekt kalitesi (Yüksek/Düşük).
  - Performans modu: tuval 1x çözünürlükte çizilir, süs hareketleri kapanır.
  - Parçacık efektleri, ekran sarsıntısı, çarpma flaşı, tarama çizgileri.
  - Animasyonları azalt: arayüz geçişleri, Riko'nun hareketleri ve önizlemeler durur. İlk açılışta sistemin "hareketi azalt" tercihinden gelir.
- **Kontroller:** klavye kartları, dokunmatik şema ve titreşim.
- **Veri:**
  - Kayıt durumu ve son kayıt zamanı; rekor, bakiye, kozmetik sayısı ve kayıt boyutu.
  - İki aşamalı sıfırlama: 2 saniye basılı tut, sonra son uyarıyı onayla. İsteğe bağlı "tam sıfırlama" ayarları ve Riko geçmişini de siler.
- **Gizlilik:** saklanan verilerin gerçek listesi, çerez kullanılmadığı, üçüncü taraf hizmet olmadığı ve KVKK bilgilendirmesi. Metin bilgilendirme amaçlıdır; hukuki inceleme önerisi metnin içinde yazar.
- **Hakkında:** logo, oyun açıklaması, tasarım ve geliştirme (Arda Irmak), portföy düğmesi (yeni sekmede açılır), sürüm, müzik ve telif bilgisi.

Mağaza ve ayarlarda başlık, sekmeler ve alt düğme sabit kalır; yalnız içerik alanı kayar. Yerleşim 320x568'den 1920x1080'e kadar 10 çözünürlükte otomatik denetlenir: taşma, çakışma, kesik metin ve 48 px dokunma hedefi.

## Arka plan müziği

İki CC0 parça vardır: menü/mağaza/ayarlar için `assets/audio/menu-theme.mp3`, koşu için `assets/audio/gameplay-theme.mp3`. Kaynak, sanatçı ve işleme notları `assets/audio/CREDITS.md` içindedir.

- **Geçişler.** `js/music.js` var olan `DR.UI` çağrılarını sarar: OYNA/yeniden dene oyun parçasını baştan başlatır, duraklatma yumuşakça susturur, devam kaldığı yerden sürer, oyun sonu ve menüye dönüş menü parçasına geçer. Geçişte çalan parça 0,45 sn'de kısılıp durur, yenisi ardından 0,7 sn'de açılır; iki parça hiç üst üste çalmaz.
- **Döngü.** http(s) üzerinde Web Audio ile çalınır. Döngü noktaları `js/config.js` içindeki gerçek içerik uzunluğu ve MP3 gecikmesiyle (1105 örnek) örnek düzeyinde kesindir. `file://` ile açılınca `<audio>` öğesine düşülür; orada döngüde çok kısa bir boşluk olabilir.
- **Otomatik oynatma.** İlk dokunuş ya da tuş basışından önce hiçbir şey çalmaz ve dosya indirilmez. Menü çalınca oyun parçası önceden çözülür. Sekme gizlenince ses bağlamı askıya alınır.
- **Ayarlar.** Ayarlar > SES'te MÜZİK (aç/kapa), MENÜ MÜZİĞİ ve OYUN MÜZİĞİ (%0–100) vardır; `dinorush-save-v1` içinde `music`, `menuMusicVolume` ve `gameMusicVolume` alanlarına kaydedilir (varsayılan açık, %70). Duyulan düzey GENEL SES × parçanın kendi düzeyidir; TÜM SESLER kapalıyken müzik de susar.
- **Yayın paketi.** Müzik service worker kurulumunda indirilmez; ilk çalındığında önbelleğe alınır, sonra çevrimdışı da çalar.

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
