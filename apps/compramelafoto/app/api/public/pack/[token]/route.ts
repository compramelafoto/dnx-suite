import { NextResponse } from "next/server";
import { OrderOrigin } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { aggregateExtraUnitClientMins } from "@/lib/preventa-canjeable/public-catalog-extras";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { listUpsellPacksForAlbum } from "@/lib/preventa-canjeable/pack-service";
import {
  mapPackRowToClientDigitalPricing,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import { parsePreCompraOrderIdFromPaymentRef } from "@/lib/preventa-canjeable/preventa-redeem-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const { token } = await params;
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) {
    const status = lookup.error === "invalid" ? 404 : 410;
    return NextResponse.json({ error: "token_invalid" }, { status });
  }

  const order = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: {
      id: true,
      status: true,
      origin: true,
      totalCents: true,
      redemptionOrderId: true,
      preventaPackSnapshotJson: true,
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
    },
  });

  if (!order || order.origin !== OrderOrigin.PREVENTA_PACK) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "pack_not_paid" }, { status: 409 });
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
  scheduleCheckoutFeeShadowCompare({
    site: "pack.gallery.public-token",
    legacyFeePercent: platformPercent,
    resolveInput: {
      component: "DIGITAL",
      flow: "PACK_REDEMPTION",
      purpose: "MARKETPLACE_FEE_TOTAL",
      photographerId: order.album?.userId ?? null,
      labId: order.album?.selectedLabId ?? null,
      albumId,
      orderOrigin: "PACK_REDEMPTION",
    },
    orderId: order.id,
    albumId,
    photographerId: order.album?.userId ?? null,
    labId: order.album?.selectedLabId ?? null,
    totalArsForEstimate: order.totalCents,
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
}
