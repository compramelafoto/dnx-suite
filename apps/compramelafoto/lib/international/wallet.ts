import {
  LOW_BALANCE_USD_CENTS,
  MAX_TOPUP_USD_CENTS,
  MIN_TOPUP_USD_CENTS,
  TOPUP_OPTIONS_USD_CENTS,
} from "./pilot";

export type WalletMovementType = "ADVANCE" | "TOPUP" | "ADVANCE_REPAID" | "COMMISSION" | "ADJUSTMENT";

export type WalletMovementLike = {
  type: string;
  amountUsdCents: number;
  createdAt: Date;
  note: string | null;
};

/** Monto devuelto del adelanto, guardado en la nota de ADVANCE_REPAID. */
export function repaidFromNote(note: string | null): number {
  if (!note) return 0;
  try {
    const n = Number((JSON.parse(note) as { repaidUsdCents?: unknown }).repaidUsdCents);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

/** Saldo = suma de movimientos. Deuda = adelantos − lo devuelto. */
export function computeWallet(movements: WalletMovementLike[]): {
  balanceUsdCents: number;
  advanceDebtUsdCents: number;
} {
  let balance = 0;
  let debt = 0;
  for (const m of movements) {
    balance += m.amountUsdCents;
    if (m.type === "ADVANCE") debt += m.amountUsdCents;
    if (m.type === "ADVANCE_REPAID") debt -= repaidFromNote(m.note);
  }
  return { balanceUsdCents: balance, advanceDebtUsdCents: Math.max(0, debt) };
}

export function validateTopUp(chosenUsdCents: number): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(chosenUsdCents)) return { ok: false, message: "El monto de la recarga no es válido." };
  if (chosenUsdCents < MIN_TOPUP_USD_CENTS) return { ok: false, message: "La recarga mínima es de 10 USD." };
  if (chosenUsdCents > MAX_TOPUP_USD_CENTS) return { ok: false, message: "La recarga máxima es de 1000 USD." };
  return { ok: true };
}

/** Lo que paga el fotógrafo: lo que elige cargar más el adelanto que todavía debe. */
export function topUpCharge(chosenUsdCents: number, advanceDebtUsdCents: number): number {
  return chosenUsdCents + Math.max(0, advanceDebtUsdCents);
}

/** Opciones fijas; recomienda la menor que cubre lo consumido en 30 días (sin historial, 25 USD). */
export function suggestTopUp(last30DaysCommissionUsdCents: number): { options: number[]; recommended: number } {
  const options = [...TOPUP_OPTIONS_USD_CENTS];
  const recommended =
    last30DaysCommissionUsdCents <= 0
      ? options[0]
      : options.find((o) => o >= last30DaysCommissionUsdCents) ?? options[options.length - 1];
  return { options, recommended };
}

export function crossedLowBalance(before: number, after: number): boolean {
  return before >= LOW_BALANCE_USD_CENTS && after < LOW_BALANCE_USD_CENTS;
}
