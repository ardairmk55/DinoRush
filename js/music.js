(function(w){
  "use strict";
  /*
   * Arka plan müziği: menü ve oyun içi iki parça. Aynı anda tek parça çalar.
   * Geçişte çalan parça yumuşakça kısılıp durur, yenisi ardından yumuşakça açılır (üst üste binmez).
   * http(s): Web Audio (çözülmüş tampon, kesintisiz döngü, GainNode ile kısma; iOS'ta da ses düzeyi çalışır).
   * file:// veya Web Audio yoksa: <audio> öğesi (döngü öğenin kendisinde, kısma ses düzeyiyle).
   * Tarayıcı otomatik oynatma kuralı: ilk kullanıcı etkileşiminden önce hiçbir şey çalınmaz, dosya da indirilmez.
   * Oyun durumu var olan DR.UI çağrıları sarılarak izlenir; oyun mekaniği değişmez.
   */
  const DR=w.DinoRush,doc=w.document;
  if(!DR||!DR.UI||!DR.Storage||!DR.Config||!DR.Config.music)return;
  const C=DR.Config.music,Ctx=w.AudioContext||w.webkitAudioContext;
  const GESTURES=["pointerdown","touchend","click","keydown"];
  const SILENCE=.003; // ~-50 dB: içerik bilgisi olmayan parça için yedek döngü eşiği

  let mode=null;          // "webaudio" | "element" (ilk etkileşimde belirlenir)
  let ctx=null,master=null;
  let unlocked=false,hooked=false;
  let want="menu";        // oyun durumunun istediği parça
  let paused=false;       // koşu duraklatıldı
  let active=null;        // çalan (kısılmayan) ses
  let busyUntil=0;        // kısılan sesin bitiş anı (webaudio: ctx saniyesi, element: performance.now ms)
  let token=0;            // eski yükleme sonuçlarını yok saymak için
  const positions={menu:null,gameplay:null};
  const buffers={},loading={},elements={};
  const log=[];           // test/teşhis: son 20 çalma aralığı {name,from,to}
  const fades=new Set();let fadeTimer=null; // yalnız element kipinde, yalnız kısma sürerken çalışır

  // Ana düzey (master GainNode): TÜM SESLER ve MÜZİK açıksa GENEL SES; parça düzeyi ayrıca uygulanır.
  function level(){
    const s=DR.Storage.get();
    if(!s.sound||!s.music)return 0;
    return Math.max(0,Math.min(1,(s.masterVolume/100)*(C.gain||1)));
  }
  // Parça düzeyi: MENÜ MÜZİĞİ (menü/mağaza/ayarlar) ve OYUN MÜZİĞİ ayrı kaydırıcılardır.
  function trackVol(name){const s=DR.Storage.get(),v=name==="gameplay"?s.gameMusicVolume:s.menuMusicVolume;return Math.max(0,Math.min(1,(Number(v)||0)/100));}
  function record(name,from){const e={name,from,to:null};log.push(e);if(log.length>20)log.shift();return e;}

  /* ---------- yükleme ---------- */
  function decode(data){
    return new Promise((ok,fail)=>{try{const p=ctx.decodeAudioData(data,ok,fail);if(p&&p.then)p.then(ok,fail);}catch(e){fail(e);}});
  }
  // Döngü sınırları: bilinen içerik uzunluğu ve kodlayıcı gecikmesiyle örnek düzeyinde kesin.
  // Çözücü gecikmeyi kendisi atmışsa (tampon kısa) içerik 0'dan başlar. Bilgi yoksa sessizlik eşiğine düşülür.
  function bounds(t,buf){
    if(t.samples&&t.rate){
      const len=t.samples/t.rate,d=(t.delay||0)/t.rate,start=buf.duration>=len+d-.001?d:0;
      if(start+len<=buf.duration+.001)return {start,end:start+len};
    }
    const chs=[];for(let c=0;c<buf.numberOfChannels;c++)chs.push(buf.getChannelData(c));
    const n=buf.length,loud=i=>{for(const d of chs)if(Math.abs(d[i])>SILENCE)return true;return false;};
    let a=0,b=n-1;while(a<n&&!loud(a))a++;while(b>a&&!loud(b))b--;
    if(b-a<buf.sampleRate)return {start:0,end:buf.duration}; // beklenmedik içerik: tamamını döngüle
    return {start:a/buf.sampleRate,end:(b+1)/buf.sampleRate};
  }
  function load(name){
    if(mode==="element"){
      if(!elements[name]){const el=new Audio();el.preload="auto";el.loop=true;el.src=C.tracks[name].src;elements[name]=el;}
      return Promise.resolve(true);
    }
    if(buffers[name])return Promise.resolve(true);
    if(!loading[name]){
      // Çevrimdışıyken ağa gitme: yalnız önbellekte (service worker) varsa çal; yoksa bağlantı dönünce yeniden denenir.
      const src=C.tracks[name].src;
      const get=w.navigator.onLine===false&&w.caches?w.caches.match(src).then(r=>{if(!r)throw new Error("offline");return r;}):fetch(src);
      loading[name]=get.then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})
        .then(decode).then(buf=>{buffers[name]=Object.assign({buf},bounds(C.tracks[name],buf));return true;})
        .catch(()=>{delete loading[name];return false;}); // ağ/çözme hatası: müziksiz devam
    }
    return loading[name];
  }

  /* ---------- Web Audio sesi ---------- */
  function startA(name,offset){
    const b=buffers[name],when=Math.max(ctx.currentTime+.02,busyUntil);
    const src=ctx.createBufferSource(),g=ctx.createGain();
    src.buffer=b.buf;src.loop=true;src.loopStart=b.start;src.loopEnd=b.end;
    const o=offset==null||offset<b.start||offset>=b.end?b.start:offset;
    g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(trackVol(name),when+C.fadeIn);
    src.connect(g);g.connect(master);src.start(when,o);
    src.onended=()=>{try{src.disconnect();g.disconnect();}catch(_){}};
    return {name,src,g,t0:when,o,b,entry:record(name,when)};
  }
  function posA(v){const L=v.b.end-v.b.start,el=Math.max(0,ctx.currentTime-v.t0);return v.b.start+((v.o-v.b.start+el)%L+L)%L;}
  function stopA(v,fade){
    const t=Math.max(ctx.currentTime,v.t0),g=v.g.gain;
    const now=ctx.currentTime<v.t0?0:Math.max(0,g.value);
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(now,t);g.linearRampToValueAtTime(0,t+fade);
    try{v.src.stop(t+fade+.02);}catch(_){}
    v.entry.to=t+fade;return t+fade;
  }

  /* ---------- <audio> sesi (yedek) ---------- */
  function tickFades(){
    const now=performance.now(),lv=level();
    for(const f of fades){
      if(now<f.at)continue;
      const k=Math.min(1,(now-f.at)/f.ms);
      if(f.to>0&&f.v.el.paused)f.v.el.play().catch(()=>{});
      f.v.mix=f.from+(f.to-f.from)*k;f.v.el.volume=Math.max(0,Math.min(1,f.v.mix*lv*trackVol(f.v.name)));
      if(k>=1){fades.delete(f);if(f.done)f.done();}
    }
    if(!fades.size){clearInterval(fadeTimer);fadeTimer=null;}
  }
  function fadeE(v,from,to,at,ms,done){
    for(const f of fades)if(f.v===v||f.v.el===v.el)fades.delete(f);
    fades.add({v,from,to,at,ms,done});
    if(!fadeTimer)fadeTimer=setInterval(tickFades,40);
  }
  function startE(name,offset){
    const el=elements[name],at=Math.max(performance.now(),busyUntil);
    try{el.currentTime=offset||0;}catch(_){}
    el.volume=0;
    const v={name,el,mix:0,entry:record(name,at/1000)};
    fadeE(v,0,1,at,C.fadeIn*1000);
    return v;
  }
  function stopE(v,fade){
    v.stopping=true;const at=performance.now();
    fadeE(v,v.mix,0,at,fade*1000,()=>v.el.pause());
    v.entry.to=(at+fade*1000)/1000;return at+fade*1000;
  }

  /* ---------- karar ---------- */
  const start=(n,o)=>mode==="webaudio"?startA(n,o):startE(n,o);
  const stop=(v,f)=>mode==="webaudio"?stopA(v,f):stopE(v,f);
  const pos=v=>mode==="webaudio"?posA(v):(v.el.currentTime||0);
  function setMaster(lv){
    if(mode==="webaudio"&&master){
      master.gain.setTargetAtTime(lv,ctx.currentTime,.05);
      // Çalan parçanın düzeyi değiştiyse yumuşakça uygula (açılış kısması sürüyorsa onun sonuna hedefle).
      if(active&&active.g){const now=ctx.currentTime,end=active.t0+C.fadeIn,g=active.g.gain,vol=trackVol(active.name);
        if(now>=end){g.cancelScheduledValues(now);g.setTargetAtTime(vol,now,.05);}
        else if(now>=active.t0){const cur=g.value;g.cancelScheduledValues(now);g.setValueAtTime(cur,now);g.linearRampToValueAtTime(vol,end);}
        else{g.cancelScheduledValues(now);g.setValueAtTime(0,active.t0);g.linearRampToValueAtTime(vol,end);}} // açılış henüz başlamadı
    }
    else if(mode==="element"&&active&&!fades.size)active.el.volume=Math.max(0,Math.min(1,active.mix*lv*trackVol(active.name)));
  }
  function update(){
    if(!unlocked)return;
    const lv=level();setMaster(lv);
    const target=lv>0&&trackVol(want)>0&&!(want==="gameplay"&&paused)?want:null;
    if(active&&active.name===target)return;
    if(active){
      positions[active.name]=pos(active);
      busyUntil=stop(active,paused&&active.name==="gameplay"?C.pauseFade:C.fadeOut);
      active=null;
    }
    if(!target)return;
    const gen=++token;
    load(target).then(ok=>{
      if(!ok||gen!==token||active||!unlocked)return;
      if(mode==="webaudio"&&ctx.state!=="running"&&!doc.hidden)ctx.resume().catch(()=>{});
      active=start(target,positions[target]);
      // Menü çalınca oyun parçasını önceden hazırla: OYNA'da beklemeden geçiş olsun.
      if(target==="menu")load("gameplay");
    });
  }
  function setWant(name,restart){
    if(want!==name||restart){
      positions[name]=null;
      if(restart&&active&&active.name===name){busyUntil=stop(active,C.fadeOut);active=null;}
    }
    want=name;paused=false;update();
  }

  /* ---------- ilk etkileşim, arka plan ---------- */
  function hook(on){
    if(on===hooked)return;hooked=on;
    GESTURES.forEach(t=>on?doc.addEventListener(t,unlock,true):doc.removeEventListener(t,unlock,true));
  }
  function unlock(){
    if(!mode){
      mode=Ctx&&w.location.protocol!=="file:"?"webaudio":"element";
      if(mode==="webaudio"){
        try{
          ctx=new Ctx();master=ctx.createGain();master.gain.value=level();master.connect(ctx.destination);
          // iOS bir aramadan/arka plandan sonra bağlamı kesebilir: yeniden etkileşim bekle.
          ctx.onstatechange=()=>hook(ctx.state!=="running"&&!doc.hidden);
        }catch(_){ctx=null;mode="element";}
      }
    }
    unlocked=true;
    if(ctx&&ctx.state!=="running"&&!doc.hidden)ctx.resume().catch(()=>{});
    update();
    if(mode==="element"||(ctx&&ctx.state==="running"))hook(false);
  }
  doc.addEventListener("visibilitychange",()=>{
    if(!unlocked)return;
    if(doc.hidden){
      if(ctx)ctx.suspend().catch(()=>{});
      else if(active)active.el.pause();
    }else{
      if(ctx)ctx.resume().catch(()=>hook(true));
      else if(active&&!active.stopping)active.el.play().catch(()=>hook(true));
      update();
    }
  });
  w.addEventListener("online",()=>update());
  hook(true);

  /* ---------- oyun durumu ---------- */
  function wrap(obj,name,after){const orig=obj[name];if(typeof orig!=="function")return;obj[name]=function(){const r=orig.apply(this,arguments);try{after.apply(null,arguments);}catch(_){}return r;};}
  wrap(DR.UI,"enterCountdown",()=>setWant("gameplay",true));
  wrap(DR.UI,"showPause",on=>{paused=!!on;update();});
  wrap(DR.UI,"showGameOver",()=>setWant("menu"));
  wrap(DR.UI,"showMenu",()=>setWant("menu"));
  // Ayar değişince (müzik aç/kapa, ses düzeyleri, sessiz) anında uygula.
  wrap(DR.Storage,"update",()=>update());

  DR.Music={
    update,
    // Teşhis ve testler için salt okunur durum
    state(){return {mode,want,paused,unlocked,hooked,active:active&&active.name,ctx:ctx&&ctx.state,level:level(),trackVolume:{menu:trackVol("menu"),gameplay:trackVol("gameplay")},voiceGain:active&&active.g?active.g.gain.value:null,loaded:Object.keys(mode==="element"?elements:buffers),position:active?pos(active):null,time:mode==="webaudio"&&ctx?ctx.currentTime:performance.now()/1000,log:log.map(e=>Object.assign({},e))};},
    loopPoints(name){const b=buffers[name];return b?{start:b.start,end:b.end,duration:b.buf.duration}:null;}
  };
})(window);
