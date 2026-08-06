/**
 * E2E ETAPA 10C — matriz productiva Santa Fe en Foco
 * (upload idempotente, reemplazo, admisión UI, privacidad, go-live acotado).
 *
 * Requiere:
 *   /tmp/sfef-10c-creds.env (ops-sfef-10c-setup-fixtures.ts)
 *   /tmp/sfef-10c-a.jpg y /tmp/sfef-10c-b.jpg
 *
 * @smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { gotoWhenReady } from "./helpers";

const CREDS_10C = process.env.SFEF10C_CREDS_PATH ?? "/tmp/sfef-10c-creds.env";
const CREDS_09 = process.env.SFEF09_CREDS_PATH ?? "/tmp/sfef-09-e2e.env";
const CONTEST_SLUG = "santa-fe-en-foco";

function loadCreds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of [CREDS_10C, CREDS_09]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      out[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
    }
  }
  return out;
}

function requireCreds(): Record<string, string> {
  if (!existsSync(CREDS_10C)) {
    throw new Error(`BLOCKED — missing ${CREDS_10C} (run ops-sfef-10c-setup-fixtures.ts)`);
  }
  const creds = loadCreds();
  const required = [
    "SFEF10C_CONTEST_ID",
    "SFEF10C_ORG_EMAIL",
    "SFEF10C_ORG_PASSWORD",
    "SFEF10C_UPLOAD_EMAIL",
    "SFEF10C_UPLOAD_PASSWORD",
    "SFEF10C_ENTRY_ADMIT",
    "SFEF10C_ENTRY_REJECT",
    "SFEF10C_ENTRY_EVIDENCE",
    "SFEF10C_ENTRY_REPLACEMENT",
    "SFEF10C_REPLACEMENT_EMAIL",
    "SFEF10C_PARTICIPANT_PASSWORD",
  ];
  for (const k of required) {
    if (!creds[k]?.trim()) throw new Error(`BLOCKED — missing ${k} in ${CREDS_10C}`);
  }
  return creds;
}

function loadJpeg(which: "a" | "b"): Buffer {
  const creds = loadCreds();
  const path =
    which === "a"
      ? (process.env.SFEF10C_JPEG_A ?? creds.SFEF10C_JPEG_A ?? "/tmp/sfef-10c-a.jpg")
      : (process.env.SFEF10C_JPEG_B ?? creds.SFEF10C_JPEG_B ?? "/tmp/sfef-10c-b.jpg");
  if (!existsSync(path)) {
    throw new Error(`BLOCKED — missing JPEG fixture at ${path}`);
  }
  return readFileSync(path);
}

const creds = requireCreds();
const contestId = creds.SFEF10C_CONTEST_ID;
const orgEmail = creds.SFEF10C_ORG_EMAIL;
const orgPassword = creds.SFEF10C_ORG_PASSWORD;
const participantPassword = creds.SFEF10C_PARTICIPANT_PASSWORD;
const entryAdmit = creds.SFEF10C_ENTRY_ADMIT;
const entryReject = creds.SFEF10C_ENTRY_REJECT;
const entryEvidence = creds.SFEF10C_ENTRY_EVIDENCE;
const entryReplacement = creds.SFEF10C_ENTRY_REPLACEMENT;

let uploadEntryId: string | null = null;
let uploadShaBefore: string | null = null;

async function loginSession(page: Page, email: string, password: string, next?: string) {
  const target = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  await gotoWhenReady(page, target);
  await page.locator("#email").waitFor({ state: "visible", timeout: 45_000 });
  await page.locator("#email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 });
}

async function loginOrganizer(page: Page) {
  await loginSession(page, orgEmail, orgPassword);
  if (page.url().includes("forbiddenApp=fotorank")) {
    throw new Error("Organizer sin acceso dashboard (membresía ACTIVE requerida).");
  }
  await gotoWhenReady(page, "/dashboard");
  await expect(page).toHaveURL(/\/(dashboard|onboarding)(\/|$|\?)/, { timeout: 45_000 });
}

async function runUploadWizard(page: Page, jpeg: Buffer, fileName: string) {
  await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}/inscripcion`);
  await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("upload-closed-notice")).toHaveCount(0);

  const start = page.getByTestId("upload-start");
  if (await start.isVisible().catch(() => false)) await start.click();

  const fileInput = page.getByTestId("entry-file-input");
  await expect(fileInput).toBeVisible({ timeout: 20_000 });
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: "image/jpeg",
    buffer: jpeg,
  });

  await expect(page.getByTestId("entry-preview-wrap")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Seleccioná una fotografía válida/i)).toHaveCount(0);

  const photoNext = page.getByTestId("upload-photo-next");
  await expect(photoNext).toBeVisible({ timeout: 10_000 });
  await photoNext.click();

  const locality = page.getByTestId("entry-capture-locality");
  await expect(locality).toBeVisible({ timeout: 20_000 });
  await locality.fill("Rosario");
  await page.getByTestId("entry-territory-confirm").check();
  await page.getByTestId("entry-period-confirm").check();
  await page.getByTestId("entry-device-kind").selectOption("SMARTPHONE");

  for (const tid of [
    "entry-authorship-declare",
    "entry-editing-declare",
    "entry-no-ai-declare",
  ] as const) {
    const el = page.getByTestId(tid);
    if (await el.isVisible().catch(() => false)) await el.check();
  }

  const ig = page.getByTestId("entry-instagram");
  if (await ig.isVisible().catch(() => false)) await ig.fill("@sfef_e2e_10c");

  const dataNext = page.getByTestId("upload-data-next");
  if (await dataNext.isVisible().catch(() => false)) await dataNext.click();

  // Esperar fin de verificación de archivo antes de confirmar
  await expect(page.getByText(/Estamos verificando el archivo/i)).toHaveCount(0, {
    timeout: 120_000,
  });
  const errText = page.locator(".fr-upload-wizard__error");
  if (await errText.isVisible().catch(() => false)) {
    const msg = (await errText.innerText()).trim();
    if (msg) throw new Error(`Upload error UI: ${msg.slice(0, 300)}`);
  }

  const confirm = page.getByTestId("entry-confirm");
  await expect(confirm).toBeVisible({ timeout: 30_000 });
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();

  const modalConfirm = page.getByTestId("upload-confirm-submit");
  if (await modalConfirm.isVisible().catch(() => false)) {
    await modalConfirm.click();
  } else {
    await page.getByRole("button", { name: /Confirmar envío/i }).click();
  }

  await expect(page.getByTestId("upload-step-confirmation")).toBeVisible({ timeout: 120_000 });
}

test.describe("Santa Fe ETAPA 10C Production matrix @smoke", () => {
  test("01 upload JPEG A + confirm idempotente (email PHOTO_RECEIVED)", async ({ page, request }) => {
    await loginSession(
      page,
      creds.SFEF10C_UPLOAD_EMAIL,
      creds.SFEF10C_UPLOAD_PASSWORD,
      `/concursos/${CONTEST_SLUG}/inscripcion`,
    );

    await runUploadWizard(page, loadJpeg("a"), "sfef-10c-a.jpg");

    const me1 = await page.request.get(`/api/fotorank/contests/${contestId}/entries/me`);
    expect(me1.ok()).toBeTruthy();
    const body1 = (await me1.json()) as {
      ok?: boolean;
      entry?: { id?: string; activeAsset?: { sha256?: string } };
    };
    expect(body1.entry?.id).toBeTruthy();
    uploadEntryId = body1.entry!.id!;
    uploadShaBefore = body1.entry?.activeAsset?.sha256 ?? null;

    for (let i = 0; i < 5; i += 1) {
      const res = await page.request.post(
        `/api/fotorank/contests/${contestId}/entries/${uploadEntryId}/confirm`,
        { data: {} },
      );
      expect(res.status()).toBeLessThan(500);
      expect([200, 409, 422]).toContain(res.status());
    }

    const me2 = await page.request.get(`/api/fotorank/contests/${contestId}/entries/me`);
    const body2 = (await me2.json()) as { entry?: { id?: string } };
    expect(body2.entry?.id).toBe(uploadEntryId);

    const probeUrl = process.env.SFEF10C_OUTBOX_PROBE_URL?.trim();
    if (probeUrl) {
      const probe = await request.get(`${probeUrl}?entryId=${uploadEntryId}&kind=PHOTO_RECEIVED`);
      expect(probe.ok()).toBeTruthy();
      const probeBody = (await probe.json()) as { count?: number };
      expect(probeBody.count).toBe(1);
    }

    await expect(page.getByTestId("admission-public-status")).toContainText(/revisión/i, {
      timeout: 30_000,
    });
  });

  test("02 reemplazo completo JPEG B — misma entry, versión > 1", async ({ page }) => {
    if (!uploadEntryId) throw new Error("BLOCKED — falta uploadEntryId del test 01");

    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${uploadEntryId}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /Permitir reemplazo/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });

    await page.context().clearCookies();
    await loginSession(
      page,
      creds.SFEF10C_UPLOAD_EMAIL,
      creds.SFEF10C_UPLOAD_PASSWORD,
      `/concursos/${CONTEST_SLUG}/inscripcion`,
    );

    await runUploadWizard(page, loadJpeg("b"), "sfef-10c-b.jpg");

    const me = await page.request.get(`/api/fotorank/contests/${contestId}/entries/me`);
    const data = (await me.json()) as {
      entry?: { id?: string; versionNumber?: number; activeAsset?: { sha256?: string } };
    };
    expect(data.entry?.id).toBe(uploadEntryId);
    expect((data.entry?.versionNumber ?? 0) > 1).toBeTruthy();
    if (uploadShaBefore && data.entry?.activeAsset?.sha256) {
      expect(data.entry.activeAsset.sha256).not.toBe(uploadShaBefore);
    }

    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${uploadEntryId}`);
    const versions = page.locator("section").filter({ hasText: "Versiones" });
    await expect(versions).toContainText(/v2/i, { timeout: 20_000 });
  });

  test("03 checklist semaforizado en detalle organizador", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryAdmit}`);
    await expect(page.getByTestId("admission-checklist-view")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("admission-checklist-counts")).toBeVisible();
    await expect(page.getByTestId("admission-checklist-final")).toBeVisible();
    const counts = await page.getByTestId("admission-checklist-counts").innerText();
    expect(/\d+/.test(counts)).toBeTruthy();
  });

  test("04 admitir UI", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryAdmit}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("ADMISSION_APPROVED");
    await page.getByRole("button", { name: /^Admitir$/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("admission-status-line")).toContainText(/ADMITTED/i);
  });

  test("05 rechazar UI con reason code + mensaje", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryReject}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("CAPTURE_DATE_BEFORE_WINDOW");
    await page.locator("textarea").nth(1).fill("Fecha fuera de período — fixture 10C.");
    await page.getByRole("button", { name: /^Rechazar$/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("admission-status-line")).toContainText(/REJECTED/i);
  });

  test("06 solicitar evidencia UI", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryEvidence}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("ORIGINAL_REQUIRED");
    await page.locator("textarea").nth(1).fill("Evidencia sintética 10C — dron.");
    await page.getByRole("button", { name: /Solicitar evidencia/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
  });

  test("07 permitir reemplazo + participante ve CTA/estado", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryReplacement}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /Permitir reemplazo/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });

    await page.context().clearCookies();
    await loginSession(
      page,
      creds.SFEF10C_REPLACEMENT_EMAIL,
      participantPassword,
      `/concursos/${CONTEST_SLUG}/inscripcion`,
    );
    await expect(page.getByTestId("entry-upload-panel")).toBeVisible({ timeout: 45_000 });
    const start = page.getByTestId("upload-start");
    await expect(start).toBeVisible({ timeout: 20_000 });
    await expect(start).toBeEnabled();
    // Copy de política o alerta de corrección (wizard canónico).
    await expect(page.locator("body")).toContainText(/Reemplazo/i);
  });

  test("08 participante ve estados públicos (sin códigos internos)", async ({ page }) => {
    const cases: Array<{ email: string; pattern: RegExp }> = [
      { email: creds.SFEF10C_UPLOAD_EMAIL, pattern: /revisión|recibida/i },
      { email: creds.SFEF10C_ADMIT_EMAIL, pattern: /admitida|revisión/i },
      { email: creds.SFEF10C_REJECT_EMAIL, pattern: /no admitida|rechaz/i },
      { email: creds.SFEF10C_EVIDENCE_EMAIL, pattern: /información|revisión/i },
      { email: creds.SFEF10C_REPLACEMENT_EMAIL, pattern: /reemplazar|revisión/i },
    ];

    for (const c of cases) {
      await page.context().clearCookies();
      await loginSession(page, c.email, participantPassword, `/concursos/${CONTEST_SLUG}/inscripcion`);
      const body = await page.locator("body").innerText();
      expect(body).not.toContain("PENDING_MANUAL_REVIEW");
      expect(body).not.toMatch(/CAPTURE_DATE_BEFORE_WINDOW|AERIAL_DEVICE_NOT_IDENTIFIED/);
      if (await page.getByTestId("admission-public-status").isVisible().catch(() => false)) {
        await expect(page.getByTestId("admission-public-status")).toContainText(c.pattern);
      }
    }
  });

  test("09 privacidad — sin GPS ni storage keys en UI participante", async ({ page }) => {
    await loginSession(
      page,
      creds.SFEF10C_UPLOAD_EMAIL,
      participantPassword,
      `/concursos/${CONTEST_SLUG}/inscripcion`,
    );
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/gpsLatitude|gpsLongitude/i);
    expect(body).not.toMatch(/-?\d+\.\d{4,}\s*,\s*-?\d+\.\d{4,}/);
    expect(body).not.toMatch(/storageKey|fotorank\/contests\/.*\/original/i);
  });

  test("10 jurado cerrado — sin evaluación abierta pública", async ({ page }) => {
    for (const path of [`/jurados`, `/concursos/${CONTEST_SLUG}/jurado`]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      const body = await page.locator("body").innerText().catch(() => "");
      const openEval =
        /evaluación abierta|votá ahora|panel de jurado activo|calificar obras/i.test(body) &&
        !/iniciar sesión|invitación|próximamente|no disponible/i.test(body);
      expect(status === 404 || status === 403 || !openEval).toBeTruthy();
    }
  });

  test("11 resultados cerrados", async ({ page }) => {
    for (const path of [
      `/concursos/${CONTEST_SLUG}/resultados`,
      `/concursos/${CONTEST_SLUG}/ranking`,
    ]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      const body = await page.locator("body").innerText().catch(() => "");
      const leaked =
        /ganador|1er premio|ranking final|publicación oficial/i.test(body) &&
        !/no (hay|disponible)|próximamente|aún no/i.test(body);
      expect(status === 404 || status === 403 || !leaked).toBeTruthy();
    }
  });

  test("12 landing + inscripción siguen abiertas", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}`);
    await expect(page.getByRole("heading", { name: /Santa Fe en Foco/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/BORRADOR — LEGAL REVIEW REQUIRED/i);

    await page.goto(`/concursos/${CONTEST_SLUG}/inscripcion`, { waitUntil: "load" });
    const url = page.url();
    const onLogin = /\/login\?next=/.test(url);
    if (onLogin) {
      await loginSession(
        page,
        creds.SFEF10C_UPLOAD_EMAIL,
        participantPassword,
        `/concursos/${CONTEST_SLUG}/inscripcion`,
      );
    }
    await expect(page.getByTestId("registration-number").or(page.getByTestId("inscription-form"))).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByTestId("upload-closed-notice")).toHaveCount(0);
  });
});
