(function(w){
  "use strict";
  /*
   * Ses efektleri: kod içinde üretilen retro (sfxr tarzı) sesler. Dış dosya veya lisans gerektirmez.
   * Her ses ilk çalındığında bir kez örneklere işlenir (AudioBuffer) ve önbellekten çalınır; oyun döngüsünde hesap yapılmaz.
   * Ses düzeyi = GENEL SES × EFEKT SESİ; TÜM SESLER kapalıyken hiçbir şey çalmaz.
   */
  const DR=w.DinoRush;let context=null,unlocked=false,lastTest=0,out=null;
  const cache=new Map();
  function init(){if(unlocked){if(context&&context.state==="suspended")context.resume().catch(()=>{});return;}unlocked=true;try{const Ctx=w.AudioContext||w.webkitAudioContext;if(!Ctx)return;context=new Ctx();out=context.createGain();out.connect(context.destination);if(context.state==="suspended")context.resume().catch(()=>{});}catch(_){context=null;}}
  function level(){const s=DR.Storage.get();if(!s.sound)return 0;return (s.masterVolume/100)*(s.sfxVolume/100);}

  /*
   * Katman parametreleri: wave (square|saw|tri|sine|noise), f0→f1 (Hz, üstel kayma), dur (sn), at (yükselme sn),
   * vol, duty (kare dalga), arp ([[zaman oranı, frekans çarpanı], ...]), vib ([hız Hz, derinlik]), lp (0..1 alçak geçiren), delay (sn).
   */
  function renderLayer(buf,L,sr){
    const n=Math.floor(L.dur*sr),start=Math.floor((L.delay||0)*sr),ratio=(L.f1||L.f0)/L.f0,at=Math.max(1,Math.floor((L.at||.004)*sr));
    let phase=0,noise=0,hold=0,lp=0;const a=L.lp||1;
    for(let i=0;i<n&&start+i<buf.length;i++){
      const u=i/n;let f=L.f0*Math.pow(ratio,u);
      if(L.arp)for(const [tt,m] of L.arp)if(u>=tt)f=L.f0*Math.pow(ratio,u)*m;
      if(L.vib)f*=1+Math.sin(2*Math.PI*L.vib[0]*i/sr)*L.vib[1];
      phase+=f/sr;phase-=Math.floor(phase);
      let s;
      switch(L.wave){
        case "square":s=phase<(L.duty||.5)?1:-1;break;
        case "saw":s=phase*2-1;break;
        case "tri":s=phase<.5?phase*4-1:3-phase*4;break;
        case "noise":hold+=f/sr;if(hold>=1){hold-=Math.floor(hold);noise=Math.random()*2-1;}s=noise;break;
        default:s=Math.sin(phase*2*Math.PI);
      }
      lp+=(s-lp)*a;s=lp;
      const env=i<at?i/at:Math.pow(1-(i-at)/Math.max(1,n-at),L.curve||2);
      buf[start+i]+=s*env*(L.vol||.5);
    }
  }
  function build(layers){
    const sr=context.sampleRate,len=Math.ceil(Math.max(...layers.map(l=>(l.delay||0)+l.dur))*sr)+64,b=context.createBuffer(1,len,sr),d=b.getChannelData(0);
    layers.forEach(l=>renderLayer(d,l,sr));
    let peak=0;for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));if(peak>.98)for(let i=0;i<d.length;i++)d[i]*=.98/peak;
    return b;
  }
  const NOTE=n=>440*Math.pow(2,(n-69)/12);
  const SOUNDS={
    jump:()=>[{wave:"square",duty:.25,f0:250,f1:560,dur:.13,vol:.32,lp:.55}],
    fossil:lv=>{const k=Math.pow(2,Math.min(lv,5)*2/12);return [{wave:"tri",f0:880*k,dur:.13,vol:.42,arp:[[.38,1.5]]},{wave:"sine",f0:1760*k,dur:.08,vol:.14}];},
    chain:lv=>{const r=60+Math.min(lv,5)*2;return [{wave:"square",duty:.5,f0:NOTE(r+12),dur:.3,vol:.26,lp:.45,arp:[[.33,Math.pow(2,4/12)],[.66,Math.pow(2,7/12)]],curve:1.4},{wave:"tri",f0:NOTE(r+24),dur:.3,vol:.18,delay:.05,arp:[[.33,Math.pow(2,4/12)],[.66,Math.pow(2,7/12)]]}];},
    nearMiss:()=>[{wave:"noise",f0:2600,f1:900,dur:.2,vol:.22,lp:.35,at:.03},{wave:"sine",f0:1250,f1:1900,dur:.16,vol:.2,delay:.03}],
    hit:()=>[{wave:"noise",f0:1800,f1:300,dur:.32,vol:.45,lp:.25,curve:1.6},{wave:"saw",f0:170,f1:48,dur:.34,vol:.3,lp:.3}],
    thud:()=>[{wave:"noise",f0:700,f1:180,dur:.16,vol:.32,lp:.18},{wave:"sine",f0:95,f1:42,dur:.18,vol:.38}],
    record:()=>[{wave:"square",duty:.5,f0:NOTE(72),dur:.62,vol:.24,lp:.4,curve:1.2,arp:[[.2,Math.pow(2,4/12)],[.4,Math.pow(2,7/12)],[.6,2]]},{wave:"tri",f0:NOTE(60),dur:.62,vol:.2,curve:1.2}],
    achievement:()=>[{wave:"square",duty:.25,f0:NOTE(76),dur:.7,vol:.2,lp:.4,curve:1.3,arp:[[.16,Math.pow(2,3/12)],[.32,Math.pow(2,7/12)],[.5,Math.pow(2,10/12)],[.68,2]]},{wave:"sine",f0:NOTE(88),dur:.7,vol:.12,vib:[7,.012],delay:.08}],
    streak:()=>[{wave:"tri",f0:NOTE(69),dur:.45,vol:.3,arp:[[.33,Math.pow(2,5/12)],[.66,Math.pow(2,9/12)]],curve:1.3}],
    click:()=>[{wave:"tri",f0:620,f1:560,dur:.045,vol:.3}],
    purchase:()=>[{wave:"square",duty:.5,f0:988,dur:.26,vol:.22,lp:.5,arp:[[.25,4/3]],curve:1.4},{wave:"sine",f0:1976,dur:.2,vol:.1,delay:.06}],
    deny:()=>[{wave:"square",duty:.5,f0:196,f1:165,dur:.09,vol:.24,lp:.4},{wave:"square",duty:.5,f0:165,f1:130,dur:.11,vol:.24,lp:.4,delay:.1}],
    count:n=>n>0?[{wave:"tri",f0:NOTE(69),dur:.1,vol:.32}]:[{wave:"tri",f0:NOTE(81),dur:.22,vol:.34},{wave:"square",duty:.25,f0:NOTE(81),dur:.18,vol:.1,lp:.4}],
    test:()=>[{wave:"sine",f0:660,dur:.07,vol:.45}]
  };
  function play(name,arg){
    const lv=level();if(lv<=0)return;init();if(!context)return;
    try{
      if(context.state==="suspended")context.resume().catch(()=>{});
      const key=name+":"+(arg===undefined?"":arg);let buf=cache.get(key);
      if(!buf){buf=build(SOUNDS[name](arg));cache.set(key,buf);}
      const src=context.createBufferSource(),g=context.createGain();g.gain.value=lv;src.buffer=buf;src.connect(g);g.connect(out);src.onended=()=>{try{src.disconnect();g.disconnect();}catch(_){}};src.start();
    }catch(_){}
  }
  DR.Audio={
    init,
    toggle(){const next=!DR.Storage.get().sound;DR.Storage.update({sound:next});return next;},
    jump(){play("jump");},
    fossil(chain){play("fossil",Math.max(0,Math.min(5,chain|0)));},
    chain(level){play("chain",Math.max(1,Math.min(5,level|0)));},
    nearMiss(){play("nearMiss");},
    record(){play("record");},
    hit(){play("hit");},
    thud(){play("thud");},
    countdown(n){play("count",n>0?1:0);},
    achievement(){play("achievement");},
    streak(){play("streak");},
    click(){play("click");},
    purchase(){play("purchase");},
    deny(){play("deny");},
    // Kaydırıcı değişince kısa test sesi (sık tetiklenmeye karşı sınırlı).
    test(){const now=performance.now();if(now-lastTest<90)return;lastTest=now;play("test");},
    haptic(ms){if(DR.Storage.get().vibration&&navigator.vibrate)try{navigator.vibrate(ms||18);}catch(_){}},
    get vibrationSupported(){return typeof navigator!=="undefined"&&typeof navigator.vibrate==="function";},
    // Test/teşhis: üretilen ses sayısı
    get cached(){return cache.size;}
  };
})(window);
