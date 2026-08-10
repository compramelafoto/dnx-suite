/**
 * Capturas QA visual — página pública Santa Fe en Foco.
 * Uso: BASE_URL=http://127.0.0.1:3000 node apps/fotorank/scripts/visual-capture-sfef-public-page.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR
  || path.resolve(process.cwd(), ".tmp/fotorank-sfef-public-page-visual");
const SLUG = "santa-fe-en-foco";
const PATHNAME = `/concursos/${SLUG}`;

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-1024x768", width: 1024, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { base: BASE, capturedAt: new Date().toISOString(), shots: [] };

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const url = `${BASE}${PATHNAME}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);

  const viewportPath = path.join(OUT, `${vp.name}-viewport.png`);
  const fullPath = path.join(OUT, `${vp.name}-full.png`);
  await page.screenshot({ path: viewportPath, fullPage: false });
  await page.screenshot({ path: fullPath, fullPage: true });

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const hero = document.querySelector(".fr-contest-hero");
    const bannerImg = document.querySelector(".fr-contest-hero__media");
    const cta = document.querySelector("#inscribirse, a.fr-btn-primary");
    const uploadLabel = Array.from(document.querySelectorAll(".fr-contest-info-strip__label"))
      .find((el) => el.textContent?.includes("Carga"));
    const uploadValue = uploadLabel?.parentElement?.querySelector(".fr-contest-info-strip__value")?.textContent?.trim() ?? null;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasOverflowX: doc.scrollWidth > doc.clientWidth + 1,
      heroClass: hero?.className ?? null,
      bannerSrc: bannerImg?.getAttribute("src") ?? null,
      bannerNaturalWidth: bannerImg instanceof HTMLImageElement ? bannerImg.naturalWidth : null,
      bannerNaturalHeight: bannerImg instanceof HTMLImageElement ? bannerImg.naturalHeight : null,
      ctaText: cta?.textContent?.trim() ?? null,
      uploadValue,
      bg: getComputedStyle(document.querySelector(".fr-contest-shell") || document.body).backgroundColor,
      primary: getComputedStyle(document.querySelector(".fr-contest-shell") || document.body).getPropertyValue("--cv-primary").trim(),
      title: document.querySelector("h1")?.textContent?.trim() ?? null,
    };
  });

  report.shots.push({
    viewport: vp.name,
    status: res?.status() ?? null,
    viewportPath,
    fullPath,
    metrics,
  });
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
