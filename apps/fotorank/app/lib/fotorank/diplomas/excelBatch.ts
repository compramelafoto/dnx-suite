import { promises as fs } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export type ExcelRecipientRow = {
  rowNumber: number;
  nombre_completo: string;
  dni: string;
  email: string;
  categoria: string;
  premio: string;
  puesto: string;
  titulo_obra: string;
  fecha_emision: string;
  texto_adicional: string;
  codigo_interno: string;
};

export type ExcelValidationRow = ExcelRecipientRow & {
  errors: string[];
  warnings: string[];
};

const EXCEL_HEADERS = [
  "nombre_completo",
  "dni",
  "email",
  "categoria",
  "premio",
  "puesto",
  "titulo_obra",
  "fecha_emision",
  "texto_adicional",
  "codigo_interno",
] as const;

export type ExcelTemplateHeader = (typeof EXCEL_HEADERS)[number];

export function buildExcelTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const rows = [
    [...EXCEL_HEADERS],
    [
      "Ana Pérez",
      "30111222",
      "ana@example.com",
      "Retrato",
      "Mención especial",
      "2",
      "Luz interior",
      "2026-03-31",
      "Participación destacada",
      "INT-0001",
    ],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(rows);
  wsData["!cols"] = EXCEL_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsData, "Plantilla");

  const wsInstructions = XLSX.utils.aoa_to_sheet([
    ["Instrucciones"],
    [""],
    ["No modifiques los encabezados de la hoja Plantilla."],
    ["Columnas obligatorias: nombre_completo, categoria, fecha_emision."],
    ["Formato fecha recomendado: YYYY-MM-DD (ej. 2026-03-31)."],
    ["Completá una fila por destinatario."],
    ["Columnas opcionales: dni, email, premio, puesto, titulo_obra, texto_adicional, codigo_interno."],
  ]);
  wsInstructions["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instrucciones");

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(out);
}

function normalizeCell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toRow(rec: Record<string, unknown>, rowNumber: number): ExcelRecipientRow {
  return {
    rowNumber,
    nombre_completo: normalizeCell(rec.nombre_completo),
    dni: normalizeCell(rec.dni),
    email: normalizeCell(rec.email),
    categoria: normalizeCell(rec.categoria),
    premio: normalizeCell(rec.premio),
    puesto: normalizeCell(rec.puesto),
    titulo_obra: normalizeCell(rec.titulo_obra),
    fecha_emision: normalizeCell(rec.fecha_emision),
    texto_adicional: normalizeCell(rec.texto_adicional),
    codigo_interno: normalizeCell(rec.codigo_interno),
  };
}

function isIsoDateLike(v: string): boolean {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export function parseExcelRecipientsFromBuffer(
  fileBuffer: Buffer
): { rows: ExcelValidationRow[]; unknownColumns: string[] } {
  const wb = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { rows: [], unknownColumns: [] };
  const ws = wb.Sheets[firstSheetName];
  if (!ws) return { rows: [], unknownColumns: [] };

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const first = json[0];
  const unknownColumns = first
    ? Object.keys(first).filter((k) => !(EXCEL_HEADERS as readonly string[]).includes(k))
    : [];

  const rows: ExcelValidationRow[] = json.map((r, idx) => {
    const base = toRow(r, idx + 2);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!base.nombre_completo) errors.push("Falta nombre_completo.");
    if (!base.categoria) errors.push("Falta categoria.");
    if (!base.fecha_emision) errors.push("Falta fecha_emision.");
    if (base.fecha_emision && !isIsoDateLike(base.fecha_emision)) errors.push("fecha_emision inválida.");
    if (base.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base.email)) warnings.push("email con formato no válido.");
    if (!base.premio) warnings.push("Sin premio.");
    if (!base.titulo_obra) warnings.push("Sin titulo_obra.");
    return { ...base, errors, warnings };
  });

  return { rows, unknownColumns };
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function sanitizeFileSlug(v: string): string {
  const t = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  return t || "diploma";
}

export function buildBatchPaths(contestId: string, batchId: string) {
  const safeContest = sanitizeFileSlug(contestId).slice(0, 64);
  const base = path.join(process.cwd(), "public", "uploads", "diplomas", "batches", safeContest, batchId);
  return {
    base,
    sourceFile: path.join(base, "source.xlsx"),
    draftFile: path.join(base, "draft.json"),
    reportFile: path.join(base, "errores.csv"),
    zipFile: path.join(base, "diplomas.zip"),
  };
}
