/**
 * Aplica el ciclo de la comisión sobre la base. Best-effort siempre: el pago,
 * la anulación o el vencimiento ya quedaron firmes y no se deshacen porque
 * falle el libro de comisiones (por ejemplo, si la tabla todavía no existe).
 */

import type { prisma as prismaClient } from "@repo/db";

import {
  nextCommissionState,
  type CommissionLifecycleEvent,
} from "../domain/commission-lifecycle";
import type { AffiliateCommissionMode, AffiliateCommissionStatus } from "../domain/labels";

export type AffiliateCommissionDb = Pick<typeof prismaClient, "clickatonAffiliateCommission">;

export type CommissionLifecycleOutcome =
  | { applied: true; status: AffiliateCommissionStatus }
  | { applied: false; reason: "no_commission" | "no_change" | "race" | "error" };

async function applyEvent(
  db: AffiliateCommissionDb,
  registrationId: string,
  event: CommissionLifecycleEvent,
  now: Date,
): Promise<CommissionLifecycleOutcome> {
  try {
    const row = await db.clickatonAffiliateCommission.findUnique({
      where: { registrationId },
      select: { id: true, status: true, mode: true },
    });
    if (!row) return { applied: false, reason: "no_commission" };

    const change = nextCommissionState(
      {
        status: row.status as AffiliateCommissionStatus,
        mode: (row.mode ?? null) as AffiliateCommissionMode | null,
      },
      event,
    );
    if (!change) return { applied: false, reason: "no_change" };

    // Condicionado al estado leído: si otro proceso lo cambió en el medio, no
    // se pisa (el siguiente evento lo vuelve a evaluar).
    const updated = await db.clickatonAffiliateCommission.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: change.status,
        mode: change.mode,
        ...(change.setPaidAt ? { paidAt: now } : {}),
        ...(change.setReversedAt
          ? { reversedAt: now, reversalReason: change.reversalReason ?? null }
          : {}),
      },
    });
    if (updated.count === 0) return { applied: false, reason: "race" };
    return { applied: true, status: change.status };
  } catch (error) {
    console.error(
      `[clickaton] comisión de afiliado (${event.type}) falló para ${registrationId}:`,
      error,
    );
    return { applied: false, reason: "error" };
  }
}

/**
 * Pago aprobado: PENDING → PAID_BY_SPLIT si el checkout ya la marcó como
 * SPLIT (cobro con reparto al afiliado); si no, OWED con modo MANUAL.
 */
export function settleAffiliateCommissionOnPaid(
  db: AffiliateCommissionDb,
  registrationId: string,
  now: Date = new Date(),
  opts: { paidViaSplit?: boolean } = {},
): Promise<CommissionLifecycleOutcome> {
  return applyEvent(db, registrationId, { type: "PAID", paidViaSplit: opts.paidViaSplit }, now);
}

/**
 * Reembolso, anulación o reserva vencida → REVERSED. Nunca tira error.
 */
export function reverseAffiliateCommission(
  db: AffiliateCommissionDb,
  registrationId: string,
  reason: string,
  now: Date = new Date(),
): Promise<CommissionLifecycleOutcome> {
  return applyEvent(db, registrationId, { type: "REVERSE", reason }, now);
}
