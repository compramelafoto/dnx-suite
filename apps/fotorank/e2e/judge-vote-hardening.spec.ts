import { expect, test } from "@playwright/test";
import {
  E2E_ASSIGNMENT_DRAFT_CONTEST_ID,
  E2E_ASSIGNMENT_WINDOW_CLOSED_ID,
  E2E_CRITERIA_BASED_KEYS,
  E2E_CRITERIA_BASED_SAMPLE,
  E2E_CRITERIA_BASED_SAMPLE_ALT,
  E2E_DEMO_JUDGE_EMAIL,
  E2E_DEMO_JUDGE_PASSWORD,
  E2E_DRAFT_EVAL_JUDGE_EMAIL,
  E2E_DRAFT_EVAL_JUDGE_PASSWORD,
  E2E_WINDOW_CLOSED_JUDGE_EMAIL,
  E2E_WINDOW_CLOSED_JUDGE_PASSWORD,
} from "./constants";
import { loginAsJudge } from "./helpers";
import { JudgeEvaluationForm } from "./pageObjects";

test.describe("Jurado — hardening evaluación / voto", () => {
  test("asignación inexistente u otra cuenta: 404", async ({ page }) => {
    await loginAsJudge(page, E2E_DEMO_JUDGE_EMAIL, E2E_DEMO_JUDGE_PASSWORD);
    const res = await page.goto(`/jurado/asignaciones/${E2E_ASSIGNMENT_DRAFT_CONTEST_ID}/evaluar`, {
      waitUntil: "commit",
    });
    expect(res?.status(), "debe ser 404 cuando la asignación no pertenece al jurado").toBe(404);
  });

  test("ventana cerrada: panel y URL directa muestran bloqueo coherente", async ({ page }) => {
    await loginAsJudge(page, E2E_WINDOW_CLOSED_JUDGE_EMAIL, E2E_WINDOW_CLOSED_JUDGE_PASSWORD);
    await expect(page.getByRole("heading", { name: /Panel del jurado/i })).toBeVisible();
    await expect(page.getByText(/ventana de evaluación está cerrada/i)).toBeVisible();

    const direct = await page.goto(`/jurado/asignaciones/${E2E_ASSIGNMENT_WINDOW_CLOSED_ID}/evaluar`, {
      waitUntil: "load",
    });
    expect(direct?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Evaluación no disponible/i })).toBeVisible();
    await expect(page.getByText(/ventana de evaluación está cerrada/i)).toBeVisible();
  });

  test("concurso no elegible (borrador): bloqueo en pantalla de evaluación", async ({ page }) => {
    await loginAsJudge(page, E2E_DRAFT_EVAL_JUDGE_EMAIL, E2E_DRAFT_EVAL_JUDGE_PASSWORD);
    await page.goto(`/jurado/asignaciones/${E2E_ASSIGNMENT_DRAFT_CONTEST_ID}/evaluar`, { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /Evaluación no disponible/i })).toBeVisible();
    await expect(page.getByText(/no está en una fase que permita evaluación/i)).toBeVisible();
  });

  test("doble guardado CRITERIA_BASED: dos éxitos seguidos (misma obra, política upsert en servidor)", async ({
    page,
  }) => {
    await loginAsJudge(page, E2E_DEMO_JUDGE_EMAIL, E2E_DEMO_JUDGE_PASSWORD);
    await page.getByRole("link", { name: "Evaluar" }).first().click();
    await expect(page.getByRole("heading", { name: /Evaluación de fotografías/i })).toBeVisible({
      timeout: 20_000,
    });

    const ev = JudgeEvaluationForm.fromPage(page);
    await ev.waitForVisible();
    await ev.expectCriteriaSectionReady(E2E_CRITERIA_BASED_KEYS.length);

    await ev.fillAllCriteriaFromConfig(E2E_CRITERIA_BASED_SAMPLE);
    await ev.submitEvaluationAndExpectSuccess();

    await ev.fillAllCriteriaFromConfig(E2E_CRITERIA_BASED_SAMPLE_ALT);
    await ev.submitEvaluationAndExpectSuccess();
  });
});
