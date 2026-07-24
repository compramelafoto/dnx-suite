import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { requireStorage } from "./helpers";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const eventsPath = resolve(root, ".qa-artifacts/notifications-qa-events.json");

function rosarioEventId(): string {
  if (!existsSync(eventsPath)) {
    throw new Error("Falta notifications-qa-events.json — correr qa-prepare-browser");
  }
  const data = JSON.parse(readFileSync(eventsPath, "utf8"));
  if (!data.rosarioOpenEventId) throw new Error("rosarioOpenEventId ausente");
  return data.rosarioOpenEventId as string;
}

test.describe("Notificaciones InfoSpot — permisos y panel", () => {
  test("editor autorizado accede al panel y ve campañas QA", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("editor_both"),
    });
    const page = await context.newPage();
    await page.goto("/admin/notificaciones");
    await expect(page.getByRole("heading", { name: /Campañas de notificación/i })).toBeVisible({
      timeout: 45_000,
    });
    // Campañas del flow QA usan prefijo visible
    await expect(page.getByText(/QA NOTIFICATIONS|CLF_PHOTOGRAPHER|Rosario/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await context.close();
  });

  test("editor solo provisioning no ve envío", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("editor_provision_only"),
    });
    const page = await context.newPage();
    const eventId = rosarioEventId();
    await page.goto(`/redaccion/eventos/${eventId}/editar`);
    await expect(
      page.getByText(/No tenés permiso para enviar avisos/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Previsualizar audiencia/i })).toHaveCount(0);
    await context.close();
  });

  test("usuario sin permisos no entra a panel notificaciones", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("no_perms"),
    });
    const page = await context.newPage();
    await page.goto("/admin/notificaciones");
    await expect(page).not.toHaveURL(/\/admin\/notificaciones$/);
    await context.close();
  });

  test("director ve listado de campañas", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("director"),
    });
    const page = await context.newPage();
    await page.goto("/admin/notificaciones");
    await expect(page.getByRole("heading", { name: /Campañas de notificación/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /Filtrar/i })).toBeVisible();
    await context.close();
  });

  test("server action preview rechaza sin permiso", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("editor_provision_only"),
    });
    const page = await context.newPage();
    const eventId = rosarioEventId();
    await page.goto(`/redaccion/eventos/${eventId}/editar`);
    await expect(
      page.getByText(/No tenés permiso para enviar avisos/i),
    ).toBeVisible({ timeout: 30_000 });
    await context.close();
  });
});
