(function(w){
  "use strict";
  const DR=w.DinoRush;
  // Çarpışma kutusu görünümü (H) yalnız adres ?debug içerdiğinde açılır.
  const DEBUG=/[?&]debug(?:[=&]|$)/.test(w.location.search);
  function bindHold(element,down,up){let pointer=null;element.addEventListener("pointerdown",e=>{e.preventDefault();pointer=e.pointerId;element.setPointerCapture(pointer);element.classList.add("pressed");DR.Audio.init();down(e);});const release=e=>{if(pointer!==null&&e.pointerId!==pointer)return;e.preventDefault();pointer=null;element.classList.remove("pressed");up(e);};element.addEventListener("pointerup",release);element.addEventListener("pointercancel",release);element.addEventListener("lostpointercapture",()=>{pointer=null;element.classList.remove("pressed");up();});}
  function init(){
    document.addEventListener("keydown",e=>{const cfg=DR.Config.controls;if(DR.UI&&DR.UI.hasModal())return;if([...cfg.jump,...cfg.duck].includes(e.code))e.preventDefault();if(e.code==="KeyH"&&!e.repeat&&DEBUG){e.preventDefault();DR.Game.toggleHitboxDebug();return;}if(e.repeat&&cfg.jump.includes(e.code))return;if(cfg.jump.includes(e.code)){DR.Audio.init();if(DR.Game.mode==="menu")DR.Game.start();else DR.Game.jump(true);}else if(cfg.duck.includes(e.code))DR.Game.setDuck(true);else if(cfg.pause.includes(e.code)){if(DR.Game.mode==="playing"||DR.Game.mode==="paused")DR.Game.togglePause();else if(DR.UI.hasModal())DR.UI.closeModal();}});
    document.addEventListener("keyup",e=>{if(DR.UI&&DR.UI.hasModal()&&DR.Game.mode!=="playing")return;if(DR.Config.controls.jump.includes(e.code))DR.Game.jump(false);if(DR.Config.controls.duck.includes(e.code))DR.Game.setDuck(false);});
    bindHold(document.getElementById("jumpButton"),()=>DR.Game.jump(true),()=>DR.Game.jump(false));
    bindHold(document.getElementById("crouchButton"),()=>DR.Game.setDuck(true),()=>DR.Game.setDuck(false));
    document.getElementById("gameCanvas").addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"&&DR.Game.mode==="playing")DR.Game.jump(true);});
    document.getElementById("gameCanvas").addEventListener("pointerup",e=>{if(e.pointerType!=="mouse")DR.Game.jump(false);});
    window.addEventListener("blur",()=>{if(DR.Game.mode==="playing")DR.Game.pause();});
    document.addEventListener("visibilitychange",()=>{if(document.hidden&&DR.Game.mode==="playing")DR.Game.pause();});
    document.addEventListener("contextmenu",e=>{if(e.target.closest(".game-app"))e.preventDefault();});
  }
  DR.Input={init};
})(window);
