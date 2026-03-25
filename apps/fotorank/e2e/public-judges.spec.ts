import { test, expect } from "@playwright/test";
import { E2E_CONTEST_SLUG, E2E_PUBLIC_JUDGE_SLUG } from "./constants";

test.describe("Público — jurados", () => {
  test(
    "lista de jurados del concurso y perfil público @smoke",
    { tag: "@smoke" },
    async ({ page }) => {
    await page.goto(`/concursos/${E2E_CONTEST_SLUG}/jurados`);
    await expect(page.getByRole("heading", { name: /Jurados del concurso/i })).toBeVisible();
    await expect(page.getByText(/Jurado/i).first()).toBeVisible();

    await page.goto(`/jurados/publico/${E2E_PUBLIC_JUDGE_SLUG}`);
    await expect(page.getByRole("heading", { name: /Jurado Demo/i })).toBeVisible();
    },
  );
});
