(function(w){
  "use strict";
  const DR=w.DinoRush,C=DR.Config,E=DR.Entities;
  const model={mode:"menu",elapsed:0,world:0,score:0,runFossils:0,pickups:[],obstacles:[],particles:[],player:{x:C.physics.playerX,y:246,vy:0,duck:false,pose:"idle",prep:0,jumpHeld:false,jumpBuffer:0,jumpHoldElapsed:0,coyote:0,frame:0},width:640,height:360,ground:246,deathElapsed:0,deathStartY:246,gameOverShown:false,gameOverResult:null,debugHitbox:false};
  let accumulator=0,last=0,countdown=0,countdownDigit=3,obstacleClock=1.05,fossilClock=1.2,footClock=0,lastScore=-1,startBest=0,recordCelebrated=false,particlesEnabled=true,playClock=0;
  const STEP=C.physics.step,P=C.physics;
  function ui(){return DR.UI;}
  function emit(data){if(!particlesEnabled)return;const cap=DR.Storage.get().lowEffects?24:Math.max(24,Math.round(96*(DR.Scene.performanceFactor||1)));while(model.particles.length>=cap)E.releaseParticle(model.particles.shift());model.particles.push(E.particle(data));}
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
  function start(){
    flushPlayTime();
    DR.Audio.init();model.mode="countdown";model.elapsed=0;model.world=0;model.score=0;model.runFossils=0;model.pickups.forEach(E.releaseFossil);model.pickups.length=0;model.obstacles.forEach(E.releaseObstacle);model.obstacles.length=0;model.particles.forEach(E.releaseParticle);model.particles.length=0;
    model.width=DR.Scene.metrics.width;model.height=DR.Scene.metrics.height;model.ground=DR.Scene.metrics.ground;model.player.x=P.playerX;model.player.y=model.ground;model.player.vy=0;model.player.duck=false;model.player.pose="prep";model.player.prep=0;model.player.jumpHeld=false;model.player.jumpBuffer=0;model.player.jumpHoldElapsed=0;model.player.coyote=0;model.player.frame=0;model.deathElapsed=0;model.deathStartY=model.ground;model.gameOverShown=false;model.gameOverResult=null;
    accumulator=0;countdown=2.25;countdownDigit=3;obstacleClock=1.05;fossilClock=1.15;footClock=0;lastScore=-1;recordCelebrated=false;startBest=DR.Storage.get().best;particlesEnabled=!DR.Storage.get().lowEffects;DR.UI.enterCountdown();
  }
  function stopToMenu(){flushPlayTime();model.mode="menu";model.pickups.forEach(E.releaseFossil);model.pickups.length=0;model.obstacles.forEach(E.releaseObstacle);model.obstacles.length=0;DR.UI.showMenu();}
  function pause(){if(model.mode!=="playing")return;model.mode="paused";flushPlayTime();DR.UI.showPause(true);}
  function resume(){if(model.mode!=="paused")return;model.mode="playing";DR.UI.showPause(false);last=performance.now();accumulator=0;}
  function togglePause(){if(model.mode==="playing")pause();else if(model.mode==="paused")resume();}
  function jump(pressed){const p=model.player;if(!pressed){p.jumpHeld=false;return;}if(model.mode!=="playing")return;p.jumpHeld=true;p.jumpBuffer=P.jumpBuffer;if(p.y>=model.ground-1||p.coyote>0){p.prep=P.jumpPrep;p.jumpBuffer=0;p.coyote=0;p.jumpHoldElapsed=0;p.duck=false;DR.Audio.jump();}}
  function setDuck(on){if(model.mode==="playing")model.player.duck=!!on;}
  // Aşağı kaydırma: yerdeyse bekleyen zıplamayı iptal edip eğilir, havadaysa hızla iner ve eğilir.
  function swipeDown(){if(model.mode!=="playing")return;const p=model.player;p.jumpHeld=false;p.jumpBuffer=0;
    if(p.prep>0){p.prep=0;p.pose="crouch";}
    if(p.y<model.ground-1)p.vy=Math.max(p.vy,P.fastFall);
    p.duck=true;}
  function resize(width,height,ground){const oldGround=model.ground,delta=ground-oldGround;model.width=width;model.height=height;model.ground=ground;const p=model.player;if((model.mode==="playing"||model.mode==="paused")&&p.y<oldGround-1){p.y+=delta;model.pickups.forEach(f=>f.y+=delta);model.obstacles.forEach(o=>o.y+=delta);}else p.y=ground;if(model.mode==="game_over")model.deathStartY+=delta;}
  function announceScore(){if(model.score===lastScore)return;lastScore=model.score;DR.UI.updateScore(model.score,model.runFossils,DR.Storage.get().best);if(model.score>startBest&&DR.Storage.setBest(model.score)){DR.UI.updateRecord(DR.Storage.get().best,!recordCelebrated);recordCelebrated=true;}}
  function endRun(){if(model.mode!=="playing")return;model.mode="game_over";flushPlayTime();model.player.pose="dead";model.player.duck=false;model.deathElapsed=0;model.deathStartY=model.player.y;model.gameOverShown=false;const isRecord=model.score>startBest;if(isRecord){DR.Storage.setBest(model.score);DR.Audio.record();}else DR.Audio.hit();DR.Audio.haptic(70);model.gameOverResult={score:model.score,best:DR.Storage.get().best,fossils:model.runFossils,record:isRecord};}
  function addFossil(f){f.taken=true;model.runFossils++;DR.Storage.addFossils(1);DR.Audio.fossil();DR.Audio.haptic(16);DR.UI.updateFossils(model.runFossils,DR.Storage.get().fossils);emit({x:f.x,y:f.y,vx:0,vy:-70,life:.72,size:1,color:"#ffd36b",kind:"text",text:"+1"});for(let i=0;i<9;i++)emit({x:f.x,y:f.y,vx:(Math.random()-.5)*95,vy:-25-Math.random()*95,life:.35+Math.random()*.3,size:2+Math.random()*2,color:i%2?"#ffd36b":"#ff8a1f"});}
  function spawnObstacle(){const r=Math.random(),R=DR.Rules;let type=r<.45?"log":r<.64?"rock":r<.79?"bush":"flyer";if(type==="flyer"&&!R.pteroAllowed(model.score,C))type="log";const g=model.ground,unit=C.artAssets.pixelWorld;
    const dims={log:[44,22],rock:[40,22],bush:[28,32],flyer:[40,26]}[type].map(n=>n*unit);let data={type,x:model.width+36,y:g-dims[1],w:dims[0],h:dims[1],phase:Math.random()*6,scale:1};
    // Pterosaur: sabit boyut, şeride göre sabit yükseklik; görünür kenarın daha dışında doğar (uyarı işareti için zaman).
    if(type==="flyer"){const size=R.pteroSize(C);data.lane=R.pteroLane(model.score,Math.random(),C);data.w=size.w;data.h=size.h;data.x=model.width+C.ptero.spawnLead;data.y=R.pteroY(data.lane,g,C);data.scale=1;data.progress=0;}
    model.obstacles.push(E.obstacle(data));return type;
  }
  const collide=(a,b)=>DR.Rules.collide(a,b);
  function getPlayerBox(p){return DR.Rules.playerBox(p||model.player,C);}
  function getObstacleBox(o){return DR.Rules.obstacleBox(o,C);}
  function update(){
    const dt=STEP;model.elapsed+=dt;
    if(model.mode==="countdown"){
      countdown-=dt;const digit=Math.max(1,Math.ceil(countdown/.75));if(digit!==countdownDigit&&countdown>0){countdownDigit=digit;DR.UI.count(digit);}if(countdown<=0){model.mode="playing";model.elapsed=0;model.player.pose="run";DR.UI.beginPlay();}return;
    }
    if(model.mode!=="playing")return;
    playClock+=dt;
    model.width=DR.Scene.metrics.width;model.height=DR.Scene.metrics.height;model.ground=DR.Scene.metrics.ground;
    const speed=Math.min(P.maxSpeed,P.runSpeed+model.score*P.speedGain);model.world+=speed*dt;model.score=Math.floor(model.world/11);announceScore();
    const p=model.player;let previousY=p.y;
    const grounded=p.y>=model.ground-1;if(grounded)p.coyote=P.coyoteTime;else p.coyote=Math.max(0,p.coyote-dt);
    if(p.jumpBuffer>0){p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);if(grounded||p.coyote>0){p.prep=P.jumpPrep;p.jumpBuffer=0;p.coyote=0;p.jumpHoldElapsed=0;p.duck=false;DR.Audio.jump();}}
    if(p.prep>0){p.prep-=dt;if(p.prep<=0){p.vy=P.jumpVelocity;p.pose="rise";p.jumpHoldElapsed=0;dust(p.x+25,model.ground,6,"#6e9a38","leaf");}}
    else if(p.y<model.ground||p.vy<0){const holding=p.jumpHeld&&p.vy<0&&p.jumpHoldElapsed<P.jumpHoldMax,gravity=holding?P.jumpHoldGravity:P.gravity;p.y+=p.vy*dt;p.vy+=gravity*dt;if(holding)p.jumpHoldElapsed+=dt;if(p.y>=model.ground){p.y=model.ground;p.vy=0;p.jumpHeld=false;p.pose=p.duck?"crouch":"run";p.coyote=P.coyoteTime;if(previousY<model.ground)dust(p.x+25,model.ground,5,"#4f7a2a");}}
    if(p.y<model.ground-1)p.pose=p.vy<0?"rise":"fall";else if(p.prep>0)p.pose="prep";else if(p.duck)p.pose="crouch";else p.pose="run";p.frame+=dt*12;
    if(p.y>=model.ground-1&&!p.duck&&p.prep<=0){footClock-=dt;if(footClock<=0){trailStep(p.x+14,model.ground);footClock=.3;}}else footClock=0;
    obstacleClock-=dt;if(obstacleClock<=0){const kind=spawnObstacle(),gap=Math.max(1.03,(P.obstacleMinGap+Math.random()*(P.obstacleMaxGap-P.obstacleMinGap))/speed);obstacleClock=kind==="flyer"?Math.max(1.65,gap):gap;}
    fossilClock-=dt;if(fossilClock<=0){const count=4+Math.floor(Math.random()*3),base=model.ground-55-Math.random()*72;for(let i=0;i<count;i++){const x=model.width+35+i*24,y=base-Math.sin((i/(count-1))*Math.PI)*13;model.pickups.push(E.fossil({x,y,phase:Math.random()*6}));}fossilClock=2+Math.random()*2;}
    const playerBox=getPlayerBox(p);
    for(let i=model.obstacles.length-1;i>=0;i--){const o=model.obstacles[i];if(o.type==="flyer"){o.x-=speed*C.ptero.speedFactor*dt;o.y=DR.Rules.pteroY(o.lane,model.ground,C);}else{o.x-=speed*dt;}if(collide(playerBox,getObstacleBox(o))){endRun();break;}if(o.x+o.w<-30){model.obstacles.splice(i,1);E.releaseObstacle(o);}}
    if(model.mode!=="playing")return;
    for(let i=model.pickups.length-1;i>=0;i--){const f=model.pickups[i];f.x-=speed*dt;if(!f.taken&&collide(playerBox,{x:f.x-7,y:f.y-7,w:14,h:14}))addFossil(f);if(f.taken||f.x<-20){model.pickups.splice(i,1);E.releaseFossil(f);}}
    for(let i=model.particles.length-1;i>=0;i--){const q=model.particles[i];q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=185*q.gravity*dt;q.life-=dt;if(q.life<=0){model.particles.splice(i,1);E.releaseParticle(q);}}
  }
  let raf=0;
  function frame(now){raf=w.requestAnimationFrame(frame);if(!last)last=now;let frameDelta=Math.min(C.physics.maxFrame,(now-last)/1000);last=now;if(DR.Scene.reportFrameTime)DR.Scene.reportFrameTime(frameDelta);
    if(model.mode==="menu"||model.mode==="game_over"&&!model.gameOverShown){accumulator+=frameDelta;let loops=0;while(accumulator+1e-9>=STEP&&loops<8&&(model.mode==="menu"||!model.gameOverShown)){if(model.mode==="menu")model.elapsed+=STEP;else{model.elapsed+=STEP;model.deathElapsed+=STEP;if(model.deathElapsed>=.82&&!model.gameOverShown){model.gameOverShown=true;DR.UI.showGameOver(model.gameOverResult);}}accumulator=Math.max(0,accumulator-STEP);loops++;}}
    else if(model.mode==="paused")accumulator=0;
    else{accumulator+=frameDelta;let loops=0;while(accumulator+1e-9>=STEP&&loops<8&&model.mode!=="paused"&&model.mode!=="game_over"){update();accumulator=Math.max(0,accumulator-STEP);loops++;}if(model.mode==="game_over")accumulator=0;}
    DR.Scene.render(model);}
  function initialize(){return DR.Assets.load().finally(()=>{DR.Scene.prepare(document.getElementById("gameCanvas"));DR.Input.init();if(!raf)raf=w.requestAnimationFrame(frame);});}
  const P_PIXEL=C.artAssets.pixelWorld;
  DR.Game={flushPlayTime,trailData,get mode(){return model.mode;},get model(){return model;},getPlayerBox,getObstacleBox,toggleHitboxDebug(){model.debugHitbox=!model.debugHitbox;return model.debugHitbox;},initialize,start,jump,setDuck,swipeDown,pause,resume,togglePause,stopToMenu,onResize:resize};
})(window);





