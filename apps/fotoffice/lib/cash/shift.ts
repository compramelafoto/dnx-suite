import { parseArsToMinor } from "@/lib/membership/money";

/**
 * Las reglas del turno de caja. Módulo PURO: todo en centavos enteros.
 *
 * Nada acá redondea ni recorta. Un esperado negativo se devuelve negativo, porque un
 * faltante que la pantalla muestra como cero es un faltante que nadie va a investigar.
 */

export type ShiftMovement = { kind: "INGRESO" | "EGRESO"; amountMinor: number };

export type OpeningAmountResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * El importe de apertura del turno.
 *
 * No es lo mismo "no escribió nada" que "escribió algo que no se entiende". Un campo vacío es
 * un cero declarado a propósito —hay quien abre el turno sin poner nada en la caja todavía—,
 * así que vale $0. Pero un texto que `parseArsToMinor` no puede interpretar no puede
 * convertirse en cero en silencio: el arqueo del cierre arrancaría mal por el fondo inicial
 * entero y nadie se enteraría hasta encontrar una diferencia que no cierra. Mismo criterio
 * que ya aplica `closeShiftAction` con el importe contado, con el mismo parser.
 */
export function parseOpeningAmountMinor(raw: string): OpeningAmountResult {
  const limpio = raw.trim();
  if (limpio === "") return { ok: true, value: 0 };
  const value = parseArsToMinor(limpio);
  if (value === null) return { ok: false, error: "El importe de apertura no se entiende." };
  return { ok: true, value };
}

/** Apertura + ingresos − egresos. */
export function expectedAmountMinor(input: {
  openingMinor: number;
  movements: readonly ShiftMovement[];
}): number {
  return input.movements.reduce(
    (acc, m) => acc + (m.kind === "INGRESO" ? m.amountMinor : -m.amountMinor),
    input.openingMinor,
  );
}

/** Contado − esperado. Positivo sobra, negativo falta. */
export function shiftDifferenceMinor(expectedMinor: number, countedMinor: number): number {
  return countedMinor - expectedMinor;
}

export type ShiftCheck = { ok: true } | { ok: false; error: string };

/**
 * Una diferencia sin explicar no se puede cerrar.
 *
 * Es la regla que le da sentido al arqueo: si cerrar con faltante fuera gratis, el conteo
 * sería un trámite. La explicación no impide el faltante — lo deja escrito.
 */
export function canCloseShift(input: {
  status: string;
  differenceMinor: number;
  note: string | null;
}): ShiftCheck {
  if (input.status !== "ABIERTO") return { ok: false, error: "Ese turno ya está cerrado." };
  if (input.differenceMinor !== 0 && (input.note ?? "").trim() === "") {
    return { ok: false, error: "La caja no cuadra. Explicá la diferencia antes de cerrar." };
  }
  return { ok: true };
}

/**
 * Sólo el efectivo del mostrador lleva turno.
 *
 * La caja fuerte queda afuera aunque sea efectivo: no se abre y se cierra por jornada, se
 * cuenta cada tanto. Un turno diario de caja fuerte sería un trámite que nadie hace y que
 * después ensucia el historial de arqueos con treinta filas vacías por mes.
 *
 * El índice único parcial de la base garantiza que no haya dos turnos abiertos por cuenta;
 * esta función existe para dar un mensaje entendible antes de que la base tire un error que
 * nadie puede leer.
 */
export function canOpenShift(input: {
  accountKind: string;
  isVault: boolean;
  openShiftExists: boolean;
}): ShiftCheck {
  if (input.accountKind !== "EFECTIVO") {
    return {
      ok: false,
      error: "Mercado Pago y el banco se concilian, no se cuentan: no llevan turno.",
    };
  }
  if (input.isVault) {
    return {
      ok: false,
      error: "La caja fuerte no se abre por jornada. Se cuenta con un arqueo cuando quieras.",
    };
  }
  if (input.openShiftExists) return { ok: false, error: "Esa caja ya tiene un turno abierto." };
  return { ok: true };
}
