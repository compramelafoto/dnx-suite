const PW = process.env.PLAYWRIGHT_PKG
  || new URL('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/compramelafoto/node_modules/@playwright/test/index.mjs', import.meta.url).href;
const { chromium } = await import(PW);
import fs from 'node:fs';
const D = process.env.DIR;
const plan = JSON.parse(fs.readFileSync(`${D}/plan.json`, 'utf8'));
const pantalla = JSON.parse(fs.readFileSync(`${D}/guion.json`, 'utf8')).pantalla;
const CURSOR = `
(() => { const draw = () => { if (document.getElementById('__cur')) return;
  const d = document.createElement('div'); d.id='__cur';
  d.style.cssText='position:fixed;top:-90px;left:-90px;width:26px;height:26px;border-radius:50%;background:rgba(37,99,235,.30);border:3px solid #2563eb;box-shadow:0 0 0 6px rgba(37,99,235,.10);z-index:2147483647;pointer-events:none;transition:width .12s,height .12s;transform:translate(-50%,-50%)';
  document.body.appendChild(d);
  document.addEventListener('mousemove', e => { d.style.left=e.clientX+'px'; d.style.top=e.clientY+'px'; }, true);
  document.addEventListener('mousedown', () => { d.style.width='40px'; d.style.height='40px'; }, true);
  document.addEventListener('mouseup', () => { d.style.width='26px'; d.style.height='26px'; }, true);
}; if (document.body) draw(); else document.addEventListener('DOMContentLoaded', draw); setInterval(draw, 800); })();`;

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'es-AR',
  recordVideo: { dir: `${D}/clip-pantalla`, size: { width: 1920, height: 1080 } } });
await ctx.addInitScript(CURSOR);
const p = await ctx.newPage();
const tPag = Date.now();
await p.goto(pantalla.url, { waitUntil: 'domcontentloaded' });
await p.waitForSelector(`text=${pantalla.esperar}`, { timeout: 30000 });
await p.waitForTimeout(2500);
const marcas = {}; const t0 = Date.now();
marcas.offset = (t0 - tPag) / 1000;
const reloj = () => (Date.now() - t0) / 1000;
const ir = async (sel, espera) => {
  const e = p.locator(sel).first();
  const box = await e.boundingBox();
  if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 26 }); }
  await p.waitForTimeout(espera);
};
await p.mouse.move(960, 300, { steps: 8 });
await p.waitForTimeout(2600);
for (const [i, sel] of ['input >> nth=0','input >> nth=1','input >> nth=2','input >> nth=3'].entries()) {
  await ir(sel, 1500);
  marcas[`campo${i}`] = reloj();
}
await ir('text=Avisarme cuando estén listas', 600);
marcas.boton = reloj();
const resto = plan.producto * 1000 - (Date.now() - t0);
if (resto > 0) await p.waitForTimeout(resto);
marcas.wall = reloj();
await ctx.close(); await b.close();
fs.writeFileSync(`${D}/marcas-pantalla.json`, JSON.stringify(marcas, null, 1));
console.log(`clip ${marcas.wall.toFixed(2)}s | botón en ${marcas.boton.toFixed(2)}s`);
