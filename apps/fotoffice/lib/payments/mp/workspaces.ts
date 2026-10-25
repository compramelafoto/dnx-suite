import "server-only";
import { prisma } from "@repo/db";
import { parseWorkspaceOrganizationRef } from "@/lib/payments/connect/constants";

/**
 * Las instituciones que tienen Mercado Pago conectado. Un aviso de Mercado Pago no dice de qué
 * institución es; se le pregunta a cada una con su token hasta que alguna lo reconozca. Son
 * pocas, y la que ya tiene el pago guardado se prueba primero (ver `webhook-handler.ts`).
 */
export async function listConnectedWorkspaceIds(): Promise<string[]> {
  const identidades = await prisma.dnxFinancialIdentity.findMany({
    where: {
      organizationRef: { startsWith: "fotoffice-workspace:" },
      paymentAccounts: { some: { provider: "MERCADOPAGO", status: { notIn: ["REVOKED", "DISABLED"] } } },
    },
    select: { organizationRef: true },
  });
  return identidades
    .map((i) => (i.organizationRef ? parseWorkspaceOrganizationRef(i.organizationRef) : null))
    .filter((id): id is string => id !== null);
}

/** La institución que ya tiene guardado este pago en algún módulo, si hay una. */
export async function findWorkspaceByPaymentId(paymentId: string): Promise<string | null> {
  const [cuota, reserva, curso, pedido] = await Promise.all([
    prisma.membershipPayment.findUnique({ where: { providerPaymentRef: paymentId }, select: { workspaceId: true } }),
    prisma.booking.findFirst({ where: { mpPaymentId: paymentId }, select: { workspaceId: true } }),
    prisma.courseEnrollment.findFirst({ where: { paymentRef: paymentId }, select: { workspaceId: true } }),
    prisma.storeOrder.findUnique({ where: { mpPaymentId: paymentId }, select: { workspaceId: true } }),
  ]);
  return cuota?.workspaceId ?? reserva?.workspaceId ?? curso?.workspaceId ?? pedido?.workspaceId ?? null;
}
