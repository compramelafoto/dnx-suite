import { escapeFormulaInjection } from "@/lib/members/export";
import { hoyEnBuenosAires } from "./periodos";
import type { ColumnaExport } from "./tipos";

export const TOPE_EXPORTACION = 20000;
const ZONA = "America/Argentina/Buenos_Aires";

/** Sólo el texto libre puede colarse como fórmula; los importes negativos ("-5,00") son números legítimos. */
function celda(raw: string, esTexto = true): string {
  const t = esTexto ? escapeFormulaInjection(raw) : raw;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function formatear<F>(col: ColumnaExport<F>, v: string | number | Date | null): string {
  if (v === null || v === undefined || v === "") return "";
  if (col.tipo === "importe" && typeof v === "number") {
    const signo = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${signo}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  }
  if ((col.tipo === "fecha" || col.tipo === "fechaHora") && v instanceof Date) {
    const opts: Intl.DateTimeFormatOptions = { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" };
    if (col.tipo === "fechaHora") Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: false });
    return new Intl.DateTimeFormat("es-AR", opts).format(v).replace(",", "");
  }
  return String(v);
}

export function armarCsvExcel<F>(columnas: ColumnaExport<F>[], filas: F[]): string {
  const lineas = [columnas.map((c) => celda(c.titulo)).join(";")];
  for (const f of filas) lineas.push(columnas.map((c) => celda(formatear(c, c.valor(f)), c.tipo === "texto")).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

export function nombreArchivoExport(workspaceName: string, clave: string, ahora: Date = new Date()): string {
  const slug = workspaceName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "fotoffice"}-${clave}-${hoyEnBuenosAires(ahora)}.csv`;
}
