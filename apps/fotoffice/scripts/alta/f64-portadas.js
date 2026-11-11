// Portadas de cursos con la marca de F64. Estilo aprobado por Daniel el 11/11/2026: letra Jost
// fina (200, cursiva para la segunda línea), mucho aire, monograma como marca de agua. El texto se
// convierte en trazos con opentype.js, así no depende de las fuentes instaladas.
//
// Preparación (fuera del repo, en una carpeta temporal):
//   npm i opentype.js@1.3.4
//   bajar de https://cdn.jsdelivr.net/npm/@fontsource/jost@5.1.0/files/ los archivos
//   jost-latin-200-normal.woff, jost-latin-300-normal.woff y jost-latin-200-italic.woff,
//   guardados como jost-200.woff, jost-300.woff y jost-200i.woff
// Uso, con este archivo copiado junto a node_modules/opentype.js:
//   SHARP=$(node -p "require.resolve('sharp',{paths:['apps/fotoffice']})") FUENTES=<fuentes> \
//   SALIDA=<salida> LOGOS=<carpeta con monograma-f64-dorado.png> node f64-portadas.js jost
const path=require('path');
const opentype=require(path.join(__dirname,'node_modules/opentype.js'));
const sharp=require(process.env.SHARP);
const F=process.env.FUENTES, S=process.env.SALIDA, L=process.env.LOGOS;
const fam=process.argv[2]||'jost', solo=process.argv[3];
const f=(w,i)=>opentype.loadSync(`${F}/${fam}-${w}${i?'i':''}.woff`);
const fl=f(200), fr=f(300), fi=(()=>{try{return f(200,true)}catch{return fl}})();
function t(font,txt,x,y,size,fill,track=0,op=1){ // texto como trazo, con espaciado
  let d='',cx=x; for(const ch of txt){const g=font.charToGlyph(ch); d+=g.getPath(cx,y,size).toPathData(2); cx+=g.advanceWidth*size/font.unitsPerEm+track;}
  return `<path d='${d}' fill='${fill}' fill-opacity='${op}'/>`;}
const cursos=[
 ['inicial','Fotografía','inicial','Nivel 1','10 clases · 2 h 49 min'],
 ['iluminacion','Iluminación','','Uso técnico y creativo de la luz','8 clases · 3 h 41 min'],
 ['productos','Fotografía','de productos','Con celular, para emprendedores','3 módulos · 54 min'],
 ['boudoir','Workshop','boudoir','Sensualidad, elegancia e intimidad','1 clase · 1 h 02 min'],
];
(async()=>{
 const mono=await sharp(`${L}/monograma-f64-dorado.png`).resize({height:1250}).ensureAlpha().toBuffer();
 const gf=await sharp(mono).composite([{input:Buffer.from([255,255,255,22]),raw:{width:1,height:1,channels:4},tile:true,blend:'dest-in'}]).png().toBuffer();
 const ghost=await sharp(gf).extract({left:0,top:120,width:760,height:900}).toBuffer();
 const small=await sharp(`${L}/monograma-f64-dorado.png`).resize({height:56}).toBuffer();
 for(const [k,l1,l2,sub,meta] of cursos){ if(solo&&k!==solo) continue;
  const tit = l2 ? t(fl,l1,136,410,128,'#f4efe6',-1)+t(fi,l2,136,540,128,'#d9b85c',-1)
                 : t(fl,l1,136,500,140,'#f4efe6',-1);
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1b1b1d'/><stop offset='1' stop-color='#2c2c2e'/></linearGradient></defs>
<rect width='1600' height='900' fill='url(#g)'/>
${t(fr,'CURSO GRABADO',140,210,20,'#c9a64a',8)}
${tit}
<rect x='140' y='608' width='56' height='1' fill='#c9a64a'/>
${t(fr,sub,140,666,32,'#d9d3c7',0.3)}
${t(fr,meta,140,712,22,'#8f8a80',1.5)}
${t(fr,'ANDREA DEFAGOT · F64 PRODUCTORA',212,800,17,'#8f8a80',5)}
</svg>`;
  await sharp(Buffer.from(svg)).composite([{input:ghost,left:840,top:0},{input:small,left:140,top:762}]).jpeg({quality:90}).toFile(`${S}/portada-${k}${solo?'-'+fam:''}.jpg`);
 }})();
