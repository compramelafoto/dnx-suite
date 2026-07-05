import {
  AlbumPackOrderDraftStatus,
  CheckoutPaymentSource,
  OrderOrigin,
  OrderStatus,
  Prisma,
  type PrismaClient,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import type {
  AlbumPackFulfillmentKind,
  AlbumPackOrderSnapshotV2,
} from "@/lib/album-packs/album-pack-composition-types";
import {
  buildAlbumPackCartPaymentRef,
  normalizeAlbumPackCartDraftIds,
} from "@/lib/album-packs/album-pack-cart-payment-ref";
import { isAlbumPackPaymentGloballyAllowedForAlbum } from "@/lib/album-packs/album-pack-feature-flags";
import { albumPackFulfillmentHasPrint } from "@/lib/album-packs/album-pack-fulfillment-helpers";
import { buildAlbumPackPrintMirrorItems } from "@/lib/album-packs/build-album-pack-print-mirror-items";
import { loadAlbumPackPrintProductsById } from "@/lib/album-packs/load-album-pack-print-products";
import {
  AlbumPackOrderCreationPrepError,
  prepareAlbumPackOrderCreation,
  type AlbumPackOrderItemCreateInput,
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
import {
  AlbumPackDraftToOrderError,
  convertAlbumPackDraftToOrder,
} from "@/lib/album-packs/convert-draft-to-order";

export { AlbumPackDraftToOrderError };

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

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
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

async function findExistingOrderByPaymentRef(
  tx: TxClient,
  paymentRef: string
): Promise<DraftOrderSummary | null> {
  const existing = await tx.order.findFirst({
    where: { preCompraPaymentRef: paymentRef },
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

function deriveCombinedFulfillmentKind(
  kinds: AlbumPackFulfillmentKind[]
): AlbumPackFulfillmentKind {
  if (kinds.some((kind) => kind === "MIXED")) return "MIXED";
  const hasPrint = kinds.some((kind) => kind === "PRINT");
  const hasDigital = kinds.some((kind) => kind === "DIGITAL");
  if (hasPrint && hasDigital) return "MIXED";
  if (hasPrint) return "PRINT";
  return "DIGITAL";
}

function buildCombinedPackLabel(packNames: string[]): string {
  if (packNames.length === 0) return "Varios packs";
  const counts = new Map<string, number>();
  for (const name of packNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 1) {
    const [name, count] = [...counts.entries()][0]!;
    return count > 1 ? `${count}× ${name}` : name;
  }
  return `Varios packs (${packNames.length})`;
}

export async function convertAlbumPackDraftsToOrder(params: {
  draftIds: string[];
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
  draftIds: string[];
}> {
  const draftIds = normalizeAlbumPackCartDraftIds(params.draftIds);
  if (draftIds.length === 0) {
    throw new AlbumPackDraftToOrderError(
      "draftIds es obligatorio.",
      "DRAFT_IDS_REQUIRED",
      400
    );
  }

  if (draftIds.length === 1) {
    const single = await convertAlbumPackDraftToOrder({
      draftId: draftIds[0]!,
      guestToken: params.guestToken,
      actorEmail: params.actorEmail,
      buyerEmail: params.buyerEmail,
      buyerName: params.buyerName,
      buyerPhone: params.buyerPhone,
      prismaClient: params.prismaClient,
    });
    return { ...single, draftIds };
  }

  const actorEmail = normalizeEmail(params.actorEmail);
  const guestToken = String(params.guestToken ?? "").trim();
  const db = params.prismaClient ?? prisma;
  const paymentRef = buildAlbumPackCartPaymentRef(draftIds);

  return db.$transaction(
    async (tx) => {
      const existing = await findExistingOrderByPaymentRef(tx, paymentRef);
      if (existing) {
        const draftsForReuse = await Promise.all(
          draftIds.map((draftId) => loadDraftForCreateOrder(tx, draftId))
        );
        const photoIds = draftsForReuse.flatMap((draft) =>
          draft.selectionSession.photos.map((row) => row.photoId)
        );
        return {
          order: existing,
          draftStatus: AlbumPackOrderDraftStatus.LOCKED,
          packName: buildCombinedPackLabel(
            draftsForReuse.map((draft) => draft.albumPack.name)
          ),
          photoIds,
          reused: true,
          draftIds,
        };
      }

      const drafts = await Promise.all(
        draftIds.map((draftId) => loadDraftForCreateOrder(tx, draftId))
      );

      const albumId = drafts[0]!.albumId;
      if (!drafts.every((draft) => draft.albumId === albumId)) {
        throw new AlbumPackDraftToOrderError(
          "Todos los packs deben pertenecer al mismo álbum.",
          "DRAFT_ALBUM_MISMATCH",
          400
        );
      }

      for (const draft of drafts) {
        if (
          draft.status !== AlbumPackOrderDraftStatus.DRAFT &&
          draft.status !== AlbumPackOrderDraftStatus.LOCKED
        ) {
          throw new AlbumPackDraftToOrderError(
            "Hay un pack que ya no está disponible para comprar.",
            "DRAFT_STATUS_INVALID",
            400
          );
        }
        if (draft.selectionSession.status !== "READY") {
          throw new AlbumPackDraftToOrderError(
            "La selección de un pack debe estar confirmada.",
            "SESSION_NOT_READY",
            400
          );
        }
        if (!draft.albumPack.isActive) {
          throw new AlbumPackDraftToOrderError(
            "Hay un pack inactivo en tu compra.",
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
            "No autorizado para convertir uno de los packs.",
            "DRAFT_ACCESS_DENIED",
            403
          );
        }
        if (draft.selectionSession.photos.length <= 0) {
          throw new AlbumPackDraftToOrderError(
            "Hay un pack sin fotos seleccionadas.",
            "DRAFT_WITHOUT_PHOTOS",
            400
          );
        }
        for (const row of draft.selectionSession.photos) {
          if (row.photo.isRemoved || row.photo.albumId !== draft.albumId) {
            throw new AlbumPackDraftToOrderError(
              "Hay fotos inválidas en uno de los packs.",
              "DRAFT_PHOTO_INVALID",
              400
            );
          }
        }
      }

      let resolvedBuyerEmail = "";
      let resolvedBuyerName: string | null = null;
      let resolvedBuyerPhone: string | null = null;

      for (const draft of drafts) {
        const draftEmail = normalizeEmail(draft.buyerEmail);
        if (draftEmail) {
          resolvedBuyerEmail = draftEmail;
          resolvedBuyerName = draft.buyerName ?? resolvedBuyerName;
          resolvedBuyerPhone = draft.buyerPhone ?? resolvedBuyerPhone;
          break;
        }
      }
      if (!resolvedBuyerEmail) resolvedBuyerEmail = actorEmail;

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

      for (const draft of drafts) {
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
      }

      const albumForPay = await tx.album.findUnique({
        where: { id: albumId },
        select: { albumPackPayEnabled: true, userId: true },
      });
      if (!isAlbumPackPaymentGloballyAllowedForAlbum(albumForPay?.albumPackPayEnabled)) {
        throw new AlbumPackDraftToOrderError(
          "El pago de packs no está habilitado para este álbum.",
          "ALBUM_PACK_PAY_DISABLED",
          403
        );
      }

      for (const draft of drafts) {
        const lock = await tx.albumPackOrderDraft.updateMany({
          where: {
            id: draft.id,
            status: { in: [AlbumPackOrderDraftStatus.DRAFT, AlbumPackOrderDraftStatus.LOCKED] },
          },
          data: { status: AlbumPackOrderDraftStatus.LOCKED },
        });
        if (lock.count !== 1) {
          throw new AlbumPackDraftToOrderError(
            "No se pudo bloquear uno de los packs para crear el pedido.",
            "DRAFT_LOCK_FAILED",
            409
          );
        }
      }

      const allItems: AlbumPackOrderItemCreateInput[] = [];
      const allPhotoIds: number[] = [];
      const packNames: string[] = [];
      const fulfillmentKinds: AlbumPackFulfillmentKind[] = [];
      const packSnapshots: AlbumPackOrderSnapshotV2[] = [];
      const allPrintMirrorItems: ReturnType<typeof buildAlbumPackPrintMirrorItems> = [];
      let combinedClientSubtotalArs = 0;
      let basePriceArs = 0;
      let marketplaceFeeCents = 0;
      let marketplaceFeePercent = 0;

      for (const draft of drafts) {
        const photoIds = draft.selectionSession.photos.map((row) => row.photoId);
        const packPricing = readAlbumPackDraftPricing(draft);
        const packClientSubtotalArs = albumPackClientPriceArs(
          packPricing.basePriceArs,
          packPricing.marketplaceFeePercent
        );
        if (packClientSubtotalArs <= 0) {
          throw new AlbumPackDraftToOrderError(
            "Uno de los packs tiene un total inválido.",
            "DRAFT_TOTAL_INVALID",
            400
          );
        }
        combinedClientSubtotalArs += packClientSubtotalArs;
        basePriceArs += packPricing.basePriceArs;
        marketplaceFeeCents += packPricing.marketplaceFeeCents;
        marketplaceFeePercent = Math.max(
          marketplaceFeePercent,
          packPricing.marketplaceFeePercent
        );

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
              totalCents: packClientSubtotalArs,
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

        allItems.push(...orderPrep.items);
        allPhotoIds.push(...orderPrep.photoIds);
        packNames.push(draft.albumPack.name);
        fulfillmentKinds.push(orderPrep.fulfillmentKind);
        packSnapshots.push(orderPrep.pricingSnapshot);

        if (albumPackFulfillmentHasPrint(orderPrep.fulfillmentKind)) {
          const photosById = new Map(
            draft.selectionSession.photos.map((row) => [
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
          allPrintMirrorItems.push(...printMirrorItems);
        }
      }

      const extensionTotals = await resolveAlbumPackOrderExtensionTotals(tx, {
        albumId,
        clientSubtotalArs: combinedClientSubtotalArs,
      });
      const totalCents = extensionTotals.totalCents;
      const extensionSurchargeCents = extensionTotals.extensionSurchargeCents;

      const combinedPackName = buildCombinedPackLabel(packNames);
      const pricingSnapshot: Prisma.InputJsonValue = {
        schemaVersion: 2,
        type: "ALBUM_PACK_ORDER_V2",
        albumPackId: drafts[0]!.albumPack.id,
        packName: combinedPackName,
        selectionMode: packSnapshots[0]?.selectionMode ?? "FIXED",
        fulfillmentKind: deriveCombinedFulfillmentKind(fulfillmentKinds),
        components: packSnapshots.flatMap((snapshot) => snapshot.components),
        photoIds: allPhotoIds,
        pricing: {
          totalCents,
          basePriceArs,
          marketplaceFeePercent,
          marketplaceFeeCents,
          clientTotalArs: combinedClientSubtotalArs,
          extensionPricingActive: extensionTotals.extensionPricing.active,
          extensionSurchargeArs:
            extensionSurchargeCents > 0 ? extensionSurchargeCents : undefined,
        },
        createdAt: new Date().toISOString(),
        source: "ALBUM_PACK_ORDER_DRAFT",
        draftId: draftIds[0],
        cartDraftIds: draftIds,
        packEntries: packSnapshots.map((snapshot, index) => ({
          draftId: draftIds[index],
          packName: snapshot.packName,
          albumPackId: snapshot.albumPackId,
          photoIds: snapshot.photoIds,
          pricing: snapshot.pricing,
        })),
      };

      const createdOrder = await tx.order.create({
        data: {
          albumId,
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
          preCompraPaymentRef: paymentRef,
          items: {
            create: allItems,
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

      if (allPrintMirrorItems.length > 0) {
        await createAlbumOrderPrintOrderMirror(tx, {
          albumOrderId: createdOrder.id,
          photographerId: albumForPay?.userId ?? null,
          customerName: resolvedBuyerName,
          customerEmail: resolvedBuyerEmail,
          customerPhone: resolvedBuyerPhone,
          printItems: allPrintMirrorItems,
          pricingSnapshot,
          internalNotesSuffix: combinedPackName,
        });
      }

      return {
        order: createdOrder,
        draftStatus: AlbumPackOrderDraftStatus.LOCKED,
        packName: combinedPackName,
        photoIds: allPhotoIds,
        reused: false,
        draftIds,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    }
  );
}
