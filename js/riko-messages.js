/*
 * Riko'nun 60 mesajı. Metinler verildiği gibi korunur (Türkçe karakterler, noktalama).
 * id: kalıcı kimlik (geçmiş kaydı bunu saklar), cat: kategori, mood: konuşurken kullanılacak animasyon.
 * Tarayıcıda window.DinoRush.RikoMessages, Node'da module.exports.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DinoRush = root.DinoRush || {}).RikoMessages = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const M = (id, cat, mood, text) => Object.freeze({ id, cat, mood, text });
  const messages = [
    // A. Karşılama ve selamlama (greeting)
    M(1, "greeting", "talk", "Selam! Ben Riko! Dinozor parkının en cesur maceracısı… En azından kendi gözümde öyleyim!"),
    M(2, "greeting", "talk", "Hey! Sonunda geldin! Ben de tam yeni bir maceraya atılacaktım. İyi ki yetiştin!"),
    M(3, "greeting", "talk", "Günaydın macera arkadaşım! Bugün fosiller mi topluyoruz, yoksa rekorları mı parçalıyoruz?"),
    M(4, "greeting", "funny", "Hoş geldin! Biliyor musun, sen gelene kadar üç kere esnedim, iki kere kuyruğuma bastım!"),
    M(5, "greeting", "talk", "Selam! Ben Riko. Küçük olabilirim ama maceralarım kocaman!"),
    M(6, "greeting", "joy", "Ooo! Macera arkadaşım geri döndü! Hadi bakalım, bugün parkta bizi neler bekliyor?"),
    M(7, "greeting", "joy", "Seni görünce enerjim yerine geldi! Hazırsan bu ormanı biraz karıştıralım!"),
    M(8, "greeting", "talk", "Psst! Buraya gel! Sana anlatmam gereken çok önemli bir şey var… Önce şu fosilleri bulalım!"),
    // B. Motivasyon (motivation)
    M(9, "motivation", "hop", "Bugün yeni bir rekor kıracağımıza dair içimde çok güçlü bir his var. Kuyruğum bile heyecandan sallanıyor!"),
    M(10, "motivation", "hop", "Her büyük macera küçük bir adımla başlar. Hadi, ilk adımı atalım!"),
    M(11, "motivation", "hop", "Unutma, önemli olan kaç kere düştüğün değil, kaç kere yeniden koştuğun!"),
    M(12, "motivation", "hop", "Biraz cesaret, biraz hız ve bolca fosil… İşte gerçek bir maceranın tarifi!"),
    M(13, "motivation", "funny", "Kendine güven! Bu park düşündüğün kadar korkutucu değil. Tamam, belki biraz korkutucu…"),
    M(14, "motivation", "hop", "Bugün sınırlarımızı zorlayacağız! Ben hazırım, sen de hazır mısın?"),
    M(15, "motivation", "hop", "Her rekor önce bir hayaldi. Belki de sıradaki büyük rekor senindir!"),
    M(16, "motivation", "hop", "Sakın pes etme! En güzel maceralar genellikle en zor yolların sonunda başlar!"),
    // C. Komik ve yaramaz Riko (funny)
    M(17, "funny", "funny", "Bir T-Rex ile saklambaç oynadım. Kazandım! Çünkü beni bulduğunda çoktan kaçmıştım!"),
    M(18, "funny", "funny", "Sence dinozorlar neden telefon kullanmaz? Çünkü şarj kablosunu görünce onu fosil sanıyorlar!"),
    M(19, "funny", "funny", "Az önce bir çalı gördüm ve bana baktığını düşündüm. Sonra fark ettim ki çalı bendim!"),
    M(20, "funny", "funny", "Bacaklarım kısa olabilir ama kaçış planlarım çok uzun!"),
    M(21, "funny", "funny", "Biraz acıktım… Keşke fosillerin tadı güzel olsaydı. Ama geçen sefer denedim, hiç tavsiye etmiyorum!"),
    M(22, "funny", "funny", "Bugün çok hızlıyım! Hatta kendi gölgem bile bana yetişemiyor!"),
    M(23, "funny", "funny", "T-Rex'in kolları neden kısa biliyor musun? Çünkü o da benim gibi oyun kumandasına uzanamıyor!"),
    M(24, "funny", "funny", "Bir dinozorun en büyük korkusu nedir biliyor musun? Ayakkabı bağcığı! Çünkü bağlayacak parmakları yok!"),
    // D. Oyuna başlama ve macera (gameplay)
    M(25, "gameplay", "hop", "Ayaklarını hazırla, gözlerini dört aç! Bu parkta tehlike her çalının arkasında olabilir!"),
    M(26, "gameplay", "hop", "Kapılar açılıyor! Fosiller bizi çağırıyor. Hadi, DinoRush başlasın!"),
    M(27, "gameplay", "talk", "Önümüzde uzun bir yol var. Ama merak etme, ben yanındayım!"),
    M(28, "gameplay", "talk", "Şu ilerideki ormanı görüyor musun? Orada neler olduğunu öğrenmeden geri dönmeyeceğim!"),
    M(29, "gameplay", "talk", "Koşarken gözünü yoldan ayırma! Bir çalı, bir kaya ve kocaman bir sürpriz seni bekliyor olabilir!"),
    M(30, "gameplay", "hop", "Hazır mısın? Üç, iki, bir… Macera başlasın!"),
    M(31, "gameplay", "talk", "Bu parkta hızlı olan kazanır ama akıllı olan daha uzun süre hayatta kalır!"),
    M(32, "gameplay", "talk", "Birazdan karşılaşacağımız şeyleri görsen inanamazsın. Neyse ki önce kaçmayı öğrenmişsin!"),
    // E. Fosil ve başarı (fossil, achievement)
    M(33, "fossil", "joy", "Hey! Bir fosil buldun! Her parça bizi geçmişin gizemlerine biraz daha yaklaştırıyor!"),
    M(34, "fossil", "joy", "İşte bu! Fosiller cebimize, heyecan kalbimize! Böyle devam et!"),
    M(35, "fossil", "joy", "Bir tane daha! Bu gidişle kendi dinozor müzemizi açacağız!"),
    M(36, "fossil", "joy", "Vay canına! Bu kadar fosili görünce kendimi arkeolog gibi hissettim!"),
    M(37, "fossil", "joy", "Her topladığın fosil yeni bir keşif demek. Bakalım koleksiyonumuz ne zaman dolacak?"),
    M(38, "fossil", "funny", "Harika gidiyorsun! Ben olsam bu kadar fosili toplamak için üç kez yorulurdum. Neyse ki ben çok dayanıklıyım!"),
    M(39, "achievement", "celebrate", "Yeni rekor! Bunu parkın duvarına yazdırmalıyız. Hatta gökyüzüne!"),
    M(40, "achievement", "celebrate", "İnanılmaz bir koşuydu! Bugün gerçekten efsane bir macera yaşadık!"),
    // F. Oyun sonu ve yeniden deneme (gameover)
    M(41, "gameover", "sad", "Ahh! Biraz erken bitti sanki… Ama sorun değil, bir sonraki koşumuz çok daha iyi olacak!"),
    M(42, "gameover", "sad", "Hey, moralini bozma! Ben de ilk koşumda kendi kuyruğuma takılıp düşmüştüm!"),
    M(43, "gameover", "sad", "Bu sefer olmadı ama parkın sırları hâlâ bizi bekliyor. Yeniden deneyelim mi?"),
    M(44, "gameover", "sad", "Bir macera sona erdi diye hikâye bitmez. Hadi, yeni bir sayfa açalım!"),
    M(45, "gameover", "sad", "O engel biraz sinsiydi! Bir dahaki sefere ona hazırlıksız yakalanmayacağız!"),
    M(46, "gameover", "sad", "Dinlenmek serbest, pes etmek yasak! Ben hazırım, ne zaman istersen başlayabiliriz!"),
    M(47, "gameover", "sad", "Her denemede biraz daha güçleniyoruz. Bir sonraki rekor çok yakında!"),
    M(48, "gameover", "sad", "Bence bu koşu sadece ısınmaydı. Asıl macera şimdi başlıyor!"),
    // G. Bekleme, mağaza ve ayarlar (idle, store, settings)
    M(49, "idle", "talk", "Biraz dinlenelim mi? Ben bu sırada kuyruğumla birkaç hareket çalışacağım!"),
    M(50, "store", "joy", "Mağazaya mı gidiyoruz? Belki kendime havalı bir şeyler bulabilirim!"),
    M(51, "store", "talk", "Şu fosillere bak! Biriktirmek güzel ama bazen kendini ödüllendirmek de gerekir!"),
    M(52, "settings", "talk", "Ayarları mı değiştireceğiz? Benim tek ayarım macera modu!"),
    M(53, "idle", "talk", "Bir süredir bekliyoruz. Acaba ormanın arkasında yeni bir yol mu açıldı?"),
    M(54, "idle", "talk", "Burada beklemek de güzel ama koşarken çok daha eğleniyoruz!"),
    M(55, "idle", "talk", "Ben olsam biraz daha macera yaşardım. Ama karar senin, kaptan!"),
    // H. Özel ve karakter sahibi mesajlar (special) — seyrek gösterilir
    M(56, "special", "talk", "Biliyor musun? Bazen kendimi bu kocaman dünyada çok küçük hissediyorum. Sonra seninle bir maceraya çıkıyorum ve her şey mümkün oluyor!"),
    M(57, "special", "talk", "Bir gün bu parkın en büyük gizemini çözeceğiz. Belki de aradığımız şey, henüz keşfetmediğimiz bir fosilin içinde saklıdır!"),
    M(58, "special", "talk", "Ben cesur olduğum için korkmuyorum sanıyorsun, değil mi? Aslında bazen ben de korkuyorum. Ama cesaret, korkmana rağmen ilerleyebilmek demek!"),
    M(59, "special", "talk", "Eğer bir gün yolunu kaybedersen gökyüzündeki yıldızlara bak. Ben de aynı yıldızların altında yeni maceralar arıyor olacağım!"),
    M(60, "special", "joy", "Hey macera arkadaşım! Unutma, bu parkta yalnız değilsin. Ben Riko'yum ve seninle daha keşfedecek çok şeyimiz var!")
  ];
  // Özel rollere sahip mesajlar
  const roles = Object.freeze({
    firstVisit: 1,      // yalnız ilk ziyarette bir kez
    longReturn: 6,      // uzun aradan sonra dönüş
    recordInRun: 39,    // koşu içinde rekor kırıldığı an
    recordGameOver: 40  // rekorla biten koşunun sonu
  });
  return Object.freeze({ messages: Object.freeze(messages), roles });
});
