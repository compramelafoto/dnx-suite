// Portadas de cursos con la marca de F64 (estilo aprobado por Daniel el 11/11/2026: Didot fino,
// mucho aire, monograma como marca de agua). Uso, desde la raíz del repo:
//   node apps/fotoffice/scripts/alta/f64-portadas.js <carpeta con logos/ y covers2/>
const sharp=require(require.resolve('sharp',{paths:[process.cwd()+'/apps/fotoffice']}));
const S=process.argv[2];
const cursos=[
 ['inicial','Fotografía','Inicial','Nivel 1','10 clases · 2 h 49 min'],
 ['iluminacion','Iluminación','','Uso técnico y creativo de la luz','8 clases · 3 h 41 min'],
 ['productos','Fotografía','de productos','Con celular, para emprendedores','3 módulos · 54 min'],
 ['boudoir','Workshop','Boudoir','Sensualidad, elegancia e intimidad','1 clase · 1 h 02 min'],
];
(async()=>{
 const mono=await sharp(S+'/logos/monograma-f64-dorado.png').resize({height:1250}).ensureAlpha().toBuffer();
 const ghostFull=await sharp(mono).composite([{input:Buffer.from([255,255,255,26]),raw:{width:1,height:1,channels:4},tile:true,blend:'dest-in'}]).png().toBuffer(); const ghost=await sharp(ghostFull).extract({left:0,top:120,width:760,height:900}).toBuffer();
 const small=await sharp(S+'/logos/monograma-f64-dorado.png').resize({height:64}).toBuffer();
 for(const [k,l1,l2,sub,meta] of cursos){
  const titulo = l2
   ? `<text x='140' y='420' font-family='Didot' font-size='132' fill='#f4efe6' letter-spacing='-1'>${l1}</text><text x='140' y='548' font-family='Didot' font-style='italic' font-size='132' fill='#e2c26a' letter-spacing='-1'>${l2}</text>`
   : `<text x='140' y='500' font-family='Didot' font-size='150' fill='#f4efe6' letter-spacing='-1'>${l1}</text>`;
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1d1d1f'/><stop offset='1' stop-color='#2e2e30'/></linearGradient></defs>
<rect width='1600' height='900' fill='url(#g)'/>
<text x='140' y='210' font-family='Helvetica Neue' font-weight='300' font-size='22' letter-spacing='9' fill='#c9a64a'>CURSO GRABADO</text>
${titulo}
<rect x='140' y='610' width='64' height='1.5' fill='#c9a64a'/>
<text x='140' y='668' font-family='Helvetica Neue' font-weight='300' font-size='34' fill='#d9d3c7'>${sub}</text>
<text x='140' y='716' font-family='Helvetica Neue' font-weight='300' font-size='24' letter-spacing='2' fill='#8f8a80'>${meta}</text>
<text x='216' y='806' font-family='Helvetica Neue' font-weight='300' font-size='20' letter-spacing='6' fill='#8f8a80'>ANDREA DEFAGOT · F64 PRODUCTORA</text>
</svg>`;
  await sharp(Buffer.from(svg)).composite([{input:ghost,left:840,top:0},{input:small,left:140,top:768}]).jpeg({quality:90}).toFile(`${S}/covers2/portada-${k}.jpg`);
 }
})();
