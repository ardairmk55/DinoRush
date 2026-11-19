(function(w){
  "use strict";
  // Mağaza ve Ayarlar panelleri. Kayıt mantığı DR.Storage / js/save-core.js içindedir.
  const DR=w.DinoRush,C=DR.Config,$=id=>document.getElementById(id);
  const LISTS={skin:"skins",trail:"trails",scene:"scenes"};
  const KIND_NOUN={skin:"görünümü",trail:"izi",scene:"sahnesi"};
  const HOLD_MS=2000;
  const PREVIEW_W=96,PREVIEW_H=72;
  let shopKind="skin",previews=[],previewRaf=0,pendingBuy=null,holdRaf=0,holdAt=0,walletAnim=0,statusTimer=0;

  const num=n=>Math.max(0,Math.floor(n||0)).toLocaleString("tr-TR");
  const reducedMotion=()=>{try{return w.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}};
  const items=kind=>C.cosmetics[LISTS[kind]];
  const icon=(id,cls)=>'<svg class="'+(cls||"")+'" aria-hidden="true"><use href="#'+id+'"/></svg>';
  const ammonite='<svg class="ammonite" aria-hidden="true"><use href="#i-fossil"/></svg>';

  /* ---------- Sekmeler (ok tuşları, Home/End) ---------- */
  function bindTabs(list,onSelect){
    const tabs=[...list.querySelectorAll('[role="tab"]')];
    function select(tab,focus){
      tabs.forEach(t=>{const on=t===tab;t.classList.toggle("selected",on);t.setAttribute("aria-selected",String(on));t.tabIndex=on?0:-1;});
      if(focus)tab.focus();
      onSelect(tab);
    }
    tabs.forEach((tab,i)=>{
      tab.addEventListener("click",()=>select(tab,false));
      tab.addEventListener("keydown",e=>{
        const map={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i-1+tabs.length)%tabs.length,Home:0,End:tabs.length-1};
        if(e.key in map){e.preventDefault();select(tabs[map[e.key]],true);}
      });
    });
    return {select:index=>select(tabs[index],false)};
  }

  /* ---------- Önizleme tuvalleri (piksel net: tam sayı ölçek) ---------- */
  function setupCanvas(canvas){
    const k=Math.max(1,Math.round(w.devicePixelRatio||1));
    canvas.width=PREVIEW_W*k;canvas.height=PREVIEW_H*k;
    canvas.style.width=PREVIEW_W+"px";canvas.style.height=PREVIEW_H+"px";
    const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
    return {ctx,k};
  }
  function drawFrame(ctx,sheet,row,frame,x,y,scale){
    const cfg=C.dinoSprite;if(!sheet)return;
    ctx.drawImage(sheet,frame*cfg.frameWidth,row*cfg.frameHeight,cfg.frameWidth,cfg.frameHeight,x,y,cfg.frameWidth*scale,cfg.frameHeight*scale);
  }
  function groundStrip(ctx,k,y,offset){
    const g=DR.Assets.get("ground");
    if(g){for(let x=-(offset%g.width)-g.width;x<PREVIEW_W;x+=g.width)ctx.drawImage(g,0,0,g.width,g.height,Math.round(x)*k,y*k,g.width*k,g.height*k);}
    else{ctx.fillStyle="#4f7a2a";ctx.fillRect(0,y*k,PREVIEW_W*k,(PREVIEW_H-y)*k);}
  }
  function skinPreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),anim=C.dinoSprite.animations.idle;
    return t=>{ctx.clearRect(0,0,canvas.width,canvas.height);const frame=Math.floor(t*anim.fps)%anim.frames;drawFrame(ctx,DR.Scene.sheetFor(id),anim.row,frame,4*k,0,2*k);};
  }
  function trailPreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),anim=C.dinoSprite.animations.run,parts=[],groundY=58;let last=0,clock=0;
    return t=>{
      const dt=last?Math.min(.05,t-last):0;last=t;clock-=dt;
      if(clock<=0){clock=.3;DR.Game.trailData(id,57,groundY).forEach(p=>{p.vx*=.5;p.vy*=.5;p.x=57+(p.x-57)*.5;p.y=groundY+(p.y-groundY)*.5;p.max=p.life;parts.push(p);});}
      for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt-40*dt;p.y+=p.vy*dt;p.vy+=92*(p.gravity===undefined?1:p.gravity)*dt;p.life-=dt;if(p.life<=0)parts.splice(i,1);}
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      groundStrip(ctx,k,groundY,t*40);
      drawFrame(ctx,DR.Scene.sheetFor(),anim.row,Math.floor(t*anim.fps)%anim.frames,50*k,(groundY-35)*k,k);
      ctx.setTransform(k,0,0,k,0,0);parts.forEach(p=>DR.Scene.drawParticle(ctx,Object.assign({},p,{size:Math.max(1,Math.round(p.size*.75))})));ctx.setTransform(1,0,0,1,0,0);
    };
  }
  function scenePreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),def=DR.Scene.sceneDef(id),anim=C.dinoSprite.animations.idle;
    return t=>{
      ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#0e2a30";ctx.fillRect(0,0,canvas.width,canvas.height);
      const far=DR.Assets.get("bgFar");
      if(far)ctx.drawImage(far,128,0,192,144,0,0,PREVIEW_W*k,PREVIEW_H*k);
      for(let band=0;band<2;band++){ctx.globalAlpha=.45;ctx.fillStyle=def.fog[band];for(let i=0;i<4;i++){const x=((i*31+t*(band?-6:5))%(PREVIEW_W+30)+PREVIEW_W+30)%(PREVIEW_W+30)-24;ctx.fillRect(Math.round(x)*k,(band?44:34)*k,(14+i%2*8)*k,2*k);}}
      ctx.globalAlpha=1;groundStrip(ctx,k,60,0);
      drawFrame(ctx,DR.Scene.sheetFor(),anim.row,Math.floor(t*anim.fps)%anim.frames,4*k,25*k,k);
      DR.Scene.applyGrade(ctx,id,0,0,canvas.width,canvas.height);
    };
  }
  function runPreviews(now){const t=now/1000;previews.forEach(draw=>draw(t));previewRaf=w.requestAnimationFrame(runPreviews);}
  function startPreviews(){if(!previewRaf)previewRaf=w.requestAnimationFrame(runPreviews);}
  function stopPreviews(){if(previewRaf)w.cancelAnimationFrame(previewRaf);previewRaf=0;}

  /* ---------- Mağaza ---------- */
  function setStatus(text,tone){
    const el=$("shopStatus");el.textContent=text;el.dataset.tone=tone||"";
    clearTimeout(statusTimer);if(text)statusTimer=setTimeout(()=>{el.textContent="";el.dataset.tone="";},4200);
  }
  function animateWallet(from,to){
    const el=$("collectionWallet"),start=performance.now(),dur=reducedMotion()?1:620;
    w.cancelAnimationFrame(walletAnim);el.classList.remove("drop");void el.offsetWidth;el.classList.add("drop");
    const step=now=>{const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3);el.textContent=num(from+(to-from)*e);if(p<1)walletAnim=w.requestAnimationFrame(step);};
    walletAnim=w.requestAnimationFrame(step);
  }
  function renderShop(focusId){
    const grid=$("shopGrid"),state=DR.Storage.get();
    grid.innerHTML="";previews=[];
    grid.setAttribute("aria-labelledby","shopTab-"+shopKind);
    $("collectionWallet").textContent=num(state.fossils);
    items(shopKind).forEach(item=>{
      const st=DR.Storage.state(shopKind,item.id),card=document.createElement("article");
      card.className="ui-card shop-card is-"+st.state;card.dataset.id=item.id;
      card.innerHTML='<div class="shop-preview"><canvas aria-hidden="true"></canvas><span class="shop-badge"></span></div>'+
        '<div class="shop-info"><strong class="shop-name"></strong><small class="shop-detail"></small><span class="shop-price"></span><span class="shop-missing"></span></div>'+
        '<button type="button" class="ui-btn shop-action"></button>';
      card.querySelector(".shop-name").textContent=item.name;
      card.querySelector(".shop-detail").textContent=item.detail;
      const price=card.querySelector(".shop-price"),badge=card.querySelector(".shop-badge"),missing=card.querySelector(".shop-missing"),button=card.querySelector(".shop-action");
      if(st.state==="selected"||st.state==="owned")price.innerHTML=icon("i-check")+"<span>SAHİPSİN</span>";
      else if(item.cost===0)price.innerHTML="<span>ÜCRETSİZ</span>";
      else price.innerHTML=ammonite+"<b>"+num(item.cost)+"</b><span class=\"sr-only\"> fosil</span>";
      if(st.state==="selected")badge.innerHTML=icon("i-check")+"SEÇİLİ";
      else if(st.state==="locked")badge.innerHTML=icon("i-lock")+"KİLİTLİ";
      else if(st.state==="owned"){badge.classList.add("is-owned-badge");badge.innerHTML=icon("i-check")+"SAHİP";}
      else badge.remove();
      if(st.state==="locked")missing.textContent=num(st.missing)+" fosil eksik";else missing.remove();
      const labels={selected:"KUŞANILDI",owned:"KUŞAN",buy:"SATIN AL",locked:"KİLİTLİ"};
      button.innerHTML=(st.state==="locked"?icon("i-lock"):st.state==="selected"?icon("i-check"):"")+"<span>"+labels[st.state]+"</span>";
      button.classList.add(st.state==="buy"||st.state==="owned"?"ui-btn--primary":"ui-btn--secondary");
      button.setAttribute("aria-label",labels[st.state]+": "+item.name+(st.state==="locked"?", "+num(st.missing)+" fosil eksik":st.state==="buy"?", "+num(item.cost)+" fosil":""));
      if(st.state==="selected")button.disabled=true;
      button.addEventListener("click",()=>onCardAction(item,card));
      const canvas=card.querySelector("canvas");
      previews.push(shopKind==="skin"?skinPreview(canvas,item.id):shopKind==="trail"?trailPreview(canvas,item.id):scenePreview(canvas,item.id));
      grid.appendChild(card);
    });
    if(focusId){const b=grid.querySelector('[data-id="'+focusId+'"] .shop-action');if(b&&!b.disabled)b.focus();}
    previews.forEach(draw=>draw(performance.now()/1000));
  }
  function onCardAction(item,card){
    const st=DR.Storage.state(shopKind,item.id);
    if(st.state==="locked"){
      DR.Audio.deny();setStatus("Yetersiz bakiye: "+num(st.missing)+" fosil eksik.","warn");
      card.classList.remove("deny");void card.offsetWidth;card.classList.add("deny");return;
    }
    if(st.state==="buy"){openConfirm(item);return;}
    if(st.state==="owned"){
      DR.Storage.equip(shopKind,item.id);DR.Audio.click();
      setStatus(item.name+" "+KIND_NOUN[shopKind]+" kuşanıldı.","ok");renderShop();DR.UI.refreshMenu();
      const equipped=$("shopGrid").querySelector('[data-id="'+item.id+'"]');if(equipped){equipped.tabIndex=-1;equipped.focus();}
    }
  }
  function openConfirm(item){
    const s=DR.Storage.get();pendingBuy={kind:shopKind,item};
    $("shopConfirmName").textContent=item.name+" "+KIND_NOUN[shopKind];
    $("shopConfirmCost").textContent=num(item.cost);
    $("shopConfirmAfter").textContent=num(s.fossils-item.cost);
    $("shopConfirm").hidden=false;$("shopConfirmOk").focus();
  }
  function closeConfirm(){const was=pendingBuy;pendingBuy=null;$("shopConfirm").hidden=true;if(was){const b=$("shopGrid").querySelector('[data-id="'+was.item.id+'"] .shop-action');if(b)b.focus();}}
  function confirmBuy(){
    if(!pendingBuy)return;
    const {kind,item}=pendingBuy,before=DR.Storage.get().fossils,result=DR.Storage.buy(kind,item.id);
    pendingBuy=null;$("shopConfirm").hidden=true;
    if(!result.ok){
      if(result.reason==="insufficient"){DR.Audio.deny();setStatus("Yetersiz bakiye: "+num(result.missing)+" fosil eksik.","warn");}
      renderShop(item.id);return;
    }
    DR.Audio.purchase();DR.Audio.haptic(30);
    renderShop(item.id);animateWallet(before,DR.Storage.get().fossils);DR.UI.refreshMenu();
    const card=$("shopGrid").querySelector('[data-id="'+item.id+'"]');if(card)burst(card);
    setStatus(item.name+" "+KIND_NOUN[kind]+" satın alındı. Kullanmak için KUŞAN'a dokun.","ok");
  }
  function burst(card){
    card.classList.remove("just-bought");void card.offsetWidth;card.classList.add("just-bought");
    setTimeout(()=>card.classList.remove("just-bought"),900);
    if(reducedMotion())return;
    const host=card.querySelector(".shop-preview")||card,count=DR.Storage.get().lowEffects?6:18;
    for(let i=0;i<count;i++){
      const spark=document.createElement("i"),angle=(i/count)*Math.PI*2+Math.random()*.35,dist=30+Math.random()*44;
      spark.className="amber-spark"+(i%3===0?" big":"");
      spark.style.setProperty("--dx",Math.round(Math.cos(angle)*dist)+"px");
      spark.style.setProperty("--dy",Math.round(Math.sin(angle)*dist-12)+"px");
      spark.style.animationDelay=Math.round(Math.random()*70)+"ms";
      host.appendChild(spark);setTimeout(()=>spark.remove(),1000);
    }
  }

  /* ---------- Ayarlar ---------- */
  function fmtTime(seconds){
    const s=Math.floor(seconds||0),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;
    if(h)return h+" sa "+String(m).padStart(2,"0")+" dk";
    if(m)return m+" dk "+String(r).padStart(2,"0")+" sn";
    return r+" sn";
  }
  function syncSettings(){
    const s=DR.Storage.get(),vib=DR.Audio.vibrationSupported;
    document.querySelectorAll("[data-setting]").forEach(btn=>{
      const key=btn.dataset.setting,on=key==="mute"?!s.sound:!!s[key];
      btn.setAttribute("aria-checked",String(on));
    });
    document.querySelectorAll("[data-range]").forEach(input=>{
      const v=s[input.dataset.range];input.value=String(v);
      const out=input.parentElement.querySelector("output");if(out)out.textContent="%"+v;
      input.style.setProperty("--fill",v+"%");
      input.setAttribute("aria-valuetext","yüzde "+v);
    });
    const vibBtn=document.querySelector('[data-setting="vibration"]');
    if(vibBtn){vibBtn.disabled=!vib;$("vibrationNote").textContent=vib?"Destekleyen telefonlarda kısa titreşim.":"Bu cihaz titreşimi desteklemiyor.";}
    $("muteNote").hidden=s.sound;
    $("motionNote").hidden=!reducedMotion();
    $("fullscreenSetting").querySelector("span").textContent=document.fullscreenElement?"TAM EKRANDAN ÇIK":"TAM EKRAN";
    $("dataVersion").textContent=C.version;
    $("dataPlayTime").textContent=fmtTime(s.playTime);
    $("dataBest").textContent=num(s.best);
    $("gameApp").classList.toggle("scanlines",!!s.scanlines);
    document.documentElement.classList.toggle("fx-low",!!s.lowEffects);
    DR.UI.syncSoundButton();
  }
  function bindSettings(){
    const panels=[...document.querySelectorAll("[data-settings-panel]")];
    bindTabs($("settingsTabs"),tab=>{const id=tab.getAttribute("aria-controls");panels.forEach(p=>{p.hidden=p.id!==id;});cancelHold();hideResetConfirm(false);});
    document.querySelectorAll("[data-range]").forEach(input=>{
      input.addEventListener("input",()=>{DR.Storage.update({[input.dataset.range]:Number(input.value)});syncSettings();if(input.dataset.range==="musicVolume")return; /* müzik düzeyi çalan müzikte duyulur, test sesi yok */DR.Audio.init();DR.Audio.test();});
    });
    document.querySelectorAll("[data-setting]").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.setting,s=DR.Storage.get();
      if(key==="mute")DR.Storage.update({sound:!s.sound});else DR.Storage.update({[key]:!s[key]});
      if(key==="lowEffects")DR.Scene.resize();
      syncSettings();
      const now=DR.Storage.get();
      if(key==="mute"&&now.sound){DR.Audio.init();DR.Audio.test();}
      else if(key!=="mute")DR.Audio.click();
      if(key==="vibration"&&now.vibration)DR.Audio.haptic(30);
    }));
    $("fullscreenSetting").addEventListener("click",()=>DR.UI.toggleFullscreen().then(syncSettings));
    document.addEventListener("fullscreenchange",syncSettings);
    const hold=$("resetHold");
    hold.addEventListener("pointerdown",e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();try{hold.setPointerCapture(e.pointerId);}catch(_){}startHold();});
    ["pointerup","pointercancel","lostpointercapture","pointerleave"].forEach(type=>hold.addEventListener(type,cancelHold));
    hold.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")){e.preventDefault();if(!e.repeat)startHold();}});
    hold.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter")cancelHold();});
    hold.addEventListener("blur",cancelHold);
    hold.addEventListener("click",e=>e.preventDefault());
    $("resetCancel").addEventListener("click",()=>hideResetConfirm(true));
    $("resetConfirmOk").addEventListener("click",()=>{
      DR.Storage.resetProgress();hideResetConfirm(false);syncSettings();DR.UI.refreshMenu();
      DR.UI.announce("İlerleme sıfırlandı.");$("resetDone").hidden=false;setTimeout(()=>{$("resetDone").hidden=true;},3200);
    });
  }
  function setRing(p){$("resetHold").style.setProperty("--hold",String(p));$("resetRing").style.strokeDashoffset=String(100-p*100);}
  function startHold(){
    if(holdRaf||!$("resetConfirm").hidden)return;
    holdAt=performance.now();$("resetHold").classList.add("holding");
    const step=now=>{const p=Math.min(1,(now-holdAt)/HOLD_MS);setRing(p);
      if(p>=1){holdRaf=0;$("resetHold").classList.remove("holding");showResetConfirm();return;}
      holdRaf=w.requestAnimationFrame(step);};
    holdRaf=w.requestAnimationFrame(step);
  }
  function cancelHold(){if(holdRaf){w.cancelAnimationFrame(holdRaf);holdRaf=0;}const b=$("resetHold");if(b){b.classList.remove("holding");if($("resetConfirm").hidden)setRing(0);}}
  function showResetConfirm(){DR.Audio.deny();$("resetConfirm").hidden=false;$("resetCancel").focus();}
  function hideResetConfirm(focus){$("resetConfirm").hidden=true;setRing(0);if(focus)$("resetHold").focus();}

  /* ---------- Genel ---------- */
  function open(id){
    if(id==="collectionModal"){setStatus("");renderShop();startPreviews();}
    if(id==="settingsModal"){if(DR.Game.flushPlayTime)DR.Game.flushPlayTime();syncSettings();}
  }
  function close(){stopPreviews();pendingBuy=null;const c=$("shopConfirm");if(c)c.hidden=true;cancelHold();hideResetConfirm(false);}
  // Esc önce iç onay kutusunu kapatır; kapattıysa true döner.
  function handleEscape(){
    if(!$("shopConfirm").hidden){closeConfirm();return true;}
    if(!$("resetConfirm").hidden){hideResetConfirm(true);return true;}
    return false;
  }
  function init(){
    const shopTabs=bindTabs($("shopTabs"),tab=>{shopKind=tab.dataset.kind;setStatus("");renderShop();});
    void shopTabs;
    $("shopConfirmOk").addEventListener("click",confirmBuy);
    $("shopConfirmCancel").addEventListener("click",closeConfirm);
    bindSettings();
    syncSettings();
  }
  DR.Panels={init,open,close,handleEscape,syncSettings,fmtTime};
})(window);
