(function(w){
  "use strict";
  // Arayüz PNG çerçeveleri ve ikonları. Her görsel ayrı yüklenir:
  // - çerçeve yüklenirse <html> üzerine "png-<ad>" sınıfı eklenir (bileşen sınıflarıyla çakışmasın diye ayrı önek); CSS PNG görünümünü yalnız bu sınıf varken uygular,
  //   yüklenemezse bileşen Aşama 1 CSS görünümünde kalır (yerleşim iki modda aynıdır);
  // - ikon yüklenirse ilgili SVG <symbol> içeriği PNG <image> ile değiştirilir ve "png-icon-<id>" eklenir; yüklenemezse SVG kalır.
  // fetch ve piksel okuması yoktur (file:// uyumlu).
  const DR=w.DinoRush=w.DinoRush||{},root=document.documentElement,SVGNS="http://www.w3.org/2000/svg";
  const status={};
  function load(src){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=src;});}
  function swapSymbol(id,src){
    const sym=document.getElementById(id);if(!sym)return;
    while(sym.firstChild)sym.removeChild(sym.firstChild);
    const image=document.createElementNS(SVGNS,"image");
    image.setAttribute("href",src);image.setAttribute("x","0");image.setAttribute("y","0");
    image.setAttribute("width","24");image.setAttribute("height","24");image.setAttribute("preserveAspectRatio","xMidYMid meet");
    sym.appendChild(image);
  }
  function init(){
    const m=w.DinoRushUIManifest||{frames:{},icons:{}};
    const jobs=[];
    Object.keys(m.frames).forEach(name=>jobs.push(load(m.frames[name]).then(ok=>{status[name]=ok;if(ok)root.classList.add("png-"+name);})));
    Object.keys(m.icons).forEach(id=>jobs.push(load(m.icons[id]).then(ok=>{status[id]=ok;if(ok){swapSymbol(id,m.icons[id]);root.classList.add("png-icon-"+id);}})));
    DR.UISkin.ready=Promise.all(jobs);
  }
  DR.UISkin={status,ready:Promise.resolve()};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
