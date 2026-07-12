/**
 * QA visual automatizado Etapa 12 (Playwright opcional).
 *
 * Uso:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
 *   INFOSPOT_QA_BASE_URL=http://localhost:3004 \
 *   pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/smoke/qa-visual.ts
 *
 * Excluido del typecheck/lint de la app (herramienta local, no runtime).
 */
/* eslint-disable turbo/no-undeclared-env-vars */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const playwrightMod = process.env.PLAYWRIGHT_MODULE || "playwright";

type Browser = {
  newContext: (opts: Record<string, unknown>) => Promise<BrowserContext>;
  close: () => Promise<void>;
};
type BrowserContext = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
};
type Page = {
  goto: (
    url: string,
    opts?: Record<string, unknown>,
  ) => Promise<{ status: () => number } | null>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  evaluate: <T>(fn: () => T) => Promise<T>;
  locator: (sel: string) => {
    innerText: () => Promise<string>;
  };
  getByRole: (
    role: string,
    opts?: { name?: RegExp },
  ) => {
    count: () => Promise<number>;
    first: () => {
      focus: () => Promise<void>;
      press: (key: string) => Promise<void>;
      count: () => Promise<number>;
    };
    isVisible: () => Promise<boolean>;
  };
  getByText: (pattern: RegExp) => { count: () => Promise<number> };
  keyboard: { press: (key: string) => Promise<void> };
  screenshot: (opts: { path: string; fullPage?: boolean }) => Promise<void>;
};

const { chromium } = require(playwrightMod) as {
  chromium: { launch: (opts: { headless: boolean }) => Promise<Browser> };
};

const BASE = process.env.INFOSPOT_QA_BASE_URL || "http://localhost:3004";
const OUT = path.join(process.cwd(), "../../apps/infospot/.qa-artifacts");

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-375", width: 375, height: 667 },
];

const PATHS = [
  "/",
  "/eventos/smoke-e11-event-a",
  "/eventos/smoke-e11-event-c",
  "/eventos/smoke-e11-event-e",
  "/noticias/smoke-e11-article-c",
  "/noticias/smoke-e11-article-d",
  "/noticias/smoke-e11-article-e",
];

type Finding = { severity: "blocker" | "important" | "note"; message: string; url?: string };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const findings: Finding[] = [];
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: "es-AR",
    });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (err: unknown) => consoleErrors.push(String(err)));
    page.on("console", (msg: unknown) => {
      const m = msg as { type?: () => string; text?: () => string };
      if (m.type?.() === "error") consoleErrors.push(m.text?.() || "");
    });

    for (const p of PATHS) {
      const url = `${BASE}${p}`;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const status = res?.status() ?? 0;
      if (status >= 400) {
        findings.push({ severity: "blocker", message: `HTTP ${status}`, url });
      }

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 2;
      });
      if (overflow) {
        findings.push({
          severity: "important",
          message: `Overflow horizontal en ${vp.name}`,
          url,
        });
      }

      if (p.includes("event-e")) {
        const body = await page.locator("body").innerText();
        if (/Calle Secreta|Lugar Privado|-34\.6|-58\.4/.test(body)) {
          findings.push({
            severity: "blocker",
            message: "HIDDEN location leaked private data in page body",
            url,
          });
        }
        if (!/Ubicación informada a los participantes/i.test(body)) {
          findings.push({
            severity: "important",
            message: "HIDDEN location missing public placeholder label",
            url,
          });
        }
      }

      if (p.includes("article-e")) {
        const body = await page.locator("body").innerText();
        if (!/ya no está disponible para publicación/i.test(body)) {
          findings.push({
            severity: "important",
            message: "REVOKED placeholder text missing",
            url,
          });
        }
      }

      if (p.includes("article-d") && vp.name === "desktop-1440") {
        const buy = await page.getByRole("link", { name: /Comprar fotos/i }).count();
        if (buy > 0) {
          findings.push({
            severity: "important",
            message: "CTA compra visible con álbum DELETED",
            url,
          });
        }
      }

      if (p.includes("article-c") && vp.name === "desktop-1440") {
        const credit = await page.getByText(/Foto:.*ComprameLaFoto/i).count();
        if (credit < 1) {
          findings.push({
            severity: "important",
            message: "Crédito editorial no visible",
            url,
          });
        }
      }

      const shot = path.join(
        OUT,
        `${vp.name}${p.replace(/\//g, "_") || "_home"}.png`,
      );
      await page.screenshot({ path: shot, fullPage: true });
    }

    if (consoleErrors.length) {
      findings.push({
        severity: "important",
        message: `Console errors (${vp.name}): ${consoleErrors.slice(0, 5).join(" | ")}`,
      });
    }
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/noticias/smoke-e11-article-c`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const enlarge = page.getByRole("button", { name: /Ampliar fotografía/i }).first();
    if (await enlarge.count()) {
      await enlarge.focus();
      await enlarge.press("Enter");
      const dialog = page.getByRole("dialog");
      if (!(await dialog.isVisible())) {
        findings.push({
          severity: "important",
          message: "Lightbox no abrió con teclado",
          url: "/noticias/smoke-e11-article-c",
        });
      } else {
        await page.keyboard.press("Escape");
        if (await dialog.isVisible()) {
          findings.push({
            severity: "important",
            message: "Lightbox no cerró con Escape",
            url: "/noticias/smoke-e11-article-c",
          });
        }
      }
    } else {
      findings.push({
        severity: "note",
        message: "Sin botón ampliar (galería vacía o sin src usable en smoke)",
      });
    }
    await context.close();
  }

  await browser.close();

  const report = {
    base: BASE,
    viewports: VIEWPORTS.map((v) => v.name),
    paths: PATHS,
    findings,
    artifacts: OUT,
  };
  fs.writeFileSync(path.join(OUT, "qa-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (findings.some((f) => f.severity === "blocker")) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
