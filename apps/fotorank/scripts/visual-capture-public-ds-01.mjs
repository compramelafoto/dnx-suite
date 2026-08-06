/**
 * Visual capture helper — ETAPA 01 public participant design system.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 CONTEST_SLUG=santa-fe-en-foco \
 *     node apps/fotorank/scripts/visual-capture-public-ds-01.mjs
 *
 * Requires Playwright browsers. Does not mutate data.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../test-results/public-ds-01-captures");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const slug = process.env.CONTEST_SLUG || "santa-fe-en-foco";

mkdirSync(outDir, { recursive: true });

const usePreview = process.env.USE_PUBLIC_DS_PREVIEW === "1";
const landingPath = usePreview
  ? "/dev/public-ds-preview?view=landing-open"
  : `/concursos/${slug}`;

const shots = [
  { name: "landing-desktop", path: landingPath, width: 1440, height: 900 },
  { name: "landing-mobile", path: landingPath, device: "iPhone 12" },
  { name: "landing-mobile-390", path: landingPath, width: 390, height: 844 },
  { name: "landing-mobile-320", path: landingPath, width: 320, height: 720 },
  {
    name: "landing-no-hero",
    path: usePreview ? "/dev/public-ds-preview?view=landing-no-hero" : landingPath,
    width: 1440,
    height: 900,
  },
  {
    name: "landing-closed",
    path: usePreview ? "/dev/public-ds-preview?view=landing-closed" : landingPath,
    width: 1440,
    height: 900,
  },
  {
    name: "participant-empty",
    path: "/dev/public-ds-preview?view=participant-empty",
    width: 1440,
    height: 900,
    previewOnly: true,
  },
  {
    name: "participant-dashboard-desktop",
    path: "/dev/public-ds-preview?view=participant-dashboard",
    width: 1440,
    height: 900,
    previewOnly: true,
  },
  {
    name: "participant-dashboard-mobile",
    path: "/dev/public-ds-preview?view=participant-dashboard",
    device: "iPhone 12",
    previewOnly: true,
  },
  {
    name: "upload-closed",
    path: "/dev/public-ds-preview?view=upload-closed",
    width: 1440,
    height: 900,
    previewOnly: true,
  },
];

const browser = await chromium.launch();
for (const shot of shots) {
  if (shot.previewOnly && !usePreview) continue;
  const context = await browser.newContext(
    shot.device
      ? devices[shot.device]
      : { viewport: { width: shot.width, height: shot.height } },
  );
  const page = await context.newPage();
  const url = `${baseUrl}${shot.path}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("OK", file);
  } catch (err) {
    console.error("FAIL", url, err instanceof Error ? err.message : err);
  }
  await context.close();
}
await browser.close();
console.log("Captures directory:", outDir);
