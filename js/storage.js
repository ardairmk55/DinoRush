(function(w){
  "use strict";
  // localStorage sarmalayıcısı. Tüm okuma/yazma try/catch içinde; erişim yoksa
  // oyun bellekteki kayıtla çalışmaya devam eder. Mantık js/save-core.js içindedir.
  const DR=w.DinoRush;
  if(!DR||!DR.SaveCore||!DR.Config)return; // eksik yüklemede ui.js kullanıcıya yeniden yükleme önerir
  const Core=DR.SaveCore,catalog=DR.Config.cosmetics,key=DR.Config.saveKey;
  function env(){
    let reducedMotion=false;
    try{reducedMotion=!!(w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(_){}
    return {reducedMotion};
  }
  function read(){
    try{return JSON.parse(w.localStorage.getItem(key)||"null");}catch(_){return null;}
  }
  let data=Core.normalize(read(),catalog,env()),lastOk=null;
  // savedAt: son başarılı yazma zamanı (Ayarlar > Veri'de gösterilir). Yazma başarısızsa bellek kaydıyla devam edilir.
  function save(){
    const prev=data.savedAt;data.savedAt=Date.now();
    try{w.localStorage.setItem(key,JSON.stringify(data));lastOk=true;return true;}catch(_){data.savedAt=prev;lastOk=false;return false;}
  }
  function commit(next){data=Core.normalize(next,catalog,env());save();return data;}
  DR.Storage={
    get(){return data;},
    save,
    update(patch){return commit(Object.assign({},data,patch));},
    addFossils(count){data.fossils+=Math.max(0,count|0);save();return data.fossils;},
    setBest(score){if(score>data.best){data.best=Math.floor(score);save();return true;}return false;},
    addPlayTime(seconds){if(seconds>0&&Number.isFinite(seconds)){data.playTime+=seconds;save();}return data.playTime;},
    state(kind,id){return Core.itemState(data,catalog,kind,id);},
    buy(kind,id){const result=Core.buy(data,catalog,kind,id);if(result.ok)commit(result.data);return result;},
    equip(kind,id){const result=Core.equip(data,catalog,kind,id);if(result.ok)commit(result.data);return result;},
    unequip(kind,id){const result=Core.unequip(data,catalog,kind,id);if(result.ok)commit(result.data);return result;},
    // Kayıt durumu: yerel depolama yazılabiliyor mu, son kayıt zamanı, kayıt boyutu (bayt).
    status(){let bytes=0;try{bytes=(w.localStorage.getItem(key)||"").length;}catch(_){}return {ok:lastOk!==false,savedAt:data.savedAt,bytes};},
    // Tüm yerel verileri siler (ilerleme, ayarlar, Riko geçmişi) ve varsayılanlarla yeniden başlar.
    wipeAll(extraKeys){try{w.localStorage.removeItem(key);(extraKeys||[]).forEach(k=>w.localStorage.removeItem(k));}catch(_){}data=Core.normalize(null,catalog,env());save();return data;},
    resetProgress(){return commit(Core.resetProgress(data,catalog,env()));},
    // Eski API (geriye uyumluluk).
    buySkin(id){const result=this.buy("skin",id);if(result.ok)this.equip("skin",id);return result.ok;},
    selectSkin(id){return this.equip("skin",id).ok;}
  };
})(window);
