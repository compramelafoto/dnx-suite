import { parse } from "csv-parse/sync";

export type ParsedRosterRow = {
  level: string;
  shift: string;
  courseName: string;
  division: string;
  firstName: string;
  lastName: string;
  externalStudentId: string | null;
  dni: string | null;
};

function normalizeHeaderKey(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

function rowFromRecord(rec: Record<string, string>): ParsedRosterRow {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    norm[normalizeHeaderKey(k)] = v ?? "";
  }
  const legajo =
    norm.externalstudentid ||
    norm.matricula ||
    norm.legajo ||
    "";
  return {
    level: norm.level ?? "",
    shift: norm.shift ?? "",
    courseName: norm.coursename ?? "",
    division: norm.division ?? "",
    firstName: norm.firstname ?? "",
    lastName: norm.lastname ?? "",
    externalStudentId: emptyToNull(legajo),
    dni: emptyToNull(norm.dni),
  };
}

function emptyToNull(v: string | undefined): string | null {
  if (v == null || String(v).trim() === "") return null;
  return String(v).trim();
}

const REQUIRED_KEYS = new Set([
  "level",
  "shift",
  "coursename",
  "division",
  "firstname",
  "lastname",
]);

/**
 * Parsea CSV con cabecera (primera fila). Columnas esperadas:
 * level, shift, courseName, division, firstName, lastName,
 * y opcionalmente externalStudentId | matricula | legajo, dni
 * Delimitador: coma. UTF-8.
 */
export function parseCsvRoster(csvText: string): ParsedRosterRow[] {
  const trimmed = csvText.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return [];
  }

  const records = parse(trimmed, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    return [];
  }

  const first = records[0];
  const keys = Object.keys(first).map(normalizeHeaderKey);
  for (const req of REQUIRED_KEYS) {
    if (!keys.includes(req)) {
      throw new Error(
        `Cabecera CSV inválida. Se requieren columnas: level, shift, courseName, division, firstName, lastName (y opcionalmente externalStudentId, dni). Falta o no coincide: ${req}`
      );
    }
  }

  return records.map((rec) => rowFromRecord(rec));
}
