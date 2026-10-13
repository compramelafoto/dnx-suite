import "server-only";
import { prisma } from "@repo/db";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/bookings/constants";
import { clubBalanceOf, clubCreditWords, grantWindow, type ClubBalance } from "@/lib/bookings/club-credits";
import { sanitizeError } from "@/lib/payments/connect/log";

/**
 * Club con turnos incluidos — la parte que toca la base.
 *
 * Cada pago ACREDITADO de una persona cuya categoría incluye turnos abre una bolsa: N turnos
 * que vencen a los X días de ese pago. No se acumulan: abrir una bolsa cierra la anterior en
 * ese instante, y lo que no se usó se pierde.
 *
 * Se llama desde los dos lugares donde un pago queda acreditado —el pago manual del equipo y
 * la acreditación de Mercado Pago (webhook y conciliación)—, después de la transacción del
 * pago y igual que `completeApplicationIfPaid`: **nunca lanza**. Que la bolsa falle no puede
 * deshacer un cobro que ya entró; queda en el registro y se vuelve a intentar sola la próxima
 * vez que alguien la pida, porque es idempotente por pago.
 */
export async function grantBookingCreditsForPayment(paymentId: string): Promise<void> {
  try {
    const pago = await prisma.membershipPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        workspaceId: true,
        memberId: true,
        status: true,
        paidAt: true,
        createdAt: true,
        bookingCreditGrant: { select: { id: true } },
        member: {
          select: {
            category: { select: { bookingCreditsPerPayment: true, bookingCreditValidityDays: true } },
          },
        },
      },
    });
    if (!pago || pago.status !== "ACREDITADO" || pago.bookingCreditGrant) return;
    const categoria = pago.member.category;
    if (!categoria || categoria.bookingCreditsPerPayment <= 0) return;

    const paidAt = pago.paidAt ?? pago.createdAt;
    const { validFrom, validUntil } = grantWindow(paidAt, categoria.bookingCreditValidityDays);

    await prisma.$transaction(async (tx) => {
      // No acumulable: la bolsa que siga abierta se cierra cuando empieza la nueva.
      await tx.memberBookingCreditGrant.updateMany({
        where: { memberId: pago.memberId, validFrom: { lte: validFrom }, validUntil: { gt: validFrom } },
        data: { validUntil: validFrom },
      });
      await tx.memberBookingCreditGrant.create({
        data: {
          workspaceId: pago.workspaceId,
          memberId: pago.memberId,
          paymentId: pago.id,
          credits: categoria.bookingCreditsPerPayment,
          validFrom,
          validUntil,
        },
      });
    });
  } catch (error) {
    // `paymentId` único: si dos acreditaciones corren a la vez, la segunda choca acá y está bien.
    const code = (error as { code?: unknown })?.code;
    if (code === "P2002") return;
    console.error("[fotoffice][club] no se pudo abrir la bolsa de turnos", {
      paymentId,
      detalle: sanitizeError(error),
    });
  }
}

/**
 * Un pago revertido (contracargo) no deja turnos: su bolsa se cierra en este instante. Los
 * turnos ya reservados con ella se respetan; lo que no deja es reservar más.
 */
export async function closeBookingCreditsForPayment(paymentId: string, at: Date = new Date()): Promise<void> {
  try {
    await prisma.memberBookingCreditGrant.updateMany({
      where: { paymentId, validUntil: { gt: at } },
      data: { validUntil: at },
    });
  } catch (error) {
    console.error("[fotoffice][club] no se pudo cerrar la bolsa de un pago revertido", {
      paymentId,
      detalle: sanitizeError(error),
    });
  }
}

export type MemberClubBalance = ClubBalance & { singular: string; plural: string };

/** La bolsa vigente de una persona, con lo que le queda. `null` si no tiene ninguna abierta. */
export async function loadMemberClubBalance(input: {
  workspaceId: string;
  memberId: string;
  at?: Date;
}): Promise<MemberClubBalance | null> {
  const at = input.at ?? new Date();
  const grant = await prisma.memberBookingCreditGrant.findFirst({
    where: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      validFrom: { lte: at },
      validUntil: { gt: at },
    },
    orderBy: { validFrom: "desc" },
    select: {
      id: true,
      credits: true,
      validFrom: true,
      validUntil: true,
      member: { select: { category: { select: { bookingCreditLabel: true } } } },
    },
  });
  if (!grant) return null;

  const usados = await prisma.booking.aggregate({
    where: { creditGrantId: grant.id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
    _sum: { creditsUsed: true },
  });
  const words = clubCreditWords(grant.member.category?.bookingCreditLabel);
  return { ...clubBalanceOf(grant, usados._sum.creditsUsed ?? 0), ...words };
}
