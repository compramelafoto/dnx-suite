import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_ADMIN_EMAIL } from "./constants";
import { ensureE2EFotorankActiveOrganization, gotoWhenReady, loginAsAdmin } from "./helpers";
import { JudgeAdminForm } from "./pageObjects";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("Admin — jurados", () => {
  test("crear jurado, avatar por archivo, bio enriquecida y editar", async ({ page }) => {
    const unique = Date.now();
    const email = `e2e.judge.${unique}@fotorank.local`;

    await loginAsAdmin(page, E2E_ADMIN_EMAIL);
    await ensureE2EFotorankActiveOrganization(page);

    await gotoWhenReady(page, "/jurados/nuevo");
    await expect(page.getByRole("heading", { name: /nuevo jurado/i })).toBeVisible();

    const admin = JudgeAdminForm.fromPage(page);
    await admin.waitReady();

    await admin.root.locator("#judge-firstName").fill("E2E");
    await admin.root.locator("#judge-lastName").fill("Creado");
    await admin.root.locator("#judge-email").fill(email);
    await admin.root.locator("#judge-password").fill("AdminJudge!e2e9");

    await admin.uploadAvatar(path.join(__dirname, "fixtures", "avatar.png"));
    await admin.addBioParagraph("Bio enriquecida E2E (párrafo).");

    await admin.submitExpectJudgesList();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).first().click();
    await expect(page.getByRole("heading", { name: /Editar jurado/i })).toBeVisible();

    const edit = JudgeAdminForm.fromPage(page);
    await edit.waitReady();
    await edit.root.locator("#judge-lastName").fill("Creado — editado");
    await edit.submitExpectJudgesList();
    await expect(page.getByRole("heading", { name: /Creado — editado/ }).first()).toBeVisible();
  });
});
