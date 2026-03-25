import { expect, test } from "@playwright/test";
import {
  E2E_CRITERIA_BASED_KEYS,
  E2E_CRITERIA_BASED_SAMPLE,
  E2E_DEMO_JUDGE_EMAIL,
  E2E_DEMO_JUDGE_PASSWORD,
} from "./constants";
import { loginAsJudge } from "./helpers";
import { JudgeEvaluationForm } from "./pageObjects";

test.describe("Jurado — panel y evaluación", () => {
  test(
    "panel, entrar a evaluación y guardar voto CRITERIA_BASED @smoke",
    { tag: "@smoke" },
    async ({ page }) => {
      await loginAsJudge(page, E2E_DEMO_JUDGE_EMAIL, E2E_DEMO_JUDGE_PASSWORD);

      await expect(page.getByRole("heading", { name: /Panel del jurado/i })).toBeVisible();
      await page.getByRole("link", { name: "Evaluar" }).first().click();

      await expect(page.getByRole("heading", { name: /Evaluación de fotografías/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page).toHaveURL(/evaluar/i, { timeout: 20_000 });

      const ev = JudgeEvaluationForm.fromPage(page);
      await ev.waitForVisible();

      await ev.expectNoLegacyCriteriaJsonTextarea();
      await ev.expectCriteriaSectionReady(E2E_CRITERIA_BASED_KEYS.length);

      await ev.fillAllCriteriaFromConfig(E2E_CRITERIA_BASED_SAMPLE);
      await ev.submitEvaluationAndExpectSuccess();
    },
  );
});
