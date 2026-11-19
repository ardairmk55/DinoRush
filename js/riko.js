(function(w){
  "use strict";
  // Riko: maskotun konuşma balonu, tıklama alanı, oyun olaylarına bağlanması ve menü pozları.
  // Seçim mantığı js/riko-core.js'tedir. Oyun mantığına dokunmaz: DR.UI fonksiyonlarını sarmalayarak olayları dinler.
  const DR=w.DinoRush;
  if(!DR||!DR.RikoCore||!DR.UI||!DR.Scene)return; // eksikse oyun Riko'suz sorunsuz çalışır
  const Core=DR.RikoCore,KEY="dinorush-riko-v1",doc=w.document;
  const IDLE_FIRST=50000,IDLE_JITTER=10000,IDLE_AGAIN=60000,CLICK_COOLDOWN=900;
  let startBest=0,history=load(),active=null,hideTimer=0,idleTimer=0,lastClick=0,lastFossilSpeak=0,recordSpoken=false,startSpoken=false,anim=null,bubble=null,text=null,hit=null,lastActivity=0;
  const reduced=()=>{try{return w.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}};

  /* ---------- kayıt ---------- */
  function load(){try{return Core.normalize(JSON.parse(w.localStorage.getItem(KEY)||"null"));}catch(_){return Core.defaults();}}
  function save(){try{w.localStorage.setItem(KEY,JSON.stringify(history));}catch(_){}}

  /* ---------- DOM ---------- */
  function build(){
    const app=doc.getElementById("gameApp");if(!app)return false;
    bubble=doc.createElement("div");bubble.className="riko-bubble";bubble.setAttribute("role","status");bubble.setAttribute("aria-live","polite");bubble.hidden=true;
    const name=doc.createElement("b");name.className="riko-name";name.textContent="Riko";
    text=doc.createElement("p");bubble.append(name,text);
    hit=doc.createElement("button");hit.type="button";hit.className="riko-hit";hit.setAttribute("aria-label","Riko ile konuş");
    hit.addEventListener("click",onRikoClick);
    app.append(hit,bubble);
    return true;
  }

  /* ---------- konumlandırma (dünya birimi -> ekran pikseli) ---------- */
  function anchor(){
    const S=DR.Scene.metrics,k=S.scale,mode=DR.Game?DR.Game.mode:"menu",shift=S.width-(S.viewWidth||S.width);
    if(mode==="menu"){const x=S.viewWidth?S.viewWidth*.075:S.width*.075;return {x:(x+80)*k,y:(S.ground-92)*k,play:false};}
    // Oyunda: dinonun sağ üstü, zıplama tepesinin de üstünde; sol üstteki skor plakalarının altında kalmaz
    const px=(DR.Config.physics.playerX-shift),portrait=S.height>S.width;
    return {x:(px+(portrait?40:96))*k,y:(S.ground-(portrait?205:150))*k,play:true};
  }
  // Balonun kapatmaması gereken görünür kontroller (balon tıklamayı zaten engellemez; bu görsel çakışma içindir)
  const AVOID="#playButton,#collectionButton,#settingsButton,#fossilPlaque,#recordPlaque,#fullscreenButton,#pauseButton,#jumpButton,#crouchButton,.hud-left,.hud-right,.overlay-panel:not([hidden]) .panel-inner,.modal-shell:not([hidden]) .modal-plaque";
  function obstacles(){
    const out=[];
    doc.querySelectorAll(AVOID).forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&r.height&&el.offsetParent!==null)out.push(r);});
    return out;
  }
  function overlapArea(b,list){
    let s=0;for(const r of list){const x=Math.min(b.r,r.right)-Math.max(b.l,r.left),y=Math.min(b.b,r.bottom)-Math.max(b.t,r.top);if(x>0&&y>0)s+=x*y;}return s;
  }
  // Sırayla dene: üstte geniş, üstte dar, altta geniş, altta dar. Çakışmayan ilkini, yoksa en az çakışanı seç.
  function place(){
    if(!bubble||bubble.hidden)return;
    const a=anchor(),vw=w.innerWidth,vh=w.innerHeight,m=8,list=obstacles(),S=DR.Scene.metrics;
    const groundY=S.ground*S.scale,belowY=(a.play?groundY:groundY)+10;
    const candidates=[["above",320],["above",220],["below",320],["below",220]];
    let best=null;
    for(const [side,maxW] of candidates){
      bubble.style.maxWidth=Math.min(maxW,vw-2*m)+"px";
      const bw=bubble.offsetWidth,bh=bubble.offsetHeight;
      let left=Math.max(m,Math.min(vw-bw-m,Math.round(a.x-26)));
      let top=side==="above"?Math.round(a.y-bh):Math.round(belowY);
      const fits=top>=m&&top+bh<=vh-m;
      top=Math.max(m,Math.min(vh-bh-m,top));
      const area=overlapArea({l:left,t:top,r:left+bw,b:top+bh},list)+(fits?0:1e6);
      if(!best||area<best.area)best={side,maxW,left,top,bw,area};
      if(area===0)break;
    }
    // Küçük ekran (ör. 320x568): dinonun üstü/altı düğmelerle dolu. Ekranda dinoya en yakın boş yeri ara; kuyruk gizlenir.
    if(best.area>0){
      if(!a.play&&hit){const r=hit.getBoundingClientRect();if(r.width)list.push(r);} // Riko'nun kendisini de kapatma
      for(const maxW of [320,220]){
        bubble.style.maxWidth=Math.min(maxW,vw-2*m)+"px";
        const bw=bubble.offsetWidth,bh=bubble.offsetHeight,left=Math.max(m,Math.min(vw-bw-m,Math.round(a.x-26)));
        let found=null;
        for(let top=m;top+bh<=vh-m;top+=4){
          if(overlapArea({l:left,t:top,r:left+bw,b:top+bh},list)===0&&(!found||Math.abs(top+bh-a.y)<Math.abs(found+bh-a.y)))found=top;
        }
        if(found!==null){best={side:"float",maxW,left,top:found,bw,area:0};break;}
      }
    }
    bubble.style.maxWidth=Math.min(best.maxW,vw-2*m)+"px";
    bubble.style.left=best.left+"px";bubble.style.top=best.top+"px";
    bubble.dataset.side=best.side;
    bubble.style.setProperty("--tail-x",Math.max(14,Math.min(best.bw-22,Math.round(a.x-best.left)))+"px");
    placeHit();
  }
  function placeHit(){if(!hit)return;const S=DR.Scene.metrics,k=S.scale,x=(S.viewWidth||S.width)*.075;
    hit.style.left=Math.round(x*k)+"px";hit.style.top=Math.round((S.ground-92)*k)+"px";
    hit.style.width=Math.max(56,Math.round(110*k))+"px";hit.style.height=Math.max(56,Math.round(92*k))+"px";}

  /* ---------- konuşma ---------- */
  function say(trigger,opts){
    opts=opts||{};
    const now=Date.now();
    if(!bubble||!Core.canInterrupt(active,trigger,now))return null;
    if(doc.hidden)return null;
    const msg=Core.choose(trigger,history,{best:DR.Storage.get().best,now,record:!!opts.record});
    if(!msg)return null;
    const mode=DR.Game?DR.Game.mode:"menu",inPlay=mode==="playing"||mode==="countdown";
    const ms=Core.durationFor(msg.text,inPlay);
    text.textContent=msg.text; // güvenli: yalnız metin
    bubble.dataset.mood=msg.mood;bubble.dataset.trigger=trigger;bubble.dataset.id=String(msg.id);
    bubble.classList.toggle("in-play",inPlay);
    bubble.hidden=false;bubble.classList.remove("leaving");void bubble.offsetWidth;bubble.classList.add("show");
    place();
    active={priority:Core.PRIORITY[trigger]||0,until:now+ms,id:msg.id};
    history=Core.remember(history,msg,now);save();
    if(mode==="menu")startAnim(msg.mood);
    clearTimeout(hideTimer);hideTimer=setTimeout(hide,ms);
    return msg;
  }
  function hide(immediate){
    clearTimeout(hideTimer);hideTimer=0;active=null;
    if(!bubble||bubble.hidden)return;
    if(immediate||reduced()){bubble.hidden=true;bubble.classList.remove("show","leaving");return;}
    bubble.classList.add("leaving");bubble.classList.remove("show");
    hideTimer=setTimeout(()=>{bubble.hidden=true;bubble.classList.remove("leaving");hideTimer=0;},260);
  }

  /* ---------- menü pozları (scene.js her karede DR.Riko.pose(t) çağırır) ---------- */
  const ANIM={talk:1.1,joy:1.0,funny:1.0,hop:.6,celebrate:1.25,sad:.8,tap:.35};
  function startAnim(type){anim=reduced()?null:{type:ANIM[type]?type:"talk",start:performance.now()};}
  function pose(t){
    if(reduced())return null;
    const out={dx:0,dy:Math.sin(t*2.2)*.8,anim:null}; // nefes alma
    if(!anim)return out;
    const a=(performance.now()-anim.start)/1000,d=ANIM[anim.type];
    if(a>=d){anim=null;return out;}
    const p=a/d,arc=h=>-h*4*p*(1-p);
    switch(anim.type){
      case "talk":out.dy+=-Math.abs(Math.sin(a*9))*2.5*(1-p);break;
      case "joy":out.dy+=-Math.abs(Math.sin(a*8))*4*(1-p);out.dx=Math.sin(a*12)*1.5*(1-p);break;
      case "funny":out.dx=Math.sin(a*14)*3*(1-p);out.dy+=-Math.abs(Math.sin(a*7))*3*(1-p);break;
      case "hop":out.dy+=arc(12);out.anim="jump";break;
      case "celebrate":{const q=(p*2)%1;out.dy+=-14*4*q*(1-q);out.anim="jump";break;}
      case "sad":out.anim="duck";break;
      case "tap":out.dy+=arc(6);break;
    }
    return out;
  }

  /* ---------- tıklama ---------- */
  function onRikoClick(){
    const now=Date.now();
    if(now-lastClick<CLICK_COOLDOWN)return; // hızlı art arda tıklama koruması
    lastClick=now;
    if(DR.Game&&DR.Game.mode!=="menu")return;
    startAnim("tap");
    const m=say("click");
    if(!m&&active)startAnim("tap");
    bumpActivity();
  }

  /* ---------- hareketsizlik (yalnız ana menüde) ---------- */
  function armIdle(delay){
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{
      idleTimer=0;
      if(doc.hidden||!DR.Game||DR.Game.mode!=="menu"||DR.UI.hasModal()){armIdle(IDLE_AGAIN);return;}
      say("idle");armIdle(IDLE_AGAIN);
    },delay);
  }
  function bumpActivity(){
    const now=Date.now();
    if(now-lastActivity<1000)return; // olay başına yeniden zamanlama yapma
    lastActivity=now;
    if(DR.Game&&DR.Game.mode==="menu")armIdle(IDLE_FIRST+Math.random()*IDLE_JITTER);
  }

  /* ---------- oyun olaylarına bağlanma (mevcut DR.UI fonksiyonları sarmalanır) ---------- */
  function wrap(name,after){
    const orig=DR.UI[name];if(typeof orig!=="function")return;
    DR.UI[name]=function(){const r=orig.apply(this,arguments);try{after.apply(null,arguments);}catch(_){}return r;};
  }
  wrap("enterCountdown",()=>{startBest=DR.Storage.get().best;startSpoken=false;recordSpoken=false;lastFossilSpeak=0;clearTimeout(idleTimer);hide(true);
    if(!startSpoken){startSpoken=true;say("start");}});
  wrap("updateFossils",run=>{const now=Date.now();if(Core.fossilMilestone(run,lastFossilSpeak,now)&&say("fossil"))lastFossilSpeak=now;});
  // İlk koşuda (önceki rekor 0) her skor "rekor" sayılır; koşu içi rekor mesajı anlamsız olacağından verilmez.
  wrap("updateRecord",(best,celebrate)=>{if(celebrate&&!recordSpoken&&startBest>0){recordSpoken=true;say("record");}});
  wrap("showGameOver",result=>{hide(true);say("gameover",{record:!!(result&&result.record)});});
  wrap("showPause",on=>{if(on)hide(true);});
  wrap("showMenu",()=>{hide(true);say("menu");bumpActivity();});

  function onDocClick(e){
    const b=e.target.closest&&e.target.closest("#collectionButton,#gameOverShop,#settingsButton,#pauseSettings");
    if(!b)return;
    const store=b.id==="collectionButton"||b.id==="gameOverShop";
    // Modal açıldıktan sonra konuş (balon modalın üstünde görünür)
    setTimeout(()=>say(store?"store":"settings"),60);
  }

  function init(){
    if(!build())return;
    doc.addEventListener("click",onDocClick);
    for(const ev of ["pointerdown","keydown","wheel"])doc.addEventListener(ev,bumpActivity,{passive:true});
    w.addEventListener("resize",()=>{placeHit();place();},{passive:true});
    doc.addEventListener("visibilitychange",()=>{if(doc.hidden){hide(true);clearTimeout(idleTimer);}else bumpActivity();});
    // İlk karşılama: yükleme ekranı kalkınca
    const ready=()=>{const p=doc.getElementById("preloader");return !p||p.classList.contains("done");};
    const greet=()=>{placeHit();if(DR.Game&&DR.Game.mode==="menu")say("menu");armIdle(IDLE_FIRST+Math.random()*IDLE_JITTER);};
    if(ready())setTimeout(greet,400);
    else{const t0=Date.now(),poll=setInterval(()=>{if(ready()||Date.now()-t0>8000){clearInterval(poll);setTimeout(greet,500);}},150);}
  }

  DR.Riko={pose,say,hide,get active(){return active;},get history(){return history;},
    // Test kancası: hareketsizlik süresini kısaltır
    setIdleDelay(ms){clearTimeout(idleTimer);armIdle(ms);}};
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
