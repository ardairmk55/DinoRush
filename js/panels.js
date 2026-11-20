(function(w){
  "use strict";
  // Mağaza ve Ayarlar panelleri. Kayıt mantığı DR.Storage / js/save-core.js içindedir.
  const DR=w.DinoRush,C=DR.Config,$=id=>document.getElementById(id);
  const LISTS={skin:"skins",trail:"trails",scene:"scenes",accessory:"accessories"};
  const KIND_NOUN={skin:"görünümü",trail:"izi",scene:"sahnesi",accessory:"aksesuarı"};
  const HOLD_MS=2000;
  // Önizleme tuvali (mantıksal piksel). Dino 2x ölçekte 88x72; şapkalar için üstte pay bırakılır.
  const PREVIEW_W=104,PREVIEW_H=84,DINO_TOP=10;
  let shopKind="skin",accSlot="all",previews=[],previewRaf=0,pendingBuy=null,holdRaf=0,holdAt=0,walletAnim=0,statusTimer=0;

  const num=n=>Math.max(0,Math.floor(n||0)).toLocaleString("tr-TR");
  const reducedMotion=()=>!!DR.Storage.get().reduceMotion;
  const systemReduced=()=>{try{return w.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}};
  const items=kind=>C.cosmetics[LISTS[kind]];
  const rarityLabel=r=>(C.cosmetics.rarities[r]||{label:""}).label;
  const slotLabel=id=>(C.cosmetics.accessorySlots.find(s=>s.id===id)||{label:""}).label;
  const accById=id=>C.cosmetics.accessories.find(a=>a.id===id);
  const icon=(id,cls)=>'<svg class="'+(cls||"")+'" aria-hidden="true"><use href="#'+id+'"/></svg>';
  const ammonite='<svg class="ammonite" aria-hidden="true"><use href="#i-fossil"/></svg>';
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}

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
  function setupCanvas(canvas,wid,hei){
    const k=Math.max(1,Math.round(w.devicePixelRatio||1));wid=wid||PREVIEW_W;hei=hei||PREVIEW_H;
    canvas.width=wid*k;canvas.height=hei*k;
    canvas.style.aspectRatio=wid+" / "+hei;
    const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
    return {ctx,k};
  }
  function drawFrame(ctx,sheet,row,frame,x,y,scale){
    const cfg=C.dinoSprite;if(!sheet)return;
    ctx.drawImage(sheet,frame*cfg.frameWidth,row*cfg.frameHeight,cfg.frameWidth,cfg.frameHeight,x,y,cfg.frameWidth*scale,cfg.frameHeight*scale);
  }
  // Riko + aksesuarlar (aynı çizim kodu oyunda da kullanılır: js/accessory-art.js)
  function drawRiko(ctx,skinId,row,frame,x,y,scale,loadout){
    ctx.imageSmoothingEnabled=false;
    drawFrame(ctx,DR.Scene.sheetFor(skinId),row,frame,x,y,scale);
    if(DR.AccessoryArt)DR.AccessoryArt.draw(ctx,row,frame,x,y,scale,loadout);
  }
  function groundStrip(ctx,k,y,offset){
    const g=DR.Assets.get("ground");
    if(g){for(let x=-(offset%g.width)-g.width;x<PREVIEW_W;x+=g.width)ctx.drawImage(g,0,0,g.width,g.height,Math.round(x)*k,y*k,g.width*k,g.height*k);}
    else{ctx.fillStyle="#4f7a2a";ctx.fillRect(0,y*k,PREVIEW_W*k,(PREVIEW_H-y)*k);}
  }
  const idleFrame=t=>{const a=C.dinoSprite.animations.idle;return reducedMotion()?0:Math.floor(t*a.fps)%a.frames;};
  function skinPreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),anim=C.dinoSprite.animations.idle;
    return t=>{ctx.clearRect(0,0,canvas.width,canvas.height);drawRiko(ctx,id,anim.row,idleFrame(t),8*k,DINO_TOP*k,2*k,DR.Storage.get().accessories);};
  }
  function accessoryPreview(canvas,item){
    const {ctx,k}=setupCanvas(canvas),anim=C.dinoSprite.animations.idle;
    return t=>{
      // Diğer yuvalardaki mevcut aksesuarlarla birlikte: oyunda nasıl görüneceği
      const loadout=Object.assign({},DR.Storage.get().accessories,{[item.slot]:item.id});
      ctx.clearRect(0,0,canvas.width,canvas.height);drawRiko(ctx,DR.Storage.get().selected,anim.row,idleFrame(t),8*k,DINO_TOP*k,2*k,loadout);
    };
  }
  function trailPreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),anim=C.dinoSprite.animations.run,parts=[],groundY=70;let last=0,clock=0;
    return t=>{
      const still=reducedMotion(),dt=last&&!still?Math.min(.05,t-last):0;last=t;clock-=dt;
      if(clock<=0&&!still){clock=.3;DR.Game.trailData(id,62,groundY).forEach(p=>{p.vx*=.5;p.vy*=.5;p.x=62+(p.x-62)*.5;p.y=groundY+(p.y-groundY)*.5;p.max=p.life;parts.push(p);});}
      for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt-40*dt;p.y+=p.vy*dt;p.vy+=92*(p.gravity===undefined?1:p.gravity)*dt;p.life-=dt;if(p.life<=0)parts.splice(i,1);}
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      groundStrip(ctx,k,groundY,still?0:t*40);
      drawRiko(ctx,DR.Storage.get().selected,anim.row,still?0:Math.floor(t*anim.fps)%anim.frames,54*k,(groundY-35)*k,k,DR.Storage.get().accessories);
      ctx.setTransform(k,0,0,k,0,0);parts.forEach(p=>DR.Scene.drawParticle(ctx,Object.assign({},p,{size:Math.max(1,Math.round(p.size*.75))})));ctx.setTransform(1,0,0,1,0,0);
    };
  }
  function scenePreview(canvas,id){
    const {ctx,k}=setupCanvas(canvas),def=DR.Scene.sceneDef(id),anim=C.dinoSprite.animations.idle;
    return t=>{
      const tt=reducedMotion()?0:t;
      ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#0e2a30";ctx.fillRect(0,0,canvas.width,canvas.height);
      const far=DR.Assets.get("bgFar");
      if(far)ctx.drawImage(far,128,0,192,144,0,0,PREVIEW_W*k,PREVIEW_H*k);
      for(let band=0;band<2;band++){ctx.globalAlpha=.45;ctx.fillStyle=def.fog[band];for(let i=0;i<4;i++){const x=((i*31+tt*(band?-6:5))%(PREVIEW_W+30)+PREVIEW_W+30)%(PREVIEW_W+30)-24;ctx.fillRect(Math.round(x)*k,(band?52:40)*k,(14+i%2*8)*k,2*k);}}
      ctx.globalAlpha=1;groundStrip(ctx,k,72,0);
      drawRiko(ctx,DR.Storage.get().selected,anim.row,idleFrame(tt),6*k,37*k,k,DR.Storage.get().accessories);
      DR.Scene.applyGrade(ctx,id,0,0,canvas.width,canvas.height);
    };
  }
  // Aksesuar sekmesinin üstündeki büyük Riko: kuşanılan tüm aksesuarlar
  function loadoutPreview(canvas){
    const {ctx,k}=setupCanvas(canvas,64,56),anim=C.dinoSprite.animations.idle;
    return t=>{ctx.clearRect(0,0,canvas.width,canvas.height);drawRiko(ctx,DR.Storage.get().selected,anim.row,idleFrame(t),Math.round(10*k),Math.round(10*k),k,DR.Storage.get().accessories);};
  }
  function runPreviews(now){const t=now/1000;previews.forEach(draw=>draw(t));previewRaf=reducedMotion()?0:w.requestAnimationFrame(runPreviews);}
  function startPreviews(){if(reducedMotion()){previews.forEach(draw=>draw(0));return;}if(!previewRaf)previewRaf=w.requestAnimationFrame(runPreviews);}
  function stopPreviews(){if(previewRaf)w.cancelAnimationFrame(previewRaf);previewRaf=0;}

  /* ---------- Mağaza ---------- */
  function setStatus(text,tone){
    const box=$("shopStatus");box.textContent=text;box.dataset.tone=tone||"";
    clearTimeout(statusTimer);if(text)statusTimer=setTimeout(()=>{box.textContent="";box.dataset.tone="";},4200);
  }
  function animateWallet(from,to){
    const box=$("collectionWallet"),start=performance.now(),dur=reducedMotion()?1:620;
    w.cancelAnimationFrame(walletAnim);box.classList.remove("drop");void box.offsetWidth;box.classList.add("drop");
    const step=now=>{const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3);box.textContent=num(from+(to-from)*e);if(p<1)walletAnim=w.requestAnimationFrame(step);};
    walletAnim=w.requestAnimationFrame(step);
  }
  function renderLoadout(){
    const list=$("loadoutSlots"),eq=DR.Storage.get().accessories;list.textContent="";
    C.cosmetics.accessorySlots.forEach(slot=>{
      const li=el("li","loadout-slot"),item=accById(eq[slot.id]);
      li.dataset.slot=slot.id;li.classList.toggle("is-empty",!item);
      li.append(el("span","loadout-label",slot.label),el("b","loadout-item",item?item.name:"Boş"));
      if(item){const b=el("button","loadout-remove","ÇIKAR");b.type="button";b.setAttribute("aria-label",item.name+" aksesuarını çıkar");b.addEventListener("click",()=>unequipAccessory(item));li.append(b);}
      list.append(li);
    });
  }
  function cardLabel(kind,state){
    if(kind==="accessory")return {selected:"ÇIKAR",owned:"KUŞAN",buy:"SATIN AL",locked:"KİLİTLİ"}[state];
    return {selected:"KUŞANILDI",owned:"KUŞAN",buy:"SATIN AL",locked:"KİLİTLİ"}[state];
  }
  function renderShop(focusId){
    const grid=$("shopGrid"),state=DR.Storage.get(),isAcc=shopKind==="accessory";
    grid.textContent="";previews=[];
    $("shopScroll").setAttribute("aria-labelledby","shopTab-"+shopKind);
    $("collectionWallet").textContent=num(state.fossils);
    $("shopTools").hidden=!isAcc;$("shopLoadout").hidden=!isAcc;
    if(isAcc){renderLoadout();previews.push(loadoutPreview($("loadoutCanvas")));
      document.querySelectorAll("#slotFilter .filter-chip").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.slot===accSlot)));}
    const list=items(shopKind).filter(item=>!isAcc||accSlot==="all"||item.slot===accSlot);
    list.forEach(item=>{
      const st=DR.Storage.state(shopKind,item.id),card=el("article","shop-card is-"+st.state);
      card.dataset.id=item.id;card.dataset.rarity=item.rarity||"starter";
      const preview=el("div","shop-preview"),canvas=document.createElement("canvas");canvas.setAttribute("aria-hidden","true");preview.append(canvas);
      if(st.state!=="buy"){const badge=el("span","shop-badge"+(st.state==="owned"?" is-owned-badge":""));
        badge.innerHTML=st.state==="selected"?icon("i-check")+(isAcc?"KUŞANILDI":"SEÇİLİ"):st.state==="locked"?icon("i-lock")+"KİLİTLİ":icon("i-check")+"SAHİP";preview.append(badge);}
      const info=el("div","shop-info"),title=el("div","shop-title");
      title.append(el("strong","shop-name",item.name),el("span","rarity-tag",rarityLabel(item.rarity)));
      info.append(title);
      if(isAcc)info.append(el("span","slot-tag",slotLabel(item.slot)));
      info.append(el("small","shop-detail",item.detail));
      const meta=el("div","shop-meta"),price=el("span","shop-price");
      if(st.state==="selected"||st.state==="owned")price.innerHTML=icon("i-check")+"<span>SAHİPSİN</span>";
      else if(item.cost===0)price.innerHTML="<span>ÜCRETSİZ</span>";
      else price.innerHTML=ammonite+"<b>"+num(item.cost)+"</b><span class=\"sr-only\"> fosil</span>";
      meta.append(price);
      if(st.state==="locked")meta.append(el("span","shop-missing",num(st.missing)+" fosil eksik"));
      info.append(meta);
      const label=cardLabel(shopKind,st.state),button=el("button","shop-action is-"+st.state);button.type="button";
      button.innerHTML=(st.state==="locked"?icon("i-lock"):st.state==="selected"&&!isAcc?icon("i-check"):"")+"<span>"+label+"</span>";
      button.setAttribute("aria-label",label+": "+item.name+(st.state==="locked"?", "+num(st.missing)+" fosil eksik":st.state==="buy"?", "+num(item.cost)+" fosil":""));
      if(st.state==="selected"&&!isAcc)button.disabled=true;
      button.addEventListener("click",()=>onCardAction(item,card));
      card.append(preview,info,button);
      previews.push(shopKind==="skin"?skinPreview(canvas,item.id):shopKind==="trail"?trailPreview(canvas,item.id):shopKind==="scene"?scenePreview(canvas,item.id):accessoryPreview(canvas,item));
      grid.append(card);
    });
    if(!reducedMotion()){grid.classList.remove("is-entering");void grid.offsetWidth;grid.classList.add("is-entering");}
    if(focusId){const b=grid.querySelector('[data-id="'+focusId+'"] .shop-action');if(b&&!b.disabled)b.focus();}
    previews.forEach(draw=>draw(performance.now()/1000));
  }
  function unequipAccessory(item){
    if(DR.Storage.unequip("accessory",item.id).ok){DR.Audio.click();setStatus(item.name+" çıkarıldı.","ok");renderShop(item.id);}
  }
  function onCardAction(item,card){
    const st=DR.Storage.state(shopKind,item.id);
    if(st.state==="locked"){
      DR.Audio.deny();setStatus("Yetersiz bakiye: "+item.name+" için "+num(st.missing)+" fosil daha gerekiyor.","warn");
      card.classList.remove("deny");void card.offsetWidth;card.classList.add("deny");return;
    }
    if(st.state==="buy"){openConfirm(item);return;}
    if(st.state==="selected"&&shopKind==="accessory"){unequipAccessory(item);return;}
    if(st.state==="owned"){
      const before=shopKind==="accessory"?accById(DR.Storage.get().accessories[item.slot]):null;
      DR.Storage.equip(shopKind,item.id);DR.Audio.click();
      setStatus(item.name+" "+KIND_NOUN[shopKind]+" kuşanıldı."+(before?" ("+before.name+" çıkarıldı)":""),"ok");renderShop(item.id);DR.UI.refreshMenu();
      announceAchievements();
    }
  }
  // Mağaza işlemlerinden sonra koşulu sağlanan başarımlar (ör. tüm şapkalar, üç yuva) açılır.
  function announceAchievements(){
    const r=DR.Storage.checkAchievements();if(!r.unlocked.length)return;
    r.unlocked.forEach((a,i)=>{const t=DR.ProgressCore.TEXT[a.id]||[a.id,""];setTimeout(()=>{DR.UI.toast({kind:"achievement",title:"BAŞARIM: "+t[0],text:t[1]+"  +"+a.reward+" fosil"});DR.Audio.achievement();},300+i*900);});
    $("collectionWallet").textContent=num(DR.Storage.get().fossils);DR.UI.refreshMenu();
  }

  /* ---------- Kaşif karnesi: günlük seri, başarımlar, istatistikler ---------- */
  const ACH_ICON={play:"i-play",trophy:"i-trophy",fossil:"i-fossil",spark:"i-spark",ptero:"i-info",chain:"i-fossil",restart:"i-restart",clock:"i-pause",calendar:"i-check",hat:"i-box"};
  function renderProfile(){
    const s=DR.Storage.get(),P=DR.ProgressCore,today=P.dayKey(new Date()),d=s.daily||{streak:0,best:0,last:null};
    const alive=d.last&&(d.last===today||P.dayDiff(d.last,today)===1),streak=alive?d.streak:0;
    $("streakDays").textContent=String(streak);$("streakBest").textContent=String(d.best||0);
    $("streakText").textContent=d.last===today?"Bugünün ödülü alındı. Yarın gel, seri "+(streak+1)+". güne çıksın (+"+C.rewards.dailyBase*Math.min(streak+1,C.rewards.dailyCap)+" fosil).":
      streak>0?"Bugün bir koşu yap, seriyi "+(streak+1)+". güne taşı: +"+C.rewards.dailyBase*Math.min(streak+1,C.rewards.dailyCap)+" fosil.":"Bugünün ilk koşusu +"+C.rewards.dailyBase+" fosil kazandırır. Her gün gelirsen ödül büyür.";
    $("streakCard").dataset.active=String(streak>0);
    const list=P.progress(s,C.cosmetics),done=list.filter(a=>a.unlockedAt).length,grid=$("prof-ach");
    $("achCount").textContent=done+"/"+list.length;grid.textContent="";
    list.sort((a,b)=>(!!b.unlockedAt)-(!!a.unlockedAt)||(b.value/b.target)-(a.value/a.target)).forEach(a=>{
      const t=P.TEXT[a.id]||[a.id,""],card=el("article","ach-card"+(a.unlockedAt?" is-done":""));card.dataset.id=a.id;
      const ic=el("div","ach-icon");ic.innerHTML=icon(ACH_ICON[a.icon]||"i-trophy");
      const body=el("div","ach-body"),head=el("div","ach-head");head.append(el("strong","ach-name",t[0]),el("span","ach-reward","+"+num(a.reward)));
      body.append(head,el("small","ach-desc",t[1]));
      if(a.unlockedAt)body.append(el("span","ach-date","Açıldı: "+new Date(a.unlockedAt).toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"})));
      else{const bar=el("div","ach-bar"),fill=el("i");fill.style.width=Math.round(a.value/a.target*100)+"%";bar.append(fill);bar.setAttribute("role","progressbar");bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax",String(a.target));bar.setAttribute("aria-valuenow",String(a.value));bar.setAttribute("aria-label",t[0]+" ilerlemesi");body.append(bar,el("span","ach-progress",num(a.value)+" / "+num(a.target)));}
      card.append(ic,body);grid.append(card);
    });
    const st=s.stats,deaths=Object.entries(st.deaths).sort((a,b)=>b[1]-a[1]),NAMES={log:"Kütük",rock:"Kaya",bush:"Çalı",flyer:"Pterosaur",faller:"Düşen kaya"};
    const rows=[["KOŞU SAYISI",num(st.runs)],["EN YÜKSEK SKOR",num(s.best)],["ORTALAMA SKOR",num(st.runs?st.totalScore/st.runs:0)],["EN UZUN KOŞU",fmtTime(st.longestRun)],["KAZANILAN TOPLAM FOSİL",num(st.totalFossils)],["TEK KOŞUDA EN ÇOK FOSİL",num(st.bestRunFossils)],["KIL PAYI (TOPLAM)",num(st.nearMisses)],["TEK KOŞUDA KIL PAYI",num(st.bestRunNearMisses)],["TAMAMLANAN ZİNCİR",num(st.chains)],["EN UZUN ZİNCİR","x"+st.bestChain],["ATLATILAN PTEROSAUR",num(st.pterosDodged)],["ZIPLAMA",num(st.jumps)],["TOPLAM OYNAMA SÜRESİ",fmtTime(s.playTime)],["EN ÇOK YAKALAYAN",deaths[0]&&deaths[0][1]?NAMES[deaths[0][0]]+" ("+deaths[0][1]+")":"-"]];
    const dl=$("statsList");dl.textContent="";rows.forEach(([k,v])=>{const row=el("div"),dt=el("dt",null,k),dd=el("dd",null,v);row.append(dt,dd);dl.append(row);});
  }
  function openConfirm(item){
    if(pendingBuy)return; // çift tıklama: tek onay penceresi
    const s=DR.Storage.get();pendingBuy={kind:shopKind,item};
    $("shopConfirmName").textContent=item.name+" "+KIND_NOUN[shopKind];
    $("shopConfirmCost").textContent=num(item.cost);
    $("shopConfirmAfter").textContent=num(s.fossils-item.cost);
    $("shopConfirmOk").disabled=false;
    $("shopConfirm").hidden=false;$("shopConfirmOk").focus();
  }
  function closeConfirm(){const was=pendingBuy;pendingBuy=null;$("shopConfirm").hidden=true;if(was){const b=$("shopGrid").querySelector('[data-id="'+was.item.id+'"] .shop-action');if(b)b.focus();}}
  function confirmBuy(){
    if(!pendingBuy)return; // hızlı ikinci tıklama: işlem zaten yapıldı
    $("shopConfirmOk").disabled=true;
    const {kind,item}=pendingBuy,before=DR.Storage.get().fossils,result=DR.Storage.buy(kind,item.id);
    pendingBuy=null;$("shopConfirm").hidden=true;
    if(!result.ok){
      if(result.reason==="insufficient"){DR.Audio.deny();setStatus("Yetersiz bakiye: "+num(result.missing)+" fosil eksik.","warn");}
      else if(result.reason==="owned")setStatus(item.name+" zaten sende.","ok");
      renderShop(item.id);return;
    }
    DR.Audio.purchase();DR.Audio.haptic(30);
    renderShop(item.id);animateWallet(before,DR.Storage.get().fossils);DR.UI.refreshMenu();
    const card=$("shopGrid").querySelector('[data-id="'+item.id+'"]');if(card)burst(card);
    setStatus(item.name+" "+KIND_NOUN[kind]+" satın alındı. Hemen kullanmak için KUŞAN'a dokun.","ok");
    announceAchievements();
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
  function fmtDate(ms){try{return new Date(ms).toLocaleString("tr-TR",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch(_){return new Date(ms).toISOString();}}
  // Görüntü ayarlarının arayüze etkisi (açılışta ve her değişiklikte)
  function applyDisplay(){
    const s=DR.Storage.get(),root=document.documentElement;
    $("gameApp").classList.toggle("scanlines",!!s.scanlines);
    root.classList.toggle("fx-low",!!s.lowEffects);
    root.classList.toggle("reduce-motion",!!s.reduceMotion);
  }
  function ownedCount(s){
    const total=["skins","trails","scenes","accessories"].reduce((n,k)=>n+C.cosmetics[k].length,0);
    return {owned:s.owned.length+s.ownedTrails.length+s.ownedScenes.length+s.ownedAccessories.length,total};
  }
  function syncSettings(){
    const s=DR.Storage.get(),vib=DR.Audio.vibrationSupported;
    document.querySelectorAll("[data-setting]").forEach(btn=>{
      const key=btn.dataset.setting,on=key==="mute"?!s.sound:!!s[key];
      btn.setAttribute("aria-checked",String(on));
    });
    document.querySelectorAll("[data-quality]").forEach(btn=>btn.setAttribute("aria-checked",String((btn.dataset.quality==="low")===!!s.lowEffects)));
    document.querySelectorAll("[data-range]").forEach(input=>{
      const v=s[input.dataset.range];input.value=String(v);
      const out=input.parentElement.querySelector("output");if(out)out.textContent="%"+v;
      input.style.setProperty("--fill",v+"%");
      input.setAttribute("aria-valuetext","yüzde "+v);
    });
    const vibBtn=document.querySelector('[data-setting="vibration"]');
    if(vibBtn){vibBtn.disabled=!vib;$("vibrationNote").textContent=vib?"Destekleyen telefonlarda kısa titreşim.":"Bu cihaz titreşimi desteklemiyor.";}
    $("muteNote").hidden=s.sound;
    $("motionNote").hidden=!systemReduced();
    $("fullscreenSetting").querySelector("span").textContent=document.fullscreenElement?"PENCEREYE DÖN":"TAM EKRAN";
    // Veri ve kayıt
    const st=DR.Storage.status(),own=ownedCount(s);
    $("saveStatus").dataset.ok=String(st.ok);
    $("saveStatusTitle").textContent=st.ok?"KAYIT BU CİHAZDA":"KAYDEDİLEMİYOR";
    $("saveStatusText").textContent=st.ok?(st.savedAt?"Son kayıt: "+fmtDate(st.savedAt):"Henüz kayıt yok; ilk değişiklikte kaydedilir."):"Tarayıcı yerel depolamaya izin vermiyor (gizli sekme olabilir). İlerleme yalnızca bu oturumda kalır.";
    $("dataVersion").textContent=C.version;$("aboutVersion").textContent=C.version;
    $("dataPlayTime").textContent=fmtTime(s.playTime);
    $("dataBest").textContent=num(s.best);
    $("dataFossils").textContent=num(s.fossils);
    $("dataOwned").textContent=own.owned+" / "+own.total;
    $("dataSize").textContent=(st.bytes/1024).toLocaleString("tr-TR",{maximumFractionDigits:1})+" KB";
    applyDisplay();
    DR.UI.syncSoundButton();
  }
  function bindSettings(){
    const panels=[...document.querySelectorAll("[data-settings-panel]")];
    bindTabs($("settingsTabs"),tab=>{const id=tab.getAttribute("aria-controls");panels.forEach(p=>{p.hidden=p.id!==id;});$("settingsScroll").scrollTop=0;cancelHold();hideResetConfirm(false);if(id==="set-data")syncSettings();});
    document.querySelectorAll("[data-range]").forEach(input=>{
      input.addEventListener("input",()=>{
        const key=input.dataset.range;DR.Storage.update({[key]:Number(input.value)});syncSettings();
        // Müzik kaydırıcıları çalan müzikte duyulur; GENEL ve EFEKT kısa test sesi çalar.
        if(key==="menuMusicVolume"||key==="gameMusicVolume")return;
        DR.Audio.init();DR.Audio.test();
      });
    });
    document.querySelectorAll("[data-setting]").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.setting,s=DR.Storage.get();
      if(key==="mute")DR.Storage.update({sound:!s.sound});else DR.Storage.update({[key]:!s[key]});
      if(key==="performance")DR.Scene.resize();
      syncSettings();
      const now=DR.Storage.get();
      if((key==="sound"||key==="mute")&&now.sound){DR.Audio.init();DR.Audio.test();}
      else if(key!=="sound"&&key!=="mute")DR.Audio.click();
      if(key==="vibration"&&now.vibration)DR.Audio.haptic(30);
      if(key==="reduceMotion"&&DR.UI.announce)DR.UI.announce(now.reduceMotion?"Animasyonlar azaltıldı.":"Animasyonlar açık.");
    }));
    document.querySelectorAll("[data-quality]").forEach(btn=>{
      btn.addEventListener("click",()=>{DR.Storage.update({lowEffects:btn.dataset.quality==="low"});DR.Scene.resize();syncSettings();DR.Audio.click();});
      btn.addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();const other=[...document.querySelectorAll("[data-quality]")].find(b=>b!==btn);other.click();other.focus();}});
    });
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
      const all=$("resetEverything").checked;
      if(all){DR.Storage.wipeAll(["dinorush-riko-v1"]);if(DR.Riko&&DR.Riko.reset)DR.Riko.reset();DR.Scene.resize();}
      else DR.Storage.resetProgress();
      hideResetConfirm(false);$("resetEverything").checked=false;syncSettings();DR.UI.refreshMenu();
      const msg=all?"Tüm yerel veriler silindi; ayarlar varsayılana döndü.":"İlerleme sıfırlandı.";
      DR.UI.announce(msg);$("resetDone").textContent=msg;$("resetDone").hidden=false;setTimeout(()=>{$("resetDone").hidden=true;},3200);
    });
    $("resetEverything").addEventListener("change",()=>{$("resetWarnText").textContent=$("resetEverything").checked?"Bu işlem geri alınamaz. Rekorun, fosil bakiyen, tüm kozmetiklerin, ayarların ve Riko'nun konuşma geçmişi silinecek.":"Bu işlem geri alınamaz. Rekorun, fosil bakiyen ve satın aldığın tüm kozmetikler silinecek.";});
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
    if(id==="profileModal"){if(DR.Game.flushPlayTime)DR.Game.flushPlayTime();announceAchievements();renderProfile();$("profileScroll").scrollTop=0;}
  }
  function close(){stopPreviews();pendingBuy=null;const c=$("shopConfirm");if(c)c.hidden=true;cancelHold();hideResetConfirm(false);}
  // Esc önce iç onay kutusunu kapatır; kapattıysa true döner.
  function handleEscape(){
    if(!$("shopConfirm").hidden){closeConfirm();return true;}
    if(!$("resetConfirm").hidden){hideResetConfirm(true);return true;}
    return false;
  }
  function init(){
    bindTabs($("shopTabs"),tab=>{shopKind=tab.dataset.kind;setStatus("");$("shopScroll").scrollTop=0;renderShop();startPreviews();});
    document.querySelectorAll("#slotFilter .filter-chip").forEach(b=>b.addEventListener("click",()=>{accSlot=b.dataset.slot;$("shopScroll").scrollTop=0;renderShop();startPreviews();}));
    const profPanels=[$("prof-ach"),$("prof-stats")];
    bindTabs($("profileTabs"),tab=>{const id=tab.getAttribute("aria-controls");profPanels.forEach(p=>{p.hidden=p.id!==id;});$("profileScroll").scrollTop=0;});
    $("replayTutorial").addEventListener("click",()=>{DR.Storage.update({tutorialDone:false});DR.Audio.click();DR.UI.toast({kind:"tutorial",title:"Öğretici hazır",text:"Bir sonraki koşuda Riko sana adım adım gösterecek."});});
    $("shopConfirmOk").addEventListener("click",confirmBuy);
    $("shopConfirmCancel").addEventListener("click",closeConfirm);
    bindSettings();
    syncSettings();
  }
  DR.Panels={init,open,close,handleEscape,syncSettings,fmtTime};
})(window);
