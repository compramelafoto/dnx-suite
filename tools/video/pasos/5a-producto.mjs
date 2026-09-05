// Playwright se toma del workspace; se puede apuntar a otro con PLAYWRIGHT_PKG.
const PW = process.env.PLAYWRIGHT_PKG
  || new URL('../../../apps/compramelafoto/node_modules/@playwright/test/index.mjs', import.meta.url).href;
const { chromium } = await import(PW);
import fs from 'node:fs';
const D = process.env.DIR;
const plan = JSON.parse(fs.readFileSync(`${D}/plan.json`, 'utf8'));
const pantalla = JSON.parse(fs.readFileSync(`${D}/guion.json`, 'utf8')).pantalla;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CURSOR = `
(() => { const draw = () => { if (document.getElementById('__cur')) return;
  const d = document.createElement('div'); d.id='__cur';
  d.style.cssText='position:fixed;top:-90px;left:-90px;width:30px;height:30px;border-radius:50%;background:rgba(37,99,235,.32);border:3px solid #2563eb;box-shadow:0 0 0 6px rgba(37,99,235,.10);z-index:2147483647;pointer-events:none;transition:width .12s,height .12s;transform:translate(-50%,-50%)';
  document.body.appendChild(d);
  document.addEventListener('mousemove', e => { d.style.left=e.clientX+'px'; d.style.top=e.clientY+'px'; }, true);
  document.addEventListener('mousedown', () => { d.style.width='46px'; d.style.height='46px'; }, true);
  document.addEventListener('mouseup', () => { d.style.width='30px'; d.style.height='30px'; }, true);
}; if (document.body) draw(); else document.addEventListener('DOMContentLoaded', draw); setInterval(draw, 800); })();`;

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: UA,
  locale: 'es-AR', recordVideo: { dir: `${D}/clip-producto`, size: { width: 390, height: 844 } } });
await ctx.addInitScript(CURSOR);
const p = await ctx.newPage();
const tPag = Date.now();
await p.goto(pantalla.url, { waitUntil: 'domcontentloaded' });
await p.waitForSelector(`text=${pantalla.esperar}`, { timeout: 30000 });
await p.waitForTimeout(2500);
await p.evaluate((y) => window.scrollTo(0, y), pantalla.scrollY);
await p.waitForTimeout(700);
const copiar = p.getByText('Copiar link', { exact: true });
const wa = p.getByText('Compartir por WhatsApp Web', { exact: true });
await copiar.waitFor({ state: 'visible', timeout: 15000 });
const marcas = {};
const t0 = Date.now();
marcas.offset = (t0 - tPag) / 1000;
const reloj = () => (Date.now() - t0) / 1000;
await p.mouse.move(195, 700, { steps: 8 });
await p.waitForTimeout(2200);
let box = await copiar.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
await p.waitForTimeout(500);
marcas.copiar = reloj();
await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up();
await p.waitForTimeout(1800);
box = await wa.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });   // solo se posa: no lo clickeamos para no salir de la página
marcas.whatsapp = reloj();
await p.waitForTimeout(900);
const resto = plan.producto * 1000 - (Date.now() - t0);
if (resto > 0) await p.waitForTimeout(resto);
marcas.wall = reloj();
await ctx.close(); await b.close();
fs.writeFileSync(`${D}/marcas-producto.json`, JSON.stringify(marcas, null, 1));
console.log(`clip ${marcas.wall.toFixed(2)}s | copiar en ${marcas.copiar.toFixed(2)}s | whatsapp en ${marcas.whatsapp.toFixed(2)}s`);
