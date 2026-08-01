/**
 * 10G.6 — Audit LIVE unpaid reservations in Production (read-only).
 * Never marks PAID. Never simulates webhook.
 */
import { prisma } from "@repo/db";

const LIVE_REGS = [
  "cms9acl7k0001xp78c1aq67so",
  // secondary controlled attempt if present
  "cms9byf9d0001xpj73om342k6",
];
const LIVE_ORDERS = ["dnx_ord_264240a0bb0a46cc", "dnx_ord_1277ebfc77454e94"];

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/silent-haze|clickaton_production|ep-silent/i.test(dbUrl)) {
    throw new Error("refusing_non_production_database_for_live_preserve_audit");
  }

  const regs = await prisma.clickatonRegistration.findMany({
    where: { id: { in: LIVE_REGS } },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentOrderId: true,
      confirmedAt: true,
      totalAmount: true,
      termsVersion: true,
    },
  });
  const orders = await prisma.dnxPaymentOrder.findMany({
    where: { id: { in: LIVE_ORDERS } },
    select: { id: true, status: true, amountMinor: true, environment: true },
  });

  const nonePaid = orders.every((o) => o.status !== "PAID");
  const noneConfirmed = regs.every((r) => r.status !== "CONFIRMED");

  const out = {
    stage: "10G.6",
    purpose: "PRESERVE_LIVE_UNPAID",
    registrations: regs,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      amountMinor: Number(o.amountMinor),
      environment: o.environment,
    })),
    guards: {
      noneMarkedPaid: nonePaid,
      noneConfirmed,
      readOnly: true,
    },
    verdict:
      nonePaid && noneConfirmed
        ? "LIVE_UNPAID_PRESERVED"
        : "LIVE_STATE_UNEXPECTED",
  };
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (out.verdict !== "LIVE_UNPAID_PRESERVED") process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
