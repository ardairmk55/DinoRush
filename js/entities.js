(function(w){
  "use strict";
  const DR=w.DinoRush;
  function makePool(factory,reset){const free=[];return {take(data){const item=free.pop()||factory();reset(item,data);return item;},release(item){if(item)free.push(item);},get size(){return free.length;}};}
  const particles=makePool(()=>({}), (p,d)=>Object.assign(p,{x:d.x,y:d.y,vx:d.vx||0,vy:d.vy||0,life:d.life||.4,max:d.life||.4,size:d.size||3,color:d.color||"#ffd36b",kind:d.kind||"dust",text:d.text||"",gravity:d.gravity===undefined?1:d.gravity,seed:d.seed||0}));
  const obstacles=makePool(()=>({}), (o,d)=>Object.assign(o,{type:d.type,x:d.x,y:d.y,w:d.w,h:d.h,cx:d.cx===undefined?d.x+d.w/2:d.cx,startX:d.startX===undefined?d.x:d.startX,progress:d.progress||0,scale:d.scale||1,phase:d.phase||0,lane:d.lane||null,passed:false,minClear:Infinity,falling:!!d.falling,fallT:0,fallTime:d.fallTime||0,startY:d.startY===undefined?d.y:d.startY,landY:d.landY===undefined?d.y:d.landY}));
  const fossils=makePool(()=>({}), (f,d)=>Object.assign(f,{x:d.x,y:d.y,phase:d.phase||0,taken:false,cluster:d.cluster||0}));
  DR.Entities={pools:{particles,obstacles,fossils},particle(data){return particles.take(data);},obstacle(data){return obstacles.take(data);},fossil(data){return fossils.take(data);},releaseParticle(p){particles.release(p);},releaseObstacle(o){obstacles.release(o);},releaseFossil(f){fossils.release(f);}};
})(window);

