import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPreventaTermsDocument } from "@/lib/preventa-canjeable/build-public-preventa-terms";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { listActivePackDefinitionsWithBenefitsForPublicTerms } from "@/lib/preventa-canjeable/pack-service";
import { buildPostCheckoutPriceRowsForPreventaTerms } from "@/lib/preventa-canjeable/preventa-terms-post-checkout";
import { isSchoolAlbum } from "@/lib/preventa-canjeable/preventa-mode";
import { gateTestAlbumPublicAccess } from "@/lib/public-album-test-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSharedPackCloseAt(packs: Array<{ validUntil: Date | null }>): Date | null {
  const dates = packs.map((p) => p.validUntil).filter(Boolean) as Date[];
  if (dates.length === 0) return null;
  const uniq = new Set(dates.map((d) => d.getTime()));
  if (uniq.size !== 1) return null;
  return new Date([...uniq][0]);
}

/**
 * GET /api/public/album/[slug]/preventa-terms
 * Términos dinámicos para la página pública de pre-venta (solo packs preventa canjeable).
 * Misma disponibilidad de álbum que GET /precompra (packs vigentes).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
    }

    const now = new Date();
    const album = await prisma.album.findFirst({
      where: {
        publicSlug: slug.trim(),
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        isTest: true,
        title: true,
        preCompraCloseAt: true,
        requireClientApproval: true,
        digitalPhotoPriceCents: true,
        enableDigitalPhotos: true,
        enablePrintedPhotos: true,
        enableFaceBulkPurchase: true,
        faceBulkPriceCents: true,
        albumProfitMarginPercent: true,
        printPricingSource: true,
        selectedLabId: true,
        user: { select: { id: true } },
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado o pre-venta cerrada" }, { status: 404 });
    }

    const testGate = await gateTestAlbumPublicAccess({
      isTest: album.isTest,
      userId: album.userId,
    });
    if (!testGate.ok) {
      return testGate.response;
    }

    const photoCount = await prisma.photo.count({
      where: { albumId: album.id, isRemoved: false },
    });
    const hasPhotos = photoCount > 0;
    const packRowsAll = await listActivePackDefinitionsWithBenefitsForPublicTerms(album.id, {
      hasPhotos,
    });
    const packRows = packRowsAll.filter(
      (p) =>
        (p.validFrom == null || p.validFrom <= now) && (p.validUntil == null || p.validUntil >= now)
    );
    if (packRows.length === 0) {
      return NextResponse.json({ error: "No hay packs de preventa disponibles para este álbum" }, { status: 404 });
    }
    const platformPercent = await resolveClientMarketplaceFeePercent({
      photographerId: album.userId ?? album.user?.id ?? null,
      labId: album.selectedLabId ?? null,
    });
    scheduleCheckoutFeeShadowCompare({
      site: "preventa.public-terms",
      legacyFeePercent: platformPercent,
      resolveInput: {
        component: "DIGITAL",
        flow: "PREVENTA_PACK",
        purpose: "DISPLAY",
        photographerId: album.userId ?? album.user?.id ?? null,
        labId: album.selectedLabId ?? null,
        albumId: album.id,
        orderOrigin: "PREVENTA_PACK",
      },
      albumId: album.id,
      photographerId: album.userId ?? album.user?.id ?? null,
      labId: album.selectedLabId ?? null,
      hasOrganizer: isSchoolAlbum(album),
    });
    const sharedPackCloseAt = getSharedPackCloseAt(packRows);
    const packs = packRows.map((p) => ({
      name: p.name,
      description: p.description,
      priceClientArs: clientTotalFromPhotographerBaseArs(p.priceClientArs, platformPercent),
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      redemptionDeadlineAt: p.redemptionDeadlineAt,
      benefits: p.benefits.map((b) => {
        const product = b.photographerProduct;
        const photographerProductLabel = product
          ? `${product.name}${product.size ? ` · ${product.size}` : ""}`
          : null;
        return {
          kind: b.kind,
          includedQuantity: b.includedQuantity,
          selectionMode: b.selectionMode,
          requiredPhotoCount: b.requiredPhotoCount,
          maxPhotosPerUnit: b.maxPhotosPerUnit,
          templatePolicy: b.templatePolicy,
          templateName: b.template?.name ?? null,
          photographerProductLabel,
          extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs,
          regularUnitPriceAfterPreventaArs: b.regularUnitPriceAfterPreventaArs ?? null,
        };
      }),
    }));

    const postCheckoutPriceRows = await buildPostCheckoutPriceRowsForPreventaTerms({
      photographerId: album.user?.id ?? null,
      digitalPhotoPriceCents: album.digitalPhotoPriceCents ?? null,
      enableDigitalPhotos: album.enableDigitalPhotos ?? true,
      enablePrintedPhotos: album.enablePrintedPhotos ?? true,
      enableFaceBulkPurchase: Boolean(album.enableFaceBulkPurchase),
      faceBulkPriceCents: album.faceBulkPriceCents ?? null,
      albumProfitMarginPercent: album.albumProfitMarginPercent ?? null,
      printPricingSource: album.printPricingSource,
      selectedLabId: album.selectedLabId ?? null,
    });

    const sections = buildPreventaTermsDocument({
      albumTitle: album.title,
      preCompraCloseAt: sharedPackCloseAt ?? album.preCompraCloseAt,
      requireClientApproval: album.requireClientApproval,
      legacyProducts: [],
      packs,
      platformFeePercent: platformPercent,
      postCheckoutPriceRows,
    });

    return NextResponse.json({ sections });
  } catch (e) {
    console.error("preventa-terms GET:", e);
    return NextResponse.json({ error: "Error al generar términos" }, { status: 500 });
  }
}
