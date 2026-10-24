import { parseArsToMinor } from "@/lib/membership/money";

/**
 * Saldo inicial de una cuenta de caja. Módulo PURO.
 *
 * Es la plata que ya estaba en la cuenta antes de empezar a usar FOTOFFICE. Suma al saldo
 * —si no, la caja fuerte arranca en cero y el primer egreso la deja en negativo— pero NO es un
 * ingreso del negocio: nadie la ganó ese mes.
 *
 * Se reconoce por el origen (`sourceModule`) y no por una columna propia porque
 * `CashMovement` no cambia. Es el mismo criterio que las patas de un pase: entran en el saldo
 * y los reportes de ingresos y egresos las saltean. La anulación de un saldo inicial conserva
 * este origen (`buildReversal`), así que tampoco cuenta como egreso.
 */

export const OPENING_BALANCE_MODULE = "saldo-inicial" as const;

export function isOpeningBalanceModule(sourceModule: string | null | undefined): boolean {
  return sourceModule === OPENING_BALANCE_MODULE;
}

export type OpeningBalanceValues = {
  accountId: string;
  amountMinor: number;
  occurredAt: Date;
  note: string | null;
};

export type OpeningBalanceResult = { ok: true; values: OpeningBalanceValues } | { ok: false; error: string };

/** El día en Argentina (UTC−3 fijo, sin horario de verano) como "AAAA-MM-DD". */
function diaArgentino(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseOpeningBalanceForm(fd: FormData, now: Date): OpeningBalanceResult {
  const accountId = String(fd.get("accountId") ?? "").trim();
  if (accountId === "") return { ok: false, error: "Elegí la cuenta." };

  const amountMinor = parseArsToMinor(String(fd.get("amountArs") ?? ""));
  if (amountMinor === null) return { ok: false, error: "El importe no se entiende." };
  if (amountMinor <= 0) return { ok: false, error: "El importe tiene que ser mayor que cero." };

  const fecha = String(fd.get("occurredAt") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Esa fecha no se entiende." };
  const occurredAt = new Date(`${fecha}T00:00:00-03:00`);
  if (Number.isNaN(occurredAt.getTime())) return { ok: false, error: "Esa fecha no se entiende." };
  if (fecha > diaArgentino(now)) return { ok: false, error: "La fecha del saldo inicial no puede ser futura." };

  const note = String(fd.get("note") ?? "").trim();
  return { ok: true, values: { accountId, amountMinor, occurredAt, note: note === "" ? null : note } };
}

export function openingBalanceDescription(note: string | null): string {
  return note ? `Saldo inicial: ${note}` : "Saldo inicial";
}
