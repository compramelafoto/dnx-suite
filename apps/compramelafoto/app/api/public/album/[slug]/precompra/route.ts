import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBenefitPublicShortLine } from "@/lib/preventa-canjeable/benefit-copy";
import { aggregateExtraUnitClientMins } from "@/lib/preventa-canjeable/public-catalog-extras";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import {
  buildClientDigitalPackPricing,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { getPreventaMode, isSchoolAlbum } from "@/lib/preventa-canjeable/preventa-mode";
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
 * GET /api/public/album/[slug]/precompra
 * Catálogo público de pre-venta (packs preventa canjeable), basado en vigencia de packs.
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
        isTest: true,
        title: true,
        publicSlug: true,
        requireClientApproval: true,
        schoolId: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: true,
        organizerCommissionAppliesTo: true,
        user: { select: { id: true, name: true, logoUrl: true } },
        selectedLab: { select: { id: true, name: true, logoUrl: true } },
        school: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            courses: {
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { division: "asc" }],
              select: { id: true, name: true, division: true },
            },
          },
        },
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

    // Regla única: SCHOOL cuando album.schoolId != null
    const isSchool = isSchoolAlbum(album);
    const preventaMode = getPreventaMode(album);
    const courses = album.school?.courses ?? [];
    const photoCount = await prisma.photo.count({
      where: { albumId: album.id, isRemoved: false },
    });
    const hasPhotos = photoCount > 0;

    const packRows = await listActivePacksForPublicCatalog(album.id, now, {
      hasPhotos,
    });
    const platformPercent = await resolveClientMarketplaceFeePercent({
      photographerId: album.userId ?? album.user?.id ?? null,
      labId: album.selectedLab?.id ?? null,
    });
    scheduleCheckoutFeeShadowCompare({
      site: "preventa.public-precompra-catalog",
      legacyFeePercent: platformPercent,
      resolveInput: {
        component: "DIGITAL",
        flow: "PREVENTA_PACK",
        purpose: "DISPLAY",
        photographerId: album.userId ?? album.user?.id ?? null,
        labId: album.selectedLab?.id ?? null,
        albumId: album.id,
        orderOrigin: "PREVENTA_PACK",
      },
      albumId: album.id,
      photographerId: album.userId ?? album.user?.id ?? null,
      labId: album.selectedLab?.id ?? null,
      hasOrganizer: isSchoolAlbum(album),
    });
    const extrasAggregated = aggregateExtraUnitClientMins(packRows, platformPercent);
    const upsellConfig = await prisma.albumUpsellConfig.findUnique({
      where: { albumId: album.id },
      select: {
        digitalExtraEnabled: true,
        digitalExtraPriceArs: true,
        printExtraEnabled: true,
        printExtraPriceArs: true,
      },
    });
    const sharedPackCloseAt = getSharedPackCloseAt(packRows);
    const packs = packRows.map((p) => {
      const pricing = buildClientDigitalPackPricing(p.priceClientArs, platformPercent);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        coverImageUrl: p.coverImageUrl ?? null,
        price: pricing.clientPriceArs,
        basePriceArs: pricing.basePriceArs,
        marketplaceFeePercent: pricing.marketplaceFeePercent,
        marketplaceFeeArs: pricing.marketplaceFeeArs,
        clientPriceArs: pricing.clientPriceArs,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        redemptionDeadlineAt: p.redemptionDeadlineAt,
        benefits: p.benefits.map((b) => ({
          line: buildBenefitPublicShortLine({
            kind: b.kind,
            includedQuantity: b.includedQuantity,
            selectionMode: b.selectionMode,
            requiredPhotoCount: b.requiredPhotoCount,
            photographerProductName: b.photographerProduct?.name ?? null,
          }),
        })),
      };
    });

    if (packs.length === 0) {
      return NextResponse.json(
        { error: "No hay packs de preventa disponibles para este álbum" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      album: {
        id: album.id,
        title: album.title,
        publicSlug: album.publicSlug,
        preCompraCloseAt: sharedPackCloseAt,
        requireClientApproval: album.requireClientApproval,
        photographer: album.user,
        lab: album.selectedLab ?? null,
        schoolId: album.schoolId,
        studentIdentificationMode: album.studentIdentificationMode ?? null,
        allowManualStudentFallback: Boolean(album.allowManualStudentFallback),
        organizerCommissionEnabled: Boolean(album.organizerCommissionEnabled),
        organizerCommissionPercentage: album.organizerCommissionPercentage ?? null,
        organizerCommissionAppliesTo: album.organizerCommissionAppliesTo ?? [],
        isSchool,
        preventaMode,
        isTestPreview: testGate.isTestPreview,
        school: isSchool
          ? {
              id: album.school!.id,
              name: album.school!.name,
              logoUrl: album.school!.logoUrl ?? null,
              courses,
            }
          : null,
      },
      packs,
      extrasHint: upsellConfig
        ? {
            digitalExtraFromArs: upsellConfig.digitalExtraEnabled
              ? upsellConfig.digitalExtraPriceArs
              : null,
            printExtraFromArs: upsellConfig.printExtraEnabled
              ? upsellConfig.printExtraPriceArs
              : null,
          }
        : {
            digitalExtraFromArs: extrasAggregated.digitalMin,
            printExtraFromArs: extrasAggregated.printMin,
          },
    });
  } catch (e) {
    console.error("precompra catalog error:", e);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}
