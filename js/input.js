(function(w){
  "use strict";
  const DR=w.DinoRush;
  // Çarpışma kutusu görünümü (H) yalnız adres ?debug içerdiğinde açılır.
  const DEBUG=/[?&]debug(?:[=&]|$)/.test(w.location.search);
  function bindHold(element,down,up){let pointer=null;element.addEventListener("pointerdown",e=>{e.preventDefault();pointer=e.pointerId;try{element.setPointerCapture(pointer);}catch(_){} // yakalama reddedilse de düğme çalışsın
element.classList.add("pressed");DR.Audio.init();down(e);});const release=e=>{if(pointer!==null&&e.pointerId!==pointer)return;e.preventDefault();pointer=null;element.classList.remove("pressed");up(e);};element.addEventListener("pointerup",release);element.addEventListener("pointercancel",release);element.addEventListener("lostpointercapture",()=>{pointer=null;element.classList.remove("pressed");up();});}
  function init(){
    document.addEventListener("keydown",e=>{const cfg=DR.Config.controls;if(DR.UI&&DR.UI.hasModal())return;if([...cfg.jump,...cfg.duck].includes(e.code))e.preventDefault();if(e.code==="KeyH"&&!e.repeat&&DEBUG){e.preventDefault();DR.Game.toggleHitboxDebug();return;}if(e.repeat&&cfg.jump.includes(e.code))return;if(cfg.jump.includes(e.code)){DR.Audio.init();if(DR.Game.mode==="menu")DR.Game.start();else DR.Game.jump(true);}else if(cfg.duck.includes(e.code))DR.Game.setDuck(true);else if(cfg.pause.includes(e.code)){if(DR.Game.mode==="playing"||DR.Game.mode==="paused")DR.Game.togglePause();else if(DR.UI.hasModal())DR.UI.closeModal();}});
    document.addEventListener("keyup",e=>{if(DR.UI&&DR.UI.hasModal()&&DR.Game.mode!=="playing")return;if(DR.Config.controls.jump.includes(e.code))DR.Game.jump(false);if(DR.Config.controls.duck.includes(e.code))DR.Game.setDuck(false);});
    bindHold(document.getElementById("jumpButton"),()=>DR.Game.jump(true),()=>DR.Game.jump(false));
    bindHold(document.getElementById("crouchButton"),()=>DR.Game.setDuck(true),()=>DR.Game.setDuck(false));
    // Dokunmatik: dokununca hemen zıpla (gecikme yok); parmak aşağı kayarsa eğil / havadaysa hızla in.
    const canvas=document.getElementById("gameCanvas");let touch=null;
    canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"||DR.Game.mode!=="playing")return;touch={id:e.pointerId,y:e.clientY,swiped:false};try{canvas.setPointerCapture(e.pointerId);}catch(_){}DR.Game.jump(true);});
    canvas.addEventListener("pointermove",e=>{if(!touch||e.pointerId!==touch.id||touch.swiped)return;if(e.clientY-touch.y>=DR.Config.controls.swipeDuckPx){touch.swiped=true;DR.Game.swipeDown();}});
    const endTouch=e=>{if(e.pointerType==="mouse")return;DR.Game.jump(false);if(touch&&e.pointerId===touch.id){if(touch.swiped)DR.Game.setDuck(false);touch=null;}};
    canvas.addEventListener("pointerup",endTouch);canvas.addEventListener("pointercancel",endTouch);
    window.addEventListener("blur",()=>{if(DR.Game.mode==="playing")DR.Game.pause();});
    document.addEventListener("visibilitychange",()=>{if(document.hidden&&DR.Game.mode==="playing")DR.Game.pause();});
    document.addEventListener("contextmenu",e=>{if(e.target.closest(".game-app"))e.preventDefault();});
  }
  DR.Input={init};
})(window);
