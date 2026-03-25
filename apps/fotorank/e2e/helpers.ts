import { expect, type Locator, type Page } from "@playwright/test";
import type { E2ECriteriaBasedKey } from "./constants";
import { E2E_ADMIN_PASSWORD, E2E_CRITERIA_BASED_SAMPLE, E2E_FOTORANK_ORG_NAME } from "./constants";
import { JudgeEvaluationForm } from "./pageObjects";

const ADMIN_SESSION_COOKIE = "dnx_session";

export async function gotoWhenReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
  } catch {
    // ignorar: next dev puede no alcanzar networkidle estable
  }
}

async function hasCookie(page: Page, name: string): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === name && Boolean(c.value));
}

async function describeAdminLoginFailure(page: Page, form: Locator): Promise<string> {
  const url = page.url();
  const dnx = await hasCookie(page, ADMIN_SESSION_COOKIE);
  const submit = form.getByRole("button", { name: /Entrar|Entrando/ });
  const submitDisabled = await submit.isDisabled().catch(() => null);
  const serverErr = await form
    .locator(".text-red-400")
    .first()
    .textContent()
    .catch(() => null);
  const emailVal = await form.locator("#email").inputValue().catch(() => "");
  const passLen = (await form.locator("#password").inputValue().catch(() => "")).length;
  const parts = [
    `url=${url}`,
    `${ADMIN_SESSION_COOKIE}=${dnx}`,
    submitDisabled === null ? "submit=?" : `submit_disabled=${submitDisabled}`,
    `email_input_chars=${emailVal.length}`,
    `password_input_chars=${passLen}`,
  ];
  if (serverErr?.trim()) parts.push(`server_error=${JSON.stringify(serverErr.trim())}`);
  return parts.join("; ");
}

/**
 * Login admin: email + contraseña (el formulario exige ambos; sin password el `required` del navegador bloquea el submit).
 * @param password Por defecto `E2E_ADMIN_PASSWORD` (seed).
 */
export async function loginAsAdmin(page: Page, email: string, password: string = E2E_ADMIN_PASSWORD) {
  await page.goto("/login", { waitUntil: "load" });
  const form = page.getByTestId("fotorank-login-form");
  await form.waitFor({ state: "visible" });
  const submitBtn = form.getByRole("button", { name: "Entrar" });
  await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(password);

  const nav = page.waitForURL(/\/(dashboard|onboarding)(\/|$|\?)/, {
    timeout: 60_000,
    waitUntil: "commit",
  });

  await submitBtn.click();

  try {
    await nav;
  } catch {
    if (await hasCookie(page, ADMIN_SESSION_COOKIE)) {
      await page.goto("/dashboard", { waitUntil: "load" });
    }
  }

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "Tras login caíste en /onboarding (sin organización). Corré `pnpm --filter @repo/db db:seed` o asigná una org al admin.",
    );
  }

  if (page.url().includes("/login")) {
    if (await hasCookie(page, ADMIN_SESSION_COOKIE)) {
      await page.goto("/dashboard", { waitUntil: "load" });
    } else {
      const detail = await describeAdminLoginFailure(page, form);
      throw new Error(`Seguís en /login sin cookie ${ADMIN_SESSION_COOKIE}. ${detail}`);
    }
  }

  await expect(page).toHaveURL(/\/dashboard(\/|$|\?)/, { timeout: 20_000 });
}

/** Misma cookie que `FOTORANK_ACTIVE_ORG_COOKIE` en el dashboard (httpOnly; comprobar vía `context.cookies()`). */
const FOTORANK_ACTIVE_ORG_COOKIE_NAME = "fotorank_active_org_id";

/**
 * Si el usuario tiene más de una organización, hace falta cookie `fotorank_active_org_id` para listar concursos
 * y ver resultados (misma resolución que `resolveActiveOrganizationForUser`).
 * El `<select>` en /jurados lista las orgs reales; tomamos el `value` (id) de la opción E2E y fijamos la cookie
 * en el contexto con los mismos flags que `setFotorankActiveOrganization` (httpOnly, path /, lax).
 * Así evitamos carreras del server action + refresh en `next dev` donde a veces la cookie no aparece a tiempo en Playwright.
 */
export async function ensureE2EFotorankActiveOrganization(page: Page) {
  await gotoWhenReady(page, "/jurados");
  const select = page.locator("#jurados-active-org");
  const visible = await select.isVisible().catch(() => false);
  if (!visible) return;

  const opt = select.locator("option").filter({ hasText: E2E_FOTORANK_ORG_NAME });
  await expect(opt).toHaveCount(1, {
    timeout: 15_000,
  });
  const orgId = (await opt.getAttribute("value"))?.trim();
  if (!orgId) {
    throw new Error(
      `E2E: la opción de organización «${E2E_FOTORANK_ORG_NAME}» no tiene value (revisá seed / membresías del admin).`,
    );
  }

  const origin = new URL(page.url()).origin;
  await page.context().addCookies([
    {
      name: FOTORANK_ACTIVE_ORG_COOKIE_NAME,
      value: orgId,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

const JUDGE_SESSION_COOKIE = "dnx_judge_session";

async function describeJudgeLoginFailure(page: Page, form: Locator): Promise<string> {
  const url = page.url();
  const session = await hasCookie(page, JUDGE_SESSION_COOKIE);
  const submit = form.getByRole("button", { name: /Entrar|Entrando/ });
  const submitDisabled = await submit.isDisabled().catch(() => null);
  const serverErr = await form.locator(".text-red-300").first().textContent().catch(() => null);
  const emailLen = (await form.locator("#judge-login-email").inputValue().catch(() => "")).length;
  const passLen = (await form.locator("#judge-login-password").inputValue().catch(() => "")).length;
  const parts = [
    `url=${url}`,
    `${JUDGE_SESSION_COOKIE}=${session}`,
    submitDisabled === null ? "submit=?" : `submit_disabled=${submitDisabled}`,
    `email_chars=${emailLen}`,
    `password_chars=${passLen}`,
  ];
  if (serverErr?.trim()) parts.push(`server_error=${JSON.stringify(serverErr.trim())}`);
  return parts.join("; ");
}

/**
 * Login jurado: formulario cliente + `judgeLoginAction` (redirect vía server action).
 * Usa `waitUntil: "load"` al esperar `/jurado/panel`: con Turbopack/Next 16 el `commit` a veces no alcanza el redirect del action.
 */
export async function loginAsJudge(page: Page, email: string, password: string) {
  await page.goto("/jurado/login", { waitUntil: "load" });
  const form = page.getByTestId("judge-login-form");
  await form.waitFor({ state: "visible" });
  const submitBtn = form.getByRole("button", { name: /Entrar|Entrando/ });
  await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
  await form.locator("#judge-login-email").fill(email);
  await form.locator("#judge-login-password").fill(password);

  try {
    await Promise.all([
      page.waitForURL(/\/jurado\/panel(\/|$|\?)/, {
        timeout: 90_000,
        waitUntil: "load",
      }),
      submitBtn.click(),
    ]);
  } catch {
    if (await hasCookie(page, JUDGE_SESSION_COOKIE)) {
      await page.goto("/jurado/panel", { waitUntil: "load" });
    }
  }

  if (page.url().includes("/jurado/login")) {
    if (await hasCookie(page, JUDGE_SESSION_COOKIE)) {
      await page.goto("/jurado/panel", { waitUntil: "load" });
    } else {
      const detail = await describeJudgeLoginFailure(page, form);
      throw new Error(`Seguís en /jurado/login sin cookie ${JUDGE_SESSION_COOKIE}. ${detail}`);
    }
  }

  await expect(page).toHaveURL(/\/jurado\/panel(\/|$|\?)/, { timeout: 30_000 });
}

/** Rellena criterios CRITERIA_BASED usando `criterion-input-<key>` dentro del form root. */
export async function fillAllCriteriaFromConfig(
  form: Locator,
  scores?: Record<E2ECriteriaBasedKey, number>,
): Promise<void> {
  await JudgeEvaluationForm.fromRoot(form).fillAllCriteriaFromConfig(scores ?? E2E_CRITERIA_BASED_SAMPLE);
}

export async function submitEvaluationAndExpectSuccess(form: Locator): Promise<void> {
  await JudgeEvaluationForm.fromRoot(form).submitEvaluationAndExpectSuccess();
}
