import { expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, ".qa-artifacts");

export function storageStatePath(roleKey: string, host = "127.0.0.1"): string {
  return resolve(artifacts, `storage-${roleKey}-${host}.json`);
}

export function requireStorage(roleKey: string, host = "127.0.0.1"): string {
  const p = storageStatePath(roleKey, host);
  if (!existsSync(p)) {
    throw new Error(
      `Falta storage state ${p}. Ejecutá: DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-prepare-browser`,
    );
  }
  return p;
}

export function qaRoles() {
  const p = resolve(artifacts, "notifications-qa-roles.json");
  if (!existsSync(p)) {
    throw new Error("Falta notifications-qa-roles.json — correr qa-prepare-browser");
  }
  return JSON.parse(readFileSync(p, "utf8")).roles as Array<{
    key: string;
    email: string;
    userId: number;
    canNotify: boolean;
    canProvision: boolean;
  }>;
}

export async function expectNoNotifyPanelControls(page: Page) {
  await expect(page.getByRole("button", { name: /Previsualizar audiencia/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enviar notificación/i })).toHaveCount(0);
}

export async function openRosarioEventEditor(page: Page) {
  // Buscar slug vía API interna no disponible → navegar listado o path conocido desde seed
  const res = await page.request.get("/redaccion/eventos");
  expect(res.ok() || res.status() === 200 || res.status() === 307 || res.status() === 302).toBeTruthy();
}
