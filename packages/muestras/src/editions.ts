/**
 * Ediciones numeradas (etapa 8, spec D21–D24). Una fila por número (`CulturalEditionCopy`): la base
 * impide dos filas con el mismo número y la reserva corre dentro de una transacción con la oferta
 * bloqueada. Acá vive la cuenta: qué número toca, cuántas quedan y cómo se nombra cada copia.
 *
 * Una copia emitida (`ISSUED`) o anulada (`VOIDED`) nunca se reutiliza: su número queda para siempre.
 */

/** Reserva del número mientras se paga. */
export const RESERVATION_MINUTES = 20;
/** Si Mercado Pago deja el pago pendiente, la reserva se extiende hasta 72 horas. */
export const PENDING_HOLD_HOURS = 72;
/** Pruebas de autor por edición (decisión de Daniel del 2026-10-11). */
export const MAX_PROOFS = 5;
/** Formatos (ofertas) por obra. */
export const MAX_OFFERS_PER_WORK = 6;

export const COPY_KINDS = ["COPY", "PROOF"] as const;
export type CopyKind = (typeof COPY_KINDS)[number];
export const COPY_STATUSES = ["RESERVED", "ISSUED", "VOIDED", "RELEASED"] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

/**
 * `isTest`: la numeración de prueba va aparte de la real (D4). Las funciones de abajo reciben el
 * ambiente que se cuenta y descartan las filas del otro: nunca se mezclan, aunque quien llama mande
 * todas las filas de la oferta. Una fila sin `isTest` cuenta como real.
 */
export type EditionRow = { id: string; number: number; status: CopyStatus | string; reservedUntil: Date | null; kind?: CopyKind | string; isTest?: boolean };

/** "Copia única", "3/10" o "P/A 1/2". */
export function editionLabel(p: { kind: string; number: number; size: number; editionKind: string; proofCount: number }): string {
  if (p.kind === "PROOF") return `P/A ${p.number}/${p.proofCount}`;
  if (p.editionKind === "UNIQUE") return "Copia única";
  return `${p.number}/${p.size}`;
}

const vigente = (r: EditionRow, now: Date) => r.status === "RESERVED" && r.reservedUntil != null && r.reservedUntil.getTime() > now.getTime();
/** Ocupa su número: emitida, anulada o reservada todavía vigente. */
const ocupa = (r: EditionRow, now: Date) => r.status === "ISSUED" || r.status === "VOIDED" || vigente(r, now);
/** Se puede volver a usar: liberada o reservada vencida (nunca emitida). */
const reutilizable = (r: EditionRow, now: Date) => r.status === "RELEASED" || (r.status === "RESERVED" && !vigente(r, now));

const deTipo = (rows: readonly EditionRow[], kind: CopyKind, isTest: boolean) =>
  rows.filter((r) => (r.kind ?? "COPY") === kind && (r.isTest ?? false) === isTest);

/** Emitidas, anuladas, reservadas vigentes y filas reutilizables (las reservas vencidas cuentan como libres). */
export function copyCounts(
  rows: readonly EditionRow[], now: Date, kind: CopyKind = "COPY", isTest = false,
): { issued: number; voided: number; reserved: number; free: number } {
  const propias = deTipo(rows, kind, isTest);
  return {
    issued: propias.filter((r) => r.status === "ISSUED").length,
    voided: propias.filter((r) => r.status === "VOIDED").length,
    reserved: propias.filter((r) => vigente(r, now)).length,
    free: propias.filter((r) => reutilizable(r, now)).length,
  };
}

/** Cuántas quedan: N − emitidas − anuladas − reservadas vigentes. */
export function editionRemaining(rows: readonly EditionRow[], size: number, now: Date, kind: CopyKind = "COPY", isTest = false): number {
  const c = copyCounts(rows, now, kind, isTest);
  return Math.max(0, size - c.issued - c.voided - c.reserved);
}

/**
 * El número libre más bajo (1..N). Si ya hay una fila con ese número (liberada o reserva vencida),
 * se reutiliza esa fila; si no, se crea una. `null` si no queda lugar. Para las P/A, `size` es la
 * cantidad de pruebas y `kind = "PROOF"`.
 */
export function nextEditionNumber(
  rows: readonly EditionRow[],
  size: number,
  now: Date,
  kind: CopyKind = "COPY",
  isTest = false,
): { reuseId: string; number: number } | { create: true; number: number } | null {
  const propias = deTipo(rows, kind, isTest);
  if (propias.filter((r) => ocupa(r, now)).length >= size) return null;
  const ocupados = new Set(propias.filter((r) => ocupa(r, now)).map((r) => r.number));
  for (let n = 1; n <= size; n++) {
    if (ocupados.has(n)) continue;
    const fila = propias.find((r) => r.number === n && reutilizable(r, now));
    return fila ? { reuseId: fila.id, number: n } : { create: true, number: n };
  }
  return null;
}

/**
 * Cambiar N: antes de la primera venta, libre; después, no sube y no baja de lo ocupado
 * (`issuedOrReserved` = emitidas + anuladas + reservadas vigentes).
 */
export function canChangeEdition(p: { firstSoldAt: Date | null; currentSize: number; nextSize: number; issuedOrReserved: number }): { ok: true } | { ok: false; error: string } {
  if (p.nextSize < p.issuedOrReserved) return { ok: false, error: `Ya hay ${p.issuedOrReserved} copias emitidas o reservadas: la edición no puede ser menor.` };
  if (p.firstSoldAt != null && p.nextSize > p.currentSize) return { ok: false, error: "Después de la primera venta, la edición no puede crecer." };
  return { ok: true };
}

/**
 * Pago tardío (D23, revisión de las tareas 1 a 5): cuando un pedido vencido se paga, su reserva ya
 * se liberó (y el pedido perdió su `copyId`). Nunca se recupera esa fila: se busca el número libre
 * más bajo como cualquier compra nueva, o el pedido pasa a `PAID_NO_COPY`.
 */
export function lateCopyDecision(rows: readonly EditionRow[], size: number, now: Date, isTest: boolean): { reuseId: string; number: number } | { create: true; number: number } | "PAID_NO_COPY" {
  return nextEditionNumber(rows, size, now, "COPY", isTest) ?? "PAID_NO_COPY";
}

/** Una venta de prueba no marca la primera venta de la oferta: no fija formato, edición ni original. */
export function marksFirstSale(p: { isTest: boolean; firstSoldAt: Date | null }): boolean {
  return !p.isTest && p.firstSoldAt == null;
}
