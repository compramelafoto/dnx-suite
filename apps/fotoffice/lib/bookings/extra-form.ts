import { parseArsToMinor } from "./space-form";
import type { ExtraPriceMode } from "./extras";

/**
 * Validación del formulario de un extra. Módulo PURO: sin base y sin red.
 *
 * La regla que más importa es la del recurso: sin recurso el extra no controla cantidad, y
 * entonces `unitsConsumed` no significa nada. Se normaliza a 1 en lugar de guardar el
 * número que haya escrito la persona — un dato que no se usa pero se ve invita a creer que
 * hace algo.
 */

export type ExtraFormValues = {
  name: string;
  description: string | null;
  priceMode: ExtraPriceMode;
  memberPriceMinor: number;
  nonMemberPriceMinor: number;
  resourceId: string | null;
  unitsConsumed: number;
  requiresConfirmation: boolean;
  spaceIds: string[];
};

export type ExtraFormResult = { ok: true; values: ExtraFormValues } | { ok: false; error: string };

export function parseExtraForm(formData: FormData): ExtraFormResult {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para el extra." };

  const memberPriceMinor = parseArsToMinor(String(formData.get("memberPriceArs") ?? ""));
  if (memberPriceMinor === null) {
    return { ok: false, error: "El precio para socios no se entiende." };
  }
  const nonMemberPriceMinor = parseArsToMinor(String(formData.get("nonMemberPriceArs") ?? ""));
  if (nonMemberPriceMinor === null) {
    return { ok: false, error: "El precio para no socios no se entiende." };
  }

  const spaceIds = formData
    .getAll("spaceIds")
    .map((v) => String(v))
    .filter((v) => v !== "");
  if (spaceIds.length === 0) {
    return { ok: false, error: "Elegí al menos un espacio donde ofrecer este extra." };
  }

  const resourceId = String(formData.get("resourceId") ?? "").trim() || null;

  // Sin recurso no hay cantidad que controlar: se normaliza a 1 para que el número
  // guardado no sugiera un comportamiento que no existe.
  let unitsConsumed = 1;
  if (resourceId !== null) {
    const crudo = Number(String(formData.get("unitsConsumed") ?? "1").trim());
    if (!Number.isFinite(crudo) || crudo < 1) {
      return { ok: false, error: "Un extra con recurso tiene que consumir al menos una unidad." };
    }
    unitsConsumed = Math.floor(crudo);
  }

  const modo = String(formData.get("priceMode") ?? "");
  const priceMode: ExtraPriceMode = modo === "PER_HOUR" ? "PER_HOUR" : "PER_BOOKING";

  return {
    ok: true,
    values: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      priceMode,
      memberPriceMinor,
      nonMemberPriceMinor,
      resourceId,
      unitsConsumed,
      requiresConfirmation: formData.get("requiresConfirmation") === "on",
      spaceIds,
    },
  };
}
