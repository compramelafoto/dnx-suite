/**
 * E2E ETAPA 08 — publicación controlada staging (fixtures sintéticos).
 * Requiere /tmp/sfef-08-creds.env (ops-sfef-08-results-fixtures.ts).
 *
 * @smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { gotoWhenReady } from "./helpers";
import {
  SANTA_FE_PUBLISH_CONFIRM_PHRASE,
  STAGING_TEST_PUBLICATION_PHRASE,
} from "../app/lib/fotorank/results/publication-types";

function loadCreds(): Record<string, string> {
  const path = process.env.SFEF_08_CREDS_PATH ?? "/tmp/sfef-08-creds.env";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("SFEF_08_") || k.startsWith("PLAYWRIGHT_")) out[k] = String(v);
  }
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      let v = line.slice(i + 1);
      if (
        (v.startsWith("'") && v.endsWith("'") && v.length >= 2) ||
        (v.startsWith('"') && v.endsWith('"') && v.length >= 2)
      ) {
        v = v.slice(1, -1);
      }
      out[line.slice(0, i)] = v;
    }
  }
  return out;
}

const creds = loadCreds();
const required = [
  "SFEF_08_ORG_EMAIL",
  "SFEF_08_ORG_PASSWORD",
  "SFEF_08_CONTEST_ID",
  "SFEF_08_RESULT_BATCH_ID",
] as const;
for (const k of required) {
  if (!creds[k]) throw new Error(`BLOCKED — missing ${k} (run ops-sfef-08-results-fixtures.ts)`);
}

const orgEmail = creds.SFEF_08_ORG_EMAIL!;
const orgPassword = creds.SFEF_08_ORG_PASSWORD!;
const contestId = creds.SFEF_08_CONTEST_ID!;
const batchId = creds.SFEF_08_RESULT_BATCH_ID!;
const tieGroup = creds.SFEF_08_TIE_GROUP ?? "";
const tiedSnapIds = (creds.SFEF_08_TIED_SNAPSHOT_IDS ?? "").split(",").filter(Boolean);

async function loginOrganizer(page: Page) {
  await gotoWhenReady(page, "/login");
  await page.locator("#email").waitFor({ state: "visible", timeout: 45_000 });
  await page.locator("#email").fill(orgEmail);
  await page.locator('input[name="password"]').fill(orgPassword);
  await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90_000 });
  await gotoWhenReady(page, "/dashboard");
}

async function readiness(page: Page) {
  const res = await page.request.get(
    `/api/fotorank/contests/${contestId}/results/readiness?batchId=${batchId}`,
  );
  const json = await res.json();
  expect(res.ok(), JSON.stringify(json)).toBeTruthy();
  const r = json.readiness as {
    status: string;
    reasonCodes: string[];
    publicationHash: string | null;
  };
  expect(r).toBeTruthy();
  return r;
}

test.describe.configure({ mode: "serial" });

test("01 ranking privado solo organizador + rúbrica bloquea", async ({ page }) => {
  await loginOrganizer(page);
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
  await expect(page.getByTestId("publication-gates-panel")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Ranking Etapa 15 \(privado\)/i)).toBeVisible();
  const r = await readiness(page);
  expect(r.status).toBe("BLOCKED");
  expect(r.reasonCodes).toContain("RUBRIC_NOT_CONFIRMED");
  expect(r.reasonCodes).toContain("UNRESOLVED_TIE");
});

test("02 empate completo → comité", async ({ page }) => {
  await loginOrganizer(page);
  expect(tieGroup.length).toBeGreaterThan(0);
  expect(tiedSnapIds.length).toBeGreaterThanOrEqual(2);
  const res = await page.request.post(`/api/fotorank/contests/${contestId}/results/committee`, {
    data: {
      batchId,
      tieGroup,
      orderedSnapshotIds: tiedSnapIds,
      members: ["organizador-staging", "coordinador-jurado-staging"],
      reason: "SFEF08 committee decision fixture — scores conserved",
    },
  });
  const json = await res.json();
  expect(res.ok(), JSON.stringify(json)).toBeTruthy();
  const r = await readiness(page);
  expect(r.reasonCodes).not.toContain("UNRESOLVED_TIE");
});

test("03 finalistas + ganadores + staging configs", async ({ page }) => {
  await loginOrganizer(page);
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
  await page.getByTestId("confirm-rubric-staging").click();
  await page.getByTestId("confirm-awards-staging").click();
  await page.getByTestId("configure-finalists").click();
  await page.getByTestId("derive-winners").click();
  await page.waitForTimeout(1500);
  const r = await readiness(page);
  expect(r.reasonCodes).not.toContain("RUBRIC_NOT_CONFIRMED");
  expect(r.reasonCodes).not.toContain("FINALISTS_NOT_CONFIGURED");
  expect(r.reasonCodes).not.toContain("WINNERS_NOT_CONFIGURED");
});

test("04 legal pendiente bloquea; institucional + legal aprueban", async ({ page }) => {
  await loginOrganizer(page);
  let r = await readiness(page);
  expect(r.reasonCodes).toContain("LEGAL_APPROVAL_MISSING");
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
  await page.getByTestId("approve-institutional").click();
  await page.getByTestId("approve-legal").click();
  await page.waitForTimeout(1500);
  r = await readiness(page);
  expect(r.reasonCodes).not.toContain("INSTITUTIONAL_APPROVAL_MISSING");
  expect(r.reasonCodes).not.toContain("LEGAL_APPROVAL_MISSING");
});

test("05 finalize + preview privado", async ({ page }) => {
  await loginOrganizer(page);
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
  const finalize = page.getByRole("button", { name: /Finalizar \(inmutable\)/i });
  if (await finalize.isVisible().catch(() => false)) {
    await finalize.click();
    await page.waitForTimeout(2000);
  }
  let r = await readiness(page);
  // si aún GENERATED/REVIEWED, forzar via form reason
  if (r.reasonCodes.includes("RESULT_BATCH_NOT_FINALIZED")) {
    await page.locator('input[name="reason"]').fill("sfef08 finalize");
    await finalize.click();
    await page.waitForTimeout(2000);
    r = await readiness(page);
  }
  expect(r.reasonCodes).not.toContain("RESULT_BATCH_NOT_FINALIZED");
  expect(r.status).toBe("READY");
  expect(r.publicationHash).toBeTruthy();

  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados/preview`);
  await expect(page.getByTestId("results-private-preview")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("preview-readiness")).toHaveText("READY");
});

test("06 publish dry-run oficial bloqueado + staging publish", async ({ page }) => {
  await loginOrganizer(page);
  const r = await readiness(page);
  expect(r.status).toBe("READY");

  const blocked = await page.request.post(`/api/fotorank/contests/${contestId}/results/publish`, {
    data: {
      batchId,
      expectedHash: r.publicationHash,
      confirmationPhrase: SANTA_FE_PUBLISH_CONFIRM_PHRASE,
      idempotencyKey: `sfef08-official-${batchId}`,
    },
  });
  expect(blocked.status()).toBe(409);

  const pub = await page.request.post(`/api/fotorank/contests/${contestId}/results/publish`, {
    data: {
      batchId,
      expectedHash: r.publicationHash,
      confirmationPhrase: STAGING_TEST_PUBLICATION_PHRASE,
      idempotencyKey: `sfef08-staging-${batchId}`,
    },
  });
  const pubJson = await pub.json();
  expect(pub.ok(), JSON.stringify(pubJson)).toBeTruthy();

  const again = await page.request.post(`/api/fotorank/contests/${contestId}/results/publish`, {
    data: {
      batchId,
      expectedHash: r.publicationHash,
      confirmationPhrase: STAGING_TEST_PUBLICATION_PHRASE,
      idempotencyKey: `sfef08-staging-${batchId}`,
    },
  });
  const againJson = await again.json();
  expect(again.ok()).toBeTruthy();
  expect(againJson.idempotent).toBe(true);
});

test("07 API pública sanitizada + UI pública", async ({ page }) => {
  await loginOrganizer(page);
  const res = await page.request.get("/api/public/v1/contests/santa-fe-en-foco/results");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.published).toBe(true);
  expect(json.stagingTest).toBe(true);
  expect(json.scoresVisible).toBe(false);
  const raw = JSON.stringify(json);
  expect(raw).not.toMatch(/aggregateScore|storageKey|privateComment|email|gps/i);

  await gotoWhenReady(page, "/concursos/santa-fe-en-foco/resultados");
  await expect(page.getByTestId("public-results-live")).toBeVisible({ timeout: 45_000 });
});

test("08 revoke + history + cleanup público", async ({ page }) => {
  await loginOrganizer(page);
  await gotoWhenReady(page, `/dashboard/concursos/${contestId}/resultados`);
  await page.getByTestId("revoke-publication").click();
  await page.waitForTimeout(2000);

  const pub = await page.request.get("/api/public/v1/contests/santa-fe-en-foco/results");
  expect(pub.status()).toBe(404);

  const hist = await page.request.get(
    `/api/fotorank/contests/${contestId}/results/history?batchId=${batchId}`,
  );
  const histJson = await hist.json();
  expect(hist.ok()).toBeTruthy();
  expect(histJson.history?.length).toBeGreaterThan(0);

  await gotoWhenReady(page, "/concursos/santa-fe-en-foco/resultados");
  await expect(page.getByTestId("public-results-not-published")).toBeVisible({ timeout: 45_000 });
});
