import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "./money";

/**
 * Lo que la Secretaría necesita ver para administrar las cuotas.
 *
 * Dos preguntas distintas y no se mezclan: **quién debe** y **qué entró**. Juntarlas en una
 * sola lista obliga a leerla dos veces para responder cualquiera de las dos.
 */

export type DebtorRow = {
  memberId: string;
  memberNumber: string;
  fullName: string;
  openCharges: number;
  overdueCharges: number;
  totalDueMinor: number;
  oldestPeriod: string;
};

export type PaymentRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  amountMinor: number;
  feeMinor: number;
  netMinor: number;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  providerPaymentRef: string | null;
};

export type DuesOverview = {
  debtors: DebtorRow[];
  totalDebtMinor: number;
  recentPayments: PaymentRow[];
  /** Acreditado en los últimos 30 días. */
  collectedLast30Minor: number;
  pendingCount: number;
};

export async function loadDuesOverview(
  workspaceId: string,
  opciones: { now?: Date } = {},
): Promise<DuesOverview> {
  const ahora = opciones.now ?? new Date();
  const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [cargos, pagos] = await Promise.all([
    prisma.membershipCharge.findMany({
      where: { workspaceId, balanceArs: { gt: 0 } },
      select: {
        memberId: true,
        period: true,
        dueDate: true,
        balanceArs: true,
        member: { select: { memberNumber: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.membershipPayment.findMany({
      where: { workspaceId },
      select: {
        id: true,
        amountArs: true,
        platformFeeArs: true,
        netAmountArs: true,
        status: true,
        paidAt: true,
        createdAt: true,
        providerPaymentRef: true,
        member: { select: { memberNumber: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const porSocio = new Map<string, DebtorRow>();
  for (const c of cargos) {
    const minor = decimalArsToMinor(c.balanceArs);
    const vencida = c.dueDate.getTime() < ahora.getTime();
    const actual = porSocio.get(c.memberId);
    if (actual) {
      actual.openCharges += 1;
      actual.overdueCharges += vencida ? 1 : 0;
      actual.totalDueMinor += minor;
      continue;
    }
    porSocio.set(c.memberId, {
      memberId: c.memberId,
      memberNumber: c.member.memberNumber,
      fullName: `${c.member.firstName} ${c.member.lastName}`.trim(),
      openCharges: 1,
      overdueCharges: vencida ? 1 : 0,
      totalDueMinor: minor,
      // Los cargos vienen ordenados por vencimiento, así que el primero de cada socio es el
      // más antiguo.
      oldestPeriod: c.period,
    });
  }

  // Primero el que más debe: es a quien la Secretaría tiene que llamar.
  const debtors = [...porSocio.values()].sort((a, b) => b.totalDueMinor - a.totalDueMinor);

  const recentPayments: PaymentRow[] = pagos.map((p) => ({
    id: p.id,
    memberNumber: p.member.memberNumber,
    fullName: `${p.member.firstName} ${p.member.lastName}`.trim(),
    amountMinor: decimalArsToMinor(p.amountArs),
    feeMinor: decimalArsToMinor(p.platformFeeArs),
    netMinor: decimalArsToMinor(p.netAmountArs),
    status: String(p.status),
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    providerPaymentRef: p.providerPaymentRef,
  }));

  return {
    debtors,
    totalDebtMinor: debtors.reduce((s, d) => s + d.totalDueMinor, 0),
    recentPayments,
    collectedLast30Minor: recentPayments
      .filter((p) => p.status === "ACREDITADO" && p.paidAt && p.paidAt >= hace30)
      .reduce((s, p) => s + p.amountMinor, 0),
    pendingCount: recentPayments.filter((p) => p.status === "PENDIENTE").length,
  };
}
