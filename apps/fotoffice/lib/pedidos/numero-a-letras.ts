/**
 * Importe en letras para el recibo (etapa 3, Entrega A). Módulo PURO.
 *
 * Enteros de 0 a 999.999.999 en español, con los centavos como "con NN/100":
 * 120000.5 → "ciento veinte mil pesos con 50/100"; 1 → "un peso con 00/100";
 * 1000000 → "un millón de pesos con 00/100".
 */

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_VEINTINUEVE = [
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete",
  "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
  "ochocientos", "novecientos",
];

const MAXIMO = 999_999_999;

/** 1 a 99. */
function decenas(n: number): string {
  if (n < 10) return UNIDADES[n]!;
  if (n < 30) return DIEZ_A_VEINTINUEVE[n - 10]!;
  const u = n % 10;
  return u === 0 ? DECENAS[Math.floor(n / 10)]! : `${DECENAS[Math.floor(n / 10)]} y ${UNIDADES[u]}`;
}

/** 1 a 999. */
function centenas(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c === 0) return decenas(resto);
  return resto === 0 ? CENTENAS[c]! : `${CENTENAS[c]} ${decenas(resto)}`;
}

/** "uno" delante de un sustantivo pasa a "un" (y "veintiuno" a "veintiún"): un peso, veintiún mil. */
function apocopar(texto: string): string {
  if (texto.endsWith("veintiuno")) return `${texto.slice(0, -"veintiuno".length)}veintiún`;
  if (texto === "uno" || texto.endsWith(" uno")) return `${texto.slice(0, -"uno".length)}un`;
  return texto;
}

/**
 * Un entero de 0 a 999.999.999 en letras. Con `apocope`, el "uno" final queda "un" (para que siga un
 * sustantivo: "veintiún pesos").
 */
export function enteroEnLetras(n: number, apocope = false): string {
  if (!Number.isInteger(n) || n < 0 || n > MAXIMO) {
    throw new RangeError(`Sólo enteros de 0 a ${MAXIMO.toLocaleString("es-AR")}.`);
  }
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "un millón" : `${apocopar(centenas(millones))} millones`);
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${apocopar(centenas(miles))} mil`);
  if (unidades > 0) partes.push(apocope ? apocopar(centenas(unidades)) : centenas(unidades));
  return partes.join(" ");
}

/** Importe en pesos (hasta dos decimales) en letras: "ciento veinte mil pesos con 50/100". */
export function importeEnLetras(importe: number): string {
  if (typeof importe !== "number" || !Number.isFinite(importe) || importe < 0) {
    throw new RangeError("El importe tiene que ser un número mayor o igual que cero.");
  }
  const totalCentavos = Math.round(importe * 100);
  const entero = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const letras = enteroEnLetras(entero, true);
  const moneda = entero === 1 ? "peso" : entero >= 1_000_000 && entero % 1_000_000 === 0 ? "de pesos" : "pesos";
  return `${letras} ${moneda} con ${String(centavos).padStart(2, "0")}/100`;
}
