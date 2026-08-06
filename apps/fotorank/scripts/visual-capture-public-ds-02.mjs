/**
 * Capturas ETAPA 01 — IMPL 02
 * Prefiere rutas reales; fallback a preview con USE_PUBLIC_DS_PREVIEW=1.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../test-results/public-ds-02-real-captures");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3018").replace(/\/$/, "");
const slug = process.env.CONTEST_SLUG || "santa-fe-en-foco";
const usePreview = process.env.USE_PUBLIC_DS_PREVIEW === "1";

mkdirSync(outDir, { recursive: true });

const landing = usePreview
  ? "/dev/public-ds-preview?view=landing-open"
  : `/concursos/${slug}`;

const shots = [
  { name: "home-desktop", path: "/", width: 1440, height: 900 },
  { name: "home-mobile-390", path: "/", width: 390, height: 844 },
  { name: "home-mobile-320", path: "/", width: 320, height: 720 },
  { name: "landing-desktop", path: landing, width: 1440, height: 900 },
  { name: "landing-mobile-390", path: landing, width: 390, height: 844 },
  { name: "landing-mobile-320", path: landing, width: 320, height: 720 },
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
    width: 390,
    height: 844,
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
  try {
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle", timeout: 60_000 });
    // Anonimizar emails visibles en captura
    await page.evaluate(() => {
      document.querySelectorAll("span, p, dd").forEach((el) => {
        if (el.textContent && /@/.test(el.textContent) && el.textContent.includes(".")) {
          el.textContent = "participante@ejemplo.com";
        }
      });
    });
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("OK", file);
  } catch (err) {
    console.error("FAIL", shot.path, err instanceof Error ? err.message : err);
  }
  await context.close();
}
await browser.close();
console.log("Dir:", outDir);
