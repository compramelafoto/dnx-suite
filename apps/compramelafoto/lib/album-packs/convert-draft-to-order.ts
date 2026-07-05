import {
  AlbumPackOrderDraftStatus,
  CheckoutPaymentSource,
  OrderOrigin,
  OrderStatus,
  Prisma,
  type PrismaClient,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { isAlbumPackPaymentGloballyAllowedForAlbum } from "@/lib/album-packs/album-pack-feature-flags";
import { albumPackFulfillmentHasPrint } from "@/lib/album-packs/album-pack-fulfillment-helpers";
import { buildAlbumPackPrintMirrorItems } from "@/lib/album-packs/build-album-pack-print-mirror-items";
import { loadAlbumPackPrintProductsById } from "@/lib/album-packs/load-album-pack-print-products";
import {
  AlbumPackOrderCreationPrepError,
  prepareAlbumPackOrderCreation,
} from "@/lib/album-packs/prepare-album-pack-order-creation";
import { mapDbComponentsToComposition } from "@/lib/album-packs/album-pack-components-persistence";
import { resolveAlbumPackComponents } from "@/lib/album-packs/resolve-album-pack-order-lines";
import { createAlbumOrderPrintOrderMirror } from "@/lib/orders/create-album-order-print-order-mirror";
import {
  AlbumPackBuyerContactError,
  validateAlbumPackBuyerContact,
} from "@/lib/album-packs/validate-album-pack-buyer-contact";
import { albumPackClientPriceArs } from "@/lib/album-packs/album-pack-client-price";
import { resolveAlbumPackOrderExtensionTotals } from "@/lib/album-packs/resolve-album-pack-extension-pricing";

type TxClient = Prisma.TransactionClient;

type DraftOrderSummary = {
  id: number;
  albumId: number;
  buyerEmail: string;
  buyerName: string | null;
  buyerPhone: string | null;
  status: OrderStatus;
  totalCents: number;
  origin: OrderOrigin;
  checkoutPaymentSource: CheckoutPaymentSource;
  createdAt: Date;
};

export class AlbumPackDraftToOrderError extends Error {
  constructor(
    message: string,
    public readonly code: string = "ALBUM_PACK_DRAFT_TO_ORDER_ERROR",
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "AlbumPackDraftToOrderError";
  }
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

async function loadDraftForCreateOrder(tx: TxClient, draftId: string) {
  const draft = await tx.albumPackOrderDraft.findUnique({
    where: { id: draftId },
    include: {
      albumPack: {
        select: {
          id: true,
          albumId: true,
          name: true,
          description: true,
          price: true,
          includedPhotoCount: true,
          requiresSelection: true,
          requiresDesign: true,
          packType: true,
          isActive: true,
          components: {
            orderBy: { sortOrder: "asc" },
            select: {
              kind: true,
              sortOrder: true,
              unitsPerSelection: true,
              photographerProductId: true,
            },
          },
        },
      },
      selectionSession: {
        select: {
          id: true,
          status: true,
          photos: {
            include: {
              photo: {
                select: { id: true, albumId: true, isRemoved: true, originalKey: true },
              },
            },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!draft) {
    throw new AlbumPackDraftToOrderError("Draft no encontrado.", "DRAFT_NOT_FOUND", 404);
  }
  return draft;
}

async function findExistingOrderByDraftRef(
  tx: TxClient,
  draftId: string
): Promise<DraftOrderSummary | null> {
  const existing = await tx.order.findFirst({
    where: { preCompraPaymentRef: `ALBUM_PACK_DRAFT:${draftId}` },
    select: {
      id: true,
      albumId: true,
      buyerEmail: true,
      buyerName: true,
      buyerPhone: true,
      status: true,
      totalCents: true,
      origin: true,
      checkoutPaymentSource: true,
      createdAt: true,
    },
    orderBy: { id: "desc" },
  });
  return existing;
}

function readAlbumPackDraftPricing(draft: {
  totalCents: number;
  pricingSnapshotJson: unknown;
  albumPack: { price: number };
}) {
  const snap =
    draft.pricingSnapshotJson && typeof draft.pricingSnapshotJson === "object"
      ? (draft.pricingSnapshotJson as Record<string, unknown>)
      : {};
  const basePriceArs =
    Number.isFinite(Number(snap.basePriceArs)) && Number(snap.basePriceArs) >= 0
      ? Math.round(Number(snap.basePriceArs))
      : Math.max(0, Math.trunc(Number(draft.albumPack.price) || 0));
  const marketplaceFeePercent = Math.max(0, Math.round(Number(snap.marketplaceFeePercent) || 0));
  const marketplaceFeeCents =
    Number.isFinite(Number(snap.marketplaceFeeCents)) && Number(snap.marketplaceFeeCents) >= 0
      ? Math.round(Number(snap.marketplaceFeeCents))
      : Math.max(0, Math.round(Number(draft.totalCents) || 0) - basePriceArs);
  const clientTotalArs = Math.max(0, Math.round(Number(draft.totalCents) || 0));
  return { basePriceArs, marketplaceFeePercent, marketplaceFeeCents, clientTotalArs };
}

export async function convertAlbumPackDraftToOrder(params: {
  draftId: string;
  guestToken?: string | null;
  actorEmail?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  prismaClient?: PrismaClient;
}): Promise<{
  order: DraftOrderSummary;
  draftStatus: AlbumPackOrderDraftStatus;
  packName: string;
  photoIds: number[];
  reused: boolean;
}> {
  const draftId = String(params.draftId ?? "").trim();
  if (!draftId) {
    throw new AlbumPackDraftToOrderError(
      "draftId es obligatorio.",
      "DRAFT_ID_REQUIRED",
      400
    );
  }
  const actorEmail = normalizeEmail(params.actorEmail);
  const guestToken = String(params.guestToken ?? "").trim();
  const db = params.prismaClient ?? prisma;

  return db.$transaction(
    async (tx) => {
      const existing = await findExistingOrderByDraftRef(tx, draftId);
      if (existing) {
        const draftForReuse = await loadDraftForCreateOrder(tx, draftId);
        const photoIds = draftForReuse.selectionSession.photos.map((row) => row.photoId);
        return {
          order: existing,
          draftStatus: draftForReuse.status,
          packName: draftForReuse.albumPack.name,
          photoIds,
          reused: true,
        };
      }

      const draft = await loadDraftForCreateOrder(tx, draftId);
      if (
        draft.status !== AlbumPackOrderDraftStatus.DRAFT &&
        draft.status !== AlbumPackOrderDraftStatus.LOCKED
      ) {
        throw new AlbumPackDraftToOrderError(
          "El draft no está disponible para crear pedido.",
          "DRAFT_STATUS_INVALID",
          400
        );
      }

      if (draft.selectionSession.status !== "READY") {
        throw new AlbumPackDraftToOrderError(
          "La selección del pack debe estar en READY.",
          "SESSION_NOT_READY",
          400
        );
      }

      if (!draft.albumPack.isActive) {
        throw new AlbumPackDraftToOrderError(
          "El pack está inactivo.",
          "PACK_INACTIVE",
          400
        );
      }

      if (
        draft.guestToken &&
        draft.guestToken !== guestToken &&
        normalizeEmail(draft.buyerEmail) !== actorEmail
      ) {
        throw new AlbumPackDraftToOrderError(
          "No autorizado para convertir este draft.",
          "DRAFT_ACCESS_DENIED",
          403
        );
      }

      let resolvedBuyerEmail = normalizeEmail(draft.buyerEmail) || actorEmail;
      let resolvedBuyerName = draft.buyerName ?? null;
      let resolvedBuyerPhone = draft.buyerPhone ?? null;

      const incomingBuyerEmail = normalizeEmail(params.buyerEmail);
      if (!resolvedBuyerEmail && incomingBuyerEmail) {
        try {
          const validated = validateAlbumPackBuyerContact({
            buyerEmail: params.buyerEmail,
            buyerName: params.buyerName,
            buyerPhone: params.buyerPhone,
          });
          resolvedBuyerEmail = validated.buyerEmail;
          resolvedBuyerName = validated.buyerName;
          resolvedBuyerPhone = validated.buyerPhone;
        } catch (err) {
          if (err instanceof AlbumPackBuyerContactError) {
            throw new AlbumPackDraftToOrderError(err.message, err.code, 400);
          }
          throw err;
        }
      }

      if (!resolvedBuyerEmail) {
        throw new AlbumPackDraftToOrderError(
          "Necesitamos tu email para crear el pedido.",
          "DRAFT_BUYER_EMAIL_REQUIRED",
          400
        );
      }

      if (!normalizeEmail(draft.buyerEmail)) {
        await tx.albumPackOrderDraft.update({
          where: { id: draft.id },
          data: {
            buyerEmail: resolvedBuyerEmail,
            buyerName: resolvedBuyerName,
            buyerPhone: resolvedBuyerPhone,
          },
        });
        await tx.albumPackSelectionSession.update({
          where: { id: draft.selectionSessionId },
          data: {
            buyerEmail: resolvedBuyerEmail,
            buyerName: resolvedBuyerName,
            buyerPhone: resolvedBuyerPhone,
          },
        });
      }

      const albumForPay = await tx.album.findUnique({
        where: { id: draft.albumPack.albumId },
        select: { albumPackPayEnabled: true, userId: true },
      });
      if (!isAlbumPackPaymentGloballyAllowedForAlbum(albumForPay?.albumPackPayEnabled)) {
        throw new AlbumPackDraftToOrderError(
          "El pago de packs no está habilitado para este álbum.",
          "ALBUM_PACK_PAY_DISABLED",
          403
        );
      }

      const selectionPhotos = draft.selectionSession.photos;
      if (selectionPhotos.length <= 0) {
        throw new AlbumPackDraftToOrderError(
          "El draft no tiene fotos seleccionadas.",
          "DRAFT_WITHOUT_PHOTOS",
          400
        );
      }

      for (const row of selectionPhotos) {
        if (row.photo.isRemoved || row.photo.albumId !== draft.albumId) {
          throw new AlbumPackDraftToOrderError(
            "Hay fotos inválidas para este álbum en la selección.",
            "DRAFT_PHOTO_INVALID",
            400
          );
        }
      }

      const lock = await tx.albumPackOrderDraft.updateMany({
        where: {
          id: draft.id,
          status: { in: [AlbumPackOrderDraftStatus.DRAFT, AlbumPackOrderDraftStatus.LOCKED] },
        },
        data: { status: AlbumPackOrderDraftStatus.LOCKED },
      });
      if (lock.count !== 1) {
        throw new AlbumPackDraftToOrderError(
          "No se pudo bloquear el draft para crear el pedido.",
          "DRAFT_LOCK_FAILED",
          409
        );
      }

      const packPricing = readAlbumPackDraftPricing(draft);
      const packClientSubtotalArs = albumPackClientPriceArs(
        packPricing.basePriceArs,
        packPricing.marketplaceFeePercent
      );
      const extensionTotals = await resolveAlbumPackOrderExtensionTotals(tx, {
        albumId: draft.albumId,
        clientSubtotalArs: packClientSubtotalArs,
      });
      const totalCents = extensionTotals.totalCents;
      const extensionSurchargeCents = extensionTotals.extensionSurchargeCents;
      if (totalCents <= 0) {
        throw new AlbumPackDraftToOrderError(
          "El total del draft debe ser mayor a 0.",
          "DRAFT_TOTAL_INVALID",
          400
        );
      }

      const photoIds = selectionPhotos.map((row) => row.photoId);

      const compositionPack = {
        id: draft.albumPack.id,
        name: draft.albumPack.name,
        description: draft.albumPack.description,
        includedPhotoCount: draft.albumPack.includedPhotoCount,
        requiresSelection: draft.albumPack.requiresSelection,
        requiresDesign: draft.albumPack.requiresDesign,
        packType: draft.albumPack.packType,
        components: mapDbComponentsToComposition(draft.albumPack.components),
      };

      const packComponents = resolveAlbumPackComponents(compositionPack);
      const printProductIds = packComponents
        .filter((c) => c.kind === "PRINT")
        .map((c) => c.photographerProductId)
        .filter((id): id is number => id != null && id > 0);

      let printProductsById;
      if (printProductIds.length > 0) {
        const photographerUserId = albumForPay?.userId;
        if (!photographerUserId) {
          throw new AlbumPackDraftToOrderError(
            "No se pudo resolver el fotógrafo del álbum para productos de impresión.",
            "ALBUM_PHOTOGRAPHER_REQUIRED",
            400
          );
        }
        try {
          printProductsById = await loadAlbumPackPrintProductsById(
            tx,
            printProductIds,
            photographerUserId
          );
        } catch (err) {
          if (err instanceof AlbumPackOrderCreationPrepError) {
            throw new AlbumPackDraftToOrderError(err.message, err.code, 400);
          }
          throw err;
        }
      }

      let orderPrep;
      try {
        orderPrep = prepareAlbumPackOrderCreation({
          pack: compositionPack,
          photoIds,
          pricing: {
            totalCents,
            basePriceArs: packPricing.basePriceArs,
            marketplaceFeePercent: packPricing.marketplaceFeePercent,
            marketplaceFeeCents: packPricing.marketplaceFeeCents,
            clientTotalArs: packClientSubtotalArs,
          },
          draftId: draft.id,
          printProductsById,
        });
      } catch (err) {
        if (err instanceof AlbumPackOrderCreationPrepError) {
          throw new AlbumPackDraftToOrderError(err.message, err.code, 400);
        }
        throw err;
      }

      const pricingSnapshot: Prisma.InputJsonValue = {
        ...orderPrep.pricingSnapshot,
        pricing: {
          ...orderPrep.pricingSnapshot.pricing,
          totalCents,
          clientTotalArs: packClientSubtotalArs,
          extensionPricingActive: extensionTotals.extensionPricing.active,
          extensionSurchargeArs:
            extensionSurchargeCents > 0 ? extensionSurchargeCents : undefined,
        },
      };

      const createdOrder = await tx.order.create({
        data: {
          albumId: draft.albumId,
          buyerEmail: resolvedBuyerEmail,
          buyerName: resolvedBuyerName,
          buyerPhone: resolvedBuyerPhone,
          status: OrderStatus.PENDING,
          totalCents,
          extensionSurchargeCents:
            extensionSurchargeCents > 0 ? extensionSurchargeCents : undefined,
          origin: OrderOrigin.STANDARD_CHECKOUT,
          checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
          pricingSnapshot,
          // Reutilizamos campo existente de referencia para idempotencia por draft.
          preCompraPaymentRef: `ALBUM_PACK_DRAFT:${draft.id}`,
          items: {
            create: orderPrep.items,
          },
        },
        select: {
          id: true,
          albumId: true,
          buyerEmail: true,
          buyerName: true,
          buyerPhone: true,
          status: true,
          totalCents: true,
          origin: true,
          checkoutPaymentSource: true,
          createdAt: true,
        },
      });

      if (albumPackFulfillmentHasPrint(orderPrep.fulfillmentKind)) {
        const photosById = new Map(
          selectionPhotos.map((row) => [
            row.photoId,
            { id: row.photo.id, originalKey: row.photo.originalKey },
          ])
        );
        const expectedPrintLines = orderPrep.items.filter(
          (item) => item.productType === "PRINT"
        ).length;
        const printMirrorItems = buildAlbumPackPrintMirrorItems(orderPrep.items, photosById);
        if (printMirrorItems.length !== expectedPrintLines || expectedPrintLines === 0) {
          throw new AlbumPackDraftToOrderError(
            "No se pudieron resolver todas las fotos para el pedido de impresión.",
            "PRINT_MIRROR_PHOTOS_INCOMPLETE",
            400
          );
        }
        await createAlbumOrderPrintOrderMirror(tx, {
          albumOrderId: createdOrder.id,
          photographerId: albumForPay?.userId ?? null,
          customerName: resolvedBuyerName,
          customerEmail: resolvedBuyerEmail,
          customerPhone: resolvedBuyerPhone,
          printItems: printMirrorItems,
          pricingSnapshot,
          internalNotesSuffix: `pack ${draft.albumPack.name}`,
        });
      }

      return {
        order: createdOrder,
        draftStatus: AlbumPackOrderDraftStatus.LOCKED,
        packName: draft.albumPack.name,
        photoIds: orderPrep.photoIds,
        reused: false,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    }
  );
}
