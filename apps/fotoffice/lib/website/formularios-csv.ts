/**
 * Exportación a CSV de la bandeja de formularios y de los suscriptores. PURO.
 *
 * Formato: UTF-8 con BOM (para que Excel lea bien las tildes), separador coma, fin de línea CRLF.
 * Los valores que Excel tomaría como fórmula (`=`, `@`, `+`/`-` que no son un número o teléfono)
 * se escriben con un apóstrofo adelante: un envío público podría traer `=HYPERLINK(…)`.
 */
import type { ParEnvio } from "./formularios";

const ZONA = "America/Argentina/Buenos_Aires";

/** Lo que Excel interpretaría como fórmula se neutraliza; un teléfono «+54 9 341…» queda igual. */
export function neutralizarFormula(valor: string): string {
  if (!valor) return valor;
  const c = valor[0];
  if (c === "=" || c === "@" || c === "\t" || c === "\r") return `'${valor}`;
  if ((c === "+" || c === "-") && !/^[+-]?[\d\s().-]+$/.test(valor)) return `'${valor}`;
  return valor;
}

export function celdaCsv(valor: string | null | undefined): string {
  const t = neutralizarFormula(valor ?? "");
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function armarCsv(encabezados: readonly string[], filas: readonly (readonly (string | null | undefined)[])[]): string {
  const lineas = [encabezados.map(celdaCsv).join(",")];
  for (const fila of filas) lineas.push(encabezados.map((_, i) => celdaCsv(fila[i])).join(","));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** «27/10/2026 14:05», en hora argentina. */
export function fechaHoraArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
}

export type EnvioParaExportar = {
  createdAt: Date;
  formulario: string;
  estado: string;
  paginaUrl: string | null;
  pares: ParEnvio[];
};

const ESTADO_LEGIBLE: Record<string, string> = { NUEVO: "Nuevo", LEIDO: "Leído", ARCHIVADO: "Archivado" };

/**
 * Columnas fijas (fecha, formulario, estado, página) y después TODAS las etiquetas que aparecen en
 * los envíos, en el orden en que aparecen por primera vez. Una etiqueta repetida dentro del mismo
 * envío se exporta en columnas «Etiqueta (2)», «Etiqueta (3)»…
 */
export function csvDeEnvios(envios: readonly EnvioParaExportar[]): string {
  const columnas: string[] = [];
  const indice = new Map<string, number>();
  const filasPorEnvio = envios.map((e) => {
    const vistos = new Map<string, number>();
    const celdas = new Map<string, string>();
    for (const { etiqueta, valor } of e.pares) {
      const base = etiqueta.trim() || "Campo";
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      const col = n === 1 ? base : `${base} (${n})`;
      if (!indice.has(col)) {
        indice.set(col, columnas.length);
        columnas.push(col);
      }
      celdas.set(col, valor);
    }
    return celdas;
  });
  const encabezados = ["Fecha", "Formulario", "Estado", "Página", ...columnas];
  const filas = envios.map((e, i) => [
    fechaHoraArgentina(e.createdAt),
    e.formulario,
    ESTADO_LEGIBLE[e.estado] ?? e.estado,
    e.paginaUrl ?? "",
    ...columnas.map((c) => filasPorEnvio[i].get(c) ?? ""),
  ]);
  return armarCsv(encabezados, filas);
}

export type SuscriptorParaExportar = { email: string; nombre: string | null; estado: string; origen: string; createdAt: Date };

export function csvDeSuscriptores(suscriptores: readonly SuscriptorParaExportar[]): string {
  return armarCsv(
    ["Correo", "Nombre", "Estado", "Origen", "Fecha de alta"],
    suscriptores.map((s) => [s.email, s.nombre ?? "", s.estado === "BAJA" ? "Dado de baja" : "Activo", s.origen, fechaHoraArgentina(s.createdAt)]),
  );
}

/** `formularios-<algo>-2026-10-27.csv`, sin tildes ni espacios (no puede romper la cabecera). */
export function nombreDeArchivoCsv(prefijo: string, nombre: string, ahora: Date = new Date()): string {
  const slug = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora);
  return `${prefijo}${slug ? `-${slug}` : ""}-${dia}.csv`;
}
