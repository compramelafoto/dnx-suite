/**
 * Precio de lista de un pack de preventa ("antes $35.000, ahora $28.000 · 20% OFF").
 *
 * Sale de `BenefitDefinition.regularUnitPriceAfterPreventaArs` (precio FINAL por unidad
 * después de la preventa) multiplicado por la cantidad incluida. Los beneficios sin ese
 * dato no suman: un pack que no lo cargó simplemente no muestra precio tachado.
 *
 * Es conservador: si la lista no supera el precio de preventa no devuelve nada, así un
 * pack que no tiene descuento real nunca muestra un "OFF".
 */

export type BenefitForListPrice = {
  includedQuantity: number;
  regularUnitPriceAfterPreventaArs?: number | null;
};

export type PackListPrice = {
  /** Precio de lista final (lo que pagaría después de la preventa). */
  listPriceArs: number;
  /** Descuento redondeado a entero, para el cartel "20% OFF". */
  discountPercent: number;
};

export function packListPrice(
  preventaPriceArs: number,
  benefits: readonly BenefitForListPrice[]
): PackListPrice | null {
  let listPriceArs = 0;
  for (const b of benefits) {
    const unit = b.regularUnitPriceAfterPreventaArs;
    if (unit == null || !Number.isFinite(unit) || unit <= 0) continue;
    const qty = Number.isFinite(b.includedQuantity) && b.includedQuantity > 0 ? b.includedQuantity : 1;
    listPriceArs += Math.round(unit) * qty;
  }
  if (!Number.isFinite(preventaPriceArs) || preventaPriceArs <= 0) return null;
  if (listPriceArs <= preventaPriceArs) return null;
  const discountPercent = Math.round((1 - preventaPriceArs / listPriceArs) * 100);
  if (discountPercent <= 0) return null;
  return { listPriceArs, discountPercent };
}

/** Líneas de la descripción del pack que empiezan con 🎁: van destacadas como regalo. */
export const PACK_GIFT_LINE_PREFIX = "🎁";

export function splitPackDescription(description: string | null | undefined): {
  giftLines: string[];
  otherLines: string[];
} {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const giftLines: string[] = [];
  const otherLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(PACK_GIFT_LINE_PREFIX)) {
      const text = line.slice(PACK_GIFT_LINE_PREFIX.length).trim();
      if (text) giftLines.push(text);
    } else {
      otherLines.push(line);
    }
  }
  return { giftLines, otherLines };
}
