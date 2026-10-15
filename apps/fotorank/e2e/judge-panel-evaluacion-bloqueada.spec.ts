import { expect, test } from "@playwright/test";
import {
  E2E_FOTORANK_CONTEST_TITLE,
  E2E_INVITE_CATEGORY_LABEL,
  E2E_PANEL_BLOCKED_JUDGE_EMAIL,
  E2E_PANEL_BLOCKED_JUDGE_PASSWORD,
} from "./constants";
import { loginAsJudge } from "./helpers";

/**
 * Asignación en estado INVITATION_SENT: el panel debe bloquear «Evaluar» y mostrar el motivo.
 * El jurado `jury.panel-bloqueado@` está sembrado solo para este caso (seed).
 */
test.describe("Jurado — evaluación bloqueada en panel", () => {
  test("asignación pendiente de invitación: el botón de calificar deshabilitado y el motivo", async ({ page }) => {
    await loginAsJudge(page, E2E_PANEL_BLOCKED_JUDGE_EMAIL, E2E_PANEL_BLOCKED_JUDGE_PASSWORD);

    await expect(page.getByRole("heading", { name: /Concursos a calificar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: E2E_FOTORANK_CONTEST_TITLE })).toBeVisible();
    await expect(page.getByText(`Categoría: ${E2E_INVITE_CATEGORY_LABEL}`)).toBeVisible();

    await expect(page.getByRole("button", { name: "Todavía no se puede calificar" })).toBeDisabled();
    await expect(page.getByText(/asignación aún no está activa para evaluar/i)).toBeVisible();
  });
});
