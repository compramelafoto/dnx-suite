/**
 * Parámetros de la dirección de los informes (etapa 6). Módulo PURO, compartido por las pantallas y el CSV.
 */
import { formatMinorArs } from "@/lib/membership/money";

export type ParametrosDireccion = Record<string, string | string[] | undefined>;

export function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Período de la dirección: `periodo` (atajo o `AAAA-MM..AAAA-MM`), o el par `desde` y `hasta` de
 * "Otro rango" (meses "AAAA-MM"), que se arma como rango.
 */
export function valorDePeriodo(sp: ParametrosDireccion): string | undefined {
  const desde = primero(sp.desde)?.trim();
  const hasta = primero(sp.hasta)?.trim();
  if (desde && hasta) return `${desde}..${hasta}`;
  return primero(sp.periodo);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10" → "octubre de 2026". */
export function nombreDeMes(mes: string): string {
  const m = Number(mes.slice(5, 7));
  return `${MESES[m - 1] ?? mes.slice(5, 7)} de ${mes.slice(0, 4)}`;
}

/** Importe para mostrar en un campo de texto en formato es-AR, sin el signo de pesos: "1.234.567,89". */
export function importeParaCampo(centavos: number | null): string {
  if (centavos === null) return "";
  return formatMinorArs(centavos).replace(/^(-?)\$ /, "$1");
}
