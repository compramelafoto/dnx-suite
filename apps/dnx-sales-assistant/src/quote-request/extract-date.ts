import { foldQuoteText } from "./fold.js";

export type ExtractDateOptions = {
  /** Fecha/hora actual inyectable para tests. */
  now?: Date;
};

export type ExtractDateResult = {
  eventDate?: string;
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function toIso(year: number, month: number, day: number): string | undefined {
  if (!isValidYmd(year, month, day)) return undefined;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Extrae fecha determinística. No inventa fechas relativas.
 * Sin año → warning YEAR_MISSING (no completa el campo).
 */
export function extractEventDate(
  normalizedText: string,
  options: ExtractDateOptions = {},
): ExtractDateResult {
  void options.now;
  const warnings: string[] = [];
  const folded = foldQuoteText(normalizedText);
  const original = normalizedText;

  if (/\b(manana|pasado manana|el sabado|el domingo|el mes que viene|dentro de dos semanas|la semana que viene)\b/.test(folded)) {
    warnings.push("RELATIVE_DATE_UNSUPPORTED");
  }

  // ISO YYYY-MM-DD
  const iso = original.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const value = toIso(year, month, day);
    if (value) return { eventDate: value, warnings };
    warnings.push("INVALID_DATE");
    return { warnings };
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = original.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const value = toIso(year, month, day);
    if (value) return { eventDate: value, warnings };
    warnings.push("INVALID_DATE");
    return { warnings };
  }

  // 20 de septiembre de 2026 | 20 de septiembre | septiembre 20
  const writtenWithYear = folded.match(
    /\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/,
  );
  if (writtenWithYear) {
    const day = Number(writtenWithYear[1]);
    const month = MONTHS[writtenWithYear[2] ?? ""];
    const year = Number(writtenWithYear[3]);
    if (month) {
      const value = toIso(year, month, day);
      if (value) return { eventDate: value, warnings };
      warnings.push("INVALID_DATE");
      return { warnings };
    }
  }

  const writtenNoYear = folded.match(/\b(\d{1,2})\s+de\s+([a-z]+)\b/);
  if (writtenNoYear && MONTHS[writtenNoYear[2] ?? ""]) {
    warnings.push("YEAR_MISSING");
    return { warnings };
  }

  const monthDay = folded.match(/\b([a-z]+)\s+(\d{1,2})\b/);
  if (monthDay && MONTHS[monthDay[1] ?? ""]) {
    const hasYearNearby = /\b20\d{2}\b/.test(folded);
    if (!hasYearNearby) {
      warnings.push("YEAR_MISSING");
      return { warnings };
    }
  }

  return { warnings };
}
