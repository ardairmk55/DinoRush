(function(w){
  "use strict";
  // Web uygulaması manifesti ve çevrimdışı önbellek (service worker) yalnız http(s) altında etkinleşir.
  // file:// ile çift tıklayarak açıldığında hiçbir şey yapılmaz (tarayıcı bunları file:// altında desteklemez).
  if(!/^https?:$/.test(w.location.protocol))return;
  const link=document.createElement("link");link.rel="manifest";link.href="site.webmanifest";document.head.appendChild(link);
  // Çevrimdışı önbellek (sw.js) yalnız tools/build_dist.py ile üretilen pakette vardır; derleme bu işareti ekler.
  // Kaynak klasör bir geliştirme sunucusuyla (ör. Live Server) açıldığında kayıt denenmez, 404 oluşmaz.
  const built=document.querySelector('meta[name="dinorush-build"]');
  if(built&&"serviceWorker" in navigator&&w.location.hostname!==""){
    const register=()=>{navigator.serviceWorker.register("sw.js").catch(()=>{});};
    // load olayı zaten geçmişse hemen kaydet, değilse sayfa yüklenince (oyunun ilk yüklemesini yavaşlatmamak için).
    if(document.readyState==="complete")register();else w.addEventListener("load",register,{once:true});
  }
})(window);
