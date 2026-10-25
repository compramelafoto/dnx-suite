import "server-only";
import { prisma } from "@/lib/prisma";
import { readAlbumPackCartDraftIdsFromSnapshot } from "@/lib/album-packs/album-pack-cart-payment-ref";
import { notifyPhotographerDesignToReview } from "./notify";
import { createDesignV2Project } from "./projects";
import { loadDesignTemplateVersion } from "./template";
import { buildDesignValues } from "./values";

/**
 * Packs de galería con diseño: cuando el pedido queda pagado, se arma un diseño por cada pack
 * que lo pida, con las fotos que el cliente eligió en el orden en que las eligió.
 *
 * El cliente recibe sus fotos como siempre (el pack se las vende); el diseño se le suma a sus
 * descargas cuando el fotógrafo lo aprueba. Idempotente: el webhook y el regreso del cliente
 * pueden confirmar el mismo pago dos veces.
 */
export async function ensureAlbumPackDesignsForPaidOrder(orderId: number): Promise<number[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      albumId: true,
      buyerName: true,
      pricingSnapshot: true,
      preCompraPaymentRef: true,
      album: {
        select: {
          userId: true,
          eventDate: true,
          school: { select: { name: true, logoUrl: true } },
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!order || order.status !== "PAID") return [];

  const draftIds = readAlbumPackCartDraftIdsFromSnapshot(order.pricingSnapshot, order.preCompraPaymentRef);
  if (draftIds.length === 0) return [];

  const drafts = await prisma.albumPackOrderDraft.findMany({
    where: { id: { in: draftIds }, albumId: order.albumId },
    select: {
      id: true,
      buyerName: true,
      albumPack: { select: { requiresDesign: true, templateV2Id: true } },
      selectionSession: {
        select: { photos: { select: { photoId: true, position: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } },
      },
    },
  });

  const created: number[] = [];
  for (const draft of drafts) {
    const templateId = draft.albumPack.templateV2Id;
    if (!draft.albumPack.requiresDesign || !templateId) continue;
    const photoIds = draft.selectionSession.photos.map((p) => p.photoId);
    if (photoIds.length === 0) continue;

    try {
      const template = await loadDesignTemplateVersion({ templateId });
      if (!template || template.slots.length === 0) {
        console.warn("[design_v2] pack sin plantilla utilizable", { orderId, draftId: draft.id, templateId });
        continue;
      }
      const result = await createDesignV2Project(prisma, {
        template,
        photoIds,
        values: buildDesignValues({
          buyerName: draft.buyerName ?? order.buyerName,
          schoolName: order.album.school?.name,
          schoolLogoUrl: order.album.school?.logoUrl,
          photographerName: order.album.user?.name,
          eventDate: order.album.eventDate,
          orderReference: `#${order.id}`,
        }),
        photographerUserId: order.album.userId,
        albumId: order.albumId,
        albumOrderId: order.id,
        albumPackDraftId: draft.id,
      });
      if (result.created) {
        created.push(result.id);
        await notifyPhotographerDesignToReview(result.id);
      }
    } catch (err) {
      // P2002: otra confirmación del mismo pago lo creó al mismo tiempo. Cualquier otro error se
      // registra pero no frena la confirmación del pago.
      if ((err as { code?: string })?.code !== "P2002") {
        console.error("[design_v2] no se pudo armar el diseño del pack", { orderId, draftId: draft.id, err });
      }
    }
  }
  return created;
}
