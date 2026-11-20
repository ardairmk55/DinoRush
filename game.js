(function(w){
  "use strict";
  const DR=w.DinoRush,C=DR.Config,E=DR.Entities;
  const model={mode:"menu",elapsed:0,world:0,score:0,runFossils:0,runBonus:0,pickups:[],obstacles:[],particles:[],player:{x:C.physics.playerX,y:246,vy:0,duck:false,pose:"idle",prep:0,jumpHeld:false,jumpBuffer:0,jumpHoldElapsed:0,coyote:0,frame:0},width:640,height:360,ground:246,deathElapsed:0,deathStartY:246,gameOverShown:false,gameOverResult:null,debugHitbox:false,journey:null,tutorial:null,run:null};
  let accumulator=0,last=0,countdown=0,countdownDigit=3,obstacleClock=1.05,fossilClock=1.2,footClock=0,lastScore=-1,startBest=0,recordCelebrated=false,particlesEnabled=true,playClock=0,pendingCombo=0,clusterSeq=0;
  const clusters=new Map(); // fosil kümesi -> {size, got, broken}
  const STEP=C.physics.step,P=C.physics,RW=C.rewards;
  const speedNow=()=>Math.min(P.maxSpeed,P.runSpeed+model.score*P.speedGain);
  function emit(data){if(!particlesEnabled)return;const cap=DR.Storage.get().lowEffects?24:Math.max(24,Math.round(96*(DR.Scene.performanceFactor||1)));while(model.particles.length>=cap)E.releaseParticle(model.particles.shift());model.particles.push(E.particle(data));}
  // Yazılı açılır bilgi (kıl payı, zincir): parçacıklar kapalı olsa bile gösterilir, oynanış bilgisidir.
  function popup(x,y,text,color){while(model.particles.length>=96)E.releaseParticle(model.particles.shift());model.particles.push(E.particle({x,y,vx:0,vy:-60,life:.9,size:1,color:color||"#ffd36b",kind:"text",text,gravity:0}));}
  function dust(x,y,count,color,kind){for(let i=0;i<count;i++)emit({x:x+(Math.random()-.5)*20,y:y-Math.random()*5,vx:(Math.random()-.5)*75,vy:-20-Math.random()*70,life:.27+Math.random()*.24,size:2+Math.random()*2,color:color||"#8a7a62",kind:kind||"dust"});}
  // Koşu izi: yalnızca adım partikülünün görünüşü değişir (adet ve sıklık aynı kalır).
  // trailData mağaza önizlemesiyle paylaşılır.
  function trailData(id,x,y){const out=[];
    for(let i=0;i<2;i++){
      if(id==="leaf")out.push({x:x+(Math.random()-.5)*16,y:y-3-Math.random()*6,vx:-30-Math.random()*45,vy:-35-Math.random()*40,life:.55+Math.random()*.25,size:3,color:i%2?"#9ec24a":"#5e9a34",kind:"trail-leaf",gravity:.32,seed:Math.random()*6});
      else if(id==="spark")out.push({x:x+(Math.random()-.5)*14,y:y-2-Math.random()*4,vx:(Math.random()-.75)*130,vy:-50-Math.random()*90,life:.24+Math.random()*.16,size:2,color:i%2?"#ffd36b":"#ff8a1f",kind:"trail-spark",gravity:1.25});
      else if(id==="firefly")out.push({x:x+(Math.random()-.5)*18,y:y-8-Math.random()*14,vx:-18-Math.random()*30,vy:-12-Math.random()*22,life:.85+Math.random()*.35,size:2,color:i%2?"#d8ff7a":"#7fffe8",kind:"trail-firefly",gravity:-.06,seed:Math.random()*6});
      else out.push({x:x+(Math.random()-.5)*20,y:y-Math.random()*5,vx:(Math.random()-.5)*75,vy:-20-Math.random()*70,life:.27+Math.random()*.24,size:2+Math.random()*2,color:"#8a7a62",kind:"dust"});
    }return out;}
  function trailStep(x,y){trailData(DR.Storage.get().selectedTrail,x,y).forEach(emit);}
  function flushPlayTime(){if(playClock>0){DR.Storage.addPlayTime(playClock);playClock=0;}}

  /* ---------- Koşuda sahne geçişi: sahip olunan sahneler arasında, seçili sahneden başlayarak ---------- */
  function journeyFor(save){
    const owned=C.cosmetics.scenes.filter(s=>save.ownedScenes.includes(s.id)).map(s=>s.id);
    const i=Math.max(0,owned.indexOf(save.selectedScene)),ids=owned.slice(i).concat(owned.slice(0,i));
    return {ids,idx:0,nextAt:C.journey.sceneEvery,from:null,to:ids[0]||save.selectedScene,k:1,on:save.sceneCycle!==false&&ids.length>1};
  }
  function stepJourney(dt){const j=model.journey;if(!j)return;if(j.k<1)j.k=Math.min(1,j.k+dt/C.journey.sceneBlend);
    if(j.on&&model.score>=j.nextAt){j.nextAt+=C.journey.sceneEvery;j.from=j.to;j.idx=(j.idx+1)%j.ids.length;j.to=j.ids[j.idx];j.k=0;}}

  /* ---------- İlk koşu öğreticisi: senaryolu engeller ve ipuçları; fizik ve çarpışma aynıdır ---------- */
  function tutorialStep(dt){
    const tu=model.tutorial;if(!tu)return false;tu.t+=dt;
    const target=tu.target,near=target&&!target.passed&&target.x-model.player.x<(target.type==="flyer"?300:250);
    if(tu.step===0&&!target&&tu.t>1.1){tu.target=pushGround("log",model.width+36);}
    else if(tu.step===0&&target&&target.passed){tu.step=1;tu.t=0;tu.target=null;DR.UI.tutorialHint(null);}
    else if(tu.step===1&&!tu.cluster&&tu.t>.5){tu.cluster=spawnFossils(model.ground-50);DR.UI.tutorialHint("collect");}
    else if(tu.step===1&&tu.cluster&&!clusters.has(tu.cluster)){tu.step=2;tu.t=0;DR.UI.tutorialHint(null);}
    else if(tu.step===2&&!target&&tu.t>.7){tu.target=pushFlyer("high",model.width+C.ptero.spawnLead);}
    else if(tu.step===2&&target&&target.passed){finishTutorial(true);return false;}
    if(near)DR.UI.tutorialHint(target.type==="flyer"?"duck":"jump");
    return true;
  }
  function finishTutorial(completed){
    model.tutorial=null;DR.Storage.update({tutorialDone:true});DR.UI.tutorialHint(null);obstacleClock=1.2;fossilClock=1.4;
    if(completed)DR.UI.toast({kind:"tutorial",title:"Hazırsın!",text:"Artık park senin. Fosil topla, kıl payı geç, zincir kur."});
  }
  function skipTutorial(){if(model.tutorial)finishTutorial(false);}

  function start(){
    flushPlayTime();
    DR.Audio.init();model.mode="countdown";model.elapsed=0;model.world=0;model.score=0;model.runFossils=0;model.runBonus=0;model.pickups.forEach(E.releaseFossil);model.pickups.length=0;model.obstacles.forEach(E.releaseObstacle);model.obstacles.length=0;model.particles.forEach(E.releaseParticle);model.particles.length=0;clusters.clear();
    model.width=DR.Scene.metrics.width;model.height=DR.Scene.metrics.height;model.ground=DR.Scene.metrics.ground;model.player.x=P.playerX;model.player.y=model.ground;model.player.vy=0;model.player.duck=false;model.player.pose="prep";model.player.prep=0;model.player.jumpHeld=false;model.player.jumpBuffer=0;model.player.jumpHoldElapsed=0;model.player.coyote=0;model.player.frame=0;model.deathElapsed=0;model.deathStartY=model.ground;model.gameOverShown=false;model.gameOverResult=null;
    accumulator=0;countdown=2.25;countdownDigit=3;obstacleClock=1.05;fossilClock=1.15;footClock=0;lastScore=-1;recordCelebrated=false;pendingCombo=0;
    const save=DR.Storage.get();startBest=save.best;particlesEnabled=save.particles!==false;
    model.run={nearMisses:0,nearMissFossils:0,chainFossils:0,chains:0,chain:0,maxChain:0,pterosDodged:0,jumps:0};
    model.journey=journeyFor(save);
    model.tutorial=save.tutorialDone?null:{step:0,t:0,target:null,cluster:null};
    DR.UI.enterCountdown();
  }
  function stopToMenu(){flushPlayTime();model.mode="menu";model.journey=null;model.tutorial=null;DR.UI.tutorialHint(null);model.pickups.forEach(E.releaseFossil);model.pickups.length=0;model.obstacles.forEach(E.releaseObstacle);model.obstacles.length=0;clusters.clear();DR.UI.showMenu();}
  function pause(){if(model.mode!=="playing")return;model.mode="paused";flushPlayTime();DR.UI.showPause(true);}
  function resume(){if(model.mode!=="paused")return;model.mode="playing";DR.UI.showPause(false);last=performance.now();accumulator=0;}
  function togglePause(){if(model.mode==="playing")pause();else if(model.mode==="paused")resume();}
  function beginJump(p){p.prep=P.jumpPrep;p.jumpBuffer=0;p.coyote=0;p.jumpHoldElapsed=0;p.duck=false;if(model.run)model.run.jumps++;DR.Audio.jump();}
  function jump(pressed){const p=model.player;if(!pressed){p.jumpHeld=false;return;}if(model.mode!=="playing")return;p.jumpHeld=true;p.jumpBuffer=P.jumpBuffer;if(p.y>=model.ground-1||p.coyote>0)beginJump(p);}
  function setDuck(on){if(model.mode==="playing")model.player.duck=!!on;}
  // Aşağı kaydırma: yerdeyse bekleyen zıplamayı iptal edip eğilir, havadaysa hızla iner ve eğilir.
  function swipeDown(){if(model.mode!=="playing")return;const p=model.player;p.jumpHeld=false;p.jumpBuffer=0;
    if(p.prep>0){p.prep=0;p.pose="crouch";}
    if(p.y<model.ground-1)p.vy=Math.max(p.vy,P.fastFall);
    p.duck=true;}
  function resize(width,height,ground){const oldGround=model.ground,delta=ground-oldGround;model.width=width;model.height=height;model.ground=ground;const p=model.player;if((model.mode==="playing"||model.mode==="paused")&&p.y<oldGround-1){p.y+=delta;model.pickups.forEach(f=>f.y+=delta);model.obstacles.forEach(o=>{o.y+=delta;if(o.falling){o.landY+=delta;o.startY+=delta;}});}else p.y=ground;if(model.mode==="game_over")model.deathStartY+=delta;}
  function announceScore(){if(model.score===lastScore)return;lastScore=model.score;DR.UI.updateScore(model.score,model.runFossils+model.runBonus,DR.Storage.get().best);if(model.score>startBest&&DR.Storage.setBest(model.score)){DR.UI.updateRecord(DR.Storage.get().best,!recordCelebrated);recordCelebrated=true;}}
  function endRun(o){if(model.mode!=="playing")return;model.mode="game_over";flushPlayTime();model.player.pose="dead";model.player.duck=false;model.deathElapsed=0;model.deathStartY=model.player.y;model.gameOverShown=false;const isRecord=model.score>startBest;if(isRecord){DR.Storage.setBest(model.score);DR.Audio.record();}else DR.Audio.hit();DR.Audio.haptic(70);
    DR.UI.tutorialHint(null);
    const r=model.run,run={score:model.score,fossils:model.runFossils,bonusFossils:r.nearMissFossils+r.chainFossils,nearMissFossils:r.nearMissFossils,chainFossils:r.chainFossils,nearMisses:r.nearMisses,chains:r.chains,maxChain:r.maxChain,pterosDodged:r.pterosDodged,jumps:r.jumps,duration:Math.round(model.elapsed*10)/10,death:o?o.type:"log",record:isRecord};
    const res=DR.Storage.recordRun(run);
    model.gameOverResult={score:model.score,best:DR.Storage.get().best,fossils:model.runFossils,record:isRecord,run,breakdown:res.breakdown,unlocked:res.unlocked,daily:res.daily};}
  function bonusFossils(n){DR.Storage.addFossils(n);model.runBonus+=n;DR.UI.updateFossils(model.runFossils+model.runBonus,DR.Storage.get().fossils);}
  function addFossil(f){f.taken=true;model.runFossils++;DR.Storage.addFossils(1);DR.Audio.fossil(model.run.chain);DR.Audio.haptic(16);DR.UI.updateFossils(model.runFossils+model.runBonus,DR.Storage.get().fossils);emit({x:f.x,y:f.y,vx:0,vy:-70,life:.72,size:1,color:"#ffd36b",kind:"text",text:"+1"});for(let i=0;i<9;i++)emit({x:f.x,y:f.y,vx:(Math.random()-.5)*95,vy:-25-Math.random()*95,life:.35+Math.random()*.3,size:2+Math.random()*2,color:i%2?"#ffd36b":"#ff8a1f"});
    const cl=clusters.get(f.cluster);if(cl&&!cl.broken){cl.got++;if(cl.got>=cl.size){clusters.delete(f.cluster);completeChain(f);}}}
  // Zincir: kümenin tamamı toplanınca seviye artar; ödül seviyeyle büyür. Kaçan fosil zinciri sıfırlar.
  function completeChain(f){const r=model.run;r.chain=Math.min(RW.chainMax,r.chain+1);r.chains++;r.maxChain=Math.max(r.maxChain,r.chain);const n=DR.ProgressCore.chainReward(r.chain,RW);r.chainFossils+=n;bonusFossils(n);
    popup(f.x,f.y-22,"ZİNCİR x"+r.chain+"  +"+n,"#9fe36a");DR.Audio.chain(r.chain);DR.Audio.haptic(22);}
  function breakChain(id){const cl=clusters.get(id);if(!cl||cl.broken)return;cl.broken=true;clusters.delete(id);if(model.run.chain>0){model.run.chain=0;popup(model.player.x+40,model.player.y-70,"ZİNCİR KOPTU","#ff9e78");}}
  // Kıl payı: engel çarpışmadan, en fazla nearMissPx boşlukla geçildi.
  function nearMiss(){const r=model.run,n=RW.nearMissFossils;r.nearMisses++;r.nearMissFossils+=n;bonusFossils(n);popup(model.player.x+30,model.player.y-78,"KIL PAYI!  +"+n,"#7fffe8");DR.Audio.nearMiss();DR.Audio.haptic(12);}

  /* ---------- Engel ve fosil üretimi ---------- */
  const unit=C.artAssets.pixelWorld;
  function pushGround(type,x){const [w0,h0]=C.artAssets.sizes[type].map(n=>n*unit),o=E.obstacle({type,x,y:model.ground-h0,w:w0,h:h0,phase:Math.random()*6,scale:1});model.obstacles.push(o);return o;}
  function pushFlyer(lane,x){const R=DR.Rules,size=R.pteroSize(C),o=E.obstacle({type:"flyer",lane,x,y:R.pteroY(lane,model.ground,C),w:size.w,h:size.h,phase:Math.random()*6,scale:1,progress:0});model.obstacles.push(o);return o;}
  // Düşen kaya: dinonun önünde yere iner (gölgesi önceden görünür), sonra sıradan bir kaya gibi zıplanır.
  function pushFaller(speed){const [w0,h0]=C.artAssets.sizes.rock.map(n=>n*unit),ft=C.patterns.fallTime,land=model.player.x+260+Math.random()*60,startY=-h0-24,landY=model.ground-h0;
    const o=E.obstacle({type:"faller",x:land+speed*ft,y:startY,w:w0,h:h0,phase:Math.random()*6,scale:1,falling:true,fallTime:ft,startY,landY});model.obstacles.push(o);return o;}
  function spawnObstacle(){
    const R=DR.Rules,speed=speedNow(),gap=Math.max(1.03,(P.obstacleMinGap+Math.random()*(P.obstacleMaxGap-P.obstacleMinGap))/speed),pat=R.patternFor(model.score,Math.random(),C);
    if(pat==="double"){const pairs=[["log","rock"],["rock","log"],["log","log"],["rock","rock"]],pr=pairs[Math.floor(Math.random()*pairs.length)],[g0,g1]=C.patterns.doubleGap;
      const a=pushGround(pr[0],model.width+36),b=pushGround(pr[1],a.x+a.w+g0+Math.random()*(g1-g0));return gap+(b.x+b.w-a.x)/speed;}
    if(pat==="faller"){pushFaller(speed);return gap+.25;}
    if(pat==="pteroCombo"){pushFlyer("low",model.width+C.ptero.spawnLead);pendingCombo=C.patterns.comboDelay;return Math.max(1.65,gap)+C.patterns.comboDelay;}
    const r=Math.random();let type=r<.45?"log":r<.64?"rock":r<.79?"bush":"flyer";if(type==="flyer"&&!R.pteroAllowed(model.score,C))type="log";
    // Pterosaur: sabit boyut, şeride göre sabit yükseklik; görünür kenarın daha dışında doğar (uyarı işareti için zaman).
    if(type==="flyer"){pushFlyer(R.pteroLane(model.score,Math.random(),C),model.width+C.ptero.spawnLead);return Math.max(1.65,gap);}
    pushGround(type,model.width+36);return gap;
  }
  function spawnFossils(base){const id=++clusterSeq,count=4+Math.floor(Math.random()*3);clusters.set(id,{size:count,got:0,broken:false});
    for(let i=0;i<count;i++){const x=model.width+35+i*24,y=base-Math.sin((i/(count-1))*Math.PI)*13;model.pickups.push(E.fossil({x,y,phase:Math.random()*6,cluster:id}));}return id;}

  const collide=(a,b)=>DR.Rules.collide(a,b);
  function getPlayerBox(p){return DR.Rules.playerBox(p||model.player,C);}
  function getObstacleBox(o){return DR.Rules.obstacleBox(o,C);}
  function update(){
    const dt=STEP;model.elapsed+=dt;
    if(model.mode==="countdown"){
      countdown-=dt;const digit=Math.max(1,Math.ceil(countdown/.75));if(digit!==countdownDigit&&countdown>0){countdownDigit=digit;DR.UI.count(digit);DR.Audio.countdown(digit);}if(countdown<=0){model.mode="playing";model.elapsed=0;model.player.pose="run";DR.UI.beginPlay();DR.Audio.countdown(0);}return;
    }
    if(model.mode!=="playing")return;
    playClock+=dt;
    model.width=DR.Scene.metrics.width;model.height=DR.Scene.metrics.height;model.ground=DR.Scene.metrics.ground;
    const speed=speedNow();model.world+=speed*dt;model.score=Math.floor(model.world/11);announceScore();stepJourney(dt);
    const p=model.player;let previousY=p.y;
    const grounded=p.y>=model.ground-1;if(grounded)p.coyote=P.coyoteTime;else p.coyote=Math.max(0,p.coyote-dt);
    if(p.jumpBuffer>0){p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);if(grounded||p.coyote>0)beginJump(p);}
    if(p.prep>0){p.prep-=dt;if(p.prep<=0){p.vy=P.jumpVelocity;p.pose="rise";p.jumpHoldElapsed=0;dust(p.x+25,model.ground,6,"#6e9a38","leaf");}}
    else if(p.y<model.ground||p.vy<0){const holding=p.jumpHeld&&p.vy<0&&p.jumpHoldElapsed<P.jumpHoldMax,gravity=holding?P.jumpHoldGravity:P.gravity;p.y+=p.vy*dt;p.vy+=gravity*dt;if(holding)p.jumpHoldElapsed+=dt;if(p.y>=model.ground){p.y=model.ground;p.vy=0;p.jumpHeld=false;p.pose=p.duck?"crouch":"run";p.coyote=P.coyoteTime;if(previousY<model.ground)dust(p.x+25,model.ground,5,"#4f7a2a");}}
    if(p.y<model.ground-1)p.pose=p.vy<0?"rise":"fall";else if(p.prep>0)p.pose="prep";else if(p.duck)p.pose="crouch";else p.pose="run";p.frame+=dt*12;
    if(p.y>=model.ground-1&&!p.duck&&p.prep<=0){footClock-=dt;if(footClock<=0){trailStep(p.x+14,model.ground);footClock=.3;}}else footClock=0;
    if(!tutorialStep(dt)){
      obstacleClock-=dt;if(obstacleClock<=0)obstacleClock=spawnObstacle();
      if(pendingCombo>0){pendingCombo-=dt;if(pendingCombo<=0)pushFlyer("high",model.width+C.ptero.spawnLead);}
      fossilClock-=dt;if(fossilClock<=0){spawnFossils(model.ground-55-Math.random()*72);fossilClock=2+Math.random()*2;}
    }
    const playerBox=getPlayerBox(p),R=DR.Rules;
    for(let i=model.obstacles.length-1;i>=0;i--){const o=model.obstacles[i];
      if(o.type==="flyer"){o.x-=speed*C.ptero.speedFactor*dt;o.y=R.pteroY(o.lane,model.ground,C);}
      else{o.x-=speed*dt;if(o.falling){o.fallT+=dt;const k=Math.min(1,o.fallT/o.fallTime);o.y=o.startY+(o.landY-o.startY)*k*k;if(k>=1){o.falling=false;o.y=o.landY;dust(o.x+o.w/2,model.ground,7,"#6b6352");DR.Audio.thud();}}}
      const ob=getObstacleBox(o);
      if(collide(playerBox,ob)){endRun(o);break;}
      const c=R.clearance(playerBox,ob);if(c<o.minClear)o.minClear=c;
      if(!o.passed&&ob.x+ob.w<playerBox.x){o.passed=true;if(o.type==="flyer")model.run.pterosDodged++;if(o.minClear<=RW.nearMissPx&&!model.tutorial)nearMiss();}
      if(o.x+o.w<-30){model.obstacles.splice(i,1);E.releaseObstacle(o);}}
    if(model.mode!=="playing")return;
    for(let i=model.pickups.length-1;i>=0;i--){const f=model.pickups[i];f.x-=speed*dt;if(!f.taken&&collide(playerBox,{x:f.x-7,y:f.y-7,w:14,h:14}))addFossil(f);if(!f.taken&&f.x<-20)breakChain(f.cluster);if(f.taken||f.x<-20){model.pickups.splice(i,1);E.releaseFossil(f);}}
    for(let i=model.particles.length-1;i>=0;i--){const q=model.particles[i];q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=185*q.gravity*dt;q.life-=dt;if(q.life<=0){model.particles.splice(i,1);E.releaseParticle(q);}}
  }
  let raf=0;
  function frame(now){raf=w.requestAnimationFrame(frame);if(!last)last=now;let frameDelta=Math.min(C.physics.maxFrame,(now-last)/1000);last=now;if(DR.Scene.reportFrameTime)DR.Scene.reportFrameTime(frameDelta);
    if(model.mode==="menu"||model.mode==="game_over"&&!model.gameOverShown){accumulator+=frameDelta;let loops=0;while(accumulator+1e-9>=STEP&&loops<8&&(model.mode==="menu"||!model.gameOverShown)){if(model.mode==="menu")model.elapsed+=STEP;else{model.elapsed+=STEP;model.deathElapsed+=STEP;if(model.deathElapsed>=.82&&!model.gameOverShown){model.gameOverShown=true;DR.UI.showGameOver(model.gameOverResult);}}accumulator=Math.max(0,accumulator-STEP);loops++;}}
    else if(model.mode==="paused")accumulator=0;
    else{accumulator+=frameDelta;let loops=0;while(accumulator+1e-9>=STEP&&loops<8&&model.mode!=="paused"&&model.mode!=="game_over"){update();accumulator=Math.max(0,accumulator-STEP);loops++;}if(model.mode==="game_over")accumulator=0;}
    DR.Scene.render(model);}
  function initialize(){return DR.Assets.load().finally(()=>{DR.Scene.prepare(document.getElementById("gameCanvas"));DR.Input.init();if(!raf)raf=w.requestAnimationFrame(frame);});}
  DR.Game={flushPlayTime,trailData,get mode(){return model.mode;},get model(){return model;},getPlayerBox,getObstacleBox,toggleHitboxDebug(){model.debugHitbox=!model.debugHitbox;return model.debugHitbox;},initialize,start,jump,setDuck,swipeDown,pause,resume,togglePause,stopToMenu,skipTutorial,onResize:resize};
})(window);
