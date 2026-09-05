const PW = process.env.PLAYWRIGHT_PKG
  || new URL('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/compramelafoto/node_modules/@playwright/test/index.mjs', import.meta.url).href;
const { chromium } = await import(PW);
import fs from 'node:fs';
const D = process.env.DIR;
const plan = JSON.parse(fs.readFileSync(`${D}/plan.json`, 'utf8'));
const total = plan.intro + plan.escenas.reduce((a, e) => a + e.dur, 0);
const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: `${D}/clip-master`, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage();
const tPag = Date.now();
await p.goto(`file://${D}/master.html`);
const listo = await p.evaluate(() => window.__listo());
await p.waitForTimeout(400);
const offset = (Date.now() - tPag) / 1000;
await p.evaluate(() => window.__start());
await p.waitForTimeout(total * 1000 + 900);
const marcas = await p.evaluate(() => window.__marcas);
const fin = await p.evaluate(() => window.__fin());
const wall = (Date.now() - tPag) / 1000;
await ctx.close(); await b.close();
fs.writeFileSync(`${D}/marcas-master.json`, JSON.stringify({ offset, wall, fin, marcas }, null, 1));
console.log('video precargado:', listo, '| plan', total.toFixed(1), 's | reloj', fin.toFixed(1), 's');
console.log(marcas.filter(x => x.id !== 'paso').map(x => `${x.id}:${x.t.toFixed(1)}`).join('  '));
