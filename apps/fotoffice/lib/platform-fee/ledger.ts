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
 * Reverso de una retención cuyo pago terminó reembolsado: REVERSADO **positivo**.
 *
 * REVERSADO tiene los dos signos: positivo revierte una retención (acá, y Digitalización con
 * `recordEntryReturningId`); negativo revierte un devengado cuyo cobro se anuló (sólo
 * Digitalización, acotado a la deuda pendiente para que el saldo no quede negativo). El saldo es la
 * suma firmada de la columna, así que el tipo sólo explica el porqué.
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

/**
 * Asiento firmado que devuelve su id, para los módulos que necesitan apuntarlo desde otra tabla
 * (Digitalización: `DigitalizacionComision.ledgerEntryId`). A diferencia de los de arriba, admite
 * 0: un pago de Mercado Pago que retuvo sólo su comisión propia no cancela deuda, pero el cobro
 * igual tiene que quedar marcado para no devengarlo después.
 *
 * El signo lo pone quien llama, con el mismo criterio que el resto del libro: positivo aumenta la
 * deuda (DEVENGADO, o REVERSADO de una retención devuelta), negativo la reduce (RETENIDO, o
 * REVERSADO de un devengado anulado).
 */
export async function recordEntryReturningId(
  db: Db,
  input: { workspaceId: string; kind: "DEVENGADO" | "RETENIDO" | "REVERSADO"; signedAmountMinor: number; note: string },
): Promise<string> {
  if (!Number.isInteger(input.signedAmountMinor)) throw new Error("el asiento tiene que ser en centavos enteros");
  const abs = minorToDecimalString(Math.abs(input.signedAmountMinor));
  const fila = await db.workspaceFeeLedgerEntry.create({
    data: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      amountArs: input.signedAmountMinor < 0 ? `-${abs}` : abs,
      note: input.note,
    },
    select: { id: true },
  });
  return fila.id;
}
