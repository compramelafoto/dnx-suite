import { parseShippingArsToMinor } from "../shipping/settings-form";

/**
 * El formulario de un formato de impresión (`PrintFormat`) y el del dpi mínimo. Módulo PURO:
 * una acción del servidor se puede llamar a mano, así que las reglas viven acá.
 */

export const MIN_FORMAT_NAME = 2;
export const MAX_FORMAT_NAME = 80;
export const MIN_SIDE_CM = 5;
export const MAX_SIDE_CM = 200;
export const MAX_WEIGHT_GRAMS = 30_000;
export const MIN_PACK_CM = 1;
export const MAX_PACK_CM = 150;
export const MIN_DPI = 72;
export const MAX_DPI = 600;
export const DEFAULT_DPI = 150;
/** Tope de precio/costo: $ 10.000.000. */
const MAX_MONEY_MINOR = 1_000_000_000;

export type PrintFormatKind = "PRINT" | "FRAME";

export type PrintFormatValues = {
  name: string;
  kind: PrintFormatKind;
  widthCm: number;
  heightCm: number;
  priceMinor: number;
  costMinor: number | null;
  weightGrams: number | null;
  packLengthCm: number | null;
  packWidthCm: number | null;
  packHeightCm: number | null;
};

export type PrintFormatFormResult =
  | { ok: true; values: PrintFormatValues; warnings: string[] }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

function entero(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

export function parsePrintFormatForm(fd: FormData): PrintFormatFormResult {
  const name = texto(fd, "name");
  if (name.length < MIN_FORMAT_NAME || name.length > MAX_FORMAT_NAME) {
    return { ok: false, error: `El nombre tiene que tener entre ${MIN_FORMAT_NAME} y ${MAX_FORMAT_NAME} caracteres.` };
  }

  const kindRaw = texto(fd, "kind");
  if (kindRaw !== "PRINT" && kindRaw !== "FRAME") {
    return { ok: false, error: "Elegí si es una impresión o un cuadro." };
  }

  const widthCm = entero(texto(fd, "widthCm"), MIN_SIDE_CM, MAX_SIDE_CM);
  const heightCm = entero(texto(fd, "heightCm"), MIN_SIDE_CM, MAX_SIDE_CM);
  if (widthCm === null || heightCm === null) {
    return { ok: false, error: `El ancho y el alto son números enteros en centímetros, entre ${MIN_SIDE_CM} y ${MAX_SIDE_CM}.` };
  }

  const priceRaw = texto(fd, "price");
  const priceMinor = priceRaw === "" ? null : parseShippingArsToMinor(priceRaw);
  if (priceMinor === null || priceMinor <= 0 || priceMinor > MAX_MONEY_MINOR) {
    return { ok: false, error: "El precio tiene que ser un monto en pesos mayor que 0, por ejemplo 12000 o 12.500,50." };
  }

  const costRaw = texto(fd, "cost");
  let costMinor: number | null = null;
  if (costRaw !== "") {
    costMinor = parseShippingArsToMinor(costRaw);
    if (costMinor === null || costMinor < 0 || costMinor > MAX_MONEY_MINOR) {
      return { ok: false, error: "El costo tiene que ser un monto en pesos (0 o más), o quedar vacío." };
    }
  }

  const weightRaw = texto(fd, "weightGrams");
  let weightGrams: number | null = null;
  if (weightRaw !== "") {
    weightGrams = entero(weightRaw, 1, MAX_WEIGHT_GRAMS);
    if (weightGrams === null) {
      return { ok: false, error: `El peso son gramos enteros, entre 1 y ${MAX_WEIGHT_GRAMS}, o quedar vacío.` };
    }
  }

  const packRaws = [texto(fd, "packLengthCm"), texto(fd, "packWidthCm"), texto(fd, "packHeightCm")];
  const cargadas = packRaws.filter((r) => r !== "").length;
  let pack: [number | null, number | null, number | null] = [null, null, null];
  if (cargadas > 0 && cargadas < 3) {
    return { ok: false, error: "Las medidas del embalaje se cargan las tres juntas (largo, ancho y alto) o ninguna." };
  }
  if (cargadas === 3) {
    const nums = packRaws.map((r) => entero(r, MIN_PACK_CM, MAX_PACK_CM));
    if (nums.some((n) => n === null)) {
      return { ok: false, error: `Las medidas del embalaje son números enteros en centímetros, entre ${MIN_PACK_CM} y ${MAX_PACK_CM}.` };
    }
    pack = nums as [number, number, number];
  }

  const warnings: string[] = [];
  if (weightGrams === null) {
    warnings.push("Sin peso, el envío de este formato usa el peso por defecto de la configuración de envíos.");
  }

  return {
    ok: true,
    values: {
      name,
      kind: kindRaw,
      widthCm,
      heightCm,
      priceMinor,
      costMinor,
      weightGrams,
      packLengthCm: pack[0],
      packWidthCm: pack[1],
      packHeightCm: pack[2],
    },
    warnings,
  };
}

export function parseMinDpi(raw: string): { ok: true; minDpi: number } | { ok: false; error: string } {
  const n = entero(raw.trim(), MIN_DPI, MAX_DPI);
  if (n === null) return { ok: false, error: `La resolución mínima es un número entero entre ${MIN_DPI} y ${MAX_DPI} dpi.` };
  return { ok: true, minDpi: n };
}
