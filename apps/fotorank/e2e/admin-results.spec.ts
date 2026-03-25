import { expect, test } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_CONTEST_SLUG,
  E2E_FOTORANK_CONTEST_TITLE,
  E2E_FOTORANK_ENTRY_TITLE,
  E2E_FOTORANK_RESULTS_AGGREGATE_DISPLAY,
} from "./constants";
import { ensureE2EFotorankActiveOrganization, gotoWhenReady, loginAsAdmin } from "./helpers";
import { contestCardTestId, TT } from "./testIds";

/**
 * Cubre el output admin de resultados: concurso sembrado → navegación → tabla con agregado y votos.
 * El voto CRITERIA_BASED en categoría General viene del seed (media 4 → `4.00`).
 */
test.describe("Admin — resultados por concurso", () => {
  test(
    "concursos → detalle → resultados: tabla, obra, valor agregado y cantidad de votos @smoke",
    { tag: "@smoke" },
    async ({ page }) => {
    await loginAsAdmin(page, E2E_ADMIN_EMAIL);
    await ensureE2EFotorankActiveOrganization(page);

    await gotoWhenReady(page, "/concursos");
    const contestCard = page.getByTestId(contestCardTestId(E2E_CONTEST_SLUG));
    await expect(contestCard).toBeVisible({ timeout: 20_000 });
    await contestCard.click();

    await expect(page).toHaveURL(/\/dashboard\/concursos\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: E2E_FOTORANK_CONTEST_TITLE }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("link", { name: /Resultados y ranking/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/concursos\/[^/]+\/resultados/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(`Resultados:.*${E2E_FOTORANK_CONTEST_TITLE}`, "i") }),
    ).toBeVisible({ timeout: 20_000 });

    const table = page.getByTestId(TT.resultsTable);
    await expect(table).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText("CRITERIA_BASED", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Categorías" }).getByText("General")).toBeVisible();

    const bodyRow = page.locator("tbody tr").filter({ hasText: E2E_FOTORANK_ENTRY_TITLE });
    await expect(bodyRow).toBeVisible();
    await expect(bodyRow).toContainText(E2E_FOTORANK_RESULTS_AGGREGATE_DISPLAY);

    const votesCell = bodyRow.locator("td").nth(3);
    await expect(votesCell).toHaveText("1");

    const rankCell = bodyRow.locator("td").first();
    await expect(rankCell).toHaveText("1");
    },
  );
});
