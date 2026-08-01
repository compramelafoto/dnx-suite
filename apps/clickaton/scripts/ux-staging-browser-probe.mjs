import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://clickaton-staging.vercel.app";
const outDir = path.resolve("../../docs/clickaton/ux-validation/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ["home", "/"],
  ["login", "/login"],
  ["como-funciona", "/como-funciona"],
  ["comunidad", "/comunidad"],
  ["sobre", "/sobre"],
  ["contacto", "/contacto"],
  ["legal-terminos", "/legal/terminos"],
  ["maratones-error", "/maratones"],
  ["crear-cuenta", "/crear-cuenta"],
  ["404", "/ruta-inexistente-ux-03"],
];

const viewports = [
  ["desktop", { width: 1366, height: 768 }],
  ["390", { width: 390, height: 844 }],
  ["320", { width: 320, height: 568 }],
  ["360", { width: 360, height: 800 }],
  ["430", { width: 430, height: 932 }],
  ["tablet", { width: 768, height: 1024 }],
];

function hasEnglishLeak(text) {
  const hits = [];
  const patterns = [
    /\bLoading\b/i,
    /\bSubmit\b/i,
    /\bCancel\b/i,
    /\bSomething went wrong\b/i,
    /\bTry again\b/i,
    /\bPENDING\b/,
    /\bAPPROVED\b/,
    /\bREJECTED\b/,
  ];
  for (const re of patterns) {
    if (re.test(text)) hits.push(String(re));
  }
  return hits;
}

const browser = await chromium.launch({ headless: true });
const report = [];

for (const [vpName, size] of viewports) {
  const context = await browser.newContext({ viewport: size, locale: "es-AR" });
  const page = await context.newPage();
  for (const [name, route] of routes) {
    const url = BASE + route;
    try {
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      const status = res?.status() ?? 0;
      await page.waitForTimeout(600);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overflowX:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 2,
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim()?.slice(0, 160) || "",
        bodySample: document.body?.innerText?.slice(0, 2500) || "",
      }));
      const file = `${name}__${vpName}.jpeg`;
      const shouldShot =
        ["desktop", "390"].includes(vpName) ||
        (name === "home" && ["320", "360", "430", "tablet"].includes(vpName)) ||
        (name === "login" && vpName === "320") ||
        (name === "maratones-error" && ["desktop", "390"].includes(vpName));
      if (shouldShot) {
        await page.screenshot({
          path: path.join(outDir, file),
          type: "jpeg",
          quality: 58,
          fullPage: false,
        });
      }
      const english = hasEnglishLeak(metrics.bodySample);
      report.push({
        route,
        vp: vpName,
        status,
        overflowX: metrics.overflowX,
        title: metrics.title,
        h1: metrics.h1,
        english,
        screenshot: shouldShot ? file : null,
      });
      console.log(
        JSON.stringify({
          route,
          vp: vpName,
          status,
          overflowX: metrics.overflowX,
          h1: metrics.h1.slice(0, 80),
        }),
      );
    } catch (e) {
      report.push({ route, vp: vpName, error: String(e).slice(0, 220) });
      console.log(
        JSON.stringify({ route, vp: vpName, error: String(e).slice(0, 220) }),
      );
    }
  }

  if (vpName === "390") {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const menuBtn = page.getByRole("button", { name: /Abrir menú/i });
    if ((await menuBtn.count()) > 0) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const links = await page
        .locator("a")
        .evaluateAll((as) =>
          as
            .map((a) => a.textContent?.trim())
            .filter(Boolean)
            .slice(0, 30),
        );
      report.push({
        route: "/ (menu)",
        vp: vpName,
        sampleLinks: links.slice(0, 14),
      });
      await page.screenshot({
        path: path.join(outDir, "home-menu__390.jpeg"),
        type: "jpeg",
        quality: 58,
      });
      console.log(JSON.stringify({ menu: true, links: links.slice(0, 12) }));
    }
  }
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      text: (
        el?.textContent ||
        el?.getAttribute("aria-label") ||
        el?.getAttribute("placeholder") ||
        ""
      ).slice(0, 80),
      outline:
        getComputedStyle(el).outlineStyle +
        " " +
        getComputedStyle(el).outlineWidth,
      boxShadow: getComputedStyle(el).boxShadow?.slice(0, 80),
    };
  });
  const legalHrefs = await page.locator("a").evaluateAll((as) =>
    as
      .map((a) => ({
        href: a.getAttribute("href"),
        text: a.textContent?.trim(),
      }))
      .filter(
        (x) =>
          /t[eé]rminos|privacidad/i.test(x.text || "") ||
          /terminos|privacidad/.test(x.href || ""),
      ),
  );
  report.push({ a11yLoginFocus: active, legalHrefs });
  console.log(JSON.stringify({ a11yLoginFocus: active, legalHrefs }));
  await context.close();
}

fs.writeFileSync(
  path.resolve("../../docs/clickaton/ux-validation/browser-probe-raw.json"),
  JSON.stringify(report, null, 2),
);
await browser.close();
console.log("DONE", report.length);
