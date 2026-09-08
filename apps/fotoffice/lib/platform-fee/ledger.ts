import "server-only";
import { Prisma, prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";

/**
 * Libro de la comisión que la institución le debe a la plataforma.
 *
 * Los asientos son firmados: positivo aumenta la deuda, negativo la reduce. El saldo es la
 * suma de la columna, sin interpretar el tipo de asiento — así un tipo nuevo no puede
 * romper el cálculo por olvidarse de contemplarlo.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Deuda pendiente de la institución, en centavos. Nunca negativa. */
export async function pendingFeeDebtMinor(workspaceId: string, db: Db = prisma): Promise<number> {
  const r = await db.workspaceFeeLedgerEntry.aggregate({
    where: { workspaceId },
    _sum: { amountArs: true },
  });
  const minor = r._sum.amountArs ? decimalArsToMinor(r._sum.amountArs) : 0;
  return Math.max(0, minor);
}

/**
 * De qué operación salió un asiento.
 *
 * Las dos referencias son opcionales y excluyentes en la práctica: un asiento viene de un
 * pago de cuota o de una reserva. Se guardan las dos como columnas nullable porque un
 * asiento sin referencia —un ajuste manual— también es legítimo, y porque obligar a elegir
 * con un tipo cerrado complicaría a los tres llamadores sin evitar ningún error real.
 */
export type LedgerEntryInput = {
  workspaceId: string;
  amountMinor: number;
  note: string;
  membershipPaymentId?: string | null;
  bookingId?: string | null;
};

/** La comisión que no se pudo retener porque el pago no pasó por Mercado Pago. */
export async function recordAccrual(db: Db, input: LedgerEntryInput): Promise<void> {
  if (input.amountMinor <= 0) return;
  await db.workspaceFeeLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "DEVENGADO",
      amountArs: minorToDecimalString(input.amountMinor),
      membershipPaymentId: input.membershipPaymentId ?? null,
      bookingId: input.bookingId ?? null,
      note: input.note,
    },
  });
}

/** Deuda cobrada reteniéndola de un pago que sí pasó por Mercado Pago. */
export async function recordDischarge(db: Db, input: LedgerEntryInput): Promise<void> {
  if (input.amountMinor <= 0) return;
  await db.workspaceFeeLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "RETENIDO",
      amountArs: `-${minorToDecimalString(input.amountMinor)}`,
      membershipPaymentId: input.membershipPaymentId ?? null,
      bookingId: input.bookingId ?? null,
      note: input.note,
    },
  });
}

/**
 * Reverso de una retención cuyo pago terminó reembolsado.
 *
 * Sin esto la plataforma se quedaría con una comisión sobre plata que volvió al socio, y la
 * deuda desaparecería sin haberse cobrado.
 */
export async function recordReversal(
  db: Db,
  input: { workspaceId: string; membershipPaymentId: string; amountMinor: number; note: string },
): Promise<void> {
  if (input.amountMinor <= 0) return;
  await db.workspaceFeeLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "REVERSADO",
      amountArs: minorToDecimalString(input.amountMinor),
      membershipPaymentId: input.membershipPaymentId,
      note: input.note,
    },
  });
}

/** Deuda dada por saldada fuera del circuito de pagos. Solo el Super Admin. */
export async function recordManualSettlement(
  db: Db,
  input: { workspaceId: string; amountMinor: number; note: string; actorUserId: number },
): Promise<void> {
  if (input.amountMinor <= 0) return;
  await db.workspaceFeeLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "SALDADO_MANUAL",
      amountArs: `-${minorToDecimalString(input.amountMinor)}`,
      note: input.note,
      actorUserId: input.actorUserId,
    },
  });
}
