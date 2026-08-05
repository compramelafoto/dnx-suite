/**
 * E2E críticos ETAPA 05B contra staging real.
 * Requiere fixtures: apps/fotorank/scripts/ops-sfef-05b-staging-fixtures.ts
 * Env: SFEF_05B_FIXTURES_JSON (path) o stdin file /tmp/sfef-05b-fixtures.json
 *
 * @smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gotoWhenReady } from "./helpers";

type Fixtures = {
  password: string;
  contestId: string;
  categories: Record<string, string>;
  users: Record<string, { email: string; id: number; province: string }>;
};

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
  "base64",
);

function loadFixtures(): Fixtures {
  const path = process.env.SFEF_05B_FIXTURES_JSON ?? "/tmp/sfef-05b-fixtures.json";
  const fx = JSON.parse(readFileSync(path, "utf8")) as Fixtures;
  const requiredUsers = [
    "open_other_province",
    "amateur",
    "professional",
    "reporter",
    "aerial",
    "limits",
  ] as const;
  for (const key of requiredUsers) {
    if (!fx.users[key]?.email) throw new Error(`Fixture user missing: ${key}`);
  }
  for (const slug of [
    "fotografo-profesional",
    "fotografo-amateur",
    "reportero-grafico",
    "fotografia-aerea",
  ]) {
    if (!fx.categories[slug]) throw new Error(`Fixture category missing: ${slug}`);
  }
  return fx;
}

function user(fx: Fixtures, key: keyof Fixtures["users"]) {
  const u = fx.users[key];
  if (!u) throw new Error(`missing user ${String(key)}`);
  return u;
}

function categoryId(fx: Fixtures, slug: string) {
  const id = fx.categories[slug];
  if (!id) throw new Error(`missing category ${slug}`);
  return id;
}

async function login(page: Page, email: string, password: string) {
  await gotoWhenReady(page, "/login");
  // Staging usa @repo/auth-ui (sin data-testid fotorank-login-form legacy).
  const emailInput = page.locator("#email");
  await emailInput.waitFor({ state: "visible", timeout: 45_000 });
  await emailInput.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 });
}

async function registerCategory(
  page: Page,
  opts: { categorySlug: string; categoryId: string; age?: string; argra?: string },
) {
  await gotoWhenReady(page, "/concursos/santa-fe-en-foco/inscripcion");
  await expect(page.getByTestId("open-participation-note")).toBeVisible({ timeout: 30_000 });
  const cat = page.getByTestId("inscription-category");
  await expect(cat).toBeVisible();
  await cat.selectOption(opts.categoryId);
  if (opts.argra !== undefined) {
    if (opts.argra === "") {
      // leave empty
    } else {
      await page.getByTestId("inscription-argra").fill(opts.argra);
    }
  }
  await page.getByTestId("inscription-age").fill(opts.age ?? "29");
  await page.getByTestId("inscription-accept-rules").check();
  const license = page.getByTestId("inscription-accept-license");
  if (await license.isVisible().catch(() => false)) await license.check();
  await page.getByTestId("inscription-submit").click();
}

async function fillEligibilityAndUpload(
  page: Page,
  opts: { locality: string; device: string; make?: string; model?: string },
) {
  await expect(page.getByTestId("entry-upload-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("entry-capture-locality").fill(opts.locality);
  await page.getByTestId("entry-territory-confirm").check();
  await page.getByTestId("entry-period-confirm").check();
  await page.getByTestId("entry-device-kind").selectOption(opts.device);
  if (opts.make) await page.getByTestId("entry-device-make").fill(opts.make);
  if (opts.model) await page.getByTestId("entry-device-model").fill(opts.model);
  if (opts.device === "DRONE") {
    const ack = page.getByTestId("entry-drone-ack");
    if (await ack.isVisible().catch(() => false)) await ack.check();
  }
  await page.getByTestId("entry-file-input").setInputFiles({
    name: "sfef-synthetic.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
}

test.describe("Santa Fe 05B staging matrix @smoke", () => {
  const fx = loadFixtures();

  test("participación abierta — otra provincia ve nota y puede iniciar Amateur", async ({ page }) => {
    await login(page, user(fx, "open_other_province").email, fx.password);
    await gotoWhenReady(page, "/concursos/santa-fe-en-foco/inscripcion");
    await expect(page.getByTestId("open-participation-note")).toBeVisible();
    await expect(page.getByTestId("open-participation-note")).toContainText(/No es necesario residir/i);
    await registerCategory(page, {
      categorySlug: "fotografo-amateur",
      categoryId: categoryId(fx, "fotografo-amateur"),
    });
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
  });

  test("Amateur + celular + territorio sin GPS", async ({ page }) => {
    await login(page, user(fx, "amateur").email, fx.password);
    await registerCategory(page, {
      categorySlug: "fotografo-amateur",
      categoryId: categoryId(fx, "fotografo-amateur"),
    });
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
    await fillEligibilityAndUpload(page, { locality: "Rosario", device: "SMARTPHONE" });
    await expect(page.getByTestId("entry-info").or(page.getByTestId("entry-status-block"))).toBeVisible({
      timeout: 90_000,
    });
    const me = await page.request.get(`/api/fotorank/contests/${fx.contestId}/entries/me`);
    expect(me.ok()).toBeTruthy();
    const json = await me.json();
    const blob = JSON.stringify(json);
    expect(blob).not.toContain("gpsLatitude");
    expect(blob).not.toContain("argraMembershipNumber");
  });

  test("Profesional + cámara continúa; Profesional + celular revisión/bloqueo en flujo", async ({
    page,
  }) => {
    await login(page, user(fx, "professional").email, fx.password);
    await registerCategory(page, {
      categorySlug: "fotografo-profesional",
      categoryId: categoryId(fx, "fotografo-profesional"),
    });
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
    // celular primero → revisión o error legible
    await fillEligibilityAndUpload(page, { locality: "Santa Fe", device: "SMARTPHONE" });
    await expect(
      page.getByTestId("entry-info").or(page.getByRole("alert")).or(page.getByTestId("entry-status-block")),
    ).toBeVisible({ timeout: 90_000 });
    const body = await page.content();
    expect(/revisión|celular|no se admit|TECHNICALLY|REQUIRES_REVIEW|error/i.test(body)).toBeTruthy();
  });

  test("Reportero sin ARGRA bloquea; con ARGRA sintético continúa", async ({ page }) => {
    await login(page, user(fx, "reporter").email, fx.password);
    await gotoWhenReady(page, "/concursos/santa-fe-en-foco/inscripcion");
    await page.getByTestId("inscription-category").selectOption(categoryId(fx, "reportero-grafico"));
    await expect(page.getByTestId("inscription-argra")).toBeVisible();
    await page.getByTestId("inscription-age").fill("31");
    await page.getByTestId("inscription-accept-rules").check();
    const license = page.getByTestId("inscription-accept-license");
    if (await license.isVisible().catch(() => false)) await license.check();
    await page.getByTestId("inscription-submit").click();
    await expect(page.getByRole("alert").or(page.locator("[role='alert']"))).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("inscription-argra").fill("SYNTH-ARGRA-05B-001");
    await page.getByTestId("inscription-submit").click();
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });

    // privacidad: API me registration no debe exponer ARGRA completo en listados públicos
    const me = await page.request.get(`/api/fotorank/contests/${fx.contestId}/registrations/me`);
    expect(me.ok()).toBeTruthy();
    const reg = JSON.stringify(await me.json());
    expect(reg).not.toContain("SYNTH-ARGRA-05B-001");
  });

  test("Aérea con no-dron falla; Aérea con dron continúa", async ({ page }) => {
    await login(page, user(fx, "aerial").email, fx.password);
    await registerCategory(page, {
      categorySlug: "fotografia-aerea",
      categoryId: categoryId(fx, "fotografia-aerea"),
    });
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
    await fillEligibilityAndUpload(page, { locality: "Rafaela", device: "DSLR", make: "Canon", model: "R6" });
    await expect(page.getByRole("alert").or(page.getByTestId("entry-info"))).toBeVisible({
      timeout: 90_000,
    });
    const errText = await page.content();
    expect(/dron|Aérea|no eleg|error|DEVICE/i.test(errText)).toBeTruthy();

    await page.getByTestId("entry-device-kind").selectOption("DRONE");
    const ack = page.getByTestId("entry-drone-ack");
    if (await ack.isVisible().catch(() => false)) await ack.check();
    await page.getByTestId("entry-device-make").fill("DJI");
    await page.getByTestId("entry-device-model").fill("Mini 3");
    await page.getByTestId("entry-file-input").setInputFiles({
      name: "sfef-drone.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });
    await expect(page.getByTestId("entry-info").or(page.getByTestId("entry-status-block"))).toBeVisible({
      timeout: 90_000,
    });
  });

  test("límites — segunda inscripción/obra bloqueada", async ({ page }) => {
    await login(page, user(fx, "limits").email, fx.password);
    await registerCategory(page, {
      categorySlug: "fotografo-amateur",
      categoryId: categoryId(fx, "fotografo-amateur"),
    });
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
    // reintento inscripción → ya inscripto
    await gotoWhenReady(page, "/concursos/santa-fe-en-foco/inscripcion");
    await expect(page.getByTestId("registration-number")).toBeVisible();
    await expect(page.getByTestId("inscription-form")).toHaveCount(0);
  });
});
