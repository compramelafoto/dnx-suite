import fs from "node:fs";
/*
 * Dibuja el fondo de la historia de bienvenida (lib/social/welcome-stories*.ts) como HTML.
 * Uso (desde apps/compramelafoto):
 *   CLF_LOGO_TS=lib/social/clf-logo-data.ts node scripts/social/bienvenida-fondo.mjs fondo.html
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
 *     --window-size=1080,1920 --screenshot=fondo.png file://$PWD/fondo.html
 * Después se pasa a JPEG (calidad 84) y se pega en lib/social/welcome-story-background.ts.
 * Con [logo.png handle nombre] dibuja una placa completa de muestra.
 */
const [,, out, logoPath, handle, nombre] = process.argv;
const src = fs.readFileSync(process.env.CLF_LOGO_TS, "utf8");
const white = src.match(/CLF_LOGO_WHITE_PNG_BASE64\s*=\s*"([^"]+)"/)[1];
const logo = logoPath ? fs.readFileSync(logoPath).toString("base64") : null;
// bokeh determinístico
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const bokeh = Array.from({ length: 34 }, () => {
  const r = 6 + rnd() * 34, x = rnd() * 1080, y = 120 + rnd() * 1700, a = 0.05 + rnd() * 0.22;
  const c = rnd() < 0.5 ? "255,170,90" : rnd() < 0.5 ? "255,90,130" : "255,255,255";
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="rgba(${c},${a.toFixed(2)})" filter="url(#b${r > 22 ? 2 : 1})"/>`;
}).join("");
// fantasmas del flare sobre la diagonal (870,300) -> (210,1640)
const ghosts = [0.18, 0.31, 0.47, 0.62, 0.8].map((t, i) => {
  const x = 890 + (190 - 890) * t, y = 170 + (1770 - 170) * t, r = [26, 60, 18, 90, 40][i];
  const c = ["255,200,120", "255,120,90", "255,255,255", "255,90,140", "255,180,90"][i];
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(${c},0.07)" stroke="rgba(${c},0.22)" stroke-width="2"/>`;
}).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:#050505;overflow:hidden}
body{position:relative;font-family:"Avenir Next","Helvetica Neue",sans-serif;color:#fff}
.abs{position:absolute;left:0;right:0;text-align:center}
svg.fx{position:absolute;inset:0}
.top img{height:96px}
.kicker{top:408px;font-size:30px;letter-spacing:12px;font-weight:700;color:#ffb36b}
.l1{top:458px;font-family:Futura,sans-serif;font-weight:800;font-stretch:condensed;font-size:92px;line-height:1;color:#fff;letter-spacing:1px}
.l2{top:556px;font-family:Futura,sans-serif;font-weight:800;font-stretch:condensed;font-size:174px;line-height:1;letter-spacing:-2px;
 background:linear-gradient(90deg,#ffd36b,#ff8a4c 50%,#ff4f7b);-webkit-background-clip:text;color:transparent;
 filter:drop-shadow(0 0 28px rgba(255,120,80,.45))}
.card{position:absolute;top:800px;left:190px;width:700px;height:470px;border-radius:44px;background:#fff;
 display:flex;align-items:center;justify-content:center;padding:56px;
 box-shadow:0 0 0 6px rgba(255,255,255,.06),0 30px 110px rgba(255,110,80,.45),0 0 60px rgba(255,80,130,.25)}
.card img{max-width:100%;max-height:100%;object-fit:contain}
.ring{position:absolute;top:776px;left:166px;width:748px;height:518px;border-radius:60px;border:3px solid transparent;
 background:linear-gradient(90deg,#ffd36b,#ff8a4c,#ff4f7b) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor}
.handle{top:1326px;font-size:76px;font-weight:700;letter-spacing:-1px}
.nombre{top:1424px;font-size:40px;color:#b0b0b0;font-weight:500}
.linea{position:absolute;top:1512px;left:390px;width:300px;height:4px;border-radius:4px;background:linear-gradient(90deg,#ffd36b,#ff4f7b);box-shadow:0 0 18px rgba(255,120,90,.8)}
.pie{top:1544px;font-size:38px;line-height:1.35;font-weight:500}
.pie b{color:#ffb36b;font-size:58px;font-weight:700}
</style></head><body>
<svg class="fx" width="1080" height="1920" viewBox="0 0 1080 1920">
 <defs>
  <filter id="b1" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="b2" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="big" filterUnits="userSpaceOnUse" x="-400" y="-400" width="1880" height="2720"><feGaussianBlur stdDeviation="90"/></filter>
  <filter id="grano"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
  <radialGradient id="core"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".12" stop-color="#ffe2b0" stop-opacity=".9"/><stop offset=".4" stop-color="#ff8a4c" stop-opacity=".25"/><stop offset="1" stop-color="#ff4f7b" stop-opacity="0"/></radialGradient>
  <linearGradient id="streak" x1="0" x2="1"><stop offset="0" stop-color="#ff8a4c" stop-opacity="0"/><stop offset=".5" stop-color="#fff2dc" stop-opacity=".85"/><stop offset="1" stop-color="#ff4f7b" stop-opacity="0"/></linearGradient>
  <linearGradient id="haz" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#ffb36b" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 </defs>
 <circle cx="980" cy="160" r="420" fill="#ff7a3c" opacity=".26" filter="url(#big)"/>
 <circle cx="60" cy="1760" r="460" fill="#ff3f7f" opacity=".24" filter="url(#big)"/>
 <circle cx="540" cy="1030" r="430" fill="#ff8a4c" opacity=".16" filter="url(#big)"/>
 <g transform="rotate(-28 540 960)">
  <rect x="-300" y="700" width="1700" height="3" fill="url(#haz)"/>
  <rect x="-300" y="760" width="1700" height="60" fill="url(#haz)" opacity=".35"/>
  <rect x="-300" y="1240" width="1700" height="2" fill="url(#haz)"/>
  <rect x="-300" y="1500" width="1700" height="90" fill="url(#haz)" opacity=".25"/>
 </g>
 ${bokeh}
 ${ghosts}
 <circle cx="890" cy="170" r="200" fill="url(#core)"/>
 <rect x="380" y="167" width="1000" height="6" fill="url(#streak)" filter="url(#b1)"/>
 <rect x="560" y="169" width="700" height="2" fill="#fff" opacity=".8"/>
 <rect x="867" y="160" width="6" height="280" fill="url(#streak)" transform="rotate(90 870 300) rotate(90 870 300)" opacity=".0"/>
 <circle cx="190" cy="1770" r="70" fill="url(#core)" opacity=".7"/>
 <rect x="0" y="1768" width="480" height="4" fill="url(#streak)" filter="url(#b1)" opacity=".8"/>
 <rect width="1080" height="1920" filter="url(#grano)"/>
</svg>
<div class="abs top" style="top:262px"><img src="data:image/png;base64,${white}"></div>
<div class="abs kicker">SE SUMA A LA COMUNIDAD</div>
<div class="abs l1">¡TE DAMOS LA</div>
<div class="abs l2">BIENVENIDA!</div>
<div class="ring"></div>
<div class="card">${logo ? `<img src="data:image/png;base64,${logo}">` : ""}</div>
${handle ? `<div class="abs handle">${handle}</div><div class="abs nombre">${nombre}</div>` : ""}
<div class="linea"></div>
<div class="abs pie">Ya subió su primer álbum en<br><b>COMPRAMELAFOTO.COM</b></div>
</body></html>`;
fs.writeFileSync(out, html);
