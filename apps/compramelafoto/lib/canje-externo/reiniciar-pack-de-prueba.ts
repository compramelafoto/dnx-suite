import { createHash } from "crypto";
import { OrderOrigin, OrderStatus, prisma } from "@/lib/prisma";

/**
 * Deja listo otra vez un pack de prueba ya canjeado, con el mismo link.
 *
 * Un pack se canjea una sola vez (`Order.redeemsOrderId` es único), así que no se "descanjea":
 * se crea una copia nueva del pack de prueba y el link pasa a apuntarle. El canje anterior queda
 * como estaba, marcado de prueba (fuera de ventas e informes).
 *
 * Sólo para packs `isTest` y sólo para el dueño del álbum: así el fotógrafo puede repetir la
 * prueba del canje cuantas veces quiera sin pedírselo al equipo.
 */
export async function reiniciarPackDePrueba(
  token: string,
  viewerUserId: number
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const acceso = await prisma.packAccessToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { id: true, orderId: true },
  });
  if (!acceso) return { ok: false, error: "El link no es válido.", status: 404 };

  const pack = await prisma.order.findUnique({ where: { id: acceso.orderId } });
  if (!pack || !pack.isTest || pack.origin !== OrderOrigin.PREVENTA_PACK || pack.status !== OrderStatus.PAID) {
    return { ok: false, error: "Sólo se pueden reiniciar los packs de prueba.", status: 400 };
  }
  const album = await prisma.album.findUnique({ where: { id: pack.albumId }, select: { userId: true } });
  if (!album || album.userId !== viewerUserId) {
    return { ok: false, error: "Sólo el fotógrafo del álbum puede reiniciar la prueba.", status: 403 };
  }
  if (pack.redemptionOrderId == null) return { ok: true };

  await prisma.$transaction(async (tx) => {
    const nuevo = await tx.order.create({
      data: {
        albumId: pack.albumId,
        buyerEmail: pack.buyerEmail,
        buyerName: pack.buyerName,
        buyerPhone: null,
        status: pack.status,
        totalCents: pack.totalCents,
        extensionSurchargeCents: pack.extensionSurchargeCents,
        platformCommissionCents: pack.platformCommissionCents,
        referralFeeDiscountCents: pack.referralFeeDiscountCents,
        origin: pack.origin,
        checkoutPaymentSource: pack.checkoutPaymentSource,
        pricingSnapshot: pack.pricingSnapshot ?? undefined,
        redemptionPaymentRefsJson: pack.redemptionPaymentRefsJson ?? undefined,
        preventaPackSnapshotJson: pack.preventaPackSnapshotJson ?? undefined,
        organizerSchoolId: pack.organizerSchoolId,
        organizerUserId: pack.organizerUserId,
        organizerReferralApplied: pack.organizerReferralApplied,
        isTest: true,
      },
      select: { id: true },
    });
    await tx.packAccessToken.update({ where: { id: acceso.id }, data: { orderId: nuevo.id } });
  });
  return { ok: true };
}
