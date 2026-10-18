const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const AR_OFFSET_MS = 3 * 3_600_000;

/** "1,234.56", "127,31", "59.197,00", "45.00" → número. Toma como decimal el último separador si tiene 2 dígitos. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s$]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  const hasDecimals = decimalAt >= 0 && s.length - decimalAt - 1 === 2;
  const intPart = (hasDecimals ? s.slice(0, decimalAt) : s).replace(/[.,]/g, "");
  const n = Number(hasDecimals ? `${intPart}.${s.slice(decimalAt + 1)}` : intPart);
  return Number.isFinite(n) ? n : null;
}

/** "October 8, 2026" → mediodía UTC de ese día (así ningún huso horario lo corre de fecha). */
export function parseEnglishDate(raw: string): Date | null {
  const m = raw.trim().match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]), 12));
}

/** "2026-08-01" → mediodía UTC de ese día. */
export function parseIsoDate(raw: string): Date | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
}

/** Año y mes de una fecha en hora argentina (UTC-3, sin horario de verano). */
export function arPeriod(d: Date): { periodYear: number; periodMonth: number } {
  const ar = new Date(d.getTime() - AR_OFFSET_MS);
  return { periodYear: ar.getUTCFullYear(), periodMonth: ar.getUTCMonth() + 1 };
}

/** Inicio de un período de servicio "Feb 27–Mar 27, 2026" o "Dec 20, 2025 – Jan 20, 2026". */
export function servicePeriodStart(text: string): { periodYear: number; periodMonth: number } | null {
  const mon = `(${SHORT.map((s) => s[0].toUpperCase() + s.slice(1)).join("|")})`;
  const re = new RegExp(`\\b${mon} (\\d{1,2})(?:, (\\d{4}))?\\s*[–-]\\s*${mon} \\d{1,2}, (\\d{4})`);
  const m = text.match(re);
  if (!m) return null;
  const start = SHORT.indexOf(m[1].toLowerCase());
  const end = SHORT.indexOf(m[4].toLowerCase());
  const endYear = Number(m[5]);
  const year = m[3] ? Number(m[3]) : start > end ? endYear - 1 : endYear;
  return { periodYear: year, periodMonth: start + 1 };
}
