import { expect, test } from "@playwright/test";
import {
  E2E_INVALID_INVITE_TOKEN,
  E2E_INVITE_JUDGE_EMAIL,
  E2E_INVITE_JUDGE_PASSWORD,
  E2E_INVITE_PLAIN_TOKEN,
} from "./constants";
import { gotoWhenReady, loginAsJudge } from "./helpers";
import { JudgeInviteForm } from "./pageObjects";

test.describe("Jurado — invitación", () => {
  test(
    "completar registro desde token y llegar al panel @smoke",
    { tag: "@smoke" },
    async ({ page, context }) => {
    await context.clearCookies();

    await gotoWhenReady(
      page,
      `/jurado/register?token=${encodeURIComponent(E2E_INVITE_PLAIN_TOKEN)}`,
    );

    await expect(page.getByRole("heading", { name: /Registro de jurado/i })).toBeVisible();

    const invite = new JudgeInviteForm(page);
    await invite.fillAndSubmit({
      token: E2E_INVITE_PLAIN_TOKEN,
      firstName: "Invitado",
      lastName: "E2E",
      password: "NuevaClave!e2e8",
    });
    await invite.expectPanelHeading();

    await context.clearCookies();
    await loginAsJudge(page, E2E_INVITE_JUDGE_EMAIL, E2E_INVITE_JUDGE_PASSWORD);
    await expect(page.getByRole("heading", { name: /Panel del jurado/i })).toBeVisible();
    },
  );

  test("token inválido: error en registro sin crear sesión", async ({ page, context }) => {
    await context.clearCookies();
    await gotoWhenReady(page, "/jurado/register");

    const invite = new JudgeInviteForm(page);
    await invite.fillFields({
      token: E2E_INVALID_INVITE_TOKEN,
      firstName: "No",
      lastName: "Existe",
      password: "ClaveSegura!8e2e",
    });
    await invite.submitExpectClientError(/Invitación inválida/i);
  });
});
