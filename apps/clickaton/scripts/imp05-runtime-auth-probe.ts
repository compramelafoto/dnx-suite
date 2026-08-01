/**
 * Read-only authenticated runtime probe for Imp. 05.
 * Does not print passwords. Writes sanitized JSON + screenshots.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";

const BASE = "https://clickaton-staging.vercel.app";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CRED = join(ROOT, ".local/clickaton-ux-staging/credentials.json");
const OUT_DIR = join(ROOT, "docs/clickaton/ux-validation/screenshots/imp05");
const RAW = join(ROOT, "docs/clickaton/ux-validation/imp05-runtime-raw.json");

type Cred = { email: string; password: string };

async function login(page: Page, cred: Cred) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(cred.email);
  await page.locator('input[type="password"]').first().fill(cred.password);
  await page.getByRole("button", { name: /iniciar|entrar|ingresar/i }).first().click();
  await page.waitForTimeout(2500);
  return page.url();
}

async function h1Info(page: Page) {
  return page.evaluate(() => {
    const h1s = [...document.querySelectorAll("h1")].map((el) => (el.textContent || "").trim());
    return {
      url: location.pathname + location.search,
      h1s,
      count: h1s.length,
      empty: h1s.some((t) => !t),
      title: document.title,
    };
  });
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    h1: ([...document.querySelectorAll("h1")].map((e) => e.textContent?.trim() || "")[0] || null),
  }));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const data = JSON.parse(readFileSync(CRED, "utf8")) as {
    credentials: Record<string, Cred>;
  };
  const creds = data.credentials;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const report: Record<string, unknown> = { h1: [], auth: {}, mobile: [], routes: [] };
  const auth = report.auth as Record<string, unknown>;
  const h1 = report.h1 as unknown[];
  const mobile = report.mobile as unknown[];
  const routes = report.routes as unknown[];

  const shot = async (name: string) => {
    await page.screenshot({ path: join(OUT_DIR, name), fullPage: false });
  };

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("login-390.png");

  auth.participantLogin = {
    finalUrl: (await login(page, creds.participantConfirmed)).replace(BASE, ""),
  };
  await page.goto(`${BASE}/mi-cuenta`, { waitUntil: "networkidle" });
  auth.miCuenta = await h1Info(page);
  await shot("mi-cuenta-participant.png");

  const detailHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/mi-cuenta/inscripciones/"]')]
      .map((a) => a.getAttribute("href"))
      .filter(Boolean) as string[],
  );
  auth.detailLinks = detailHrefs;

  for (const href of detailHrefs.slice(0, 3)) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    h1.push({ profile: "participantConfirmed", href, ...(await h1Info(page)) });
    await shot("detalle-confirmed-h1.png");
    for (const [w, h, n] of [
      [320, 568, "320"],
      [390, 844, "390"],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      mobile.push({ route: href, w, h, n, ...(await overflow(page)) });
      await shot(`detalle-confirmed-${n}.png`);
    }
  }

  auth.participantEmptyLogin = {
    finalUrl: (await login(page, creds.participantEmpty)).replace(BASE, ""),
  };
  await page.goto(`${BASE}/mi-cuenta`, { waitUntil: "networkidle" });
  const emptyLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/mi-cuenta/inscripciones/"]')]
      .map((a) => a.getAttribute("href"))
      .filter(Boolean) as string[],
  );
  auth.emptyDetailLinks = emptyLinks;
  if (emptyLinks[0]) {
    await page.goto(`${BASE}${emptyLinks[0]}`, { waitUntil: "networkidle" });
    h1.push({ profile: "participantEmpty", href: emptyLinks[0], ...(await h1Info(page)) });
    await shot("detalle-empty-h1.png");
  } else {
    h1.push({ profile: "participantEmpty", note: "no detail link" });
    await shot("mi-cuenta-empty.png");
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  auth.adminLogin = { finalUrl: (await login(page, creds.admin)).replace(BASE, "") };
  for (const route of [
    "/admin",
    "/admin/inscripciones",
    "/admin/finanzas/cuenta-owner",
    "/admin/finanzas",
    "/admin/integraciones",
    "/admin/integraciones/diagnostico",
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const info = await h1Info(page);
    const snippet = await page.evaluate(() =>
      (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 240),
    );
    routes.push({ role: "admin", route, ...info, snippet });
    if (route.includes("cuenta-owner")) {
      await shot("cuenta-owner-empty.png");
      await shot("admin-finanzas-cuenta-owner-desktop.png");
    }
    if (route === "/admin/integraciones") await shot("admin-integraciones.png");
    if (route.includes("diagnostico")) await shot("admin-diagnostico.png");
    if (route === "/admin") await shot("admin-dashboard.png");
  }

  for (const [w, h, n] of [
    [320, 568, "320"],
    [360, 800, "360"],
    [390, 844, "390"],
    [430, 932, "430"],
    [768, 1024, "tablet"],
    [1280, 800, "desktop"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/admin/finanzas/cuenta-owner`, { waitUntil: "networkidle" });
    mobile.push({ route: "/admin/finanzas/cuenta-owner", w, h, n, ...(await overflow(page)) });
    await shot(`cuenta-owner-${n}.png`);
  }

  auth.nopermLogin = {
    finalUrl: (await login(page, creds.noPermission)).replace(BASE, ""),
  };
  await page.goto(`${BASE}/admin/finanzas/cuenta-owner`, { waitUntil: "networkidle" });
  auth.nopermCuentaOwner = await h1Info(page);
  await shot("noperm-cuenta-owner.png");

  await page.context().clearCookies();
  await page.goto(`${BASE}/admin/finanzas/cuenta-owner`, { waitUntil: "networkidle" });
  auth.anonCuentaOwner = await h1Info(page);

  let prev: Record<string, unknown> = {};
  try {
    prev = JSON.parse(readFileSync(RAW, "utf8")) as Record<string, unknown>;
  } catch {
    prev = {};
  }
  const merged = {
    ...prev,
    ...report,
    auth: { ...((prev.auth as object) || {}), ...auth },
    validatedAt: new Date().toISOString(),
  };
  writeFileSync(RAW, JSON.stringify(merged, null, 2) + "\n");
  await browser.close();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        h1,
        authUrls: {
          participant: auth.participantLogin,
          empty: auth.participantEmptyLogin,
          admin: auth.adminLogin,
          noperm: auth.nopermLogin,
          nopermCuentaOwner: auth.nopermCuentaOwner,
          anonCuentaOwner: auth.anonCuentaOwner,
          miCuenta: auth.miCuenta,
          detailLinks: auth.detailLinks,
          emptyDetailLinks: auth.emptyDetailLinks,
        },
        routes: routes.map((r) => {
          const row = r as { route: string; url: string; h1s: string[]; snippet: string };
          return { route: row.route, url: row.url, h1s: row.h1s, snippet: row.snippet };
        }),
        mobile,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
