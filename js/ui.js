(function(w){
  "use strict";
  const DR=w.DinoRush,$=id=>document.getElementById(id),app=$("gameApp"),menu=$("menuLayer"),hud=$("hudLayer"),pausePanel=$("pausePanel"),overPanel=$("gameOverPanel"),countdown=$("countdown"),touch=$("touchZones");
  let lastFocused=null,flashTimer=0,retryReadyAt=0,retryTimer=0,hintTimer=0;
  const touchLayout=()=>matchMedia("(pointer: coarse)").matches||matchMedia("(max-width: 760px)").matches;
  function hint(on){const el=$("touchHint");clearTimeout(hintTimer);el.classList.toggle("visible",!!on&&touchLayout());}
  function fmt(value){return Math.max(0,Math.floor(value||0)).toLocaleString("tr-TR").replace(/\./g," ").padStart(6,"0");}
  function announce(text){$("announcement").textContent="";requestAnimationFrame(()=>$("announcement").textContent=text);}
  function setMode(mode){app.dataset.mode=mode;document.body.dataset.mode=mode;}
  function updateMenu(){const s=DR.Storage.get(),fossils=Math.max(0,s.fossils).toLocaleString("tr-TR");$("menuRecord").textContent=fmt(s.best);$("menuFossils").textContent=fossils;$("collectionWallet").textContent=fossils;$("ownedCount").textContent=String(s.owned.length).padStart(2,"0")+"/"+String(DR.Config.cosmetics.skins.length).padStart(2,"0");$("hudRecord").textContent=fmt(s.best);achievementBadge();}
  function enterCountdown(){menu.classList.add("leaving");hud.classList.add("visible");pausePanel.hidden=true;overPanel.hidden=true;countdown.classList.add("visible");countdown.setAttribute("aria-hidden","false");count(3);setMode("countdown");touch.classList.remove("visible");hint(true);}
  function count(n){const span=$("countdownValue");span.textContent=String(n);span.style.animation="none";void span.offsetWidth;span.style.animation="";countdown.classList.add("visible");}
  function beginPlay(){clearTimeout(hintTimer);hintTimer=setTimeout(()=>$("touchHint").classList.remove("visible"),2200);countdown.classList.remove("visible");countdown.setAttribute("aria-hidden","true");setMode("playing");if(matchMedia("(pointer: coarse)").matches||matchMedia("(max-width: 760px)").matches)touch.classList.add("visible");}
  function showMenu(){hint(false);menu.classList.remove("leaving");hud.classList.remove("visible");countdown.classList.remove("visible");touch.classList.remove("visible");pausePanel.hidden=true;overPanel.hidden=true;closeModal();setMode("menu");updateMenu();}
  function showPause(on){pausePanel.hidden=!on;if(on){setMode("paused");touch.classList.remove("visible");$("resumeButton").focus();}else{setMode("playing");if(matchMedia("(pointer: coarse)").matches||matchMedia("(max-width: 760px)").matches)touch.classList.add("visible");}}
  function updateScore(score,fossils,best){const el=$("scoreValue");if(el.textContent!==fmt(score)){el.textContent=fmt(score);hud.classList.remove("tick");void hud.offsetWidth;hud.classList.add("tick");}$("runFossils").textContent=String(fossils).padStart(2,"0");$("hudRecord").textContent=fmt(best);}
  function updateRecord(best,celebrate){$("hudRecord").textContent=fmt(best);$("menuRecord").textContent=fmt(best);if(celebrate){const plaque=document.querySelector(".record-hud");plaque.classList.remove("beat");void plaque.offsetWidth;plaque.classList.add("beat");const flash=$("recordFlash");flash.classList.add("visible");clearTimeout(flashTimer);flashTimer=setTimeout(()=>flash.classList.remove("visible"),1700);announce("Yeni kişisel rekor: "+fmt(best));}}
  function updateFossils(run,total){const fossils=Math.max(0,total).toLocaleString("tr-TR");$("runFossils").textContent=String(run).padStart(2,"0");$("menuFossils").textContent=fossils;$("collectionWallet").textContent=fossils;const icon=document.querySelector(".fossil-hud");icon.classList.remove("beat");void icon.offsetWidth;icon.classList.add("beat");}
  function showGameOver(result){hint(false);hud.classList.remove("visible");touch.classList.remove("visible");countdown.classList.remove("visible");$("finalScore").textContent=fmt(0);$("finalRecord").textContent=fmt(result.best);$("finalFossils").textContent="00";$("gameOverTitle").textContent="YAKALANDIN";$("newRecordBadge").hidden=!result.record;$("gameOverMessage").textContent=result.record?"Kaçış rekorunu yeniledin.":"Bir sonraki koşuda daha uzağa kaç.";$("recordGap").textContent=result.record?"":("Rekora "+fmt(Math.max(0,result.best-result.score))+" puan kaldı");overPanel.hidden=false;setMode("game_over");retryReadyAt=performance.now()+700;const retry=$("retryButton");retry.disabled=true;clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retry.disabled=false;retry.focus();},700);animateNumber($("finalScore"),result.score,900,fmt);animateNumber($("finalFossils"),result.fossils,700,n=>String(n).padStart(2,"0"));$("finalRecord").textContent=fmt(result.best);renderBreakdown(result);celebrate(result);announce("Koşu bitti. Skor "+fmt(result.score)+". Rekor "+fmt(result.best)+"."+(result.breakdown?" Kazanılan fosil "+result.breakdown.total+".":""));}
  /* ---------- Oyun sonu: kazanılan fosillerin dökümü, başarım ve seri bildirimleri ---------- */
  function renderBreakdown(result){
    const dl=$("runBreakdown");dl.textContent="";const b=result&&result.breakdown;if(!b){dl.hidden=true;return;}dl.hidden=false;
    const day=result.daily&&result.daily.first?result.daily.daily.streak:0;
    const rows=[["Toplanan fosil",b.collected],["Kıl payı",b.nearMiss],["Zincir",b.chain],["Skor bonusu",b.score],["Rekor bonusu",b.record],[day?"Günlük seri ("+day+". gün)":"Günlük seri",b.daily],["Başarımlar",b.achievements]];
    rows.forEach(([label,value],i)=>{if(i>0&&!value)return;const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=(i>0?"+":"")+value.toLocaleString("tr-TR");row.append(dt,dd);dl.append(row);});
    const total=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");total.className="total";dt.textContent="TOPLAM";dd.textContent="+"+b.total.toLocaleString("tr-TR");total.append(dt,dd);dl.append(total);
  }
  function celebrate(result){
    if(!result)return;let delay=500;
    if(result.daily&&result.daily.first&&result.daily.bonus){const d=result.daily.daily.streak;setTimeout(()=>{toast({kind:"streak",title:d>1?d+" gün üst üste!":"Günlük seri başladı",text:"Bugünün ilk koşusu: +"+result.daily.bonus+" fosil. Yarın da gel, ödül büyüsün."});DR.Audio.streak();},delay);delay+=700;}
    (result.unlocked||[]).forEach(a=>{const t=DR.ProgressCore.TEXT[a.id]||[a.id,""];setTimeout(()=>{toast({kind:"achievement",title:"BAŞARIM: "+t[0],text:t[1]+"  +"+a.reward+" fosil"});DR.Audio.achievement();},delay);delay+=900;});
    if((result.unlocked||[]).length)updateMenu();
  }
  /* ---------- Bildirimler (başarım, seri, öğretici): üstte kısa süre görünür, ekran okuyucuya duyurulur ---------- */
  function toast(o){
    const stack=$("toastStack");if(!stack)return;
    while(stack.children.length>=3)stack.firstElementChild.remove();
    const el=document.createElement("div"),b=document.createElement("b"),s=document.createElement("span");
    el.className="toast toast--"+(o.kind||"info");b.textContent=o.title||"";s.textContent=o.text||"";el.append(b,s);stack.append(el);
    setTimeout(()=>{el.classList.add("leaving");setTimeout(()=>el.remove(),320);},o.ms||3800);
  }
  /* ---------- İlk koşu öğreticisi: büyük ipucu kutusu (oyun fiziği değişmez) ---------- */
  const HINTS={
    jump:{key:["SPACE","↑"],touchKey:["DOKUN"],title:"ZIPLA!",text:"Kütüğün üstünden atla. Basılı tutarsan daha yükseğe çıkarsın.",touchText:"Ekrana dokun. Basılı tutarsan daha yükseğe çıkarsın."},
    collect:{key:["◆"],touchKey:["◆"],title:"FOSİLLERİ TOPLA",text:"Kümenin hepsini toplarsan ZİNCİR kurarsın ve bonus fosil kazanırsın.",touchText:"Kümenin hepsini toplarsan ZİNCİR kurarsın ve bonus fosil kazanırsın."},
    duck:{key:["↓","S"],touchKey:["KAYDIR ↓"],title:"EĞİL!",text:"Yüksekten gelen pterosaurun altından eğilerek geç.",touchText:"Parmağını aşağı kaydır ya da EĞİL'e bas."}
  };
  let hintKind=null;
  function tutorialHint(kind){
    const box=$("tutorialHint");if(!box||kind===hintKind)return;hintKind=kind;
    if(!kind){box.hidden=true;return;}
    const h=HINTS[kind],touchy=touchLayout(),keys=touchy?h.touchKey:h.key;
    const keyBox=$("tutorialKey");keyBox.textContent="";keys.forEach(k=>{const kbd=document.createElement("kbd");kbd.textContent=k;keyBox.append(kbd);});
    $("tutorialTitle").textContent=h.title;$("tutorialText").textContent=touchy?h.touchText:h.text;box.dataset.kind=kind;box.hidden=false;
  }
  let seenAchievements=null;
  function achievementBadge(){const n=Object.keys(DR.Storage.get().achievements||{}).length;if(seenAchievements===null)seenAchievements=n;const badge=$("profileBadge");if(badge){const fresh=n-seenAchievements;badge.hidden=fresh<=0;badge.textContent=String(fresh);}}
  function animateNumber(el,target,duration,format){const start=performance.now();function frame(now){const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,3);el.textContent=format(Math.floor(target*ease));if(p<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);}
  function hasModal(){return !!document.querySelector(".modal-shell:not([hidden])");}
  function openModal(id){const open=document.querySelector(".modal-shell:not([hidden])");if(open&&open.id!==id){open.hidden=true;DR.Panels.close();}else lastFocused=document.activeElement;$(id).hidden=false;updateMenu();DR.Panels.open(id);const first=$(id).querySelector('[role="tab"][aria-selected="true"]')||$(id).querySelector("button:not(:disabled)");if(first)first.focus();}
  function closeModal(){const open=document.querySelector(".modal-shell:not([hidden])");if(open)open.hidden=true;DR.Panels.close();if(lastFocused&&lastFocused.focus)lastFocused.focus();lastFocused=null;}
  function toggleFullscreen(){const target=app;try{const p=document.fullscreenElement?document.exitFullscreen():target.requestFullscreen?target.requestFullscreen():Promise.reject(new Error("yok"));return Promise.resolve(p).catch(()=>announce("Bu tarayıcı tam ekranı desteklemiyor."));}catch(_){announce("Bu tarayıcı tam ekranı desteklemiyor.");return Promise.resolve();}}
  function syncSoundButton(){const button=$("soundButton"),sound=DR.Storage.get().sound;button.setAttribute("aria-label",sound?"Sesi kapat":"Sesi aç");button.innerHTML='<svg><use href="#'+(sound?"i-sound":"i-mute")+'"/></svg>';}
  // Önyükleme bütünlüğü: bir betik eksik/boş yüklendiyse sessizce bozuk açılmak yerine açıklama göster.
  const REQUIRED=["Config","ProgressCore","SaveCore","Storage","Audio","Assets","Rules","Entities","Scene","Input","Game","Panels","UISkin"];
  function bootError(missing){
    const loader=$("preloader"),text=$("loaderText");if(!loader||!text)return;
    text.textContent="OYUN DOSYALARI EKSİK YÜKLENDİ";
    const info=document.createElement("p");info.className="boot-error";info.textContent="Bağlantı kesilmiş olabilir. Sayfayı yeniden yükleyin.";
    const btn=document.createElement("button");btn.type="button";btn.className="boot-retry";btn.textContent="YENİDEN YÜKLE";btn.addEventListener("click",()=>w.location.reload());
    loader.append(info,btn);loader.setAttribute("aria-live","assertive");btn.focus();
    if(w.console)w.console.error("DinoRush: eksik modüller: "+missing.join(", "));
  }
  function init(){
    const missing=REQUIRED.filter(k=>!DR[k]);if(missing.length){bootError(missing);return;}
    const logo=document.querySelector(".logo-art");if(logo){const textLogo=()=>{logo.hidden=true;document.querySelector(".logo-lockup h1")?.classList.remove("sr-only");};logo.addEventListener("error",textLogo,{once:true});if(logo.complete&&!logo.naturalWidth)textLogo();}
    $("playButton").addEventListener("click",()=>{DR.Audio.init();DR.Audio.click();DR.Game.start();});
    $("pauseButton").addEventListener("click",()=>DR.Game.pause());$("pauseSettings").addEventListener("click",()=>openModal("settingsModal"));$("resumeButton").addEventListener("click",()=>DR.Game.resume());$("restartButton").addEventListener("click",()=>DR.Game.start());$("retryButton").addEventListener("click",()=>{if(performance.now()>=retryReadyAt)DR.Game.start();});$("gameOverShop").addEventListener("click",()=>openModal("collectionModal"));
    document.querySelectorAll("[data-return-menu]").forEach(button=>button.addEventListener("click",()=>DR.Game.stopToMenu()));
    $("profileButton").addEventListener("click",()=>{seenAchievements=Object.keys(DR.Storage.get().achievements||{}).length;achievementBadge();openModal("profileModal");});
    $("shareButton").addEventListener("click",()=>{if(DR.Share)DR.Share.share(DR.Game.model.gameOverResult);});
    $("tutorialSkip").addEventListener("click",()=>{DR.Game.skipTutorial();toast({kind:"tutorial",title:"Öğretici atlandı",text:"İstersen Ayarlar > Kontroller'den yeniden oynayabilirsin."});});
    $("collectionButton").addEventListener("click",()=>openModal("collectionModal"));$("settingsButton").addEventListener("click",()=>openModal("settingsModal"));
    document.querySelectorAll("[data-close-modal]").forEach(button=>button.addEventListener("click",closeModal));
    document.querySelectorAll(".modal-shell").forEach(panel=>panel.addEventListener("pointerdown",e=>{if(e.target===panel)closeModal();}));
    $("soundButton").addEventListener("click",()=>{DR.Audio.init();const next=DR.Audio.toggle();DR.Panels.syncSettings();if(next)DR.Audio.click();});
    $("fullscreenButton").addEventListener("click",()=>toggleFullscreen());
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&hasModal()){e.stopImmediatePropagation();if(!DR.Panels.handleEscape())closeModal();return;}if(hasModal())return;if(DR.Game.mode==="game_over"&&(e.code==="Space"||e.key==="Enter")){e.preventDefault();if(performance.now()>=retryReadyAt)DR.Game.start();}else if(DR.Game.mode==="game_over"&&e.key==="Escape"){DR.Game.stopToMenu();}});
    // Tam ekran API'si yoksa (ör. iPhone Safari) tam ekran düğmeleri gösterilmez.
    if(!(document.fullscreenEnabled&&app.requestFullscreen)){$("fullscreenButton").hidden=true;const fs=$("fullscreenSetting");if(fs)fs.closest(".setting-row").hidden=true;}
    setMode("menu");DR.Panels.init();syncSoundButton();updateMenu();
    const loader=$("preloader"),bar=$("loaderBar"),text=$("loaderText"),start=performance.now();
    function loading(now){const n=Math.min(1,(now-start)/520);bar.style.width=Math.round(n*100)+"%";text.textContent=n<.45?"PARK SİSTEMİ UYANDIRILIYOR":n<.82?"ÇİT HATLARI EŞLEŞTİRİLİYOR":"KAÇIŞ ROTASI AÇILIYOR";if(n<1)requestAnimationFrame(loading);else{DR.Game.initialize().finally(()=>{loader.classList.add("done");setTimeout(()=>loader.remove(),380);});}}
    requestAnimationFrame(loading);
  }
  DR.UI={refreshMenu:updateMenu,syncSoundButton,toggleFullscreen,announce,toast,tutorialHint,openModal,init,enterCountdown,count,beginPlay,showMenu,showPause,updateScore,updateRecord,updateFossils,showGameOver,hasModal,closeModal};
  document.addEventListener("DOMContentLoaded",init,{once:true});
})(window);


