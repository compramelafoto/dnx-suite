// Grabador de pantallas del curso. Cada toma se marca con await h.toma(n); el montaje corta el video en esas marcas.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire("/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/node_modules/.pnpm/playwright@1.51.1/node_modules/playwright/");
const { chromium } = require("playwright");
export const DIR = new URL(".", import.meta.url).pathname;
export const BASE = "https://www.compramelafoto.com";
const VW = 1280, VH = 720;

const CSS = '[class*="z-[9995]"],[class*="z-[10000]"],.dnxbot-raiz,.dnx-tour-bubble,[data-sonner-toaster]{display:none!important}' +
  '#cursor-falso{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);transition:transform .08s}' +
  '#cursor-falso.click{transform:translate(-3px,-2px) scale(.82)}' +
  '.anillo-curso{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #c27b3d;border-radius:12px;box-shadow:0 0 0 6px rgba(194,123,61,.22);transition:opacity .35s;opacity:0}';

export async function grabar(nombre, opciones, cuerpo) {
  const b = await chromium.launch({ headless: true });
  const ctxOpts = { viewport: { width: VW, height: VH }, deviceScaleFactor: 1, locale: "es-AR",
    recordVideo: { dir: DIR + "video", size: { width: VW, height: VH } } };
  if (opciones.sesion !== false) ctxOpts.storageState = DIR + "sesion.json";
  const ctx = await b.newContext(ctxOpts);
  await ctx.addInitScript((css) => {
    const poner = () => {
      if (document.getElementById("cursor-falso")) return;
      const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
      const c = document.createElement("div"); c.id = "cursor-falso";
      c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      const q = document.createElement("div"); q.id = "marca-curso";
      let col = "#ffff00"; try { col = localStorage.getItem("__marcaCurso") || col; } catch {}
      q.style.cssText = "position:fixed;right:0;bottom:0;width:10px;height:10px;z-index:2147483647;pointer-events:none;background:" + col;
      document.body.appendChild(q);
      const xy = window.__cursorXY || [640, 360]; c.style.left = xy[0] + "px"; c.style.top = xy[1] + "px";
      addEventListener("mousemove", (e) => { window.__cursorXY = [e.clientX, e.clientY]; c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
      addEventListener("mousedown", () => c.classList.add("click"), true);
      addEventListener("mouseup", () => c.classList.remove("click"), true);
    };
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", poner); else poner();
  }, CSS);
  const p = await ctx.newPage();
  const t0 = Date.now(); const marcas = {}; const orden = []; const COLORES = ["#ff0000", "#00ff00", "#0000ff"];
  let cx = 640, cy = 360;
  const h = {
    p,
    async toma(n) {
      marcas["t" + n] = (Date.now() - t0) / 1000; orden.push("t" + n);
      const col = COLORES[orden.length % 3];
      await p.evaluate((col) => { try { localStorage.setItem("__marcaCurso", col); } catch {} const q = document.getElementById("marca-curso"); if (q) q.style.background = col; }, col);
      await p.waitForTimeout(120);
    },
    async esperar(ms) { await p.waitForTimeout(ms); },
    async ir(ruta) { await p.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {}); await p.waitForTimeout(800); await p.mouse.move(cx, cy); },
    loc(x) { return typeof x === "string" ? p.getByText(x, { exact: false }).filter({ visible: true }).first() : x; },
    async verEn(x) {
      const l = h.loc(x); await l.waitFor({ state: "visible", timeout: 15000 });
      await l.evaluate((el) => {
        let sc = el.parentElement;
        while (sc && !(sc.scrollHeight > sc.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        const r = el.getBoundingClientRect();
        if (r.top > 110 && r.bottom < innerHeight - 90) return false;
        const delta = r.top - innerHeight * 0.38;
        if (sc && sc !== document.documentElement && sc !== document.body) sc.scrollBy({ top: delta, behavior: "smooth" });
        else window.scrollBy({ top: delta, behavior: "smooth" });
        return true;
      }).then((mov) => mov && p.waitForTimeout(850));
      return l;
    },
    async mover(x, { dx = 0.5, ms = 700 } = {}) {
      const l = await h.verEn(x); const bb = await l.boundingBox();
      const tx = bb.x + Math.min(bb.width * dx, bb.width - 8), ty = bb.y + bb.height / 2;
      await p.mouse.move(tx, ty, { steps: Math.max(12, Math.round(ms / 25)) }); cx = tx; cy = ty;
      await p.waitForTimeout(200); return l;
    },
    async señalar(x, ms = 1600, pad = 8) {
      const l = await h.verEn(x); const bb = await l.boundingBox();
      await p.evaluate(({ bb, pad, ms }) => {
        const a = document.createElement("div"); a.className = "anillo-curso";
        Object.assign(a.style, { left: bb.x - pad + "px", top: bb.y - pad + "px", width: bb.width + 2 * pad + "px", height: bb.height + 2 * pad + "px" });
        document.body.appendChild(a); requestAnimationFrame(() => (a.style.opacity = "1"));
        setTimeout(() => { a.style.opacity = "0"; setTimeout(() => a.remove(), 400); }, ms);
      }, { bb, pad, ms });
      await h.mover(l, { ms: 600 });
      await p.waitForTimeout(ms - 400);
      return l;
    },
    async clic(x, opts) { const l = await h.mover(x, opts); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(700); return l; },
    async tipear(x, texto, delay = 70) { const l = await h.clic(x); await p.keyboard.type(texto, { delay }); await p.waitForTimeout(300); return l; },
    async arriba() { await p.evaluate(() => { window.scrollTo({ top: 0, behavior: "smooth" }); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop > 0 && e.scrollHeight > 400) e.scrollTo({ top: 0, behavior: "smooth" }); }); }); await p.waitForTimeout(900); },
  };
  try {
    await cuerpo(h);
    await h.toma("__fin"); marcas.fin = marcas["t__fin"]; delete marcas["t__fin"]; orden[orden.length - 1] = "fin";
    await p.waitForTimeout(600);
  } catch (err) {
    await p.screenshot({ path: DIR + "error-" + nombre + ".png" });
    console.error("ERROR en", nombre, err.message);
    marcas.error = err.message;
  }
  const v = p.video(); await ctx.close(); await b.close();
  fs.mkdirSync(DIR + "tomas", { recursive: true });
  fs.renameSync(await v.path(), DIR + "tomas/" + nombre + ".webm");
  marcas.__orden = orden;
  fs.writeFileSync(DIR + "tomas/" + nombre + ".json", JSON.stringify(marcas, null, 1));
  console.log(nombre, JSON.stringify(marcas));
  if (marcas.error) process.exitCode = 1;
}
