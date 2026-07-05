/**
 * Clave estable para agrupar matrícula / padrón por (nivel, turno, curso, división).
 * Separador ASCII unit separator para evitar colisiones con comas del CSV.
 */
const SLOT_SEP = "\u001f";

export function encodeCourseSlotKey(
  level: string,
  shift: string,
  courseName: string,
  division: string
): string {
  const norm = (s: string) => String(s ?? "").trim();
  return [norm(level), norm(shift), norm(courseName), norm(division)].join(SLOT_SEP);
}

export function decodeCourseSlotKey(
  key: string
): { level: string; shift: string; courseName: string; division: string } | null {
  const parts = String(key ?? "").split(SLOT_SEP);
  if (parts.length !== 4) return null;
  const [level, shift, courseName, division] = parts.map((p) => String(p ?? "").trim());
  return { level, shift, courseName, division };
}

/** Lee `Album.selectedCourseKeys` (JSON string[] desde Prisma) de forma tolerante. */
export function parseStoredCourseSlotKeys(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t) out.push(t);
  }
  return [...new Set(out)];
}

export function formatCourseSlotLabel(courseName: string, division: string): string {
  const cn = String(courseName ?? "").trim();
  const dv = String(division ?? "").trim();
  if (cn && dv) return `${cn} ${dv}`.replace(/\s+/g, " ").trim();
  return cn || dv || "—";
}
