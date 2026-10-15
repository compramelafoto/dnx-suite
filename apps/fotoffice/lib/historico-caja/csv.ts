/**
 * Lector del CSV normalizado del histórico (formato `movimientos.csv`). Módulo PURO.
 *
 * Columnas: `date` (AAAA-MM-DD), `monto` (con signo, punto decimal) y `concepto_normalizado` o
 * `concepto_original` son obligatorias; `turno`, `medio`, `origen` y `observacion` son opcionales.
 * Las demás (tipo, grupo, línea…) se ignoran: la clasificación sale del archivo de mapeo.
 */
import Papa from "papaparse";
import type { FilaCsv, Medio } from "./tipos";
import { normalizarConcepto } from "./mapeo";

/**
 * "4980915.5" → 498091550. Por texto, sin flotantes. Sólo punto decimal (el formato del CSV
 * normalizado); un texto con coma o con letras es un error de la fila, no un número a adivinar.
 */
export function pesosACentavos(texto: string): number | null {
  const t = texto.trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(t);
  if (!m) return null;
  const [, signo, entera, dec = ""] = m;
  const valor = Number(entera) * 100 + Number(dec.padEnd(2, "0"));
  if (!Number.isSafeInteger(valor)) return null;
  return signo === "-" ? -valor : valor;
}

function fechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [y, m, d] = texto.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function medioDe(texto: string | undefined): Medio | null {
  const t = (texto ?? "").trim().toLowerCase();
  if (t === "efectivo") return "EFECTIVO";
  if (t === "digital" || t === "transfer" || t === "transferencia") return "DIGITAL";
  return null;
}

function textoONulo(texto: string | undefined): string | null {
  const t = (texto ?? "").trim();
  return t === "" ? null : t;
}

export type ErrorCsv = { fila: number; mensaje: string };

export function leerCsvHistorico(texto: string): { filas: FilaCsv[]; errores: ErrorCsv[] } {
  const r = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: "greedy" });
  const columnas = r.meta.fields ?? [];
  const faltan = ["date", "monto"].filter((c) => !columnas.includes(c));
  if (!columnas.includes("concepto_normalizado") && !columnas.includes("concepto_original")) {
    faltan.push("concepto_normalizado o concepto_original");
  }
  if (faltan.length > 0) {
    return { filas: [], errores: [{ fila: 1, mensaje: `Faltan columnas: ${faltan.join(", ")}.` }] };
  }

  const filas: FilaCsv[] = [];
  const errores: ErrorCsv[] = [];
  r.data.forEach((d, i) => {
    const fila = i + 2;
    const fecha = (d.date ?? "").trim();
    if (!fechaValida(fecha)) {
      errores.push({ fila, mensaje: `Fecha inválida: "${fecha}".` });
      return;
    }
    const centavos = pesosACentavos(d.monto ?? "");
    if (centavos === null || centavos === 0) {
      errores.push({ fila, mensaje: `Importe inválido o en cero: "${d.monto ?? ""}".` });
      return;
    }
    const original = textoONulo(d.concepto_original) ?? textoONulo(d.concepto_normalizado) ?? "";
    const normalizado = normalizarConcepto(textoONulo(d.concepto_normalizado) ?? original);
    filas.push({
      fila,
      fecha,
      turno: textoONulo(d.turno),
      medio: medioDe(d.medio),
      conceptoOriginal: original,
      conceptoNormalizado: normalizado,
      centavos,
      referencia: textoONulo(d.origen),
      observacion: textoONulo(d.observacion),
    });
  });
  return { filas, errores };
}
