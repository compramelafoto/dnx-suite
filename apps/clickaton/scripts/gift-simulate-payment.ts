/**
 * Simula la acreditación del pago de un regalo, ejecutando el mismo código
 * que corre cuando llega el aviso de Mercado Pago. Sólo para probar a mano
 * contra una rama de prueba: nunca contra la base que vende.
 *
 * Uso: tsx scripts/gift-simulate-payment.ts REGALO-XXXX-XXXX
 */
import { prisma } from "@repo/db";
import { createPrismaCheckoutMutations } from "@/lib/checkout/infrastructure/prisma-checkout-mutations";
import { issueGiftVoucherOnPayment } from "@/lib/gift-vouchers/application/issue-gift-voucher";
import { createPrismaGiftVoucherRepository } from "@/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository";
import { notifyGiftPurchased } from "@/lib/gift-vouchers/notifications/notify-gift-lifecycle";

async function main() {
  const code = process.argv[2];
  if (!code) throw new Error("Falta el código del regalo.");

  const voucher = await prisma.clickatonGiftVoucher.findUnique({
    where: { code },
    select: { registrationId: true, editionId: true, status: true },
  });
  if (!voucher) throw new Error(`No existe el voucher ${code}.`);
  console.log(`Voucher ${code}: ${voucher.status}`);

  const mutations = createPrismaCheckoutMutations();
  const redeemableUntil = await mutations.getEditionRegistrationCloseAt(voucher.editionId);

  const confirmed = await mutations.confirmGiftPaid({
    registrationId: voucher.registrationId,
    paymentOrderId: `simulado-${Date.now()}`,
    source: "prueba_manual",
    requestId: `prueba-${Date.now()}`,
    redeemableUntil,
  });
  console.log(`Inscripción: ${confirmed.status} / ${confirmed.paymentStatus}`);

  const issued = await issueGiftVoucherOnPayment({
    vouchers: createPrismaGiftVoucherRepository(),
  }).execute({
    registrationId: voucher.registrationId,
    editionRegistrationCloseAt: redeemableUntil,
    paidAt: new Date(),
  });
  console.log(`Voucher emitido: ${issued.issued} (${issued.code})`);

  if (issued.issued) await notifyGiftPurchased(voucher.registrationId);

  const hold = await prisma.clickatonCapacityHold.findUnique({
    where: { registrationId: voucher.registrationId },
    select: { status: true, expiresAt: true },
  });
  console.log(`Cupo: ${hold?.status} hasta ${hold?.expiresAt?.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
