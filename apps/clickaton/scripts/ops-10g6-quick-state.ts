/**
 * 10G.6 — quick staging state dump (no Production).
 */
import { prisma } from "@repo/db";

const REG = process.env.REG_ID?.trim() || "cms9dbk1g0003xppehrysck7n";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("refusing_production_database");
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    include: {
      items: true,
      credential: { include: { qrTokens: true } },
      welcomeCards: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!reg) throw new Error("registration_missing");

  const order = reg.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: reg.paymentOrderId },
        include: {
          paymentIntent: true,
          providerOrders: true,
        },
      })
    : null;

  const orderAllocations = reg.paymentOrderId
    ? await prisma.dnxPaymentOrderAllocation.findMany({
        where: { paymentOrderId: reg.paymentOrderId },
        select: {
          role: true,
          basisPoints: true,
          chargedAmount: true,
          status: true,
          paymentAccountId: true,
        },
      })
    : [];

  const credCount = await prisma.clickatonParticipantCredential.count({
    where: { registrationId: REG },
  });

  console.log(
    JSON.stringify(
      {
        status: reg.status,
        paymentStatus: reg.paymentStatus,
        termsVersion: reg.termsVersion,
        totalAmount: reg.totalAmount,
        paymentOrderId: reg.paymentOrderId,
        confirmedAt: reg.confirmedAt,
        order: order
          ? {
              id: order.id,
              status: order.status,
              amountMinor: Number(order.amountMinor),
              currency: order.currency,
              providerOrders: order.providerOrders.map((p) => ({
                providerOrderId: p.providerOrderId,
                mapped: p.mappedStatus,
                provider: p.providerStatus,
              })),
              allocations: orderAllocations.map((a) => ({
                role: a.role,
                basisPoints: a.basisPoints,
                chargedAmount: Number(a.chargedAmount),
                status: a.status,
                paymentAccountId: a.paymentAccountId,
              })),
            }
          : null,
        items: reg.items.map((i) => ({
          name: i.nameSnapshot,
          variant: i.variantNameSnapshot,
          sku: i.skuSnapshot,
          included: i.isIncluded,
          fulfill: i.fulfillmentStatus,
        })),
        credential: reg.credential
          ? {
              id: reg.credential.id,
              status: reg.credential.status,
              publicCode: reg.credential.publicCode,
              qrActive: reg.credential.qrTokens.filter((t) => t.status === "ACTIVE").length,
            }
          : null,
        welcomeCards: reg.welcomeCards.map((w) => ({ id: w.id, status: w.status })),
        userEmail: reg.user?.email,
        credCount,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
