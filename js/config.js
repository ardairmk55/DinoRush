(function(w){
  "use strict";
  const DR=w.DinoRush=w.DinoRush||{};
  // Kozmetik katalog: yalnızca görünüş değiştirir, oynanışa etkisi yoktur.
  // skins[].body/dark/spine yalnızca sprite sayfası yüklenemezse kullanılan prosedürel çizim içindir.
  const skins=[
    {id:"fern",name:"Orman",detail:"Parkın klasik yeşil koşucusu.",cost:0,sheet:"assets/dino/dino_sheet_fern.png",body:"#60be40",dark:"#3a8a30",spine:"#ee542e"},
    {id:"amber",name:"Amber",detail:"Kehribar pulları, koyu kızıl dikenler.",cost:25,sheet:"assets/dino/dino_sheet_amber.png",body:"#e0962e",dark:"#a45e1e",spine:"#963a22"},
    {id:"midnight",name:"Gece Mavisi",detail:"Ay ışığında parlayan mavi pullar.",cost:60,sheet:"assets/dino/dino_sheet_midnight.png",body:"#4274c8",dark:"#284890",spine:"#ffc448"},
    {id:"lavender",name:"Lavanta",detail:"Yumuşak mor, nane yeşili dikenler.",cost:95,sheet:"assets/dino/dino_sheet_lavender.png",body:"#a686d8",dark:"#7258a6",spine:"#52c4a4"},
    {id:"ember",name:"Kızıl",detail:"Kor rengi gövde, altın dikenler.",cost:150,sheet:"assets/dino/dino_sheet_ember.png",body:"#cc4030",dark:"#8c2422",spine:"#ffca46"},
    {id:"gold",name:"Altın",detail:"Parkın en nadir fosil parıltısı.",cost:260,sheet:"assets/dino/dino_sheet_gold.png",body:"#eaba36",dark:"#b27e18",spine:"#ba2a3e"}
  ];
  const trails=[
    {id:"dust",name:"Toz",detail:"Patikada kalkan ince toz.",cost:0},
    {id:"leaf",name:"Yaprak",detail:"Adımlarından savrulan eğrelti yaprakları.",cost:30},
    {id:"spark",name:"Kıvılcım",detail:"Çitlerden sıçrayan sıcak kıvılcımlar.",cost:75},
    {id:"firefly",name:"Ateş Böceği",detail:"Peşine takılan parlak ateş böcekleri.",cost:120}
  ];
  // Sahne: yalnızca renk derecelendirme (multiply + screen) ve sis tonu.
  const scenes=[
    {id:"night",name:"Gece",detail:"Parkın serin, turkuaz gecesi.",cost:0,grade:null,fog:["#2e7e78","#4fc3b0"]},
    {id:"dawn",name:"Şafak",detail:"Pembe ufuk, ılık sabah sisi.",cost:80,grade:{multiply:"#ffdfe6",top:"rgba(255,152,186,.36)",bottom:"rgba(255,206,150,.14)"},fog:["#b07a8e","#f2b8a0"]},
    {id:"sunset",name:"Gün Batımı",detail:"Turuncu gökyüzü, mor gölgeler.",cost:150,grade:{multiply:"#ffc8b4",top:"rgba(255,112,36,.38)",bottom:"rgba(132,44,120,.26)"},fog:["#9c4e6c","#ff9a5c"]}
  ];
  // Ölçülen 9 parçalı kesim değerleri (tools/make_ui_assets.py yazar; elle düzenleme).
  /*UI_SLICES_START*/
  DR.UISlices=Object.freeze({btn_primary:{w:1000,h:311,slice:[155,219,156,228]},btn_secondary:{w:700,h:186,slice:[93,128,93,131]},panel_frame:{w:1200,h:782,slice:[120,158,123,165]},card_frame:{w:700,h:418,slice:[84,110,89,115]},plate_record:{w:900,h:256,slice:[128,200,128,202]},pill_counter:{w:700,h:216,slice:[108,144,108,195]},plank_tagline:{w:1000,h:237,slice:[118,147,119,143]}});
  /*UI_SLICES_END*/
  DR.Config=Object.freeze({
    version:"1.2.0",
    saveKey:"dinorush-save-v1",
    viewport:{baseHeight:360,minWidth:640,portraitWidth:440,portraitShift:76,portraitGroundRatio:.64,portraitTouchReserve:150,groundRatio:.82,midSink:90,dprMax:3,dprMaxTouch:2},
    physics:{step:1/60,jumpPrep:.03,fastFall:650,maxFrame:.1,runSpeed:335,maxSpeed:450,speedGain:.13,jumpVelocity:-525,jumpHoldGravity:1080,jumpHoldMax:.18,jumpBuffer:.12,coyoteTime:.09,gravity:1520,duckHeight:25,playerWidth:42,playerHeight:49,playerX:120,obstacleMinGap:325,obstacleMaxGap:540},
    dinoSprite:{worldPixel:2,frameWidth:44,frameHeight:36,footRow:34,animations:{idle:{row:0,frames:6,fps:6},run:{row:1,frames:6,fps:14},jump:{row:2,frames:3,fps:1},duck:{row:3,frames:2,fps:10},dead:{row:4,frames:2,fps:4}},hitboxes:{standing:{x:11,y:6,w:25,h:29},duck:{x:9,y:17,w:30,h:18}}},
    // Pterosaur: sabit boyut, iki şerit. lanes = çarpışma kutusu alt kenarının zeminden yüksekliği.
    // low (10): ayakta ve eğilmiş dinoya çarpar -> ZIPLA. high (44): ayakta dinoya çarpar, eğilmiş dinonun (üst kenar 36) üstünden geçer -> EĞİL.
    ptero:{scale:.75,speedFactor:1.1,hitboxInset:{x:.16,y:.22},lanes:{low:10,high:44},minScore:120,highFromScore:300,spawnLead:150},
    artAssets:{pixelWorld:2,hitboxInset:.12,sizes:{bgFar:[320,180],bgMid:[320,100],ground:[320,48],fgFerns:[320,48],logo:[320,176],log:[44,22],rock:[40,22],bush:[28,32],ptero:[40,26],fossil:[18,18]}},
    palette:{night:"#07161c",deep:"#0e2a30",forest:"#14404a",moon:"#7fffe8",moonSoft:"#bffff2",amber:"#ffb020",amberLight:"#ffd36b",amberDark:"#7a3b0a",green:"#5dbb3f",greenMid:"#3e8f2e",greenDark:"#2a6325",belly:"#f1e3a6",spine:"#e8452c",metal:"#2b2622",metalMid:"#4a3f36",metalLight:"#6b5a48",moss:"#4f7a2a"},
    skins,
    cosmetics:{skins,trails,scenes},
    settings:{sound:true,vibration:false,lowEffects:false},
    controls:{swipeDuckPx:28,jump:["Space","ArrowUp","KeyW"],duck:["ArrowDown","KeyS"],pause:["KeyP","Escape"]}
  });
})(window);
