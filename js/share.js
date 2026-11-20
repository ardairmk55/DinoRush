(function(w){
  "use strict";
  /*
   * Skor paylaşım kartı: 1200x630 görsel cihazda Canvas ile çizilir (sunucu yok).
   * Destekleyen cihazlarda sistemin paylaş menüsü (Web Share API) açılır; desteklemeyenlerde görsel indirilir.
   * file:// altında tarayıcı görsel dışa aktarmayı engelleyebilir; o durumda yalnız metin paylaşılır.
   */
  const DR=w.DinoRush,doc=w.document,W=1200,H=630;
  const GAME_URL="https://ardairmk55.github.io/DinoRush/";
  const fmt=n=>Math.max(0,Math.floor(n||0)).toLocaleString("tr-TR");
  function cover(ctx,img,x,y,wid,hei){if(!img)return;const s=Math.max(wid/img.width,hei/img.height),iw=img.width*s,ih=img.height*s;ctx.drawImage(img,x+(wid-iw)/2,y+(hei-ih)/2,iw,ih);}
  function text(ctx,str,x,y,size,color,align,weight){ctx.font=(weight||900)+" "+size+"px system-ui, 'Segoe UI', sans-serif";ctx.textAlign=align||"left";ctx.lineJoin="round";ctx.lineWidth=Math.max(4,size/7);ctx.strokeStyle="#140b05";ctx.strokeText(str,x,y);ctx.fillStyle=color;ctx.fillText(str,x,y);}
  function plaque(ctx,x,y,wid,hei,label,value,accent){
    ctx.fillStyle="rgba(20,12,6,.78)";ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,wid,hei,14);else ctx.rect(x,y,wid,hei);ctx.fill();ctx.stroke();
    text(ctx,label,x+24,y+40,24,"#e9c98a");text(ctx,value,x+24,y+hei-26,58,accent);
  }
  /** Kartı çizer ve tuvali döndürür. */
  function draw(result){
    const cv=doc.createElement("canvas");cv.width=W;cv.height=H;const ctx=cv.getContext("2d");ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#0e2a30";ctx.fillRect(0,0,W,H);
    cover(ctx,DR.Assets.get("bgFar"),0,0,W,H);
    const g=DR.Assets.get("ground");if(g)for(let x=0;x<W;x+=g.width*4)ctx.drawImage(g,x,H-g.height*4+40,g.width*4,g.height*4);
    const shade=ctx.createLinearGradient(0,0,W,0);shade.addColorStop(0,"rgba(7,22,28,.88)");shade.addColorStop(.62,"rgba(7,22,28,.55)");shade.addColorStop(1,"rgba(7,22,28,.1)");ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
    DR.Scene.applyGrade(ctx,null,0,0,W,H);
    const logo=doc.querySelector(".logo-art");if(logo&&logo.complete&&logo.naturalWidth){ctx.imageSmoothingEnabled=true;const lw=360,lh=lw*logo.naturalHeight/logo.naturalWidth;ctx.drawImage(logo,48,34,lw,lh);ctx.imageSmoothingEnabled=false;}
    const s=DR.Storage.get(),cfg=DR.Config.dinoSprite,scale=8,sheet=DR.Scene.sheetFor(s.selected),rx=W-cfg.frameWidth*scale-40,ry=H-cfg.frameHeight*scale-60;
    if(sheet){ctx.drawImage(sheet,0,cfg.animations.idle.row*cfg.frameHeight,cfg.frameWidth,cfg.frameHeight,rx,ry,cfg.frameWidth*scale,cfg.frameHeight*scale);if(DR.AccessoryArt)DR.AccessoryArt.draw(ctx,cfg.animations.idle.row,0,rx,ry,scale,s.accessories);}
    const r=result||{score:s.best,best:s.best,fossils:0};
    text(ctx,r.record?"YENİ REKOR!":"KOŞU SONUCU",56,250,40,r.record?"#ffd36b":"#cfe9e2");
    plaque(ctx,56,280,330,150,"SKOR",fmt(r.score),"#ffd36b");
    plaque(ctx,404,280,240,150,"REKOR",fmt(r.best),"#9fd56f");
    plaque(ctx,56,450,330,120,"FOSİL",fmt(r.breakdown?r.breakdown.total:r.fossils),"#f19a1d");
    text(ctx,"Beni geçebilir misin?",410,500,30,"#fff1cf");
    text(ctx,GAME_URL.replace("https://",""),410,546,24,"#9fe0d4",null,700);
    return cv;
  }
  function blobOf(cv){return new Promise((ok,fail)=>{try{cv.toBlob(b=>b?ok(b):fail(new Error("boş")),"image/png");}catch(e){fail(e);}});}
  function message(r){return "DinoRush'ta "+fmt(r?r.score:0)+" puan yaptım! Beni geçebilir misin?";}
  async function share(result){
    const say=t=>DR.UI.toast({kind:"info",title:"Paylaş",text:t});
    let blob=null;
    try{blob=await blobOf(draw(result));}catch(_){blob=null;}
    const text=message(result),url=w.location.protocol.startsWith("http")?w.location.href.split("#")[0].split("?")[0]:GAME_URL;
    try{
      if(blob&&w.File&&navigator.canShare){const file=new File([blob],"dinorush-skor.png",{type:"image/png"});if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"DinoRush",text});return "shared-image";}}
      if(navigator.share){await navigator.share({title:"DinoRush",text,url});return "shared-text";}
    }catch(e){if(e&&e.name==="AbortError")return "cancelled";}
    if(blob){const a=doc.createElement("a"),href=URL.createObjectURL(blob);a.href=href;a.download="dinorush-skor.png";doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);say("Skor görseli indirildi.");return "downloaded";}
    try{await navigator.clipboard.writeText(text+" "+url);say("Paylaşım metni panoya kopyalandı.");return "copied";}catch(_){say("Bu tarayıcı paylaşımı desteklemiyor.");return "unsupported";}
  }
  DR.Share={draw,share,message};
})(window);
