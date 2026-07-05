import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/order-claims";
import { Role } from "@/lib/prisma";
import { aggregateExtraUnitClientMins } from "@/lib/preventa-canjeable/public-catalog-extras";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { listUpsellPacksForAlbum } from "@/lib/preventa-canjeable/pack-service";
import {
  mapPackRowToClientDigitalPricing,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { parsePreCompraOrderIdFromPaymentRef } from "@/lib/preventa-canjeable/preventa-redeem-url";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.CUSTOMER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const orderId = Number(params.id);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        origin: true,
        buyerEmail: true,
        buyerUserId: true,
        preventaPackSnapshotJson: true,
        redemptionOrderId: true,
        preCompraPaymentRef: true,
        album: {
          select: {
            id: true,
            publicSlug: true,
            title: true,
            userId: true,
            schoolId: true,
            selectedLabId: true,
          },
        },
      }
    });

    if (!order) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const userEmailNorm = user.email ? normalizeEmail(user.email) : "";
    const orderEmailNorm = order.buyerEmail ? normalizeEmail(order.buyerEmail) : "";
    const isOwner =
      order.buyerUserId === user.id ||
      (order.buyerUserId == null &&
        !!user.emailVerifiedAt &&
        userEmailNorm &&
        userEmailNorm === orderEmailNorm);

    if (!isOwner) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const albumId = order.album?.id ?? null;
    let currentPackId: number | null = null;
    if (order.preventaPackSnapshotJson != null) {
      try {
        const parsed = parsePreventaPackSnapshotV1(order.preventaPackSnapshotJson);
        currentPackId = parsed.packDefinitionId;
      } catch {
        currentPackId = null;
      }
    }
    const hasPhotos =
      albumId != null
        ? (await prisma.photo.count({ where: { albumId, isRemoved: false } })) > 0
        : false;
    const upsellConfig =
      albumId != null
        ? await prisma.albumUpsellConfig.findUnique({
            where: { albumId },
            select: {
              digitalExtraEnabled: true,
              digitalExtraPriceArs: true,
              printExtraEnabled: true,
              printExtraPriceArs: true,
            },
          })
        : null;
    const upsellPackIds = upsellConfig
      ? (
          await prisma.albumUpsellPack.findMany({
            where: { albumId },
            select: { packId: true },
          })
        ).map((p) => p.packId)
      : undefined;
    const packs =
      albumId != null
        ? await listUpsellPacksForAlbum(albumId, new Date(), {
            hasPhotos,
            excludePackId: currentPackId,
          allowedPackIds: upsellPackIds,
          })
        : [];
    const platformPercent = await resolveClientMarketplaceFeePercent({
      photographerId: order.album?.userId ?? null,
      labId: order.album?.selectedLabId ?? null,
    });
    const extrasAggregated = aggregateExtraUnitClientMins(packs, platformPercent);
    const extrasHint =
      hasPhotos && upsellConfig
        ? {
            digitalExtraFromArs: upsellConfig.digitalExtraEnabled
              ? upsellConfig.digitalExtraPriceArs
              : null,
            printExtraFromArs: upsellConfig.printExtraEnabled
              ? upsellConfig.printExtraPriceArs
              : null,
          }
        : hasPhotos
          ? {
              digitalExtraFromArs: extrasAggregated.digitalMin,
              printExtraFromArs: extrasAggregated.printMin,
            }
          : { digitalExtraFromArs: null, printExtraFromArs: null };

    return NextResponse.json({
      ok: true,
      order,
      extrasHint,
      upsellPacks: packs.map((p) => mapPackRowToClientDigitalPricing(p, platformPercent)),
      journey: {
        hasPhotos,
        preCompraOrderId: parsePreCompraOrderIdFromPaymentRef(order.preCompraPaymentRef),
        isSchoolAlbum: order.album?.schoolId != null,
      },
    });
  } catch (err) {
    console.error("[GET /api/orders/[id]]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
