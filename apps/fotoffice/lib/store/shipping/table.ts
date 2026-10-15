/**
 * Tabla propia de envíos: elegir la zona y el escalón de peso. Módulo PURO.
 */

import { normalizePostalCode } from "./package";

export type ShippingZoneInput = {
  id: string;
  postalCodes: string[];
  provinceCodes: string[];
  isRestOfCountry: boolean;
  sortOrder: number;
};

/**
 * Elige la zona más específica: código postal exacto, después provincia, después "resto del
 * país". Si hay empate en el mismo nivel, gana el menor `sortOrder` y luego el menor `id`.
 */
export function pickZone(
  zones: ShippingZoneInput[],
  dest: { postalCode: string; provinceCode: string },
): string | null {
  const postal = normalizePostalCode(dest.postalCode);
  let best: { id: string; level: number; sortOrder: number } | null = null;
  for (const z of zones) {
    let level = 0;
    if (postal && z.postalCodes.some((c) => normalizePostalCode(c) === postal)) level = 3;
    else if (z.provinceCodes.includes(dest.provinceCode)) level = 2;
    else if (z.isRestOfCountry) level = 1;
    if (level === 0) continue;
    if (
      !best ||
      level > best.level ||
      (level === best.level &&
        (z.sortOrder < best.sortOrder || (z.sortOrder === best.sortOrder && z.id < best.id)))
    ) {
      best = { id: z.id, level, sortOrder: z.sortOrder };
    }
  }
  return best ? best.id : null;
}

/** Precio del primer escalón cuyo tope alcanza al peso; null si el peso supera todos. */
export function pickRate(
  rates: { maxGrams: number; priceMinor: number }[],
  weightGrams: number,
): number | null {
  const sorted = [...rates].sort((a, b) => a.maxGrams - b.maxGrams);
  const found = sorted.find((r) => r.maxGrams >= weightGrams);
  return found ? found.priceMinor : null;
}
