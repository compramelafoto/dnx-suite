import { chromium } from '/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/compramelafoto/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';

const D = process.env.DIR;
const plan = JSON.parse(fs.readFileSync(`${D}/plan.json`, 'utf8'));
const total = plan.intro + plan.producto + plan.escenas.reduce((a, e) => a + e.dur, 0);
const FPS = 25, RETARDO = 0.5;
const N = Math.ceil(total * FPS);
const dir = `${D}/frames-render`;
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await p.goto(`file://${D}/master.html`);
await p.waitForTimeout(700);
// fondo transparente: la pantalla real se compone por debajo con ffmpeg
await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
await p.evaluate(() => window.__start());

const avanzar = async (ms) => {
  const listo = new Promise(r => cdp.once('Emulation.virtualTimeBudgetExpired', r));
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms, maxVirtualTimeTaskStarvationCount: 1000000 });
  await listo;
};
const capturar = async (ruta) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(ruta, Buffer.from(data, 'base64'));
};
const T_PROD = [plan.intro, plan.intro + plan.producto];

await avanzar(RETARDO * 1000);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await capturar(`${dir}/${String(i).padStart(5, '0')}.png`);
  await avanzar(1000 / FPS);
  if (i % 100 === 0) console.log(`  ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
const marcas = await p.evaluate(() => window.__marcas);
fs.writeFileSync(`${D}/marcas-render.json`, JSON.stringify({ fps: FPS, total, marcas }, null, 1));
await b.close();
console.log(`${N} fotogramas en ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
console.log(marcas.filter(x => x.id !== 'unlock').map(x => `${x.id}:${x.t.toFixed(2)}`).join('  '));
