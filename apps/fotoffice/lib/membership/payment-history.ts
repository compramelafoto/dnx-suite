import "server-only";
import { prisma } from "@repo/db";
import { toPaymentHistory, type PaymentHistoryEntry } from "./payment-entries";

/**
 * Lo que el socio pagó.
 *
 * El menú del portal prometía «qué debés, qué pagaste y cómo pagar» y la pantalla sólo
 * mostraba lo primero: los pagos estaban en la base y ninguna superficie los mostraba. Esto
 * es la mitad que faltaba.
 *
 * El filtro por `ACREDITADO` no es un detalle de consulta: es la regla que hace verdadera a
 * la lista. Ver `payment-entries.ts`.
 */
export async function loadMemberPaymentHistory(
  memberId: string,
  opciones: { limit?: number } = {},
): Promise<PaymentHistoryEntry[]> {
  const filas = await prisma.membershipPayment.findMany({
    where: { memberId, status: "ACREDITADO" },
    select: {
      id: true,
      amountArs: true,
      method: true,
      providerPaymentRef: true,
      providerOrderRef: true,
      paidAt: true,
      createdAt: true,
      allocations: { select: { charge: { select: { period: true } } } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: opciones.limit,
  });

  return toPaymentHistory(filas);
}
