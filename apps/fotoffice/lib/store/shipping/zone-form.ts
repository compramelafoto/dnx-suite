import { parseArsToMinor } from "@/lib/membership/money";
import { normalizePostalCode } from "./package";
import { isProvinceCode } from "./provinces";

/**
 * El formulario de una zona de la tabla de envíos con sus escalones. Módulo PURO.
 *
 * Una zona llega a códigos postales exactos, a provincias enteras y/o al "resto del país"; cada
 * escalón dice "hasta X gramos cuesta $Y". Que haya una sola zona con "resto del país" lo
 * verifica la acción, porque necesita la base.
 */

export const MAX_ZONE_NAME = 100;
/** Un tope razonable para un escalón: 1000 kg. La tabla puede cubrir más que Correo (25 kg). */
const MAX_RATE_GRAMS = 1_000_000;
/** Precio máximo de un escalón: $ 10.000.000. */
const MAX_RATE_MINOR = 1_000_000_000;
const MAX_POSTAL_CODES = 2000;

export type ZoneRateValue = { maxGrams: number; priceMinor: number };

export type ZoneFormValues = {
  name: string;
  postalCodes: string[];
  provinceCodes: string[];
  isRestOfCountry: boolean;
  /** Ordenados por `maxGrams`, sin repetidos, al menos uno. */
  rates: ZoneRateValue[];
};

export type ZoneFormResult = { ok: true; values: ZoneFormValues } | { ok: false; error: string };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

function textos(fd: FormData, campo: string): string[] {
  return fd.getAll(campo).map((v) => (typeof v === "string" ? v.trim() : ""));
}

/**
 * Códigos postales separados por coma, punto y coma, espacio o renglón. Se normalizan (CPA →
 * 4 dígitos) y se sacan los repetidos, respetando el orden en que se escribieron.
 */
export function parsePostalCodeList(
  raw: string,
): { ok: true; codes: string[] } | { ok: false; invalid: string[] } {
  const partes = raw.split(/[\s,;]+/).filter((p) => p !== "");
  const codes: string[] = [];
  const invalid: string[] = [];
  for (const parte of partes) {
    const cp = normalizePostalCode(parte);
    if (!cp) invalid.push(parte);
    else if (!codes.includes(cp)) codes.push(cp);
  }
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, codes };
}

export function parseZoneForm(fd: FormData): ZoneFormResult {
  const name = texto(fd, "name");
  if (!name) return { ok: false, error: "Poné un nombre a la zona, por ejemplo \"Rosario\"." };
  if (name.length > MAX_ZONE_NAME) {
    return { ok: false, error: `El nombre de la zona puede tener hasta ${MAX_ZONE_NAME} caracteres.` };
  }

  const cps = parsePostalCodeList(texto(fd, "postalCodes"));
  if (!cps.ok) {
    return { ok: false, error: `Estos códigos postales no son válidos: ${cps.invalid.join(", ")}.` };
  }
  if (cps.codes.length > MAX_POSTAL_CODES) {
    return { ok: false, error: `Una zona puede tener hasta ${MAX_POSTAL_CODES} códigos postales.` };
  }

  const provinceCodes: string[] = [];
  for (const code of textos(fd, "provinceCodes")) {
    const c = code.toUpperCase();
    if (!isProvinceCode(c)) return { ok: false, error: "Hay una provincia que no se reconoce." };
    if (!provinceCodes.includes(c)) provinceCodes.push(c);
  }

  // Casilla con respaldo oculto después: `FormData.get` devuelve la primera coincidencia.
  const isRestOfCountry = fd.get("isRestOfCountry") === "on";

  if (cps.codes.length === 0 && provinceCodes.length === 0 && !isRestOfCountry) {
    return {
      ok: false,
      error: "Indicá a qué destinos llega la zona: códigos postales, provincias o el resto del país.",
    };
  }

  const pesos = textos(fd, "rateMaxGrams");
  const precios = textos(fd, "ratePrice");
  const filas = Math.max(pesos.length, precios.length);
  const rates: ZoneRateValue[] = [];
  for (let i = 0; i < filas; i++) {
    const pesoRaw = pesos[i] ?? "";
    const precioRaw = precios[i] ?? "";
    // Una fila en blanco se ignora: la pantalla siempre deja una vacía para agregar.
    if (pesoRaw === "" && precioRaw === "") continue;
    const maxGrams = /^\d+$/.test(pesoRaw) ? Number(pesoRaw) : NaN;
    if (!Number.isSafeInteger(maxGrams) || maxGrams < 1 || maxGrams > MAX_RATE_GRAMS) {
      return { ok: false, error: "Cada escalón necesita un peso en gramos, un número entero mayor que 0." };
    }
    const priceMinor = precioRaw === "" ? null : parseArsToMinor(precioRaw);
    if (priceMinor === null || priceMinor > MAX_RATE_MINOR) {
      return { ok: false, error: `Falta un precio válido para el escalón de hasta ${maxGrams} g.` };
    }
    if (rates.some((r) => r.maxGrams === maxGrams)) {
      return { ok: false, error: `Hay dos escalones con el mismo peso (${maxGrams} g).` };
    }
    rates.push({ maxGrams, priceMinor });
  }
  if (rates.length === 0) return { ok: false, error: "Cargá al menos un escalón de precio." };
  rates.sort((a, b) => a.maxGrams - b.maxGrams);

  return { ok: true, values: { name, postalCodes: cps.codes, provinceCodes, isRestOfCountry, rates } };
}
