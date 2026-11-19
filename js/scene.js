(function(w){
  "use strict";
  const DR=w.DinoRush,C=DR.Config,scene={canvas:null,ctx:null,scale:1,dpr:1,quality:1,slowFrames:0,fastFrames:0,width:640,height:360,ground:246,cache:null,cacheCtx:null,cacheDirty:true,elapsed:0,fireflies:[],lastWidth:0,lastHeight:0,reducedMotion:false,shakeX:0,shakeY:0};
  // Zemin yüksekliği. Dikey ekranda oyun sırasında zemin yukarı alınır (başparmak dinoyu kapatmasın);
  // altında dokunma düğmeleri için en az portraitTouchReserve CSS pikseli kalır. Menüde ve yatayda değişmez.
  function groundFor(){
    if(!(scene.portrait&&scene.farPlay))return scene.height*C.viewport.groundRatio;
    return Math.min(scene.height*C.viewport.portraitGroundRatio,scene.height-C.viewport.portraitTouchReserve/scene.scale);
  }
  function resize(){
    if(!scene.canvas)return;
    const box=scene.canvas.getBoundingClientRect(),cssW=Math.max(1,box.width),cssH=Math.max(1,box.height);
    const low=DR.Storage.get().lowEffects,device=Number(navigator.deviceMemory)||8;
    // Dokunmatik cihazlarda tuval yoğunluğu 2x ile sınırlı: 3x telefonda boyanan piksel ~%55 azalır, görsel fark yok denecek kadar az.
    let coarse=false;try{coarse=!!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches);}catch(_){}
    const cap=device<4?1.75:(coarse?C.viewport.dprMaxTouch:C.viewport.dprMax);
    scene.dpr=Math.max(1,Math.min(cap,window.devicePixelRatio||1,low?2:C.viewport.dprMax)*scene.quality);
    // Dikey ekran: görünür dünya daha dar (yakınlaştırma) ve çizimde kamera sola kayar.
    // Yalnız görüntüdür; fizik, çarpışma ve engel aralıkları aynı kalır. Engeller görünür kenarın dışında doğar.
    scene.portrait=cssH>cssW*1.05;scene.shift=scene.portrait?C.viewport.portraitShift:0;
    scene.scale=Math.min(cssW/(scene.portrait?C.viewport.portraitWidth:C.viewport.minWidth),cssH/C.viewport.baseHeight);
    scene.width=cssW/scene.scale;scene.height=cssH/scene.scale;scene.ground=groundFor();
    const pw=Math.round(cssW*scene.dpr),ph=Math.round(cssH*scene.dpr);
    if(scene.canvas.width!==pw||scene.canvas.height!==ph){scene.canvas.width=pw;scene.canvas.height=ph;}
    scene.ctx=scene.canvas.getContext("2d",{alpha:false,desynchronized:true});scene.ctx.setTransform(scene.dpr*scene.scale,0,0,scene.dpr*scene.scale,0,0);scene.ctx.imageSmoothingEnabled=false;
    scene.cacheDirty=true;scene.lastWidth=cssW;scene.lastHeight=cssH;
    if(DR.Game&&DR.Game.onResize)DR.Game.onResize(scene.width,scene.height,scene.ground);
  }
  function prepare(canvas){scene.canvas=canvas;scene.ctx=canvas.getContext("2d",{alpha:false,desynchronized:true});const motion=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null;scene.reducedMotion=!!(motion&&motion.matches);if(motion){const onMotion=()=>{scene.reducedMotion=motion.matches;};if(motion.addEventListener)motion.addEventListener("change",onMotion);else if(motion.addListener)motion.addListener(onMotion);}resize();const ro=new ResizeObserver(resize);ro.observe(canvas);window.addEventListener("resize",resize,{passive:true});window.addEventListener("orientationchange",()=>setTimeout(resize,100),{passive:true});if(window.visualViewport)window.visualViewport.addEventListener("resize",resize,{passive:true});return scene;}
  function reportFrameTime(seconds){if(!scene.canvas)return;if(seconds>.04){scene.slowFrames++;scene.fastFrames=0;if(scene.slowFrames>=12&&scene.quality>.55){scene.quality=Math.max(.55,scene.quality-.15);scene.slowFrames=0;resize();}}else if(seconds<.022){scene.fastFrames++;scene.slowFrames=0;if(scene.fastFrames>=180&&scene.quality<1){scene.quality=Math.min(1,scene.quality+.1);scene.fastFrames=0;resize();}}else{scene.slowFrames=Math.max(0,scene.slowFrames-1);scene.fastFrames=0;}}
  function rnd(i){const x=Math.sin(i*127.1+41.7)*43758.5453;return x-Math.floor(x);}
  function buildCache(){
    const cw=Math.max(1,Math.ceil(scene.width)),ch=Math.max(1,Math.ceil(scene.height));
    if(!scene.cache)scene.cache=document.createElement("canvas");scene.cache.width=cw;scene.cache.height=ch;scene.cacheCtx=scene.cache.getContext("2d");scene.cacheCtx.imageSmoothingEnabled=false;
    const c=scene.cacheCtx,wid=scene.width,hei=scene.height,ground=scene.ground;
    const grad=c.createLinearGradient(0,0,0,hei);grad.addColorStop(0,"#07161c");grad.addColorStop(.43,"#0e2a30");grad.addColorStop(.77,"#1a3e42");grad.addColorStop(1,"#233b2c");c.fillStyle=grad;c.fillRect(0,0,wid,hei);
    const farArt=DR.Assets.get("bgFar"),farH=farArt?wid*farArt.height/farArt.width:0;
    // Dikey ekranda oyun sırasında uzak sahne çitin hemen arkasına iner (ortadaki boş şerit kalkar).
    scene.farY=scene.portrait&&scene.farPlay&&farArt?Math.max(0,Math.round(ground-110-farH*.8)):0;
    // Distant teal moon and soft halo.
    const mx=wid*.76,my=scene.farY?-999:Math.min(hei*.22,ground*.45),mr=Math.max(22,Math.min(43,wid*.067));
    const halo=c.createRadialGradient(mx,my,mr*.55,mx,my,mr*2.5);halo.addColorStop(0,"#7fffe84c");halo.addColorStop(1,"#7fffe800");c.fillStyle=halo;c.fillRect(mx-mr*3,my-mr*3,mr*6,mr*6);
    c.fillStyle="#8fffe7";c.beginPath();c.arc(mx,my,mr,0,Math.PI*2);c.fill();c.fillStyle="#bcfff0";c.beginPath();c.arc(mx-mr*.13,my-mr*.12,mr*.83,0,Math.PI*2);c.fill();
    c.fillStyle="#5bb5aa";for(let i=0;i<13;i++){const x=mx+(rnd(i+8)-.5)*mr*1.4,y=my+(rnd(i+18)-.5)*mr*1.4,r=1+rnd(i+3)*4;c.globalAlpha=.2;c.fillRect(x,y,r,r);}c.globalAlpha=1;
    for(let i=0;i<Math.max(45,wid*.11);i++){const x=rnd(i+1)*wid,y=rnd(i+101)*Math.min(ground*.72,hei*.44),size=rnd(i+303)>.87?2.2:1.2;c.globalAlpha=.3+rnd(i+77)*.65;c.fillStyle=i%8===0?"#a8fff2":"#d5edcd";c.fillRect(Math.round(x),Math.round(y),size,size);}c.globalAlpha=1;
    // Foggy ridges.
    if(!scene.farY)for(let layer=0;layer<4;layer++){
      c.fillStyle=["#12353b","#13363a","#15352f","#17382c"][layer];c.beginPath();c.moveTo(0,hei);
      for(let x=-20;x<=wid+40;x+=24){const y=ground*(.37+layer*.105)-Math.sin(x*.023+layer*2)*ground*(.04+layer*.006);c.lineTo(x,y);c.lineTo(x+12,y-8-rnd(x+layer*9)*15);}
      c.lineTo(wid,hei);c.closePath();c.fill();
    }
    // Art replaces the generated distant scene when available; the old scenery remains as a fallback and as an extension below portrait crops.
    const far=DR.Assets.get("bgFar");if(far){c.save();c.imageSmoothingEnabled=false;c.drawImage(far,0,0,far.width,far.height,0,scene.farY,wid,farH);
      if(scene.farY){const fade=c.createLinearGradient(0,scene.farY,0,scene.farY+farH*.38);fade.addColorStop(0,"#0b2329");fade.addColorStop(1,"rgba(11,35,41,0)");c.fillStyle=fade;c.fillRect(0,scene.farY-1,wid,farH*.38+1);}
      c.restore();}
    else{drawSilhouette(c,wid*.27,ground*.56,.78,"#102a2d",true);drawSilhouette(c,wid*.73,ground*.61,.53,"#102628",false);}
    scene.cacheDirty=false;
  }
  function drawSilhouette(c,x,y,s,color,longNeck){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle=color;
    c.fillRect(0,19,59,23);c.fillRect(43,12,17,17);c.fillRect(55,8,22,9);c.fillRect(75,11,7,3);c.fillRect(14,38,9,27);c.fillRect(43,38,9,27);c.fillRect(5,29,18,5);c.fillRect(-20,19,27,6);
    if(longNeck){c.fillRect(8,1,9,29);c.fillRect(13,-8,24,13);c.fillRect(32,-7,7,8);}else{c.fillRect(48,5,9,18);c.fillRect(53,1,17,8);c.fillRect(67,5,10,7);}
    c.restore();}
  function px(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
  function drawTower(ctx,x,ground,t){if(x<-100||x>scene.width+40)return;const s=Math.max(.8,Math.min(1.18,scene.width/640));ctx.save();ctx.translate(x,ground);ctx.scale(s,s);
    px(ctx,8,-99,6,97,"#3b3429");px(ctx,56,-99,6,97,"#332e27");px(ctx,3,-104,65,7,"#68533b");px(ctx,0,-149,72,43,"#4b4033");px(ctx,-4,-154,80,7,"#806443");px(ctx,5,-143,62,34,"#2a2924");
    const pulse=.7+.25*Math.sin(t*4+x);ctx.globalAlpha=pulse;px(ctx,12,-135,18,21,"#ffb24a");px(ctx,37,-135,22,21,"#fb9a32");px(ctx,15,-131,12,14,"#ffe28d");px(ctx,40,-131,16,14,"#ffd36b");ctx.globalAlpha=1;
    px(ctx,29,-169,3,13,"#857d66");px(ctx,31,-171,17,2,"#c8c6a3");px(ctx,39,-169,2,9,"#bcb498");
    for(let i=0;i<5;i++){px(ctx,13+i*9,-99+i*16,4,4,"#82684a");px(ctx,53-i*8,-89+i*16,4,4,"#82684a");}
    ctx.restore();}
  function drawDome(ctx,x,ground,t){if(x<-170||x>scene.width+170)return;ctx.save();ctx.translate(x,ground);ctx.strokeStyle="#475148";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-72,0);ctx.arc(0,0,72,Math.PI,0);ctx.stroke();ctx.lineWidth=2;for(let a=Math.PI;a<=Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*72,Math.sin(a)*72);ctx.stroke();}ctx.beginPath();ctx.moveTo(-52,-50);ctx.lineTo(52,-50);ctx.moveTo(-68,-25);ctx.lineTo(68,-25);ctx.stroke();const pulse=.35+.22*Math.sin(t*8);ctx.fillStyle="rgba(255,114,33,"+pulse+")";ctx.beginPath();ctx.ellipse(22,-38,31,20,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawTree(ctx,x,ground,height,phase){if(x<-70||x>scene.width+70)return;const top=ground-height;px(ctx,x-2,top+17,5,height-17,"#10251e");px(ctx,x-16,top+12,24,9,"#123027");px(ctx,x-10,top+3,23,11,"#16372b");px(ctx,x+5,top+8,21,10,"#19402f");px(ctx,x+13,top+19,16,8,"#173b2c");if(phase%4===0){px(ctx,x-19,top+17,8,5,"#1a452e");px(ctx,x+25,top+10,7,5,"#1c4931");}}
  function drawFence(ctx,ground,camera,t){const start=-(camera*.84%118);for(let x=start;x<scene.width+118;x+=118){px(ctx,x,ground-63,5,65,"#332f28");px(ctx,x-3,ground-62,11,4,"#857255");px(ctx,x-3,ground-42,11,4,"#77664d");px(ctx,x-2,ground-60,9,2,"#35a8b4");px(ctx,x-2,ground-40,9,2,"#2a9cae");if(Math.sin(t*15+x*.2)>.77){ctx.strokeStyle="#99fff8";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+4,ground-52);ctx.lineTo(x+15,ground-57);ctx.lineTo(x+10,ground-47);ctx.lineTo(x+20,ground-51);ctx.stroke();}}}
  function drawSign(ctx,x,ground){if(x<-65||x>scene.width+30)return;px(ctx,x+3,ground-74,5,53,"#4c4031");px(ctx,x,ground-83,54,30,"#624e37");px(ctx,x+3,ground-80,48,24,"#e7c873");px(ctx,x+8,ground-76,4,15,"#24251f");px(ctx,x+14,ground-75,3,18,"#24251f");px(ctx,x+19,ground-72,3,17,"#24251f");px(ctx,x+24,ground-75,4,19,"#24251f");px(ctx,x+32,ground-77,12,3,"#ad4b2b");}
  function drawGround(ctx,ground,camera,width){
    px(ctx,0,ground,width,scene.height-ground,"#2c352a");px(ctx,0,ground,width,5,"#7d9941");px(ctx,0,ground+5,width,5,"#4f7a2a");px(ctx,0,ground+10,width,4,"#182722");
    const drift=camera%82;for(let x=-drift-82;x<width+82;x+=82){px(ctx,x+8,ground+17,34,3,"#3b4931");px(ctx,x+48,ground+27,19,4,"#202d28");px(ctx,x+18,ground+38,15,3,"#59613b");px(ctx,x+51,ground+49,25,3,"#1a2724");px(ctx,x+5,ground+4,19,2,"#bdd35a");px(ctx,x+42,ground+5,15,2,"#8daf45");
      // layered stone wall faces
      px(ctx,x+5,ground+70,24,14,"#252b2b");px(ctx,x+29,ground+63,27,19,"#38413a");px(ctx,x+57,ground+71,20,13,"#2a3330");px(ctx,x+16,ground+87,19,10,"#182421");px(ctx,x+48,ground+86,28,11,"#192624");px(ctx,x+21,ground+69,3,3,"#88914b");px(ctx,x+60,ground+76,3,3,"#788848");}
    for(let i=0;i<18;i++){const x=(i*63-camera*.32%(width+63)+width+63)%(width+63);px(ctx,x,ground-3,2+i%3,4,"#b6c65c");}
  }
  function drawFern(ctx,x,y,s,flip){ctx.save();ctx.translate(x,y);ctx.scale(flip?-s:s,s);ctx.strokeStyle="#101e1a";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(3,-25,20,-48);ctx.stroke();for(let i=0;i<7;i++){const yy=-7-i*6,xx=2+i*2;ctx.fillStyle=i%2?"#122b22":"#183528";ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx-13,yy-7);ctx.lineTo(xx-7,yy+2);ctx.lineTo(xx+2,yy+2);ctx.fill();ctx.beginPath();ctx.moveTo(xx+2,yy-2);ctx.lineTo(xx+13,yy-10);ctx.lineTo(xx+9,yy);ctx.lineTo(xx+1,yy+1);ctx.fill();}ctx.restore();}
  function drawArtTile(ctx,image,y,camera,width,scale,parallax,alpha,heightScale){if(!image)return;const tileW=image.width*scale,tileH=image.height*scale*(heightScale||1),drift=(camera*parallax)%tileW;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha===undefined?1:alpha;for(let x=-drift-tileW;x<width+tileW;x+=tileW)ctx.drawImage(image,Math.round(x),Math.round(y),tileW,tileH);ctx.restore();}
  function sceneDef(id){const list=C.cosmetics.scenes;return list.find(s=>s.id===(id||DR.Storage.get().selectedScene))||list[0];}
  // Renk derecelendirme: multiply ile ton, screen degrade ile ışık. Piksel okuması yapılmaz.
  function applyGrade(ctx,id,x,y,w,h){const grade=sceneDef(id).grade;if(!grade)return;ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation="multiply";ctx.fillStyle=grade.multiply;ctx.fillRect(x,y,w,h);ctx.globalCompositeOperation="screen";const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,grade.top);g.addColorStop(1,grade.bottom);ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore();}
  function sheetFor(id){return DR.Assets.get("dinoSheet_"+(id||DR.Storage.get().selected))||DR.Assets.get("dinoSheet");}
  // Menüde çit katmanı sabit durur; tabela düğme yığınının arkasında (ekran ortası) kalır.
  const MID_SIGN_CENTER=372;
  function midCamera(menu,parallax){return menu?(MID_SIGN_CENTER-scene.width/2)/.25:parallax;}
  function lowMotion(){return DR.Storage.get().lowEffects||scene.reducedMotion||scene.quality<=.65;}
  function drawFarEffects(ctx,t,score){
    const wid=scene.width,unit=wid/320,quiet=lowMotion(),pulse=quiet ? .24 : (.31+.12*Math.sin(t*.45));
    if(!quiet){ctx.save();ctx.globalCompositeOperation="lighter";const fy=scene.farY||0,mx=wid*.808,my=wid*.087+fy,r=wid*.075,halo=ctx.createRadialGradient(mx,my,r*.42,mx,my,r*2.4);halo.addColorStop(0,"rgba(79,195,176,"+pulse+")");halo.addColorStop(.55,"rgba(46,126,120,.11)");halo.addColorStop(1,"rgba(46,126,120,0)");ctx.fillStyle=halo;ctx.fillRect(mx-r*2.5,my-r*2.5,r*5,r*5);
      const windowPulse=.45+.3*Math.sin(t*2.8);ctx.globalCompositeOperation="source-over";ctx.globalAlpha=windowPulse;for(const x of [.072,.102,.137,.16])px(ctx,wid*x,wid*.269+fy,7*unit,4*unit,"#ffb020");ctx.globalAlpha=1;
      const dx=wid*.914,dy=Math.min(scene.ground-14,wid*.385+fy),dr=wid*.047,g=ctx.createRadialGradient(dx,dy,2*unit,dx,dy,dr*2.2);g.addColorStop(0,"rgba(255,138,31,.42)");g.addColorStop(.45,"rgba(255,138,31,.17)");g.addColorStop(1,"rgba(255,138,31,0)");ctx.globalCompositeOperation="lighter";ctx.fillStyle=g;ctx.fillRect(dx-dr*2.2,dy-dr*2.2,dr*4.4,dr*4.4);ctx.globalCompositeOperation="source-over";
      for(let i=0;i<4;i++){const cycle=(t*5+i*1.7)%5,sy=dy-cycle*4*unit;ctx.globalAlpha=Math.max(0,.7-cycle/5);px(ctx,dx+(i%2?1:-1)*i*3*unit,sy,2*unit,2*unit,i%2?"#ffb020":"#ffd36b");}ctx.globalAlpha=1;
      for(let i=0;i<12;i++){const x=(rnd(i+45)*wid+t*(i%2?1.5:-1.1)+wid*2)%wid,y=rnd(i+98)*Math.min(scene.ground*.48,scene.height*.36),a=.16+.42*(.5+.5*Math.sin(t*1.7+i*2.1));ctx.globalAlpha=a;px(ctx,x,y,(i%4===0?2:1)*unit,(i%4===0?2:1)*unit,"#7fffe8");}ctx.globalAlpha=1;ctx.restore();
    }
    const mood=Math.max(0,Math.min(1,(score||0)/6200)),tone=mood*(quiet?.018:.055);if(tone>0){ctx.fillStyle="rgba(255,138,31,"+tone+")";ctx.fillRect(0,0,wid,scene.height);}
  }
  function drawFogBand(ctx,t,camera,score,band){if(lowMotion())return;const wid=scene.width,density=.045+Math.min(.035,(score||0)/120000),direction=band===0?1:-1,baseY=scene.ground*(band===0?.48:.68),phase=t*direction*9+camera*(band===0?.025:-.018);ctx.save();for(let i=-2;i<Math.ceil(wid/74)+2;i++){const x=((i*74+phase)%(wid+100)+wid+100)%(wid+100)-50,y=baseY+Math.sin(i*1.7+t*.25)*9;ctx.globalAlpha=density*(.65+.35*Math.sin(i*3+t*.5));px(ctx,x,y,24+(i%3+3)%3*12,3+(i%2+2)%2*2,sceneDef().fog[band===0?0:1]);}ctx.restore();}
  function drawFenceSparks(ctx,t,camera){if(lowMotion())return;const width=scene.width,tileW=640,drift=(camera*.25)%tileW,start=-drift-tileW,frame=Math.floor(t*60);for(let tile=0,x=start;x<width+tileW;x+=tileW,tile++){if((frame+tile*37)%210<2){const sx=x+(76+(tile*41)%430),sy=scene.ground-184+C.viewport.midSink+(tile%2)*22;px(ctx,sx,sy,4,2,"#5fd0ff");px(ctx,sx+5,sy-2,2,3,"#7fffe8");}}}
  function drawGroundArt(ctx,ground,camera,width){const image=DR.Assets.get("ground");if(!image){drawGround(ctx,ground,camera,width);return;}const scale=C.artAssets.pixelWorld,tileW=image.width*scale,tileH=image.height*scale,drift=camera%tileW,start=-drift-tileW;ctx.save();ctx.imageSmoothingEnabled=false;for(let x=start;x<width+tileW;x+=tileW){ctx.drawImage(image,Math.round(x),ground,tileW,tileH);for(let y=ground+tileH;y<scene.height;y+=80)ctx.drawImage(image,0,8,image.width,40,Math.round(x),y,tileW,80);}ctx.restore();}
  function drawBackground(t,camera,menu,score){
    if(scene.cacheDirty)buildCache();const c=scene.ctx,wid=scene.width,hei=scene.height,ground=scene.ground,parallax=menu?t*18:camera,far=DR.Assets.get("bgFar"),mid=DR.Assets.get("bgMid");
    const scale=scene.dpr*scene.scale;c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;c.clearRect(0,0,scene.canvas.width,scene.canvas.height);c.setTransform(scale,0,0,scale,scene.shakeX*scale,scene.shakeY*scale);c.drawImage(scene.cache,-3,-3,wid+6,hei+6);
    if(!DR.Storage.get().lowEffects&&!scene.reducedMotion&&scene.quality>.75){for(let i=0;i<12;i++){const x=(i*113-parallax*.11%(wid+20)+wid+20)%(wid+20),y=(i*71+t*3)%(ground*.8);c.globalAlpha=.2+.4*Math.sin(t*1.5+i);px(c,x,y,2,2,i%2?"#9ee268":"#7fffe8");}c.globalAlpha=1;}
    if(!far){const treeDrift=menu?0:camera*.46%112;for(let i=-1;i<wid/112+3;i++){const phase=i+Math.floor(camera*.46/112),x=i*112-treeDrift,height=ground*(.22+((phase*29+101)%23)/100);drawTree(c,x,ground,height,phase);}const towerOffset=menu?wid*.13:-(camera*.21%Math.max(1,wid*.8));drawTower(c,towerOffset,ground,t);drawDome(c,menu?wid*.84:wid+140-(camera*.13%Math.max(1,wid+310)),ground,t);}else drawFarEffects(c,t,score);
    drawFogBand(c,t,parallax,score,0);
    if(mid)drawArtTile(c,mid,ground-mid.height*C.artAssets.pixelWorld+C.viewport.midSink,midCamera(menu,parallax),wid,C.artAssets.pixelWorld,.25,1);else{drawFence(c,ground,parallax,t);drawSign(c,menu?wid*.66:wid+80-(camera*.64%Math.max(1,wid+140)),ground);}
    drawFogBand(c,t,parallax,score,1);if(mid)drawFenceSparks(c,t,midCamera(menu,parallax));
    if(!mid&&!far){drawFern(c,0,hei,Math.min(1.25,hei/390),false);drawFern(c,wid,hei,Math.min(1.3,hei/375),true);}
    drawGroundArt(c,ground,parallax,wid);
  }
  const mask=["....RRRR.........","...RRRRRR........","...RRRGGGG.......","....GGGGGGGGG....","....GGGGGGGGGGG..","...GGGGGGGGGGGKK.","...GGGGGGGGGGGGG..","..GGGGGGGGGGGG....",".GGGGGGGGGGG......","GGGGGGGGGG........","...GG..GG.........","...GG..GG........."];
  function drawDinoProcedural(x,feet,t,pose,skinId,menu){const c=scene.ctx,skin=C.skins.find(s=>s.id===skinId)||C.skins[0],cell=4.2,body=skin.body,dark=skin.dark,spine=skin.spine;let sx=1,sy=1;
    if(pose==="prep"){sx=1.1;sy=.82;}else if(pose==="rise"){sx=.88;sy=1.12;}else if(pose==="fall"){sx=1.05;sy=.94;}else if(pose==="dead"){sx=1.08;sy=.75;}
    const bob=menu?Math.sin(t*2.1)*1.3:(pose==="run"?Math.sin(t*17)*1.8:0);c.save();c.translate(Math.round(x),Math.round(feet+bob));c.scale(sx,sy);
    // grounded shadow shrinks and fades during jumps
    const shadow=Math.max(.18,1-Math.max(0,scene.ground-feet)/145);c.globalAlpha=.2*shadow;c.fillStyle="#07161c";c.beginPath();c.ellipse(27,1,26*shadow,4*shadow,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    if(pose==="crouch"){px(c,0,-25,22,9,dark);px(c,12,-34,30,21,body);px(c,34,-38,16,20,body);px(c,42,-34,12,6,"#f0e4ae");px(c,42,-35,4,4,"#14221c");px(c,19,-14,9,7,spine);px(c,28,-14,9,7,spine);px(c,15,-10,14,8,dark);px(c,34,-13,14,8,dark);c.restore();return;}
    const h=mask.length*cell;for(let ry=0;ry<mask.length;ry++)for(let rx=0;rx<mask[ry].length;rx++){const ch=mask[ry][rx];if(ch===".")continue;let color=body;if(ch==="R")color=spine;if(ch==="K")color="#17241e";if(ry>7&&rx<4)color=dark;px(c,rx*cell,-h+ry*cell,cell,cell,color);}
    // Belly plate, nostril, eye glint, tail and animated six-pose feet.
    px(c,34,-22,10,18,"#f1e3a6");px(c,55,-43,5,5,"#fff8d7");px(c,57,-43,2,2,"#ffffff");px(c,66,-36,3,2,"#28321f");px(c,14,-h+27+Math.sin(t*(menu?2:15))*1.5,15,5,dark);px(c,7,-h+28+Math.sin(t*(menu?2:15))*1.5,10,4,body);
    const frame=menu?Math.floor(t*3)%6:Math.floor(t*15)%6;
    const offsets=[[-4,1],[0,4],[4,1],[4,-1],[0,-3],[-4,-1]][frame];
    px(c,22,-11+offsets[0],7,10,dark);px(c,43,-11+offsets[1],7,10,dark);px(c,19+offsets[0],-3,12,3,body);px(c,40+offsets[1],-3,13,3,body);
    c.restore();}
  function drawDino(x,feet,t,pose,skinId,menu,player,mode,deathElapsed,deathStartY,animOverride){
    const c=scene.ctx,cfg=C.dinoSprite,sheet=sheetFor(skinId);
    if(!sheet){drawDinoProcedural(x,feet,t,pose,skinId,menu);return;}
    let animation="run",frame=0,drawX=x,drawFeet=feet,angle=0;
    if(mode==="menu"||mode==="countdown")animation=animOverride&&cfg.animations[animOverride]?animOverride:"idle";
    else if(mode==="game_over")animation="dead";
    else if(player&&(player.pose==="rise"||player.pose==="fall"||player.y<scene.ground-1)){
      animation="jump";const threshold=Math.abs(C.physics.jumpVelocity)*.25;
      frame=player.vy<=-threshold?0:Math.abs(player.vy)<threshold?1:2;
    }else if(player&&(player.duck||player.pose==="crouch"))animation="duck";
    const spec=cfg.animations[animation];
    if(animation==="idle")frame=Math.floor(t*spec.fps)%spec.frames;
    else if(animation==="run"){
      const game=DR.Game&&DR.Game.model,speed=Math.min(C.physics.maxSpeed,C.physics.runSpeed+(game?game.score:0)*C.physics.speedGain);
      const ratio=Math.max(0,Math.min(1,(speed-C.physics.runSpeed)/(C.physics.maxSpeed-C.physics.runSpeed)));
      frame=Math.floor(t*(spec.fps+6*ratio))%spec.frames;
    }else if(animation==="duck")frame=Math.floor(t*spec.fps)%spec.frames;
    else if(animation==="dead"){
      const dt=Math.max(0,deathElapsed||0),fall=Math.max(0,Math.min(1,(dt-.15)/.55)),ease=fall*fall*(3-2*fall);
      frame=dt<.15?0:1;drawX=x-12*ease;angle=-80*Math.PI/180*ease;
      const startY=Number.isFinite(deathStartY)?deathStartY:scene.ground,settle=Math.max(0,Math.min(1,dt/.45));
      drawFeet=startY+(scene.ground-startY)*(settle*settle*(3-2*settle))-12*Math.sin(Math.PI*settle);
    }
    const pixelScale=scene.scale*scene.dpr,menuScale=menu?1.25:1,devicePx=Math.max(1,Math.round(cfg.worldPixel*pixelScale*menuScale));
    const shadow=Math.max(.18,1-Math.max(0,scene.ground-drawFeet)/145);
    c.save();c.globalAlpha=.2*shadow;c.fillStyle="#07161c";c.beginPath();c.ellipse(Math.round(drawX+cfg.frameWidth*cfg.worldPixel*menuScale/2),scene.ground+1,22*shadow*menuScale,4*shadow,0,0,Math.PI*2);c.fill();c.restore();
    const originX=Math.round((drawX-(menu?0:scene.shift||0))*pixelScale),footY=Math.round(drawFeet*pixelScale),pivotX=originX+22*devicePx;
    c.save();c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;c.translate(pivotX+scene.shakeX*pixelScale,footY+scene.shakeY*pixelScale);if(angle)c.rotate(angle);
    c.drawImage(sheet,frame*cfg.frameWidth,spec.row*cfg.frameHeight,cfg.frameWidth,cfg.frameHeight,-22*devicePx,-(cfg.footRow+1)*devicePx,cfg.frameWidth*devicePx,cfg.frameHeight*devicePx);c.restore();
  }
  function drawPlayerHitbox(player){
    if(!DR.Game.model.debugHitbox)return;const box=DR.Game.getPlayerBox();if(!box)return;const c=scene.ctx;
    c.save();c.fillStyle="rgba(255,55,45,.28)";c.strokeStyle="#ff554b";c.lineWidth=1.5;c.fillRect(box.x,box.y,box.w,box.h);c.strokeRect(Math.round(box.x)+.5,Math.round(box.y)+.5,Math.round(box.w),Math.round(box.h));c.fillStyle="#fff2d5";c.font="700 9px system-ui";c.textAlign="left";c.fillText("DİNO",box.x,box.y-4);c.restore();
  }
  function drawFossilProcedural(x,y,t,pulse){const c=scene.ctx,r=7+Math.sin(t*6)*.8+(pulse||0);c.save();c.translate(Math.round(x),Math.round(y));c.fillStyle="#ffb020";c.strokeStyle="#ffd36b";c.lineWidth=1.5;c.beginPath();c.moveTo(0,-r);c.lineTo(r*.75,-r*.35);c.lineTo(r,.55*r);c.lineTo(.25*r,r);c.lineTo(-r*.7,.68*r);c.lineTo(-r,-.12*r);c.closePath();c.fill();c.stroke();c.fillStyle="#7a3b0a";c.fillRect(-1,-r*.52,2,r*1.02);c.fillRect(-r*.45,-1,r*.9,2);c.restore();}
  function drawFossil(x,y,t,pulse,phase,size){size=size||36;const half=size/2,k=size/36,c=scene.ctx,low=lowMotion(),bob=Math.sin(t*3+(phase||0))*1.6+((pulse||0)*.5),name=Math.floor(Math.abs(phase||0))%2?"fossilFern":"fossilAmmonite",img=DR.Assets.get(name)||DR.Assets.get("fossilAmmonite");
    if(!low){const r=(20+(pulse||0)*3)*k,g=c.createRadialGradient(x,y+bob,1,x,y+bob,r*2.1);g.addColorStop(0,"rgba(255,211,107,.38)");g.addColorStop(.5,"rgba(255,176,32,.15)");g.addColorStop(1,"rgba(255,176,32,0)");c.fillStyle=g;c.fillRect(x-r*2.1,y+bob-r*2.1,r*4.2,r*4.2);}
    if(img){c.save();c.imageSmoothingEnabled=false;c.drawImage(img,Math.round(x-half),Math.round(y+bob-half),size,size);c.restore();if(!low&&Math.floor(t*2+(phase||0))%5===0){c.globalAlpha=.9;px(c,x+13*k,y+bob-16*k,2*k,2*k,"#f4e6aa");c.globalAlpha=1;}}
    else drawFossilProcedural(x,y+bob,t,pulse);
  }
  function drawObstacle(o,t){const c=scene.ctx,x=o.x,y=o.y,key={log:"obsLog",rock:"obsRock",bush:"obsBush"}[o.type],img=key&&DR.Assets.get(key);if(o.type==="flyer"){drawBat(o,t);return;}if(img){c.save();c.imageSmoothingEnabled=false;c.drawImage(img,Math.round(x),Math.round(y),o.w,o.h);c.restore();return;}if(o.type==="log"){px(c,x,y+11,o.w,o.h-11,"#63472b");px(c,x+5,y+5,o.w-11,12,"#8e6038");px(c,x+14,y,o.w-28,9,"#ad7a44");px(c,x+o.w-17,y+8,13,13,"#d0a261");px(c,x+o.w-13,y+11,7,7,"#745034");px(c,x+10,y+13,16,3,"#4f7135");px(c,x+31,y+4,12,4,"#789143");}
    else if(o.type==="rock"){px(c,x+3,y+16,o.w-6,o.h-16,"#343b36");px(c,x+8,y+6,o.w-18,15,"#566057");px(c,x+17,y,o.w-31,11,"#75806d");px(c,x+12,y+9,9,3,"#92a073");px(c,x+18,y+o.h-4,15,3,"#6f8d3b");}
    else if(o.type==="bush"){px(c,x+5,y+14,o.w-8,o.h-14,"#29462b");px(c,x+1,y+6,16,16,"#396338");px(c,x+15,y,o.w-24,23,"#4d7b38");px(c,x+o.w-16,y+8,14,16,"#3e6b33");px(c,x+9,y+7,5,4,"#83a944");}}
  function drawObstacleHitboxes(obstacles){if(!DR.Game.model.debugHitbox)return;const c=scene.ctx;c.save();c.fillStyle="rgba(255,55,45,.2)";c.strokeStyle="#ff554b";c.lineWidth=1.2;for(const o of obstacles){const b=DR.Game.getObstacleBox(o);c.fillRect(b.x,b.y,b.w,b.h);c.strokeRect(Math.round(b.x)+.5,Math.round(b.y)+.5,Math.round(b.w),Math.round(b.h));}c.restore();}
  // Bir görselin tek renkli siluetini önbelleğe alır (piksel okuması yok: source-in birleştirme).
  const silCache=new Map();
  function silhouette(img,color){const key=img.src+color;let cv=silCache.get(key);if(cv)return cv;cv=document.createElement("canvas");cv.width=img.width;cv.height=img.height;const x=cv.getContext("2d");x.drawImage(img,0,0);x.globalCompositeOperation="source-in";x.fillStyle=color;x.fillRect(0,0,cv.width,cv.height);silCache.set(key,cv);return cv;}
  function drawBat(o,t){const c=scene.ctx,s=o.scale||1,cx=o.x+o.w/2,cy=o.y+o.h/2,frame=Math.floor(t*8+(o.phase||0))%2,image=DR.Assets.get(frame?"ptero2":"ptero1");if(image){
      // Yer gölgesi: şeridi okumayı kolaylaştırır (alçak şeritte koyu ve dar, yüksekte açık ve geniş).
      const high=o.lane==="high",bob=lowMotion()?0:Math.sin(t*6+(o.phase||0))*1.5;
      c.save();c.globalAlpha=high?.14:.26;c.fillStyle="#07161c";c.beginPath();c.ellipse(Math.round(cx),scene.ground+1,o.w*(high?.42:.34),3,0,0,Math.PI*2);c.fill();c.restore();
      // Koyu sprite koyu ormanda kaybolmasın: açık renkli siluet dört yöne kaydırılarak arkasına çizilir (ince kontur) + hafif hale.
      c.save();const hx=cx,hy=cy+bob,hr=o.w*.6,halo=c.createRadialGradient(hx,hy,2,hx,hy,hr);halo.addColorStop(0,"rgba(255,226,160,.22)");halo.addColorStop(1,"rgba(255,200,110,0)");c.fillStyle=halo;c.fillRect(hx-hr,hy-hr,hr*2,hr*2);
      const sil=silhouette(image,"#ffe3a0");c.imageSmoothingEnabled=false;c.globalAlpha=.9;for(const [dx,dy] of [[-1.5,0],[1.5,0],[0,-1.5],[0,1.5]])c.drawImage(sil,Math.round(o.x)+dx,Math.round(o.y+bob)+dy,o.w,o.h);c.restore();
      c.save();c.imageSmoothingEnabled=false;c.drawImage(image,Math.round(o.x),Math.round(o.y+bob),o.w,o.h);
      if(!lowMotion()){c.globalAlpha=.18;c.fillStyle="#5fd0ff";c.fillRect(o.x+o.w*.78,cy+bob-1,14,2);c.fillRect(o.x+o.w*.82,cy+bob+5,9,1.5);c.globalAlpha=1;}
      c.restore();return;}const flap=Math.sin(t*18+(o.phase||0))*8;c.save();
    if(o.progress<.92&&!DR.Storage.get().lowEffects){c.globalAlpha=(.22+.32*(1-o.progress))*(.8+.2*Math.sin(t*14));c.strokeStyle="#78dbc1";c.lineWidth=2;c.beginPath();c.moveTo(cx+17*s,cy-3*s);c.lineTo(cx+34*s,cy-7*s);c.moveTo(cx+18*s,cy+4*s);c.lineTo(cx+29*s,cy+2*s);c.stroke();c.globalAlpha=1;}
    c.translate(Math.round(cx),Math.round(cy));c.scale(s,s);
    // Wide membrane wings flap as the bat swoops out of the distant sky.
    c.fillStyle="#332b31";c.beginPath();c.moveTo(-5,-3);c.lineTo(-17,-8-flap);c.lineTo(-28,-16-flap);c.lineTo(-25,-4-flap*.5);c.lineTo(-32,2);c.lineTo(-22,4+flap*.25);c.lineTo(-17,10);c.lineTo(-8,5);c.closePath();c.fill();
    c.beginPath();c.moveTo(5,-3);c.lineTo(17,-8-flap);c.lineTo(28,-16-flap);c.lineTo(25,-4-flap*.5);c.lineTo(32,2);c.lineTo(22,4+flap*.25);c.lineTo(17,10);c.lineTo(8,5);c.closePath();c.fill();
    px(c,-6,-7,12,18,"#3b3034");px(c,-9,-13,18,11,"#4b3735");
    c.fillStyle="#4b3735";c.beginPath();c.moveTo(-8,-10);c.lineTo(-13,-24);c.lineTo(-2,-14);c.closePath();c.fill();c.beginPath();c.moveTo(8,-10);c.lineTo(13,-24);c.lineTo(2,-14);c.closePath();c.fill();
    px(c,-7,-12,4,3,"#ffbf58");px(c,3,-12,4,3,"#ffbf58");px(c,-6,-12,2,2,"#fff0b0");px(c,4,-12,2,2,"#fff0b0");
    px(c,-4,-1,8,3,"#211c22");px(c,-3,2,2,5,"#f3e6c8");px(c,2,2,2,5,"#f3e6c8");px(c,-2,10,4,7,"#2b252b");
    c.restore();
  }
  // Ekrana girmek üzere olan pterosaur için sağ kenarda, geleceği yükseklikte yanıp sönen uyarı.
  function drawPteroWarnings(obstacles,t){const c=scene.ctx,edge=scene.width+(scene.shift||0);for(const o of obstacles){if(o.type!=="flyer"||o.x<edge-4)continue;const box=DR.Rules.obstacleBox(o,C),cy=Math.round(box.y+box.h/2),x=Math.round(edge-20),a=lowMotion()?.95:.78+.22*Math.sin(t*16);
    c.save();c.globalAlpha=.55;c.fillStyle="#07161c";c.beginPath();c.arc(x,cy,17,0,Math.PI*2);c.fill();
    c.globalAlpha=a;c.fillStyle="#ffc23a";c.strokeStyle="#3a1d08";c.lineWidth=2;c.beginPath();c.moveTo(x+9,cy-13);c.lineTo(x+9,cy+13);c.lineTo(x-13,cy);c.closePath();c.fill();c.stroke();
    c.fillStyle="#2a1405";c.fillRect(x+1,cy-7,3,8);c.fillRect(x+1,cy+3,3,3);c.restore();}}
  function drawForeground(camera,menu){const image=DR.Assets.get("fgFerns");if(image)drawArtTile(scene.ctx,image,scene.ground-image.height*C.artAssets.pixelWorld*.72,camera,scene.width,C.artAssets.pixelWorld,.42,.82,.72);else{drawFern(scene.ctx,0,scene.height,Math.min(1.25,scene.height/390),false);drawFern(scene.ctx,scene.width,scene.height,Math.min(1.3,scene.height/375),true);}}
  function drawParticle(c,p){const a=Math.max(0,p.life/p.max);
    if(p.kind==="text"){c.globalAlpha=a;c.fillStyle=p.color;c.font="900 14px system-ui";c.textAlign="center";c.fillText(p.text,p.x,p.y);}
    else if(p.kind==="trail-leaf"){c.globalAlpha=Math.min(1,a*1.4);const f=Math.floor((p.max-p.life)*10+p.seed)%3;px(c,p.x,p.y,f===0?4:f===1?3:2,f===0?2:3,p.color);px(c,p.x+1,p.y+1,1,1,"#2f5a24");}
    else if(p.kind==="trail-spark"){c.globalAlpha=a*.7;px(c,p.x-p.vx*.03,p.y-p.vy*.03,1.5,1.5,"#ff8a1f");c.globalAlpha=a;px(c,p.x,p.y,p.size,p.size,p.color);}
    else if(p.kind==="trail-firefly"){const pulse=.55+.45*Math.sin((p.max-p.life)*14+p.seed);c.globalAlpha=a*.3*pulse;px(c,p.x-2,p.y-2,6,6,p.color);c.globalAlpha=Math.min(1,a*1.3)*pulse;px(c,p.x,p.y,2,2,"#fbffd8");}
    else{c.globalAlpha=a;px(c,p.x,p.y,p.size,p.size,p.color);}
    c.globalAlpha=1;}
  function render(model){if(!scene.ctx)return;const play=model.mode!=="menu";if(scene.portrait&&play!==scene.farPlay){scene.farPlay=play;scene.ground=groundFor();scene.cacheDirty=true;if(DR.Game&&DR.Game.onResize)DR.Game.onResize(scene.width,scene.height,scene.ground);}const c=scene.ctx,t=model.elapsed||0,camera=model.world||0,prefs=DR.Storage.get(),shakeOn=prefs.screenShake&&!prefs.lowEffects,flash=model.mode==="game_over"&&prefs.flash&&!prefs.lowEffects&&model.deathElapsed<2*C.physics.step;scene.shakeX=model.mode==="game_over"&&shakeOn&&model.deathElapsed<.09?(rnd(Math.floor(model.deathElapsed*60)+51)-.5)*2.2:0;scene.shakeY=model.mode==="game_over"&&shakeOn&&model.deathElapsed<.09?(rnd(Math.floor(model.deathElapsed*60)+61)-.5)*1.4:0;const worldDrift=model.mode==="menu"?t*18:camera;drawBackground(t,camera,model.mode==="menu",model.score);drawForeground(worldDrift,model.mode==="menu");
    if(model.mode==="menu"){const rk=DR.Riko&&DR.Riko.pose?DR.Riko.pose(t):null; // Riko menü pozu: yalnız konum kayması + mevcut sprite satırı
    drawDino(scene.width*.075+(rk?rk.dx:0),scene.ground+(rk?rk.dy:0),t,"idle",DR.Storage.get().selected,true,null,model.mode,0,scene.ground,rk&&rk.anim);drawFossil(scene.width*.885,scene.ground-30,t,Math.sin(t*2)*.5,0,54);applyGrade(c,null,-8,-8,scene.width+16,scene.height+16);return;}
    c.save();c.translate(-(scene.shift||0),0);
    model.pickups.forEach(f=>{if(!f.taken)drawFossil(f.x,f.y,t,0,f.phase);});model.obstacles.forEach(o=>drawObstacle(o,t));drawPteroWarnings(model.obstacles,t);
    model.particles.forEach(p=>drawParticle(c,p));
    const player=model.player;drawDino(player.x,player.y,t,player.pose,DR.Storage.get().selected,false,player,model.mode,model.deathElapsed,model.deathStartY);drawObstacleHitboxes(model.obstacles);drawPlayerHitbox(player);
    c.restore();applyGrade(c,null,-8,-8,scene.width+16,scene.height+16);
 if(flash){c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=Math.max(.02,.18-model.deathElapsed*4);c.fillStyle=model.deathElapsed<C.physics.step?"#fff1ca":"#ffd36b";c.fillRect(0,0,scene.canvas.width,scene.canvas.height);c.restore();}
  }
  DR.Scene={prepare,resize,render,reportFrameTime,applyGrade,sheetFor,drawParticle,sceneDef,get performanceFactor(){return scene.quality;},get metrics(){return {width:scene.width+(scene.shift||0),viewWidth:scene.width,height:scene.height,ground:scene.ground,scale:scene.scale,dpr:scene.dpr};}};
})(window);

