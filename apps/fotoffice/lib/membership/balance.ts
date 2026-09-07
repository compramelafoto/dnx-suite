import "server-only";
import { prisma } from "@repo/db";
import { creditFromPayments, type OpenCredit, type PaymentForCredit } from "./credit";
import { decimalArsToMinor } from "./money";
import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * La cuenta de un socio, completa.
 *
 * Reemplaza a `loadMemberAccount`, que sólo sabía restar: leía cargos con saldo y nada más,
 * así que un socio que pagó de más no tenía dónde figurar.
 *
 * `netMinor` negativo significa que el socio está **a favor**.
 */

export type MemberBalance = {
  charges: OpenCharge[];
  /** Lo que debe, en centavos. */
  dueMinor: number;
  /** Lo que tiene a favor, en centavos. */
  creditMinor: number;
  /** `dueMinor - creditMinor`. Negativo = el socio está a favor. */
  netMinor: number;
  /** De qué pagos sale el crédito. Lo necesita la imputación automática. */
  openCredits: OpenCredit[];
  overdueCount: number;
  oldestOverduePeriod: string | null;
};

export async function loadMemberBalance(
  memberId: string,
  opciones: { now?: Date } = {},
): Promise<MemberBalance> {
  const ahora = opciones.now ?? new Date();

  const [cargos, pagos] = await Promise.all([
    prisma.membershipCharge.findMany({
      where: { memberId, balanceArs: { gt: 0 } },
      select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
    }),
    prisma.membershipPayment.findMany({
      where: { memberId, status: "ACREDITADO" },
      select: {
        id: true,
        method: true,
        providerPaymentRef: true,
        amountArs: true,
        allocations: { select: { principalArs: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const charges: OpenCharge[] = sortOldestFirst(
    cargos.map((f) => ({
      id: f.id,
      concept: String(f.concept),
      period: f.period,
      dueDate: f.dueDate,
      balanceMinor: decimalArsToMinor(f.balanceArs),
    })),
  );

  const paraCredito: PaymentForCredit[] = pagos.map((p) => ({
    id: p.id,
    method: p.method,
    providerPaymentRef: p.providerPaymentRef,
    amountMinor: decimalArsToMinor(p.amountArs),
    allocatedMinor: p.allocations.reduce((s, a) => s + decimalArsToMinor(a.principalArs), 0),
  }));

  const { creditMinor, open } = creditFromPayments(paraCredito);
  const dueMinor = charges.reduce((s, c) => s + c.balanceMinor, 0);
  const vencidas = charges.filter((c) => c.dueDate.getTime() < ahora.getTime());

  return {
    charges,
    dueMinor,
    creditMinor,
    netMinor: dueMinor - creditMinor,
    openCredits: open,
    overdueCount: vencidas.length,
    oldestOverduePeriod: vencidas[0]?.period ?? null,
  };
}
