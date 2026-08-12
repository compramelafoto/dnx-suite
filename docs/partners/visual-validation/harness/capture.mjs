/**
 * Local-only visual validation captures.
 * - Backgrounds from public pages (flags OFF ⇒ no real welcome)
 * - Overlay via harness with real PartnerWelcomeInterstitial
 * - No production tracking / no DB writes
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backgrounds = path.join(root, "backgrounds");
const captures = path.join(root, "captures");
const publicBg = path.join(__dirname, "public", "backgrounds");

fs.mkdirSync(backgrounds, { recursive: true });
fs.mkdirSync(captures, { recursive: true });
fs.mkdirSync(publicBg, { recursive: true });

const BG = [
  {
    key: "clickaton",
    url: "https://maratonfotografica.com/maratones/clickaton-argentina-2026",
    file: "bg-clickaton.jpg",
  },
  {
    key: "fotorank",
    url: "https://fotorank.com/concursos/santa-fe-en-foco",
    file: "bg-fotorank.jpg",
  },
  {
    key: "infospot",
    url: "https://infospot.com.ar/",
    file: "bg-infospot.jpg",
  },
  {
    key: "clf",
    url: "https://compramelafoto.dnxsuite.com/album/torneo-libertadores-de-rawson-1038c358",
    file: "bg-clf.jpg",
  },
];

const FINAL = [
  {
    platform: "clickaton",
    animation: "fade",
    desktop: "01-clickaton-event-sponsor-welcome.png",
    mobile: "01b-clickaton-event-sponsor-welcome-mobile.png",
  },
  {
    platform: "fotorank",
    animation: "slide-up",
    desktop: "02-fotorank-contest-sponsor-welcome.png",
    mobile: "02b-fotorank-contest-sponsor-welcome-mobile.png",
  },
  {
    platform: "infospot",
    animation: "slide-left",
    desktop: "03-infospot-home-sponsor-welcome.png",
    mobile: "03b-infospot-home-sponsor-welcome-mobile.png",
  },
  {
    platform: "clf",
    animation: "slide-right",
    desktop: "04-clf-album-sponsor-welcome.png",
    mobile: "04b-clf-album-sponsor-welcome-mobile.png",
  },
];

const HARNESS = process.env.HARNESS_URL || "http://127.0.0.1:5199";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const bg of BG) {
    await page.goto(bg.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2200);
    const dest = path.join(backgrounds, bg.file);
    await page.screenshot({ path: dest, type: "jpeg", quality: 82, fullPage: false });
    fs.copyFileSync(dest, path.join(publicBg, bg.file));
    console.log("bg", bg.key, fs.statSync(dest).size);
  }

  for (const shot of FINAL) {
    const url = `${HARNESS}/?platform=${shot.platform}&animation=${shot.animation}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    // Hide fixture badge for cleaner capture
    await page.addStyleTag({
      content: '[data-harness-badge="true"]{display:none !important;}',
    });
    await page.screenshot({
      path: path.join(captures, shot.desktop),
      type: "png",
      fullPage: false,
    });
    console.log("desktop", shot.desktop);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.addStyleTag({
      content: '[data-harness-badge="true"]{display:none !important;}',
    });
    await page.screenshot({
      path: path.join(captures, shot.mobile),
      type: "png",
      fullPage: false,
    });
    console.log("mobile", shot.mobile);
  }

  await browser.close();
  console.log("DONE", captures);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
