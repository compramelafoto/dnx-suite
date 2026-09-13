import { MOVEMENT_KINDS, type MovementKind } from "./constants";

/**
 * Validación del formulario de una categoría. Módulo PURO.
 *
 * `kind` es obligatorio y no tiene valor por omisión a propósito: una categoría sirve para
 * un lado solo —"Sueldos" no es un ingreso— y elegir por la gente acá produce categorías
 * mal clasificadas que después ensucian todos los reportes.
 */

export type CategoryFormValues = {
  name: string;
  kind: MovementKind;
  isActive: boolean;
  order: number;
};

export type CategoryFormResult =
  | { ok: true; values: CategoryFormValues }
  | { ok: false; error: string };

export function parseCategoryForm(fd: FormData): CategoryFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name === "") return { ok: false, error: "Poné un nombre para la categoría." };

  const kindRaw = String(fd.get("kind") ?? "").trim();
  if (!MOVEMENT_KINDS.includes(kindRaw as MovementKind)) {
    return { ok: false, error: "Elegí si la categoría es de ingreso o de egreso." };
  }

  const orderRaw = Number(String(fd.get("order") ?? "0").trim());

  return {
    ok: true,
    values: {
      name,
      kind: kindRaw as MovementKind,
      isActive: fd.get("isActive") !== "off" && fd.get("isActive") !== "false",
      order: Number.isFinite(orderRaw) ? Math.floor(orderRaw) : 0,
    },
  };
}
