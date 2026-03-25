import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_CRITERIA_BASED_KEYS, type E2ECriteriaBasedKey, E2E_CRITERIA_BASED_SAMPLE } from "./constants";
import { criterionInputTestId, TT } from "./testIds";

async function hasCookie(page: Page, name: string): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === name && Boolean(c.value));
}

const CRITERION_INPUT_PREFIX = "criterion-input-";

/** Formulario de evaluación del jurado. */
export class JudgeEvaluationForm {
  readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  static fromPage(page: Page): JudgeEvaluationForm {
    return new JudgeEvaluationForm(page.getByTestId(TT.evaluationForm));
  }

  static fromRoot(root: Locator): JudgeEvaluationForm {
    return new JudgeEvaluationForm(root);
  }

  async waitForVisible(): Promise<void> {
    await this.root.waitFor({ state: "visible" });
  }

  async expectNoLegacyCriteriaJsonTextarea(): Promise<void> {
    await expect(this.root.locator('textarea[name="criteriaScoresJson"]')).toHaveCount(0);
  }

  async expectCriteriaSectionReady(expectedCount: number): Promise<void> {
    await expect(this.root.getByTestId(TT.evaluationCriteria)).toBeVisible({ timeout: 20_000 });
    await expect(this.root.getByTestId(TT.evaluationCriteriaHint)).toBeVisible({ timeout: 20_000 });
    await expect(this.root.locator(`[data-testid^="${CRITERION_INPUT_PREFIX}"]`)).toHaveCount(expectedCount, {
      timeout: 20_000,
    });
  }

  /**
   * Completa todos los criterios del seed E2E; valida enteros y que el valor quede dentro de min/max del input (HTML).
   */
  async fillAllCriteriaFromConfig(
    scores: Record<E2ECriteriaBasedKey, number> = E2E_CRITERIA_BASED_SAMPLE,
  ): Promise<void> {
    for (const key of E2E_CRITERIA_BASED_KEYS) {
      const n = scores[key];
      if (!Number.isInteger(n)) {
        throw new Error(`E2E: ${key}=${n} debe ser entero`);
      }
      const input = this.root.getByTestId(criterionInputTestId(key));
      await expect(input).toBeVisible({ timeout: 15_000 });
      const min = Number(await input.getAttribute("min"));
      const max = Number(await input.getAttribute("max"));
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error(`E2E: criterion ${key} sin min/max en DOM`);
      }
      if (n < min || n > max) {
        throw new Error(`E2E: ${key}=${n} fuera de [${min},${max}]`);
      }
      await input.fill(String(n));
      await expect(input).toHaveValue(String(n));
      const numVal = Number(await input.inputValue());
      expect(numVal).toBeGreaterThanOrEqual(min);
      expect(numVal).toBeLessThanOrEqual(max);
    }
  }

  async submit(): Promise<void> {
    const submitBtn = this.root.getByTestId(TT.evaluationSubmit);
    await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
    await submitBtn.click();
  }

  async expectSaved(): Promise<void> {
    const saved = this.root.getByTestId(TT.voteSavedMessage);
    const errLoc = this.root.getByTestId(TT.evaluationError);
    const submit = this.root.getByTestId(TT.evaluationSubmit);
    try {
      await expect(saved).toBeVisible({ timeout: 30_000 });
    } catch (cause) {
      const errVisible = await errLoc.isVisible().catch(() => false);
      const errText = errVisible ? (await errLoc.textContent().catch(() => null))?.trim() : null;
      const btn = (await submit.textContent().catch(() => null))?.trim() ?? null;
      throw new Error(
        `E2E: no apareció vote-saved-message. evaluation-error=${errVisible ? JSON.stringify(errText) : "hidden"} submit=${JSON.stringify(btn)}`,
        { cause },
      );
    }
  }

  async submitEvaluationAndExpectSuccess(): Promise<void> {
    await this.submit();
    await this.expectSaved();
  }
}

/** Formulario admin crear/editar jurado. */
export class JudgeAdminForm {
  private readonly page: Page;
  readonly root: Locator;

  constructor(page: Page, root: Locator) {
    this.page = page;
    this.root = root;
  }

  static fromPage(page: Page): JudgeAdminForm {
    return new JudgeAdminForm(page, page.getByTestId(TT.judgeAdminForm));
  }

  async waitReady(): Promise<void> {
    await this.root.waitFor({ state: "visible" });
    await expect(this.root.getByTestId(TT.judgeAdminSubmit)).toBeEnabled({ timeout: 20_000 });
  }

  async uploadAvatar(filePath: string): Promise<void> {
    const fileInput = this.root.locator("#judge-avatar-file");
    await fileInput.waitFor({ state: "attached", timeout: 20_000 });
    await fileInput.setInputFiles(filePath);
    await expect
      .poll(async () => fileInput.evaluate((el) => (el as HTMLInputElement).files?.length ?? 0), {
        timeout: 10_000,
      })
      .toBe(1);
  }

  async addBioParagraph(text: string): Promise<void> {
    const bio = this.root.getByTestId(TT.judgeBioEditor);
    await expect(bio).toBeVisible({ timeout: 15_000 });
    const para = bio.getByTestId(TT.judgeBioParagraph);
    if ((await para.count()) === 0) {
      await bio.getByTestId(TT.judgeBioAddParagraph).click();
    }
    await expect(para).toBeVisible({ timeout: 20_000 });
    await para.fill(text);
    await expect(this.root.getByTestId(TT.judgeBioRichJson)).toHaveValue(
      new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      { timeout: 10_000 },
    );
    await expect(this.root.getByTestId(TT.judgeBioPreview)).toBeVisible();
  }

  async submitExpectJudgesList(): Promise<void> {
    await expect(this.root.getByTestId(TT.judgeAdminSubmit)).toBeEnabled({ timeout: 20_000 });
    const nav = this.page.waitForURL(/\/jurados\/?$/, {
      timeout: 60_000,
      waitUntil: "commit",
    });
    await this.root.getByTestId(TT.judgeAdminSubmit).click();
    try {
      await nav;
    } catch (cause) {
      const err = await this.root.locator('[role="alert"]').textContent().catch(() => null);
      throw new Error(
        err?.trim()
          ? `Formulario jurado: ${err.trim()}`
          : "No hubo navegación a /jurados tras guardar (revisá consola del servidor).",
        { cause },
      );
    }
    await expect(this.page).toHaveURL(/\/jurados\/?$/, { timeout: 10_000 });
  }
}

/** Registro desde invitación. */
export class JudgeInviteForm {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  root(): Locator {
    return this.page.getByTestId(TT.judgeRegisterForm);
  }

  async waitReady(): Promise<void> {
    const form = this.root();
    await form.waitFor({ state: "visible" });
    await expect(form.getByTestId(TT.judgeRegisterSubmit)).toBeEnabled({ timeout: 20_000 });
  }

  async fillFields(data: { token: string; firstName: string; lastName: string; password: string }): Promise<void> {
    const form = this.root();
    await this.waitReady();
    await form.locator("#judge-token").fill(data.token);
    await form.locator("#judge-firstName").fill(data.firstName);
    await form.locator("#judge-lastName").fill(data.lastName);
    await form.locator("#judge-password").fill(data.password);
  }

  /** Tras enviar el formulario, espera error en cliente (sin redirect al panel). */
  async submitExpectClientError(match: string | RegExp): Promise<void> {
    const form = this.root();
    await expect(form.getByTestId(TT.judgeRegisterSubmit)).toBeEnabled({ timeout: 20_000 });
    await form.getByTestId(TT.judgeRegisterSubmit).click();
    const err = this.page.getByTestId(TT.judgeRegisterError);
    await expect(err).toBeVisible({ timeout: 25_000 });
    await expect(err).toContainText(match);
    expect(await hasCookie(this.page, "dnx_judge_session")).toBe(false);
    await expect(this.page).not.toHaveURL(/\/jurado\/panel(\/|$|\?)/);
  }

  async fillAndSubmit(data: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<void> {
    const form = this.root();
    await this.waitReady();
    await form.locator("#judge-token").fill(data.token);
    await form.locator("#judge-firstName").fill(data.firstName);
    await form.locator("#judge-lastName").fill(data.lastName);
    await form.locator("#judge-password").fill(data.password);

    const nav = this.page.waitForURL(/\/jurado\/panel(\/|$|\?)/, {
      timeout: 90_000,
      waitUntil: "commit",
    });

    await form.getByTestId(TT.judgeRegisterSubmit).click();

    try {
      await nav;
    } catch (cause) {
      const closed =
        cause instanceof Error &&
        /Target page, context or browser has been closed|has been closed/i.test(cause.message);
      if (closed) {
        throw new Error(
          "El navegador o la pestaña se cerró durante el registro (en modo headed no cierres la ventana hasta que termine el test).",
          { cause },
        );
      }
      const url = this.page.url();
      const session = await hasCookie(this.page, "dnx_judge_session");
      const errText = await this.page
        .getByTestId(TT.judgeRegisterError)
        .textContent()
        .catch(() => null);
      const submitDisabled = await form.getByTestId(TT.judgeRegisterSubmit).isDisabled().catch(() => null);
      if (session) {
        await this.page.goto("/jurado/panel", { waitUntil: "load" });
      } else {
        throw new Error(
          `Registro no llegó al panel. url=${url} dnx_judge_session=false judge-register-error=${JSON.stringify(errText?.trim() ?? null)} submit_disabled=${submitDisabled}`,
          { cause },
        );
      }
    }

    await expect(this.page).toHaveURL(/\/jurado\/panel(\/|$|\?)/, { timeout: 20_000 });
  }

  async expectPanelHeading(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /Panel del jurado/i })).toBeVisible();
  }
}
