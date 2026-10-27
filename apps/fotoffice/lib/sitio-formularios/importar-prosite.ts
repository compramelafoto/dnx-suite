/**
 * Importación del Inbox de Alboom Prosite («Exportar» → XLS) a la bandeja de formularios del
 * sitio. PURO: lee el archivo ya cargado en memoria y devuelve los envíos agrupados por
 * formulario, con una huella por envío para que repetir la importación no duplique nada. El script
 * `packages/db/prisma/scripts/ops-sitio-importar-inbox-prosite.ts` sólo lee el archivo y escribe.
 *
 * Formatos que acepta (el «XLS» de muchos paneles es en realidad otra cosa):
 *   - CSV (coma, punto y coma o tabulación; UTF-8 o Windows-1252);
 *   - HTML con una tabla guardado como .xls;
 *   - XML de Excel 2003 (SpreadsheetML) guardado como .xls;
 *   - .xlsx o .xls binario: los lee el script con SheetJS (`xlsx`) si está en el monorepo y le pasa
 *     las filas a `interpretarTabla`; si no, hay que abrirlo en Excel y guardarlo como CSV.
 *
 * Columnas: una de fecha, una del nombre del formulario y el resto son los campos (Nombre, Correo,
 * Teléfono, Instagram, Mensaje…), en el orden del archivo. Las fechas sin zona se toman como hora
 * argentina (UTC−3 fijo desde 2009).
 */
import { createHash } from "node:crypto";
import Papa from "papaparse";
import { contactoPorEtiquetas, type ContactoEnvio, type ParEnvio } from "../website/formularios";

export type Celda = string | number | boolean | Date | null | undefined;
export type Formato = "csv" | "html" | "xml-excel" | "xlsx" | "xls-binario";

/** Qué es el archivo, mirando sus primeros bytes (no la extensión). */
export function detectarFormato(bytes: Uint8Array): Formato {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "xlsx";
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "xls-binario";
  const inicio = decodificarTexto(bytes.subarray(0, 4096)).toLowerCase();
  if (inicio.includes("urn:schemas-microsoft-com:office:spreadsheet") || /<workbook[\s>]/.test(inicio)) return "xml-excel";
  if (/<(html|table|meta|!doctype html)[\s>]/.test(inicio)) return "html";
  return "csv";
}

/** UTF-8 (sin BOM); si no es UTF-8 válido, Windows-1252 (lo que guarda Excel en español). */
export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", ccedil: "ç", atilde: "ã", otilde: "õ", ecirc: "ê", ocirc: "ô", acirc: "â" };

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

/** El texto de una celda HTML: sin etiquetas, con los `<br>` como saltos de línea. */
function textoDeHtml(html: string): string {
  return decodificarEntidades(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Filas de la PRIMERA tabla de un HTML (`<tr>` con `<td>`/`<th>`). */
export function filasDeHtml(html: string): string[][] {
  const tabla = /<table[\s\S]*?<\/table>/i.exec(html)?.[0] ?? html;
  const filas: string[][] = [];
  for (const tr of tabla.matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr[\s>]|<\/table>|$)/gi)) {
    const celdas = [...tr[1].matchAll(/<t[dh]([^>]*)>([\s\S]*?)(?=<t[dh][\s>]|<\/tr>|$)/gi)].flatMap((m) => {
      const texto = textoDeHtml(m[2].replace(/<\/t[dh]>\s*$/i, ""));
      const colspan = Number.parseInt(/colspan\s*=\s*["']?(\d+)/i.exec(m[1])?.[1] ?? "1", 10);
      return [texto, ...Array.from({ length: Math.min(Math.max(colspan, 1), 50) - 1 }, () => "")];
    });
    if (celdas.length > 0) filas.push(celdas);
  }
  return filas;
}

/** Filas de la primera hoja de un XML de Excel 2003 (`<Row>`/`<Cell>`/`<Data>`, con `ss:Index`). */
export function filasDeXmlExcel(xml: string): string[][] {
  const hoja = /<(?:ss:)?Worksheet[\s\S]*?<\/(?:ss:)?Worksheet>/i.exec(xml)?.[0] ?? xml;
  const filas: string[][] = [];
  for (const row of hoja.matchAll(/<(?:ss:)?Row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/gi)) {
    const fila: string[] = [];
    for (const cell of (row[1] ?? "").matchAll(/<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/gi)) {
      const indice = /(?:ss:)?Index\s*=\s*"(\d+)"/i.exec(cell[1])?.[1];
      if (indice) while (fila.length < Number(indice) - 1 && fila.length < 500) fila.push("");
      const data = /<(?:ss:)?Data\b[^>]*>([\s\S]*?)<\/(?:ss:)?Data>/i.exec(cell[2] ?? "")?.[1] ?? "";
      fila.push(textoDeHtml(data.replace(/&#10;/g, "\n")));
    }
    filas.push(fila);
  }
  return filas;
}

export function filasDeCsv(texto: string): string[][] {
  const r = Papa.parse<string[]>(texto, { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  return r.data.map((fila) => fila.map((c) => (typeof c === "string" ? c : String(c ?? ""))));
}

/** Las filas de un archivo de texto (CSV, HTML o XML de Excel). Para .xlsx/.xls binario, ver el script. */
export function filasDeArchivoDeTexto(bytes: Uint8Array): { formato: Formato; filas: string[][] } {
  const formato = detectarFormato(bytes);
  if (formato === "xlsx" || formato === "xls-binario") return { formato, filas: [] };
  const texto = decodificarTexto(bytes);
  const filas = formato === "html" ? filasDeHtml(texto) : formato === "xml-excel" ? filasDeXmlExcel(texto) : filasDeCsv(texto);
  return { formato, filas };
}

// ── Fechas ──────────────────────────────────────────────────────────────────────────────────

const AR_OFFSET_MS = 3 * 3600_000;

/** Fecha y hora de calendario argentinas → instante. `null` si no existe (31/02…). */
function instanteArgentino(y: number, m: number, d: number, hh = 0, mi = 0, ss = 0): Date | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;
  const ms = Date.UTC(y, m - 1, d, hh, mi, ss) + AR_OFFSET_MS;
  const vuelta = new Date(ms - AR_OFFSET_MS);
  if (vuelta.getUTCFullYear() !== y || vuelta.getUTCMonth() !== m - 1 || vuelta.getUTCDate() !== d) return null;
  return new Date(ms);
}

/**
 * La fecha de un envío, en hora argentina: `27/10/2026 14:05[:30]`, `27-10-2026`, `27/10/26`,
 * `2026-10-27 14:05:30`, ISO con zona (`…Z`, `-03:00`), «27/10/2026 às 14:05» (Prosite en
 * portugués), o el número de serie de Excel (días desde 1899-12-30). `null` si no se entiende.
 * Día/mes primero: es como escriben Prosite y Excel en español y en portugués.
 */
export function parsearFechaArgentina(valor: Celda): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor < 20000 || valor > 80000) return null;
    const dias = Math.floor(valor);
    const segundos = Math.round((valor - dias) * 86400);
    const base = Date.UTC(1899, 11, 30) + dias * 86400_000;
    const d = new Date(base);
    return instanteArgentino(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60);
  }
  const t = String(valor ?? "")
    .trim()
    .replace(/\s+(às|as|a las|a la|at|-)\s+/i, " ")
    .replace(/\s*(hs?|h)\.?$/i, "");
  if (!t) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) return parsearFechaArgentina(Number(t.replace(",", ".")));

  // «2019-07-26 01:16:06 UTC» (exportaciones viejas de Prosite): es UTC, no hora argentina.
  const utc = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*(?:UTC|GMT|Z)$/i.exec(t);
  if (utc) {
    const ms = Date.UTC(+utc[1], +utc[2] - 1, +utc[3], +utc[4], +utc[5], +(utc[6] ?? 0));
    const d = new Date(ms);
    return d.getUTCMonth() === +utc[2] - 1 && d.getUTCDate() === +utc[3] && +utc[4] < 24 && +utc[5] < 60 ? d : null;
  }

  // ISO con zona explícita: tal cual.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) return instanteArgentino(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4}),?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return instanteArgentino(y, +m[2], +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  return null;
}

// ── Tabla → envíos ──────────────────────────────────────────────────────────────────────────

const COLUMNA_FECHA = /^(fecha|fecha de env[ií]o|fecha y hora|enviado|enviado el|enviado em|enviado en|recibido|creado|data|data de envio|data de envío|date|sent|sent at|created|created at)$/i;
const COLUMNA_FORMULARIO = /^(formulario|nombre del formulario|formul[aá]rio|form|form name|origen|origem|p[aá]gina|landing|landing page)$/i;
/** Columnas que no son datos de la persona (estado del inbox de Prosite, ids). */
const COLUMNA_IGNORADA = /^(id|#|status|estado|lido|le[ií]do|read|visto)$/i;

export type EnvioImportado = {
  /** `null` = la fila vino sin fecha: se importa igual, marcada «sin fecha». */
  fecha: Date | null;
  formulario: string;
  pares: ParEnvio[];
  contacto: ContactoEnvio;
  /** Huella de fecha + formulario + datos (sha-256, 40 caracteres). */
  clave: string;
  /** Número de fila en el archivo (1 = primera), para el informe. */
  fila: number;
};

export type Descartada = { fila: number; motivo: string };

export type ResultadoInterpretacion = {
  columnas: { fecha: string | null; formulario: string | null; campos: string[]; ignoradas: string[] };
  envios: EnvioImportado[];
  descartadas: Descartada[];
  /** Filas idénticas (misma huella) dentro del mismo archivo: se importan una vez. */
  repetidas: number;
};

function normalizarEncabezado(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[:*]+$/, "").trim();
}

function celdaComoTexto(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString();
  if (typeof c === "number") return Number.isInteger(c) ? String(c) : String(c);
  return String(c).replace(/\r\n?/g, "\n").trim();
}

/** Etiqueta para comparar: sin tildes, minúsculas, espacios simples. */
function etiquetaNormalizada(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Huella de un envío importado: fecha + formulario (normalizado con `claveDeFormularioProsite`) +
 * los pares ORDENADOS por etiqueta normalizada. Así el mismo envío en dos exportaciones con las
 * columnas en otro orden, o con el nombre del formulario escrito distinto, no se duplica.
 */
export function claveDeImportacion(fecha: Date | null, formulario: string, pares: readonly ParEnvio[]): string {
  const ordenados = pares
    .map((p) => [etiquetaNormalizada(p.etiqueta), p.valor.trim()] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const base = JSON.stringify([fecha ? fecha.toISOString() : "sin-fecha", claveDeFormularioProsite(formulario), ordenados]);
  return createHash("sha256").update(base).digest("hex").slice(0, 40);
}

/**
 * Interpreta la tabla: la primera fila con al menos dos celdas escritas es el encabezado. Las
 * filas sin fecha válida se descartan (con su motivo); las que no traen ningún dato, también.
 * `opciones.columnaFormulario: false` (la exportación real de Prosite: un CSV por formulario,
 * con el nombre en el nombre del archivo) no busca columna de formulario: todo va a
 * `formularioPorOmision`, y una columna «Página» u «Origen» queda como campo.
 * `formularioPorOmision` se usa cuando el archivo no tiene columna de formulario (o la celda
 * viene vacía).
 */
export function interpretarTabla(
  filas: readonly (readonly Celda[])[],
  formularioPorOmision = "Inbox de Prosite",
  opciones: { columnaFormulario?: boolean } = {},
): ResultadoInterpretacion {
  const inicio = filas.findIndex((f) => f.filter((c) => celdaComoTexto(c) !== "").length >= 2);
  const vacio: ResultadoInterpretacion = { columnas: { fecha: null, formulario: null, campos: [], ignoradas: [] }, envios: [], descartadas: [], repetidas: 0 };
  if (inicio < 0) return vacio;

  const encabezados = filas[inicio].map((c) => normalizarEncabezado(celdaComoTexto(c)).replace(/^['"]+$/, ""));
  // Columnas sin nombre. Prosite a veces las pone en el encabezado pero no en las filas (cada fila
  // trae una celda menos y todo queda corrido): esas filas se realinean salteando las sin nombre.
  const sinNombre = new Set(encabezados.flatMap((h, i) => (h === "" ? [i] : [])));
  const alinear = (fila: readonly Celda[]): readonly Celda[] => {
    if (sinNombre.size === 0 || fila.length !== encabezados.length - sinNombre.size) return fila;
    let k = 0;
    return encabezados.map((_, i) => (sinNombre.has(i) ? "" : fila[k++]));
  };
  const iFecha = encabezados.findIndex((h) => COLUMNA_FECHA.test(h));
  const iFormulario = opciones.columnaFormulario === false ? -1 : encabezados.findIndex((h, i) => i !== iFecha && COLUMNA_FORMULARIO.test(h));
  const campos: Array<{ i: number; etiqueta: string }> = [];
  const ignoradas: string[] = [];
  encabezados.forEach((h, i) => {
    if (i === iFecha || i === iFormulario) return;
    if (COLUMNA_IGNORADA.test(h)) ignoradas.push(h);
    else campos.push({ i, etiqueta: h || "Campo sin nombre" });
  });

  const resultado: ResultadoInterpretacion = {
    columnas: { fecha: iFecha >= 0 ? encabezados[iFecha] : null, formulario: iFormulario >= 0 ? encabezados[iFormulario] : null, campos: campos.map((c) => c.etiqueta), ignoradas },
    envios: [],
    descartadas: [],
    repetidas: 0,
  };
  if (iFecha < 0) {
    resultado.descartadas.push({ fila: inicio + 1, motivo: "El archivo no tiene una columna «Fecha»: no se importa nada." });
    return resultado;
  }

  const vistas = new Set<string>();
  for (let n = inicio + 1; n < filas.length; n++) {
    const fila = alinear(filas[n]);
    const numero = n + 1;
    if (fila.every((c) => celdaComoTexto(c) === "")) continue;
    // Fecha vacía: se importa igual, «sin fecha». Una fecha escrita pero ilegible se descarta.
    const sinFecha = celdaComoTexto(fila[iFecha]) === "";
    const fecha = sinFecha ? null : parsearFechaArgentina(fila[iFecha]);
    if (!fecha && !sinFecha) {
      resultado.descartadas.push({ fila: numero, motivo: `Fecha ilegible: «${celdaComoTexto(fila[iFecha]).slice(0, 40)}»` });
      continue;
    }
    const pares: ParEnvio[] = [];
    for (const { i, etiqueta } of campos) {
      const valor = celdaComoTexto(fila[i]).slice(0, 10000);
      if (valor) pares.push({ etiqueta, valor });
    }
    if (pares.length === 0) {
      resultado.descartadas.push({ fila: numero, motivo: "Fila sin datos (sólo la fecha)." });
      continue;
    }
    const formulario = (iFormulario >= 0 ? celdaComoTexto(fila[iFormulario]).replace(/\s+/g, " ") : "") || formularioPorOmision;
    const clave = claveDeImportacion(fecha, formulario, pares);
    if (vistas.has(clave)) {
      resultado.repetidas++;
      continue;
    }
    vistas.add(clave);
    resultado.envios.push({ fecha, formulario: formulario.slice(0, 200), pares, contacto: contactoPorEtiquetas(pares), clave, fila: numero });
  }
  return resultado;
}

/** La clave estable de un formulario importado: `prosite:<nombre en minúsculas, sin tildes>`. */
export function claveDeFormularioProsite(nombre: string): string {
  const slug = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `prosite:${slug || "sin-nombre"}`;
}

export type GrupoDeFormulario = { clave: string; nombre: string; envios: EnvioImportado[]; desde: Date | null; hasta: Date | null; sinFecha: number };

/** Los envíos agrupados por formulario (los nombres que difieren sólo en mayúsculas/tildes van juntos). */
export function agruparPorFormulario(envios: readonly EnvioImportado[]): GrupoDeFormulario[] {
  const grupos = new Map<string, GrupoDeFormulario>();
  for (const e of envios) {
    const clave = claveDeFormularioProsite(e.formulario);
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, nombre: e.formulario, envios: [], desde: null, hasta: null, sinFecha: 0 };
      grupos.set(clave, g);
    }
    g.envios.push(e);
    if (!e.fecha) g.sinFecha++;
    else {
      if (!g.desde || e.fecha < g.desde) g.desde = e.fecha;
      if (!g.hasta || e.fecha > g.hasta) g.hasta = e.fecha;
    }
  }
  return [...grupos.values()].sort((a, b) => b.envios.length - a.envios.length || a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * El nombre del formulario y la cantidad esperada a partir del nombre de archivo de la exportación
 * de Prosite: `NNN__<nombre del formulario>__<cantidad>.csv` (el nombre puede tener espacios,
 * tildes, `&`, `+`, `°`…; incluso `__`). `null` si el archivo no sigue el patrón.
 */
export function formularioDeNombreDeArchivo(archivo: string): { nombre: string; cantidad: number } | null {
  const base = (archivo.split(/[\\/]/).pop() ?? "").normalize("NFC").replace(/\.(csv|xlsx?|txt)$/i, "");
  const partes = base.split("__");
  if (partes.length < 3 || !/^\d+$/.test(partes[0]) || !/^\d+$/.test(partes[partes.length - 1])) return null;
  const nombre = partes.slice(1, -1).join("__").replace(/\s+/g, " ").trim();
  return nombre ? { nombre: nombre.slice(0, 200), cantidad: Number(partes[partes.length - 1]) } : null;
}

export type ResultadoDeArchivo = {
  archivo: string;
  /** El formulario al que van sus envíos (del nombre del archivo, de su columna o el por omisión). */
  formulario: string;
  /** La cantidad que dice el nombre del archivo (`…__<cantidad>.csv`), si la dice. */
  esperados: number | null;
  resultado: ResultadoInterpretacion;
  /** Envíos que no estaban ya en un archivo anterior. */
  nuevos: number;
};

/**
 * Varios archivos de una vez (la carpeta de la exportación de Prosite): cada uno con el formulario
 * de su nombre (`NNN__<formulario>__<cantidad>.csv`) o, si no sigue el patrón, con su columna de
 * formulario o `formularioPorOmision`. Un envío que aparece en dos archivos se cuenta una vez.
 */
export function combinarArchivos(
  entradas: ReadonlyArray<{ archivo: string; filas: readonly (readonly Celda[])[] }>,
  formularioPorOmision = "Inbox de Prosite",
): { envios: EnvioImportado[]; repetidas: number; descartadas: number; porArchivo: ResultadoDeArchivo[] } {
  const envios: EnvioImportado[] = [];
  const vistas = new Set<string>();
  const porArchivo: ResultadoDeArchivo[] = [];
  let repetidas = 0;
  let descartadas = 0;
  for (const { archivo, filas } of entradas) {
    const delNombre = formularioDeNombreDeArchivo(archivo);
    const resultado = delNombre ? interpretarTabla(filas, delNombre.nombre, { columnaFormulario: false }) : interpretarTabla(filas, formularioPorOmision);
    let nuevos = 0;
    for (const e of resultado.envios) {
      if (vistas.has(e.clave)) {
        repetidas++;
        continue;
      }
      vistas.add(e.clave);
      envios.push(e);
      nuevos++;
    }
    repetidas += resultado.repetidas;
    descartadas += resultado.descartadas.length;
    porArchivo.push({
      archivo,
      formulario: delNombre?.nombre ?? (resultado.columnas.formulario ? `(columna «${resultado.columnas.formulario}»)` : formularioPorOmision),
      esperados: delNombre?.cantidad ?? null,
      resultado,
      nuevos,
    });
  }
  return { envios, repetidas, descartadas, porArchivo };
}

/**
 * Para .xlsx/.xls binario: las filas de la primera hoja con SheetJS (`xlsx`), que el script carga
 * de otra app del monorepo (FOTOFFICE no la tiene como dependencia). Las fechas llegan como
 * número de serie y `parsearFechaArgentina` las entiende.
 */
export type LectorSheetJs = {
  read: (data: Uint8Array, opts: { type: "array"; cellDates?: boolean }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (hoja: unknown, opts: { header: 1; raw: boolean; defval: string; blankrows: boolean }) => Celda[][] };
};

export function filasConSheetJs(xlsx: LectorSheetJs, bytes: Uint8Array): Celda[][] {
  const libro = xlsx.read(bytes, { type: "array", cellDates: false });
  const hoja = libro.Sheets[libro.SheetNames[0] ?? ""];
  if (!hoja) return [];
  return xlsx.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "", blankrows: false });
}
