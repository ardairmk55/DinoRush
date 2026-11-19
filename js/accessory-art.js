(function(w){
  "use strict";
  /*
   * Riko aksesuarlarının piksel çizimleri ve sprite'a bağlanması.
   * Her çizim sprite pikseli cinsindendir (1 karakter = 1 sprite pikseli, "." boş).
   * Konum, karedeki ibik (kafanın en üst pikseli) noktasına göredir; ibik konumu her kare için
   * assets/dino/dino_sheet*.png üzerinden ölçülmüştür (tüm görünümler aynı geometride).
   * Çizimler bir kez küçük tuvallere işlenir, sonra tam sayı ölçekle çizilir (piksel net, ucuz).
   */
  const DR=w.DinoRush=w.DinoRush||{};
  // [satır][kare] -> ibik [x,y]. Satırlar: 0 idle, 1 run, 2 jump, 3 duck, 4 dead (js/config.js dinoSprite).
  const ANCHORS=[
    [[26,1],[26,1],[26,2],[26,2],[26,1],[26,1]],
    [[27,0],[27,0],[27,1],[27,0],[27,0],[27,0]],
    [[27,0],[27,0],[26,1]],
    [[28,11],[28,10]],
    [[26,0],[26,2]]
  ];
  // Göğüs/sırt aksesuarları (gear) gövdeye bağlıdır: eğilmede kafa 10 px iner ama gövde ~5 px iner.
  const GEAR_ANCHORS=ANCHORS.map((row,r)=>r===3?[[24,6],[24,5]]:row);
  const K="#21170f"; // ortak koyu kontur (sprite konturuyla uyumlu)
  // parts: [{at:[dx,dy], rows:[...]}], dx/dy ibiğe göre sol üst köşe.
  const ART={
    "explorer-hat":{colors:{K,k:"#d6bc84",h:"#f1e1b2",b:"#7a4e2a"},parts:[{at:[-9,-1],rows:[
      ".......KKKK.......",
      ".....KKkkhhKK.....",
      "....KkkkkkhhkK....",
      "....KkkkkkkkkK....",
      "....KbbbbbbbbK....",
      ".KKKkkkkkkkkkkKKK.",
      "KkkkkkkkkkkkkkkkhK",
      ".KKKKKKKKKKKKKKKK."]}]},
    "winter-beanie":{colors:{K,b:"#2e8e98",d:"#1f6670",w:"#f1ede2"},parts:[{at:[-9,-2],rows:[
      "........KKK.......",
      ".......KwwwK......",
      "........KKK.......",
      ".....KKKKKKKK.....",
      "....KbbbbbbbbK....",
      "...KbbbbbbbbbbK...",
      "...KwwwwwwwwwwK...",
      "...KbdbdbdbdbdK...",
      "...KKKKKKKKKKKK..."]}]},
    "pirate-bandana":{colors:{K,r:"#cf3a2e",d:"#8e1f1d",W:"#f5ead2"},parts:[{at:[-9,1],rows:[
      "......KKKKKKK.....",
      "....KKrrWrrrrKK...",
      "...KrrrrrrrWrrrK..",
      ".KKrrWrrrrrrrrWrK.",
      "KrrKdddddddddddddK",
      "KrdK.KKKKKKKKKKKK.",
      ".KrrK.............",
      "..KK.............."]}]},
    "ranger-hat":{colors:{K,o:"#6f7d3c",O:"#8d9c52",t:"#c9a46a",y:"#ffd34d"},parts:[{at:[-9,-2],rows:[
      "........KK........",
      ".......KoOK.......",
      "......KoKKOK......",
      ".....KooooOOK.....",
      "....KooooooOOK....",
      "....KttttyttK.....",
      ".KKKooooooooooKKK.",
      "KoooooooooooooooOK",
      ".KKKKKKKKKKKKKKKK."]}]},
    "egg-helmet":{colors:{K,e:"#f3ead2",s:"#d6c9a8",g:"#6aa84f"},parts:[{at:[-9,-1],rows:[
      "......KKKKK......",
      "....KKeeeeeKK....",
      "...KeegeeeeeeK...",
      "..KeeeeeeeegesK..",
      "..KegeeeeeeeesK..",
      "..KeeeeeeeeessK..",
      "..KeeKeeeKeeeKK..",
      "...KK.KKK.KKK...."]}]},
    "gold-crown":{colors:{K,y:"#f4c534",Y:"#ffe68a",d:"#b8860b",R:"#d8343c",B:"#3a7bd5"},parts:[{at:[-6,-1],rows:[
      "..K...K...K..",
      ".KYK.KYK.KYK.",
      ".KyyKyyyKyyK.",
      ".KyRyyByyRyK.",
      ".KdddddddddK.",
      ".KKKKKKKKKKK."]}]},
    "scholar-glasses":{colors:{F:"#c9963a",g:"rgba(196,236,255,.30)",h:"rgba(255,255,255,.55)"},parts:[{at:[-9,7],rows:[
      "..........FFFF..",
      ".........FhgggF.",
      "........FghggggF",
      "FFFFFFFFFggggggF",
      "........FggggggF",
      "........FggggggF",
      "........FggggggF",
      "........FggggggF",
      ".........FggggF.",
      "..........FFFF.."]}]},
    "sunglasses":{colors:{K,b:"#151a24",W:"#dfeeff",B:"#2a3346"},parts:[{at:[-9,7],rows:[
      "........KKKKKKKK",
      "KKKKKKKKKbbbbbbK",
      "........KbWWbbbK",
      "........KbWbbbbK",
      "........KbbbbbbK",
      "........KbbbbbBK",
      "........KbbbbBBK",
      ".........KbbbbK.",
      "..........KKKK.."]}]},
    "aviator":{colors:{F:"#e3b443",a:"#d98a32",A:"#8f4a1c",C:"#f5c27a"},parts:[{at:[-9,7],rows:[
      "........FFFFFFFF",
      "FFFFFFFFFaaaaaaF",
      "........FaCaaaaF",
      "........FCaaaaaF",
      "........FaaaaaaF",
      "........FAaaaaAF",
      ".........FAaaAF.",
      "..........FAAF..",
      "...........FF..."]}]},
    "neon-shades":{colors:{P:"#ff3fb4",c:"#47f5ff",C:"#c8fdff",d:"#21b8d0"},parts:[{at:[-9,7],rows:[
      "........PPPPPPPP",
      "PPPPPPPPPcCccccP",
      "........PcCccccP",
      "........PccccccP",
      "........PccccccP",
      "........PddddddP",
      "........PPPPPPPP"]}]},
    "night-vision":{colors:{K,h:"#3b4636",H:"#56634e",S:"#1b1e1a",L:"#8dff5f",l:"#3fae2c"},parts:[{at:[-9,7],rows:[
      "........KKKKKKKK..",
      "SSSSSSSSKhhhhhhKKK",
      "........KhHhhhhKLK",
      "........KhhhhhhKLK",
      "........KhhhhhhKlK",
      "........KhhhhhhKKK",
      "........KKKKKKKK.."]}]},
    "mini-scarf":{colors:{K,t:"#3fb5a5",w:"#f1ede2"},parts:[{at:[-18,19],rows:[
      "......KKKKKKKKKKKKKK..",
      ".....KtwttwttwttwttwK.",
      "KKKKKKtwttwttwttwttwK.",
      "KtwttwKKKKKKKKKKKKKK..",
      ".KKKKK................"]}]},
    "red-neckerchief":{colors:{K,r:"#d63a2c",d:"#9b2219"},parts:[{at:[-12,19],rows:[
      ".KKKKKKKKKKKKKKK.",
      "KrrrrrrrrrrrrrrrK",
      ".KKKKKKKKKKKrrrdK",
      "............KrrdK",
      "............KrdK.",
      ".............KK.."]}]},
    "explorer-badge":{colors:{K,r:"#d63a2c",b:"#2f6fd0",y:"#f2c230",Y:"#fff1a0"},parts:[{at:[-8,21],rows:[
      ".KrK.",
      ".KbK.",
      "KKyKK",
      "KyYyK",
      "KyyyK",
      ".KKK."]}]},
    "backpack":{colors:{K,b:"#8a5a2b",B:"#5e3a1a",y:"#e8c25a"},parts:[
      {at:[-21,18],rows:[
        "..KKKKKKK.",
        ".KbbbbbbbK",
        "KbbbbbbbbK",
        "KBBBBBBBBK",
        "KbbbbybbbK",
        "KbbbbbbbbK",
        ".KbbbbbbK.",
        "..KKKKKK.."]},
      {at:[-11,22],rows:["BBBBBBBBBBBB"]}]},
    "fossil-necklace":{colors:{K,c:"#5a3a1e",a:"#f0a030",O:"#8a4b12"},parts:[{at:[-12,20],rows:[
      "cccccccccccc...",
      "...........KKK.",
      "..........KaaaK",
      "..........KaOaK",
      "..........KaaaK",
      "...........KKK."]}]},
    "ranger-gear":{colors:{K,o:"#5d6b32",O:"#7d8c45",t:"#c9a46a",y:"#ffd34d",g:"#9fe36a",s:"#2b2f22"},parts:[
      {at:[-21,12],rows:[
        ".......g..",
        ".......K..",
        ".......K..",
        ".......K..",
        "..KKKKKKK.",
        ".KoooooooK",
        "KoOOOOOOoK",
        "KoOssssOoK",
        "KoOOOOOOoK",
        "KoooooooooK".slice(0,10),
        "KoottttooK",
        "KooooooooK",
        ".KooooooK.",
        "..KKKKKK.."]},
      {at:[-11,21],rows:["tttttttttttt"]},
      {at:[-4,22],rows:[".KK.","KyyK","KyyK",".KK."]}]}
  };

  const cache=new Map();
  function render(id){
    if(cache.has(id))return cache.get(id);
    const def=ART[id];if(!def||!w.document){cache.set(id,null);return null;}
    let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    def.parts.forEach(p=>{minX=Math.min(minX,p.at[0]);minY=Math.min(minY,p.at[1]);maxX=Math.max(maxX,p.at[0]+Math.max(...p.rows.map(r=>r.length)));maxY=Math.max(maxY,p.at[1]+p.rows.length);});
    const cv=w.document.createElement("canvas");cv.width=maxX-minX;cv.height=maxY-minY;
    const ctx=cv.getContext("2d");
    def.parts.forEach(p=>p.rows.forEach((row,y)=>{for(let x=0;x<row.length;x++){const ch=row[x];if(ch===".")continue;ctx.fillStyle=def.colors[ch]||"#f0f";ctx.fillRect(p.at[0]-minX+x,p.at[1]-minY+y,1,1);}}));
    const out={canvas:cv,dx:minX,dy:minY};cache.set(id,out);return out;
  }
  const ORDER=["gear","face","head"];
  /**
   * Kuşanılan aksesuarları çizer. (x0,y0): sprite karesinin sol üst köşesinin tuvaldeki yeri, px: sprite pikseli başına tuval pikseli.
   * Çağıran imageSmoothingEnabled=false ayarlamış olmalı (sprite çizimiyle aynı).
   */
  function draw(ctx,row,frame,x0,y0,px,loadout){
    if(!loadout)return;
    for(const slot of ORDER){
      const id=loadout[slot];if(!id)continue;
      const table=slot==="gear"?GEAR_ANCHORS:ANCHORS,a=(table[row]&&table[row][frame])||table[0][0];
      const r=render(id);if(!r)continue;
      ctx.drawImage(r.canvas,x0+(a[0]+r.dx)*px,y0+(a[1]+r.dy)*px,r.canvas.width*px,r.canvas.height*px);
    }
  }
  DR.AccessoryArt={draw,has:id=>!!ART[id],ids:Object.keys(ART),ANCHORS};
})(window);
