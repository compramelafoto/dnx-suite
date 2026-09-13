import { SEED_ACCOUNTS, SEED_CATEGORIES } from "./constants";

/**
 * Las filas que se crean al encender el módulo en un workspace. Módulo PURO.
 *
 * Existe porque una pantalla de categorías vacía no la llena nadie, y sin categorías el
 * libro no sirve para ningún reporte. Son un punto de partida editable: se pueden renombrar,
 * desactivar y agregar las que cada negocio necesite.
 */

export type SeedAccountRow = {
  workspaceId: string;
  name: string;
  kind: "EFECTIVO" | "DIGITAL";
  isVault: boolean;
  isDefault: boolean;
  order: number;
};

export type SeedCategoryRow = {
  workspaceId: string;
  name: string;
  kind: "INGRESO" | "EGRESO";
  order: number;
};

export function seedRowsFor(workspaceId: string): {
  accounts: SeedAccountRow[];
  categories: SeedCategoryRow[];
} {
  return {
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a, workspaceId })),
    categories: SEED_CATEGORIES.map((c) => ({ ...c, workspaceId })),
  };
}
