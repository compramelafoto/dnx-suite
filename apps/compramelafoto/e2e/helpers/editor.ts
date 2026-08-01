import { expect, type Page } from "@playwright/test";
import { dismissWorkLocationPrompt } from "./auth";

/** Espera carga real del editor (canvas + herramientas laterales). */
export async function waitForEditorReady(page: Page, timeout = 90_000) {
  await expect(page.getByTestId("template-v2-editor")).toBeVisible({ timeout });
  await dismissWorkLocationPrompt(page);
  await expect(page.getByText("Cargando editor")).toHaveCount(0, { timeout });
  await expect(page.getByTestId("template-v2-canvas")).toBeVisible({ timeout });
  await expect(page.getByRole("button", { name: "Forma", exact: true }).first()).toBeVisible({
    timeout,
  });
  await expect(page.getByRole("button", { name: "Variable", exact: true }).first()).toBeVisible({
    timeout,
  });
}
