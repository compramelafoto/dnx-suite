/**
 * Reporte de regalías de autores (spec O11, §5.9). Módulo PURO: meses en hora argentina,
 * agrupado por autor y CSV. La base y las escrituras viven en `royalties.ts`.
 *
 * Argentina no tiene horario de verano desde 2009: la medianoche de Buenos Aires es siempre
 * las 03:00 UTC. Un mes "YYYY-MM" va de su día 1 a las 03:00 UTC al día 1 siguiente a la
 * misma hora; la fecha que cuenta es la de la regalía (`createdAt`, cuando entró la plata).
 */

export type RoyaltyStatus = "ACCRUED" | "PAID" | "VOIDED";

export const ROYALTY_STATUS_LABELS: Record<RoyaltyStatus, string> = {
  ACCRUED: "A pagar",
  PAID: "Pagada",
  VOIDED: "Anulada",
};

export function royaltyStatusLabel(status: string): string {
  return ROYALTY_STATUS_LABELS[status as RoyaltyStatus] ?? status;
}

const TZ = "America/Argentina/Buenos_Aires";
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const OFFSET_HORAS = 3;

/** "2026-10" del instante dado, en hora argentina. */
export function arMonthOf(d: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = partes.find((p) => p.type === "year")?.value;
  const m = partes.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** El mes pedido si es válido; si no, el mes argentino actual. */
export function parseRoyaltyMonth(raw: string | null | undefined, now: Date = new Date()): string {
  return typeof raw === "string" && MES.test(raw) ? raw : arMonthOf(now);
}

function partes(month: string): { y: number; m: number } {
  const match = MES.exec(month);
  if (!match) throw new RangeError(`Mes inválido: ${month}`);
  return { y: Number(match[1]), m: Number(match[2]) };
}

/** `[start, end)` en UTC del mes argentino. */
export function arMonthRange(month: string): { start: Date; end: Date } {
  const { y, m } = partes(month);
  return {
    start: new Date(Date.UTC(y, m - 1, 1, OFFSET_HORAS)),
    end: new Date(Date.UTC(y, m, 1, OFFSET_HORAS)),
  };
}

export function shiftMonth(month: string, delta: number): string {
  const { y, m } = partes(month);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "octubre de 2026". */
export function monthLabel(month: string): string {
  const { start } = arMonthRange(month);
  return start.toLocaleDateString("es-AR", { timeZone: TZ, month: "long", year: "numeric" });
}

export function arDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export type RoyaltyRow = {
  id: string;
  authorUserId: number;
  orderId: string;
  orderNumber: number;
  orderStatus: string;
  workTitle: string;
  formatName: string | null;
  qty: number;
  baseMinor: number;
  royaltyBps: number;
  amountMinor: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  paidReference: string | null;
};

export type AuthorPerson = { name: string | null; email: string | null };

export type AuthorRoyalties = {
  authorUserId: number;
  name: string;
  email: string | null;
  /** Copias vendidas (renglones no anulados). */
  copies: number;
  accruedMinor: number;
  paidMinor: number;
  items: RoyaltyRow[];
};

export function authorName(authorUserId: number, person: AuthorPerson | undefined): string {
  return person?.name?.trim() || `Autor #${authorUserId}`;
}

export function groupRoyaltiesByAuthor(rows: readonly RoyaltyRow[], people: ReadonlyMap<number, AuthorPerson>): AuthorRoyalties[] {
  const porAutor = new Map<number, AuthorRoyalties>();
  for (const r of rows) {
    let g = porAutor.get(r.authorUserId);
    if (!g) {
      const persona = people.get(r.authorUserId);
      g = {
        authorUserId: r.authorUserId,
        name: authorName(r.authorUserId, persona),
        email: persona?.email ?? null,
        copies: 0,
        accruedMinor: 0,
        paidMinor: 0,
        items: [],
      };
      porAutor.set(r.authorUserId, g);
    }
    g.items.push(r);
    if (r.status !== "VOIDED") g.copies += r.qty;
    if (r.status === "ACCRUED") g.accruedMinor += r.amountMinor;
    if (r.status === "PAID") g.paidMinor += r.amountMinor;
  }
  return [...porAutor.values()].sort((a, b) => a.name.localeCompare(b.name, "es") || a.authorUserId - b.authorUserId);
}

export const PAID_REFERENCE_MAX = 120;

export function parsePaidReference(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const texto = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!texto) return { ok: false, error: "Escribí una referencia del pago (por ejemplo, el número de transferencia)." };
  if (texto.length > PAID_REFERENCE_MAX) {
    return { ok: false, error: `La referencia puede tener hasta ${PAID_REFERENCE_MAX} caracteres.` };
  }
  return { ok: true, value: texto };
}

/** Pesos con coma decimal y sin separador de miles: lo que una planilla en castellano lee como número. */
export function csvAmount(minor: number): string {
  const negativo = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  return `${negativo ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

function porcentaje(bps: number): string {
  return String(bps / 100).replace(".", ",");
}

const FORMULA = ["=", "+", "-", "@", "\t", "\r"];

function celda(valor: string | number | null): string {
  if (valor === null) return "";
  if (typeof valor === "number") return String(valor);
  // Una celda que empieza como fórmula se ejecutaría al abrir la planilla.
  const texto = FORMULA.some((f) => valor.startsWith(f)) ? `'${valor}` : valor;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ENCABEZADOS = [
  "Mes",
  "Autor",
  "Email",
  "Pedido",
  "Obra",
  "Formato",
  "Copias",
  "Base",
  "Regalía %",
  "Regalía",
  "Estado",
  "Pagada el",
  "Referencia",
];

/** Un renglón por regalía. UTF-8 con BOM y `;` para que Excel en castellano lo abra bien. */
export function buildRoyaltiesCsv(groups: readonly AuthorRoyalties[], month: string): string {
  const lineas = [ENCABEZADOS.join(";")];
  for (const g of groups) {
    for (const r of g.items) {
      lineas.push(
        [
          month,
          celda(g.name),
          celda(g.email),
          r.orderNumber,
          celda(r.workTitle),
          celda(r.formatName),
          r.qty,
          csvAmount(r.baseMinor),
          porcentaje(r.royaltyBps),
          csvAmount(r.amountMinor),
          celda(royaltyStatusLabel(r.status)),
          r.paidAt ? arDate(r.paidAt) : "",
          celda(r.paidReference),
        ].join(";"),
      );
    }
  }
  return `﻿${lineas.join("\r\n")}\r\n`;
}
