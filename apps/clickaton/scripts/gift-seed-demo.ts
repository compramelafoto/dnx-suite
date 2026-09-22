/**
 * Siembra regalos de ejemplo en todos los estados, para mirar el panel.
 * Sólo contra una rama de prueba: nunca contra la base que vende.
 *
 * Uso: DATABASE_URL=... tsx scripts/gift-seed-demo.ts <slug-de-edicion>
 */
import { prisma } from "@repo/db";
import { generateGiftVoucherCode } from "@/lib/gift-vouchers/domain/code";

type Caso = {
  buyer: [string, string];
  recipient: [string, string] | null;
  message: string | null;
  estado: "PENDING_PAYMENT" | "ACTIVE" | "REDEEMED" | "CANCELLED";
  participante?: [string, string];
};

const CASOS: Caso[] = [
  {
    buyer: ["Ana", "Pérez"],
    recipient: ["Beto", "beto@example.test"],
    message: "¡Feliz cumple! Salí a sacar fotos.",
    estado: "REDEEMED",
    participante: ["Beto", "Gómez"],
  },
  {
    buyer: ["Carla", "Ruiz"],
    recipient: ["Dario", "dario@example.test"],
    message: "Para que estrenes la cámara nueva.",
    estado: "ACTIVE",
  },
  {
    buyer: ["Elena", "Torres"],
    recipient: null,
    message: null,
    estado: "ACTIVE",
  },
  {
    buyer: ["Fabián", "Molina"],
    recipient: ["Gisela", "gisela@example.test"],
    message: null,
    estado: "PENDING_PAYMENT",
  },
  {
    buyer: ["Hugo", "Sánchez"],
    recipient: ["Irma", "irma@example.test"],
    message: "Se arrepintió y pidió la devolución.",
    estado: "CANCELLED",
  },
];

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Falta el slug de la edición.");

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug },
    select: { id: true, registrationCloseAt: true, currency: true },
  });
  if (!edition) throw new Error(`No existe la edición ${slug}.`);

  const ticket = await prisma.clickatonTicketType.findFirst({
    where: { editionId: edition.id, code: "GENERAL" },
    select: { id: true, priceAmount: true, currency: true },
  });
  if (!ticket) throw new Error("No hay entrada GENERAL en esa edición.");

  const ahora = new Date();
  const pagado = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000);

  for (const caso of CASOS) {
    const esPago = caso.estado !== "PENDING_PAYMENT";
    const esCanjeado = caso.estado === "REDEEMED";
    const esAnulado = caso.estado === "CANCELLED";

    const registration = await prisma.clickatonRegistration.create({
      data: {
        editionId: edition.id,
        ticketTypeId: ticket.id,
        isGift: true,
        status: esCanjeado
          ? "CONFIRMED"
          : esAnulado
            ? "CANCELLED"
            : esPago
              ? "GIFT_AWAITING_REDEMPTION"
              : "DRAFT",
        paymentStatus: esPago ? "APPROVED" : "PENDING",
        firstName: caso.participante?.[0] ?? caso.buyer[0],
        lastName: caso.participante?.[1] ?? caso.buyer[1],
        email: caso.participante
          ? `${caso.participante[0].toLowerCase()}@example.test`
          : `${caso.buyer[0].toLowerCase()}@example.test`,
        currency: ticket.currency,
        subtotalAmount: ticket.priceAmount,
        discountAmount: 0,
        totalAmount: ticket.priceAmount,
        visibleCode: esCanjeado ? `CKN26-9000${CASOS.indexOf(caso)}` : null,
        confirmedAt: esCanjeado ? ahora : null,
        cancelledAt: esAnulado ? ahora : null,
        acceptedTermsAt: pagado,
        // Sin el hold, el regalo no ocupa cupo y la prueba del panel miente.
        capacityHold: {
          create: {
            editionId: edition.id,
            ticketTypeId: ticket.id,
            status: esCanjeado ? "CONSUMED" : esAnulado ? "RELEASED" : "ACTIVE",
            expiresAt: edition.registrationCloseAt ?? ahora,
            consumedAt: esCanjeado ? ahora : null,
            releasedAt: esAnulado ? ahora : null,
          },
        },
      },
      select: { id: true },
    });

    await prisma.clickatonGiftVoucher.create({
      data: {
        code: generateGiftVoucherCode(),
        status: caso.estado,
        editionId: edition.id,
        registrationId: registration.id,
        buyerFirstName: caso.buyer[0],
        buyerLastName: caso.buyer[1],
        buyerEmail: `${caso.buyer[0].toLowerCase()}@example.test`,
        recipientName: caso.recipient?.[0] ?? null,
        recipientEmail: caso.recipient?.[1] ?? null,
        giftMessage: caso.message,
        paidAt: esPago ? pagado : null,
        redeemableUntil: esPago ? edition.registrationCloseAt : null,
        redeemedAt: esCanjeado ? ahora : null,
        cancelledAt: esAnulado ? ahora : null,
        recipientEmailCount: caso.recipient ? 1 : 0,
        recipientEmailSentAt: caso.recipient ? pagado : null,
      },
    });

    console.log(`  ${caso.estado} — ${caso.buyer.join(" ")}`);
  }

  console.log(`\n${CASOS.length} regalos de ejemplo creados.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
