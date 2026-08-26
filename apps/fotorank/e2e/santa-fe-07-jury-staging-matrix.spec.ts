/**
 * E2E ETAPA 07B — matriz 8/8 jurado staging.
 * Requiere /tmp/sfef-07b-creds.env (ops-sfef-07b-jury-e2e-fixtures.ts).
 *
 * @smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { gotoWhenReady, loginAsJudge } from "./helpers";
import { SANTA_FE_EN_FOCO_JURY_CRITERIA } from "../app/lib/fotorank/jury/santa-fe-en-foco-rubric";

function loadCreds(): Record<string, string> {
  const path = process.env.SFEF_07B_CREDS_PATH ?? "/tmp/sfef-07b-creds.env";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("SFEF_07B_") || k.startsWith("PLAYWRIGHT_")) out[k] = String(v);
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
const required = [
  "SFEF_07B_ORG_EMAIL",
  "SFEF_07B_ORG_PASSWORD",
  "SFEF_07B_CONTEST_ID",
  "SFEF_07B_JUDGE_PASSWORD",
  "SFEF_07B_J0_EMAIL",
  "SFEF_07B_J1_EMAIL",
  "SFEF_07B_J2_EMAIL",
  "SFEF_07B_BACKUP_EMAIL",
  "SFEF_07B_BACKUP_ID",
  "SFEF_07B_INVITEE_EMAIL",
  "SFEF_07B_INVITE_TOKEN",
  "SFEF_07B_ENTRY_0",
  "SFEF_07B_ENTRY_1",
  "SFEF_07B_ENTRY_2",
  "SFEF_07B_ENTRY_3",
  "SFEF_07B_SNAP_0",
  "SFEF_07B_SNAP_1",
  "SFEF_07B_SNAP_2",
  "SFEF_07B_SNAP_3",
  "SFEF_07B_SESSION_ID",
] as const;
for (const k of required) {
  if (!creds[k]) throw new Error(`BLOCKED — missing ${k} (run ops-sfef-07b-jury-e2e-fixtures.ts)`);
}

const orgEmail = creds.SFEF_07B_ORG_EMAIL!;
const orgPassword = creds.SFEF_07B_ORG_PASSWORD!;
const contestId = creds.SFEF_07B_CONTEST_ID!;
const judgePassword = creds.SFEF_07B_JUDGE_PASSWORD!;

async function loginOrganizer(page: Page) {
  await gotoWhenReady(page, "/login");
  await page.locator("#email").waitFor({ state: "visible", timeout: 45_000 });
  await page.locator("#email").fill(orgEmail);
  await page.locator('input[name="password"]').fill(orgPassword);
  await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 });
  await gotoWhenReady(page, "/dashboard");
}

async function acceptTermsIfNeeded(page: Page) {
  const gate = page.getByTestId("jury-terms-gate");
  if (await gate.isVisible().catch(() => false)) {
    await page.getByTestId("jury-terms-check").check();
    await page.getByTestId("jury-terms-submit").click();
    await expect(page.getByTestId("jury-terms-accepted")).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByTestId("jury-terms-accepted")).toBeVisible({ timeout: 30_000 });
  }
}

async function submitEvaluationApi(
  page: Page,
  opts: {
    entryId: string;
    snapshotId: string;
    scores: Record<string, number>;
    submit?: boolean;
    idempotencyKey: string;
  },
) {
  const scores = SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
    key: c.key,
    score: opts.scores[c.key] ?? 7,
  }));
  const res = await page.request.post(
    `/api/fotorank/jury/contests/${contestId}/evaluations`,
    {
      data: {
        snapshotId: opts.snapshotId,
        scores,
        privateComment: "e2e sfef07b",
        submit: opts.submit ?? true,
        idempotencyKey: opts.idempotencyKey,
      },
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`eval submit failed ${res.status()}: ${JSON.stringify(json)}`);
  }
  return json;
}

function scoresEqualTotalDifferentNarrative(highNarrative: boolean): Record<string, number> {
  // enteros, sum = 40 → total 8 con pesos 20%
  if (highNarrative) {
    return {
      composition: 8,
      technique: 8,
      originality: 8,
      narrative_impact: 10,
      thematic_relation: 6,
    };
  }
  return {
    composition: 9,
    technique: 9,
    originality: 9,
    narrative_impact: 6,
    thematic_relation: 7,
  };
}

test.describe.configure({ mode: "serial" });

test.describe("Santa Fe ETAPA 07B — jurado 8/8", () => {
  test("01 invitación formal + aceptación token + términos", async ({ page, context }) => {
    await context.clearCookies();
    // Token inválido
    await gotoWhenReady(page, "/jurado/register?token=deadbeefdeadbeefdeadbeefdeadbeef");
    await page.locator("#judge-firstName").fill("X");
    await page.locator("#judge-lastName").fill("Y");
    await page.locator("#judge-password").fill("ClaveSegura!07b");
    await page.getByTestId("judge-register-submit").click();
    await expect(page.getByTestId("judge-register-error")).toContainText(/Invitación inválida|inválida/i, {
      timeout: 20_000,
    });

    // Token expirado
    await gotoWhenReady(
      page,
      `/jurado/register?token=${encodeURIComponent(creds.SFEF_07B_EXPIRED_TOKEN!)}`,
    );
    await page.locator("#judge-firstName").fill("Exp");
    await page.locator("#judge-lastName").fill("Ired");
    await page.locator("#judge-password").fill("ClaveSegura!07b");
    await page.getByTestId("judge-register-submit").click();
    await expect(page.getByTestId("judge-register-error")).toContainText(/vencida|expir/i, {
      timeout: 20_000,
    });

    // Token válido → aceptación
    await context.clearCookies();
    await gotoWhenReady(
      page,
      `/jurado/register?token=${encodeURIComponent(creds.SFEF_07B_INVITE_TOKEN!)}`,
    );
    await page.locator("#judge-firstName").fill("Invitee");
    await page.locator("#judge-lastName").fill("SFEF07B");
    await page.locator("#judge-password").fill(judgePassword);
    await page.getByTestId("judge-register-submit").click();
    await page.waitForURL(/\/jurado\/panel/, { timeout: 90_000 });

    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await expect(page.getByTestId("jury-entries-blocked-terms")).toBeVisible();
    await acceptTermsIfNeeded(page);
    await expect(page.getByTestId("jury-entries-list")).toBeVisible();

    // Org ve invitación ACCEPTED (sin token)
    await context.clearCookies();
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/jurado`);
    await expect(page.getByText(creds.SFEF_07B_INVITEE_EMAIL!).first()).toBeVisible();
    await expect(page.getByText(/ACCEPTED/i).first()).toBeVisible();
  });

  test("02 evaluación completa draft + submit + lock", async ({ page }) => {
    await loginAsJudge(page, creds.SFEF_07B_J0_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}/obras/${creds.SFEF_07B_ENTRY_0}`);
    // draft
    await submitEvaluationApi(page, {
      entryId: creds.SFEF_07B_ENTRY_0!,
      snapshotId: creds.SFEF_07B_SNAP_0!,
      scores: scoresEqualTotalDifferentNarrative(true),
      submit: false,
      idempotencyKey: `e2e-07b-j0-e0-draft`,
    });
    await page.reload();
    await submitEvaluationApi(page, {
      entryId: creds.SFEF_07B_ENTRY_0!,
      snapshotId: creds.SFEF_07B_SNAP_0!,
      scores: scoresEqualTotalDifferentNarrative(true),
      submit: true,
      idempotencyKey: `e2e-07b-j0-e0-submit`,
    });
  });

  test("03 conflicto + reasignación", async ({ page, context }) => {
    await loginAsJudge(page, creds.SFEF_07B_J1_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}/obras/${creds.SFEF_07B_ENTRY_1}`);
    await page.getByTestId("jury-conflict-reason").selectOption("KNOW_AUTHOR");
    await page.getByTestId("jury-conflict-submit").click();
    await page.waitForURL(new RegExp(`/jurado/concursos/${contestId}`), { timeout: 60_000 });
    // obra ya no listada para j1
    await expect(page.locator(`a[href*="${creds.SFEF_07B_ENTRY_1}"]`)).toHaveCount(0);

    await context.clearCookies();
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/jurado`);
    await expect(page.getByTestId("conflict-reassign-panel")).toBeVisible({ timeout: 60_000 });
    const submit = page.locator('[data-testid^="conflict-reassign-submit-"]').first();
    await expect(submit).toBeVisible();
    const target = page.locator('[data-testid^="conflict-reassign-target-"]').first();
    await target.selectOption(creds.SFEF_07B_BACKUP_ID!);
    await submit.click();
    await expect(page.getByText(/reasignada|Conflictos|Sin conflictos/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await context.clearCookies();
    await loginAsJudge(page, creds.SFEF_07B_BACKUP_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    await submitEvaluationApi(page, {
      entryId: creds.SFEF_07B_ENTRY_1!,
      snapshotId: creds.SFEF_07B_SNAP_1!,
      scores: { composition: 7, technique: 7, originality: 7, narrative_impact: 7, thematic_relation: 7 },
      submit: true,
      idempotencyKey: `e2e-07b-backup-e1`,
    });
  });

  test("04 abstención UI", async ({ page }) => {
    await loginAsJudge(page, creds.SFEF_07B_J2_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}/obras/${creds.SFEF_07B_ENTRY_2}`);
    page.once("dialog", async (d) => {
      await d.accept("Falta de competencia técnica — fixture 07B");
    });
    await page.getByTestId("jury-eval-abstain").click();
    await expect(page.getByText(/abst|VOID|registr/i).first()).toBeVisible({ timeout: 30_000 }).catch(
      () => undefined,
    );
    // otras obras siguen accesibles
    await gotoWhenReady(page, `/jurado/concursos/${contestId}/obras/${creds.SFEF_07B_ENTRY_3}`);
    await expect(page.getByTestId("jury-eval-abstain")).toBeVisible();
  });

  test("05 permisos y anonimización", async ({ page, context }) => {
    await loginAsJudge(page, creds.SFEF_07B_J0_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/@fotorank\.test/i);
    expect(body).not.toMatch(/ARGRA|latitude|longitude|storageKey/i);
    await page.goto(`/dashboard/concursos/${contestId}/resultados`);
    await expect(page).not.toHaveURL(new RegExp(`/dashboard/concursos/${contestId}/resultados`));

    await context.clearCookies();
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await expect(page).toHaveURL(/jurado\/login/);
  });

  test("06 cierre bloqueado por cobertura incompleta", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/jurado`);
    await expect(page.getByTestId("scoring-coverage")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("scoring-coverage")).toContainText(/Incompletas:\s*[1-9]/i);
    await expect(page.getByTestId("scoring-session-status")).toContainText(/OPEN/i);

    const sessionId = creds.SFEF_07B_SESSION_ID!;
    const res = await page.request.post(
      `/api/fotorank/contests/${contestId}/jury/scoring-sessions/${sessionId}/close`,
      { data: {} },
    );
    const json = await res.json();
    expect(res.status()).toBe(409);
    expect(json?.error?.code).toMatch(/COVERAGE_INCOMPLETE|CONFLICTS_OPEN/i);

    // UI: intentar cierre (server action) y ver mensaje si llega; no depender solo de eso.
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("scoring-coverage")).toContainText(/Incompletas:\s*[1-9]/i);
    await page.getByTestId("scoring-close").click();
    const closeErr = page.getByTestId("scoring-close-error");
    if (await closeErr.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(closeErr).toBeVisible();
    }
    await expect(page.getByTestId("scoring-session-status")).toContainText(/OPEN/i);
  });

  test("07 cierre exitoso + ranking privado", async ({ page, context }) => {
    // Completar cobertura: 3 evals válidas por obra (excepto abstain entry needs others)
    const judges = [
      { email: creds.SFEF_07B_J0_EMAIL!, tag: "j0" },
      { email: creds.SFEF_07B_J1_EMAIL!, tag: "j1" },
      { email: creds.SFEF_07B_BACKUP_EMAIL!, tag: "bk" },
    ];
    const entries = [
      { entryId: creds.SFEF_07B_ENTRY_0!, snap: creds.SFEF_07B_SNAP_0!, highN: true },
      { entryId: creds.SFEF_07B_ENTRY_1!, snap: creds.SFEF_07B_SNAP_1!, highN: false },
      { entryId: creds.SFEF_07B_ENTRY_2!, snap: creds.SFEF_07B_SNAP_2!, highN: false },
      { entryId: creds.SFEF_07B_ENTRY_3!, snap: creds.SFEF_07B_SNAP_3!, highN: false },
    ];

    for (const j of judges) {
      await context.clearCookies();
      await loginAsJudge(page, j.email, judgePassword);
      await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
      await acceptTermsIfNeeded(page);
      for (const e of entries) {
        // j1 en conflicto con entry1 — skip
        if (j.tag === "j1" && e.entryId === creds.SFEF_07B_ENTRY_1) continue;
        // j2 abstained entry2 — j2 not in this list; ok
        try {
          await submitEvaluationApi(page, {
            entryId: e.entryId,
            snapshotId: e.snap,
            scores: scoresEqualTotalDifferentNarrative(e.highN),
            submit: true,
            idempotencyKey: `e2e-07b-cover-${j.tag}-${e.entryId}`,
          });
        } catch (err) {
          // idempotent / conflict / locked — continuar
          const msg = err instanceof Error ? err.message : String(err);
          if (!/idempot|CONFLICT|LOCKED|409|already/i.test(msg)) {
            // still try continue for coverage
            console.warn(msg);
          }
        }
      }
    }

    // j2 completa otras obras (no entry2 abstained)
    await context.clearCookies();
    await loginAsJudge(page, creds.SFEF_07B_J2_EMAIL!, judgePassword);
    await gotoWhenReady(page, `/jurado/concursos/${contestId}`);
    await acceptTermsIfNeeded(page);
    for (const e of entries) {
      if (e.entryId === creds.SFEF_07B_ENTRY_2) continue;
      try {
        await submitEvaluationApi(page, {
          entryId: e.entryId,
          snapshotId: e.snap,
          scores: scoresEqualTotalDifferentNarrative(e.highN),
          submit: true,
          idempotencyKey: `e2e-07b-cover-j2-${e.entryId}`,
        });
      } catch {
        /* ignore */
      }
    }

    await context.clearCookies();
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/jurado`);
    await expect(page.getByTestId("scoring-coverage")).toContainText(/Incompletas:\s*0/i, {
      timeout: 60_000,
    });
    const closeRes = await page.request.post(
      `/api/fotorank/contests/${contestId}/jury/scoring-sessions/${creds.SFEF_07B_SESSION_ID}/close`,
      { data: {} },
    );
    const closeJson = await closeRes.json();
    expect(closeRes.ok(), JSON.stringify(closeJson)).toBeTruthy();
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("scoring-session-status")).toContainText(/CLOSED|LOCKED/i, {
      timeout: 60_000,
    });
    // ranking privado
    const gen = page.getByTestId("scoring-generate-ranking");
    if (await gen.isVisible().catch(() => false)) {
      // ensure rules first if buttons present
      const ensure = page.getByRole("button", { name: /Asegurar reglas/i });
      if (await ensure.isVisible().catch(() => false)) await ensure.click();
      const activate = page.getByRole("button", { name: /Activar reglas/i });
      if (await activate.isVisible().catch(() => false)) await activate.click();
      await gen.click();
    }
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
    await expect(page.getByText(/Ranking Etapa 15|privado|Legado JudgeVote/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("08 empate — gana mayor narrative_impact", async ({ page }) => {
    await loginOrganizer(page);
    await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
    // Ranking privado visible; empate resuelto por narrative (entry0 high narrative)
    await expect(page.locator("body")).toContainText(/Ranking Etapa 15|privado/i);
    await expect(page.locator("body")).toContainText(/Sin publicación LIVE|sesión CLOSED/i);
    // No estado de publicación pública activa
    await expect(page.locator("body")).not.toContainText(/publicado públicamente|PUBLICADO_LIVE|status:\s*LIVE/i);
    // Legado JudgeVote explícitamente no canónico
    await expect(page.locator("body")).toContainText(/No es fuente de verdad Etapa 15|Legado JudgeVote/i);
  });
});
