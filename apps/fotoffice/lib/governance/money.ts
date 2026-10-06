import { parseArsToMinor } from "@/lib/membership/money";
import { parseDateOnly } from "./forms";

/**
 * La plata de cada proyecto (diseño §8). Módulo PURO, todo en centavos enteros.
 *
 * Cuatro números:
 * - **Necesario**: por etapa, la cotización elegida; si no hay, la mayor de las recibidas; si no
 *   hay ninguna, el costo estimado a mano. Si ninguna etapa aporta nada, el costo aproximado
 *   del proyecto (el que escribió el socio al proponerlo).
 * - **Asignado**: reservas + ingresos de Caja del proyecto + lo asignado antes del sistema.
 * - **Gastado**: egresos de Caja del proyecto (sin los anulados) + lo gastado antes del sistema.
 * - **Restante**: asignado − gastado.
 */

export const QUOTE_STATUSES = ["RECEIVED", "CHOSEN", "DISCARDED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type StageMoneyInput = {
  id: string;
  estimatedCostMinor: number | null;
  quotes: readonly { amountMinor: number; status: string }[];
};

export type NeededDetail = { chosen: number; ranged: number; estimated: number; empty: number };

export type Needed = {
  totalMinor: number;
  /** Mínimo y máximo posibles, cuando hay etapas con varias cotizaciones sin elegir. */
  minMinor: number;
  maxMinor: number;
  detail: NeededDetail;
  /** Si el total salió del costo aproximado del proyecto y no de las etapas. */
  fromManual: boolean;
};

export function neededFor(stages: readonly StageMoneyInput[], manualNeededMinor: number | null): Needed {
  let total = 0;
  let min = 0;
  const detail: NeededDetail = { chosen: 0, ranged: 0, estimated: 0, empty: 0 };
  for (const s of stages) {
    const vivas = s.quotes.filter((q) => q.status !== "DISCARDED");
    const elegida = vivas.find((q) => q.status === "CHOSEN");
    if (elegida) {
      total += elegida.amountMinor;
      min += elegida.amountMinor;
      detail.chosen++;
    } else if (vivas.length > 0) {
      const montos = vivas.map((q) => q.amountMinor);
      total += Math.max(...montos);
      min += Math.min(...montos);
      detail.ranged++;
    } else if (s.estimatedCostMinor !== null && s.estimatedCostMinor > 0) {
      total += s.estimatedCostMinor;
      min += s.estimatedCostMinor;
      detail.estimated++;
    } else {
      detail.empty++;
    }
  }
  if (total === 0 && manualNeededMinor !== null && manualNeededMinor > 0) {
    return { totalMinor: manualNeededMinor, minMinor: manualNeededMinor, maxMinor: manualNeededMinor, detail, fromManual: true };
  }
  return { totalMinor: total, minMinor: min, maxMinor: total, detail, fromManual: false };
}

export type MovementForProject = { kind: "INGRESO" | "EGRESO"; amountMinor: number; reversed: boolean };

export type ProjectNumbers = {
  neededMinor: number;
  assignedMinor: number;
  spentMinor: number;
  remainingMinor: number;
  /** Lo que falta conseguir: necesario − asignado, si es positivo. */
  missingMinor: number;
  /** Se gastó más de lo asignado: se avisa, no se bloquea. */
  overspent: boolean;
};

export function projectNumbers(input: {
  neededMinor: number;
  reservationsMinor: readonly number[];
  movements: readonly MovementForProject[];
  openingAssignedMinor: number;
  openingSpentMinor: number;
}): ProjectNumbers {
  const reservado = input.reservationsMinor.reduce((a, b) => a + b, 0);
  let ingresos = 0;
  let egresos = 0;
  for (const m of input.movements) {
    if (m.reversed) continue;
    if (m.kind === "INGRESO") ingresos += m.amountMinor;
    else egresos += m.amountMinor;
  }
  const assigned = reservado + ingresos + input.openingAssignedMinor;
  const spent = egresos + input.openingSpentMinor;
  const remaining = assigned - spent;
  return {
    neededMinor: input.neededMinor,
    assignedMinor: assigned,
    spentMinor: spent,
    remainingMinor: remaining,
    missingMinor: Math.max(0, input.neededMinor - assigned),
    overspent: spent > assigned,
  };
}

/** Lo que de verdad se puede usar: el total en Caja menos lo comprometido en proyectos vivos. */
export function freeBalanceMinor(totalMinor: number, remainingOfActiveProjects: readonly number[]): number {
  return totalMinor - remainingOfActiveProjects.reduce((a, r) => a + Math.max(0, r), 0);
}

/** "Cotizado $300.000, pagado $340.000, +13%". `null` si no hay base para comparar. */
export function deviationPercent(quotedMinor: number, paidMinor: number): number | null {
  if (quotedMinor <= 0) return null;
  return Math.round(((paidMinor - quotedMinor) / quotedMinor) * 100);
}

/** Las monedas con signo: el usuario escribe positivo y elige si reserva o libera. */
export function signedReservation(amountMinor: number, release: boolean): number {
  return release ? -amountMinor : amountMinor;
}

type Resultado<T> = { ok: true; values: T } | { ok: false; error: string };

export type QuoteFormValues = {
  stageId: string;
  supplier: string;
  amountMinor: number;
  quotedAt: Date;
  validUntil: Date | null;
  note: string | null;
};

export function parseQuoteForm(input: {
  stageId?: unknown;
  supplier?: unknown;
  amount?: unknown;
  quotedAt?: unknown;
  validUntil?: unknown;
  note?: unknown;
}): Resultado<QuoteFormValues> {
  const stageId = String(input.stageId ?? "").trim();
  if (!stageId) return { ok: false, error: "Elegí la etapa." };
  const supplier = String(input.supplier ?? "").trim();
  if (!supplier) return { ok: false, error: "Poné el proveedor." };
  if (supplier.length > 160) return { ok: false, error: "El nombre del proveedor es demasiado largo." };
  const amountMinor = parseArsToMinor(String(input.amount ?? ""));
  if (amountMinor === null || amountMinor === 0) return { ok: false, error: "El monto no se entiende." };
  const fecha = String(input.quotedAt ?? "").trim();
  const quotedAt = fecha ? parseDateOnly(fecha) : new Date();
  if (!quotedAt) return { ok: false, error: "La fecha de la cotización no se entiende." };
  const vence = String(input.validUntil ?? "").trim();
  const validUntil = vence ? parseDateOnly(vence) : null;
  if (vence && !validUntil) return { ok: false, error: "La fecha de vencimiento no se entiende." };
  const note = String(input.note ?? "").trim() || null;
  if (note && note.length > 2000) return { ok: false, error: "La nota es demasiado larga." };
  return { ok: true, values: { stageId, supplier, amountMinor, quotedAt, validUntil, note } };
}

export function parseReservationForm(fd: FormData): Resultado<{ amountMinor: number; reason: string }> {
  const minor = parseArsToMinor(String(fd.get("amount") ?? ""));
  if (minor === null || minor === 0) return { ok: false, error: "El monto no se entiende." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { ok: false, error: "Escribí el motivo: es lo que se lee después." };
  if (reason.length > 1000) return { ok: false, error: "El motivo es demasiado largo." };
  return { ok: true, values: { amountMinor: signedReservation(minor, fd.get("release") === "1"), reason } };
}

/** La cotización está vencida si su fecha de validez ya pasó. */
export function isQuoteExpired(validUntil: Date | null, now: Date): boolean {
  return validUntil !== null && validUntil.getTime() < now.getTime();
}
