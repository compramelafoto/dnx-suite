/**
 * E2E UI ETAPA 06B — admisión en staging real.
 * Requiere /tmp/sfef-06b-creds.env (ops-sfef-06b-bootstrap-org.ts).
 * No SKIP: falla si faltan credenciales.
 *
 * @smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { gotoWhenReady } from "./helpers";

function loadCreds(): Record<string, string> {
  const path = process.env.SFEF_06B_CREDS_PATH ?? "/tmp/sfef-06b-creds.env";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("SFEF_06") || k.startsWith("PLAYWRIGHT_")) out[k] = String(v);
  }
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i)] = line.slice(i + 1);
    }
  }
  return out;
}

const creds = loadCreds();
const orgEmail = creds.SFEF_06_ORG_EMAIL;
const orgPassword = creds.SFEF_06_ORG_PASSWORD;
const contestId = creds.SFEF_06_CONTEST_ID;
const entryReporter = creds.SFEF_06B_ENTRY_REPORTER;
const entryEvidence = creds.SFEF_06B_ENTRY_EVIDENCE;
const entryPro = creds.SFEF_06B_ENTRY_PRO;
const entryReject = creds.SFEF_06B_ENTRY_REJECT;
const entryAdmit = creds.SFEF_06B_ENTRY_ADMIT;
const entryFreeze = creds.SFEF_06B_ENTRY_FREEZE;
const participantProEmail = creds.SFEF_06B_PARTICIPANT_PRO_EMAIL;
const participantPassword = creds.SFEF_06B_PARTICIPANT_PASSWORD;

if (!orgEmail || !orgPassword || !contestId) {
  throw new Error(
    "BLOCKED — STAGING ORGANIZER TEST CREDENTIALS UNAVAILABLE (run ops-sfef-06b-bootstrap-org.ts)",
  );
}
if (
  !entryReporter ||
  !entryEvidence ||
  !entryPro ||
  !entryReject ||
  !entryAdmit ||
  !entryFreeze
) {
  throw new Error("Missing SFEF_06B_ENTRY_* fixtures — re-run bootstrap");
}

async function loginSession(page: Page, email: string, password: string) {
  await gotoWhenReady(page, "/login");
  const emailInput = page.locator("#email");
  await emailInput.waitFor({ state: "visible", timeout: 45_000 });
  await emailInput.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 });
}

/** Login organizador: exige acceso al dashboard (membresía ACTIVE). */
async function loginOrganizer(page: Page, email: string, password: string) {
  await loginSession(page, email, password);
  if (page.url().includes("forbiddenApp=fotorank")) {
    throw new Error(
      "Login OK pero forbiddenApp=fotorank — falta membresía ACTIVE de ContestOrganization o gate de dashboard.",
    );
  }
  await gotoWhenReady(page, "/dashboard");
  if (page.url().includes("forbiddenApp=fotorank")) {
    throw new Error("Dashboard bloqueado con forbiddenApp=fotorank tras login.");
  }
  await expect(page).toHaveURL(/\/(dashboard|onboarding)(\/|$|\?)/, { timeout: 45_000 });
}

/** Login participante: sesión pública; no exige panel organizador. */
async function loginParticipant(page: Page, email: string, password: string) {
  await loginSession(page, email, password);
}

async function openAdmission(page: Page) {
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/admision`);
  await expect(page.getByTestId("admission-filters")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("admission-queue-table")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Santa Fe 06B admission UI @smoke", () => {
  test("01 login organizador + cola + filtros", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    await openAdmission(page);
    await expect(page.getByTestId("admission-freeze")).toBeVisible();

    const filters = [
      ["Requiere revisión", "requires_review"],
      ["Fecha observada", "date_observed"],
      ["Territorio observado", "territory_observed"],
      ["Dispositivo observado", "device_observed"],
      ["ARGRA pendiente", "argra_pending"],
      ["Evidencia solicitada", "evidence_requested"],
      ["Reemplazo pendiente", "replacement_pending"],
      ["Admitida", "admitted"],
      ["Rechazada", "rejected"],
      ["Congelada", "frozen"],
    ] as const;

    for (const [label, value] of filters) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`filter=${value}`));
      await expect(page.getByTestId("admission-queue-table")).toBeVisible();
      expect(page.url()).toContain(contestId);
    }
  });

  test("02 detalle obra — privacidad", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryReporter}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("admission-status-line")).toBeVisible();
    await expect(page.getByTestId("admin-eligibility")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/-?\d+\.\d{4,}.*,\s*-?\d+\.\d{4,}/); // no coords típicas
    expect(body.toLowerCase()).not.toContain("password");
    // ARGRA no completo por defecto (sintético SYNTH-ARGRA…)
    expect(body).not.toContain("SYNTH-ARGRA-06B-");
  });

  test("03 ARGRA UI — verificar", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryReporter}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /Ver número/i }).click();
    await page.waitForTimeout(500);
    // marcar VERIFIED
    await page.locator("select").filter({ hasText: "VERIFIED" }).first().selectOption("VERIFIED");
    await page.getByRole("button", { name: /Guardar ARGRA/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
    // idempotencia
    await page.getByRole("button", { name: /Guardar ARGRA/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
  });

  test("04 evidencia UI", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryEvidence}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("ORIGINAL_REQUIRED");
    await page.locator("textarea").nth(1).fill("Evidencia sintética 06B — dron.");
    await page.getByRole("button", { name: /Solicitar evidencia/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
  });

  test("05 reemplazo UI — permitir + participante", async ({ page }) => {
    if (!participantProEmail || !participantPassword) {
      throw new Error("Missing SFEF_06B_PARTICIPANT_PRO_* — re-run bootstrap");
    }
    await loginOrganizer(page, orgEmail, orgPassword);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryPro}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /Permitir reemplazo/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });

    // Participante: estado público con reemplazo (sin exigir dashboard)
    await page.context().clearCookies();
    await loginParticipant(page, participantProEmail, participantPassword);
    await gotoWhenReady(page, "/concursos/santa-fe-en-foco/inscripcion");
    await expect(page.getByText(/Ya estás inscripto/i)).toBeVisible({ timeout: 45_000 });
    // Estado público de admisión (cargado vía /entries/me al montar el panel)
    await expect(page.getByTestId("entry-status-block")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("admission-public-status")).toContainText(/Reemplazo|habilitado/i);
  });

  test("06 rechazo UI", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryReject}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("CAPTURE_DATE_BEFORE_WINDOW");
    await page.locator("textarea").nth(1).fill("Fecha fuera de período — fixture 06B.");
    await page.getByRole("button", { name: /^Rechazar$/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("admission-status-line")).toContainText(/REJECTED/i);
  });

  test("07 admitir + freeze selectivo dry-run/apply", async ({ page }) => {
    await loginOrganizer(page, orgEmail, orgPassword);
    // Admitir elegible
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/inscripciones/${entryAdmit}`);
    await expect(page.getByTestId("admission-actions")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("admission-reason-code").selectOption("ADMISSION_APPROVED");
    await page.getByRole("button", { name: /^Admitir$/i }).click();
    await expect(page.getByText(/Acción registrada/i)).toBeVisible({ timeout: 30_000 });

    await openAdmission(page);
    // Solo Amateur (incluye eAdmit + eFreeze)
    await page.getByTestId("freeze-cat-fotografo-profesional").click(); // ensure toggle off if needed
    // reset: click amateur on, others off
    for (const slug of [
      "fotografo-profesional",
      "reportero-grafico",
      "fotografia-aerea",
    ]) {
      const btn = page.getByTestId(`freeze-cat-${slug}`);
      const cls = await btn.getAttribute("class");
      if (cls?.includes("text-gold")) await btn.click();
    }
    const amateur = page.getByTestId("freeze-cat-fotografo-amateur");
    const aCls = await amateur.getAttribute("class");
    if (!aCls?.includes("text-gold")) await amateur.click();

    await page.getByTestId("freeze-dry-run").click();
    await expect(page.getByTestId("freeze-result")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("freeze-result")).toContainText(/Dry-run selectivo/i);
    await expect(page.getByTestId("freeze-result")).toContainText(/Hash:/i);
    await expect(page.getByTestId("freeze-result")).toContainText(/Leaks: ninguno/i);

    const hint = await page.getByTestId("freeze-result").innerText();
    const m = hint.match(/CONGELAR (\d+) OBRAS/);
    expect(m).toBeTruthy();
    const phrase = m![0];
    await page.getByTestId("freeze-confirm-phrase").fill(phrase);
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("freeze-apply").click();
    await expect(page.getByTestId("freeze-result")).toContainText(/Freeze aplicado/i, {
      timeout: 60_000,
    });
  });
});
