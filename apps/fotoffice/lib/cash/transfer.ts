import "server-only";
import type { Prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";

/**
 * Los pases de plata entre dos cuentas del mismo workspace.
 *
 * El caso que motiva todo esto es el de todos los días: al cerrar el mostrador se guarda lo
 * recaudado en la caja fuerte y queda el fondo fijo para el vuelto. Es un *retiro de caja*.
 *
 * Un pase NO es un ingreso ni un egreso del negocio. Los saldos por cuenta lo incluyen —la
 * plata efectivamente ya no está en el mostrador— y los reportes de ingresos y egresos lo
 * excluyen. Ver `lib/cash/balance.ts`.
 */

/**
 * Cuánto conviene pasar a la caja fuerte al cerrar.
 *
 * Nunca propone un pase negativo. Si la caja quedó por debajo del fondo fijo —porque hubo un
 * faltante o porque el día fue flojo—, lo que hace falta no es un pase al revés: es que el
 * arqueo deje asentada la diferencia, que es otra cosa y ya la resuelve `canCloseShift`.
 */
export function suggestedDropMinor(input: {
  countedMinor: number;
  fixedFloatMinor: number;
}): number {
  return Math.max(0, input.countedMinor - input.fixedFloatMinor);
}

export type TransferCheck = { ok: true } | { ok: false; error: string };

/**
 * El importe es siempre positivo: el sentido del pase lo dan las dos cuentas, no el signo.
 * Permitir un negativo sería tener dos maneras de expresar lo mismo, y tarde o temprano las
 * dos se usan y se contradicen.
 */
export function validateTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  fromBalanceMinor: number;
}): TransferCheck {
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: "Elegí dos cuentas distintas." };
  }
  if (input.amountMinor <= 0) {
    return { ok: false, error: "El importe tiene que ser mayor que cero." };
  }
  if (input.amountMinor > input.fromBalanceMinor) {
    return { ok: false, error: "No podés pasar más plata de la que hay en esa cuenta." };
  }
  return { ok: true };
}

export type CreateTransferInput = {
  workspaceId: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  occurredAt: Date;
  note: string | null;
  /** Turno al que se imputa la pata de salida, cuando el pase se hace al cerrar. */
  fromShiftId?: string | null;
  createdByUserId?: number | null;
};

/**
 * Escribe el pase y sus dos asientos hermanos, en una sola transacción.
 *
 * Los tres nacen juntos o no nace ninguno. Un egreso sin su ingreso hermano sería plata
 * evaporada entre dos cuentas, y encontrar eso meses después es prácticamente imposible.
 *
 * Los dos asientos van sin categoría a propósito: una transferencia no pertenece a ninguna
 * categoría de ingreso ni de egreso, y forzarle una la metería en los reportes por la puerta
 * de atrás.
 */
export async function createCashTransfer(
  tx: Prisma.TransactionClient,
  input: CreateTransferInput,
): Promise<{ transferId: string }> {
  const importe = minorToDecimalString(input.amountMinor);

  const pase = await tx.cashTransfer.create({
    data: {
      workspaceId: input.workspaceId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountArs: importe,
      occurredAt: input.occurredAt,
      note: input.note,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: { id: true },
  });

  // La pata de ENTRADA resuelve el turno abierto de SU PROPIA cuenta, igual que
  // `recordCashMovement` (ver el comentario de ese archivo). No es sólo el caso de todos los
  // días —mostrador a caja fuerte, donde la caja fuerte no lleva turno y esto no cambia
  // nada—: la pantalla de Pases también ofrece el camino inverso, sacar plata de la caja
  // fuerte para reponer el fondo de vuelto del mostrador. Si esa entrada naciera sin turno,
  // `expectedAmountMinor` no la vería y el cierre de esa caja marcaría sobrante por el
  // importe entero, todos los días que se repita el pase — el mismo error silencioso que
  // `recordCashMovement` ya corrige para los depósitos automáticos.
  const turnoDestino = await tx.cashShift.findFirst({
    where: { workspaceId: input.workspaceId, accountId: input.toAccountId, status: "ABIERTO" },
    select: { id: true },
  });

  const comun = {
    workspaceId: input.workspaceId,
    amountArs: importe,
    occurredAt: input.occurredAt,
    categoryId: null,
    paymentMethod: "EFECTIVO",
    transferId: pase.id,
    sourceModule: "manual",
    createdByUserId: input.createdByUserId ?? null,
  };

  await tx.cashMovement.createMany({
    data: [
      {
        ...comun,
        accountId: input.fromAccountId,
        shiftId: input.fromShiftId ?? null,
        kind: "EGRESO",
        description: input.note ?? "Pase a otra cuenta",
      },
      {
        ...comun,
        accountId: input.toAccountId,
        shiftId: turnoDestino?.id ?? null,
        kind: "INGRESO",
        description: input.note ?? "Pase desde otra cuenta",
      },
    ],
  });

  return { transferId: pase.id };
}
