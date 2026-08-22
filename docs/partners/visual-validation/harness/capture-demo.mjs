/**
 * Capturas de la demo comercial para el PDF de venta.
 *
 * Local-only: monta el componente real sobre fondos ya capturados, con el
 * tracking apagado. No toca bases de datos ni las apps.
 *
 * Uso:  pnpm exec node capture-demo.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "demo-comercial");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://127.0.0.1:5199";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Cada toma: plataforma, pieza, marca y nombre de archivo. */
const SHOTS = [
  // --- placas con GRÁFICA COMPLETA: lo que entrega un anunciante real ---
  { n: "01", platform: "infospot", piece: "welcome", brand: "photostraps", anim: "slide-left",
    name: "placa-grafica-infospot-photostraps" },
  { n: "02", platform: "clf", piece: "welcome", brand: "terraza-bistro", anim: "slide-right",
    name: "placa-grafica-clf-terraza-bistro" },
  { n: "03", platform: "clickaton", piece: "welcome", brand: "photostraps", anim: "fade",
    name: "placa-grafica-clickaton-photostraps" },
  // --- placas con logo + texto: para anunciantes sin pieza propia ---
  { n: "04", platform: "infospot", piece: "welcome", brand: "copy-express", anim: "slide-left",
    name: "placa-logo-infospot-copy-express" },
  { n: "05", platform: "clickaton", piece: "welcome", brand: "fotorank", anim: "fade",
    name: "placa-logo-clickaton-fotorank" },
  { n: "06", platform: "fotorank", piece: "welcome", brand: "mucha-escuela", anim: "slide-up",
    name: "placa-logo-fotorank-mucha-escuela" },
  { n: "07", platform: "clf", piece: "welcome", brand: "dvv", anim: "slide-right",
    name: "placa-logo-clf-dvv" },
  // --- banners horizontales ---
  { n: "08", platform: "infospot", piece: "banner", brand: "copy-express", anim: "fade",
    name: "banner-infospot-copy-express" },
  { n: "09", platform: "clf", piece: "banner", brand: "photostraps", anim: "fade",
    name: "banner-clf-photostraps" },
  // --- franja de logos: diez marcas intercaladas ---
  { n: "10", platform: "infospot", piece: "marquee", brand: "copy-express", anim: "fade",
    density: "default", name: "franja-infospot-compacta" },
  { n: "11", platform: "clickaton", piece: "marquee", brand: "copy-express", anim: "fade",
    density: "default", name: "franja-clickaton-compacta" },
  { n: "12", platform: "clf", piece: "marquee", brand: "copy-express", anim: "fade",
    density: "default", name: "franja-clf-compacta" },
  { n: "13", platform: "infospot", piece: "marquee", brand: "copy-express", anim: "fade",
    name: "franja-infospot-destacada" },
];


const url = (s, badge) =>
  `${BASE}/?platform=${s.platform}&piece=${s.piece}&brand=${s.brand}` +
  `&animation=${s.anim}&density=${s.density || "featured"}&badge=${badge ? 1 : 0}`;

const browser = await chromium.launch();
let ok = 0;

for (const shot of SHOTS) {
  for (const [label, viewport] of [["", DESKTOP], ["-mobile", MOBILE]]) {
    const ctx = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(url(shot, false), { waitUntil: "networkidle" });
    // dar tiempo a que entren las imágenes y termine la animación de aparición
    await page.waitForTimeout(1200);
    const file = path.join(OUT, `${shot.n}-${shot.name}${label}.png`);
    await page.screenshot({ path: file });
    await ctx.close();
    ok++;
    console.log(`  ✓ ${path.basename(file)}`);
  }
}

await browser.close();
console.log(`\n${ok} capturas en ${OUT}`);
