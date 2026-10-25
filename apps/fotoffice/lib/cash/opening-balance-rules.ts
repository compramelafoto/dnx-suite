/**
 * Reglas del saldo inicial que dependen de lo que ya hay en la base. Módulo PURO.
 *
 * Una cuenta tiene a lo sumo un saldo inicial vigente. Dos harían que el saldo dependa de
 * cuántas veces alguien apretó el botón; para corregirlo se anula (queda a la vista) y se
 * vuelve a cargar.
 */

export type OpeningBalanceRow = { movementId: string; amountMinor: number; occurredAt: Date };

export function canAddOpeningBalance(
  existing: OpeningBalanceRow | undefined,
): { ok: true } | { ok: false; error: string } {
  if (existing) {
    return {
      ok: false,
      error: "Esta cuenta ya tiene saldo inicial. Para corregirlo, anulalo en Movimientos y cargalo de nuevo.",
    };
  }
  return { ok: true };
}
