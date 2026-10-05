/**
 * Armado del paquete de un pedido (peso y medidas) para cotizar el envío. Módulo PURO.
 *
 * Peso = Σ(cantidad × peso del producto, o el peso por defecto si no lo tiene) + embalaje.
 * Medidas = la caja por defecto; si los productos cargaron medidas y piden más, se usa en
 * cada lado la mayor (largo y ancho: el máximo; alto: la suma por cantidad).
 */

export type PackageItem = {
  qty: number;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export type PackageConfig = {
  packagingGrams: number;
  defaultUnitGrams: number;
  boxLengthCm: number;
  boxWidthCm: number;
  boxHeightCm: number;
};

export type ShippingPackage = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

/** Límites de Correo Argentino: 25 kg y 150 cm por lado. */
export const CORREO_MAX_WEIGHT_GRAMS = 25000;
export const CORREO_MAX_SIDE_CM = 150;

/** Entero hacia arriba, nunca menor que 1. */
function ceilMin1(n: number): number {
  return Math.max(1, Math.ceil(n));
}

/**
 * Código postal de 4 dígitos (1000–9999). Acepta el formato CPA (letra + 4 dígitos + 3 letras,
 * ej. "S2000ABC") y lo reduce a los 4 dígitos. Devuelve null si no es válido.
 */
export function normalizePostalCode(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  const match = /^(?:[A-Z](\d{4})[A-Z]{3}|(\d{4}))$/.exec(value);
  if (!match) return null;
  const digits = match[1] ?? match[2];
  return /^[1-9]\d{3}$/.test(digits) ? digits : null;
}

export function buildPackage(items: PackageItem[], cfg: PackageConfig): ShippingPackage {
  let weight = cfg.packagingGrams;
  let itemsLength = 0;
  let itemsWidth = 0;
  let itemsHeight = 0;
  for (const it of items) {
    weight += it.qty * (it.weightGrams ?? cfg.defaultUnitGrams);
    // Sólo cuentan los productos con las tres medidas cargadas.
    if (it.lengthCm != null && it.widthCm != null && it.heightCm != null) {
      itemsLength = Math.max(itemsLength, it.lengthCm);
      itemsWidth = Math.max(itemsWidth, it.widthCm);
      itemsHeight += it.qty * it.heightCm;
    }
  }
  return {
    weightGrams: ceilMin1(weight),
    lengthCm: ceilMin1(Math.max(cfg.boxLengthCm, itemsLength)),
    widthCm: ceilMin1(Math.max(cfg.boxWidthCm, itemsWidth)),
    heightCm: ceilMin1(Math.max(cfg.boxHeightCm, itemsHeight)),
  };
}

/** ¿El paquete supera lo que Correo Argentino acepta? */
export function exceedsCorreoLimits(pkg: ShippingPackage): boolean {
  return (
    pkg.weightGrams > CORREO_MAX_WEIGHT_GRAMS ||
    pkg.lengthCm > CORREO_MAX_SIDE_CM ||
    pkg.widthCm > CORREO_MAX_SIDE_CM ||
    pkg.heightCm > CORREO_MAX_SIDE_CM
  );
}
