(function(w){
  "use strict";
  // Web Audio efektleri. Ses düzeyi = ana ses × efekt sesi; "sound" alanı sessiz anahtarıdır.
  const DR=w.DinoRush;let context=null,unlocked=false,lastTest=0;
  function init(){if(unlocked)return;unlocked=true;try{const Ctx=w.AudioContext||w.webkitAudioContext;if(!Ctx)return;context=new Ctx();if(context.state==="suspended")context.resume();}catch(_){context=null;}}
  function level(){const s=DR.Storage.get();if(!s.sound)return 0;return (s.masterVolume/100)*(s.sfxVolume/100);}
  function tone(freq,duration,type,volume){const gainLevel=level();if(gainLevel<=0)return;init();if(!context)return;try{if(context.state==="suspended")context.resume();const osc=context.createOscillator(),gain=context.createGain(),peak=Math.max(.0002,(volume||.035)*gainLevel*1.25);osc.type=type||"sine";osc.frequency.setValueAtTime(freq,context.currentTime);gain.gain.setValueAtTime(peak,context.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration);osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(context.currentTime+duration);}catch(_){}}
  DR.Audio={
    init,
    toggle(){const next=!DR.Storage.get().sound;DR.Storage.update({sound:next});return next;},
    jump(){tone(220,.08,"triangle",.025);},
    fossil(){tone(670,.07,"sine",.045);setTimeout(()=>tone(910,.06,"sine",.025),38);},
    record(){tone(440,.11,"triangle");setTimeout(()=>tone(660,.16,"triangle"),110);setTimeout(()=>tone(880,.22,"triangle"),230);},
    hit(){tone(115,.27,"sawtooth",.055);},
    click(){tone(360,.045,"square",.018);},
    purchase(){tone(520,.08,"triangle",.04);setTimeout(()=>tone(780,.1,"triangle",.035),70);setTimeout(()=>tone(1040,.16,"sine",.03),150);},
    deny(){tone(150,.12,"square",.02);},
    // Kaydırıcı değişince kısa test sesi (sık tetiklenmeye karşı sınırlı).
    test(){const now=performance.now();if(now-lastTest<90)return;lastTest=now;tone(660,.07,"sine",.045);},
    haptic(ms){if(DR.Storage.get().vibration&&navigator.vibrate)try{navigator.vibrate(ms||18);}catch(_){}},
    get vibrationSupported(){return typeof navigator!=="undefined"&&typeof navigator.vibrate==="function";}
  };
})(window);
