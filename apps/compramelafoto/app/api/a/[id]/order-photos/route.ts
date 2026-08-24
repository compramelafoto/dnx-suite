import { NextRequest, NextResponse } from "next/server";
import {
  isLegacyAlbumDigitalSalesEnabled,
  isLegacyAlbumPrintSalesEnabled,
} from "@/lib/albums/album-sale-channels";
import { prisma } from "@/lib/prisma";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { getAppConfig } from "@/lib/services/settingsService";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import {
  albumSalesNotReadyResponse,
  isAlbumReadyToSellForCheckout,
} from "@/lib/albums/album-sales-readiness-server";
import { getAuthUser } from "@/lib/auth";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import { getAlbumDigitalClientFeePercent } from "@/lib/pricing/print-pricing";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { getPlatformFeePercent } from "@/lib/pricing/print-pricing";
import {
  getAlbumExtensionDays,
  isAlbumExtensionPricingActive,
  loadAlbumExtensionSurchargeModeForPhotographer,
} from "@/lib/pricing/album-extension-surcharge";
import {
  isCheckoutFeeShadowModeEnabled,
  scheduleCheckoutFeeShadowCompare,
} from "@/lib/pricing/checkout-fee-shadow";
import {
  fetchCollaborativeEventPricingForAudit,
  isEventPhotoPricingAuditEnabled,
  logEventDigitalPhotoPricingAuditDifference,
} from "@/lib/pricing/event-photo-pricing-audit";
import { resolveEventDigitalPhotoBasePrice } from "@/lib/pricing/event-digital-photo-price-resolver";
import { denyIfTestAlbumNotOwnerPreview } from "@/lib/public-album-test-access";
import { resolveCheckoutOrderPhotoThumbUrl } from "@/lib/images/order-photo-thumb-url";

async function buildOrderPhotosResponse(albumId: number, photoIds: number[], debugCheckout = false) {
  const startedAt = Date.now();
  console.info("[order-photos] start", { albumId, photoIdsCount: photoIds.length });
  const testRow = await prisma.album.findUnique({
    where: { id: albumId },
    select: { isTest: true, userId: true },
  });
  if (!testRow) {
    return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
  }
  const testDenyOrderPhotos = await denyIfTestAlbumNotOwnerPreview(testRow);
  if (testDenyOrderPhotos) return testDenyOrderPhotos;

  // Intentar cargar con selectedLab, si falla cargar sin él (schema no actualizado)
  let album: any;
  try {
    album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        user: { 
          select: { 
            id: true,
            preferredLabId: true, 
            profitMarginPercent: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
            logoUrl: true,
            secondaryColor: true,
            tertiaryColor: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
          } 
        },
        selectedLab: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
          },
        },
        photos: { where: { id: { in: photoIds }, isRemoved: false }, select: { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true } },
      },
    });
  } catch (includeError: any) {
    // Si falla por selectedLab o isRemoved, intentar sin ellos
    const missingSelectedLab = includeError?.message?.includes("selectedLab");
    const missingIsRemoved = includeError?.message?.includes("isRemoved");
    const isSchemaError = missingSelectedLab || missingIsRemoved || includeError?.message?.includes("Unknown argument");
    
    if (isSchemaError) {
      console.warn("Schema no actualizado, cargando álbum sin campos nuevos");
      try {
        const photosSelect = missingIsRemoved
          ? { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true }
          : { id: true, previewUrl: true, originalKey: true, isRemoved: true, userId: true, sellDigital: true, sellPrint: true };

        album = await prisma.album.findUnique({
          where: { id: albumId },
          include: {
            user: { 
              select: { 
                id: true,
                preferredLabId: true, 
                profitMarginPercent: true,
                name: true,
                phone: true,
                address: true,
                city: true,
                province: true,
                country: true,
                logoUrl: true,
                secondaryColor: true,
                tertiaryColor: true,
                isPublicPageEnabled: true,
                publicPageHandler: true,
              } 
            },
            photos: { 
              where: { id: { in: photoIds } }, 
              select: photosSelect,
            },
          },
        });
        // Agregar selectedLab como null si no existe y filtrar fotos removidas
        if (album) {
          album.selectedLab = null;
          if (album.photos && !missingIsRemoved) {
            album.photos = album.photos.filter((p: any) => !p.isRemoved);
          }
        }
      } catch (secondError: any) {
        // Fallback final: cargar con queries mínimos para evitar columnas inexistentes
        console.warn("Fallback mínimo por schema desfasado:", secondError?.message || secondError);
        const albumBasic = await prisma.album.findUnique({
          where: { id: albumId },
          select: {
            id: true,
            userId: true,
            createdAt: true,
            isPublic: true,
            isHidden: true,
            enablePrintedPhotos: true,
            enableDigitalPhotos: true,
            selectedLabId: true,
            albumProfitMarginPercent: true,
            pickupBy: true,
            digitalPhotoPriceCents: true,
            includeDigitalWithPrint: true,
            digitalWithPrintDiscountPercent: true,
            termsAcceptedAt: true,
            termsVersion: true,
          },
        });
        if (!albumBasic) {
          return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
        }
        const photosBasic = await prisma.photo.findMany({
          where: { albumId, id: { in: photoIds } },
          select: { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true },
        });
        const userBasic = albumBasic.userId
          ? await prisma.user.findUnique({
              where: { id: albumBasic.userId },
              select: { id: true, name: true, phone: true, address: true, city: true, province: true, country: true },
            })
          : null;

        album = {
          ...albumBasic,
          user: userBasic,
          selectedLab: null,
          photos: photosBasic,
        };
      }
    } else {
      throw includeError;
    }
  }

  if (!album) {
    return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
  }

  let eventId = (album as { eventId?: number | null }).eventId ?? null;
  if (eventId === null || eventId === undefined) {
    const eventRow = await prisma.album.findUnique({
      where: { id: albumId },
      select: { eventId: true },
    });
    eventId = eventRow?.eventId ?? null;
  }

  const salesReady = await isAlbumReadyToSellForCheckout({
    userId: album.userId,
    enableDigitalPhotos: album.enableDigitalPhotos,
    enablePrintedPhotos: album.enablePrintedPhotos,
    digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    albumProfitMarginPercent: album.albumProfitMarginPercent,
    selectedLabId: album.selectedLabId,
    pickupBy: album.pickupBy,
    printPricingSource: album.printPricingSource,
    termsAcceptedAt: album.termsAcceptedAt,
    termsVersion: album.termsVersion,
  });
  if (!salesReady) {
    if (eventId) {
      // Permitir checkout en galerías colaborativas aunque la venta del álbum no esté lista.
    } else {
      return albumSalesNotReadyResponse();
    }
  }

  if (!isAlbumPubliclyAccessible(album)) {
    const authUser = await getAuthUser();
    const isOwner = authUser?.id === album.userId;
    const hasAccess = authUser
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId, userId: authUser.id } },
        })
      : null;
    if (!isOwner && !hasAccess) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
    }
  }

  const fallbackUploaderId = album.user?.id ?? album.userId ?? null;
  const uploaderIds = Array.from(
    new Set(
      (album.photos || [])
        .map((p: { userId?: number | null }) => p.userId ?? fallbackUploaderId)
        .filter((id: number | null) => Number.isFinite(id as number))
    )
  ) as number[];
  const uploaderUsers = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, defaultDigitalPhotoPrice: true },
      })
    : [];
  const appConfig = await getAppConfig();
  const platformMinDigital = appConfig?.minDigitalPhotoPrice ?? 5000;
  const uploaderDigitalMap = new Map<number, number | null>();
  uploaderUsers.forEach((u) => uploaderDigitalMap.set(u.id, u.defaultDigitalPhotoPrice ?? platformMinDigital));

  // Álbum colaborativo: cada fotógrafo define su precio (defaultDigitalPhotoPrice).
  // Solo las fotos del dueño del álbum usan el precio del álbum cuando está configurado.
  const albumOwnerId = album.user?.id ?? album.userId ?? null;
  const albumDigitalPriceCents = (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents;
  const albumHasPrice = albumDigitalPriceCents != null && albumDigitalPriceCents > 0;

  /** Datos Event para quote (13C) y auditoría (13B) cuando existe eventId. */
  let collaborativeEventPricing:
    | Awaited<ReturnType<typeof fetchCollaborativeEventPricingForAudit>>
    | null = null;
  /** Default del dueño del álbum; usado sólo cuando hay política del evento. */
  let albumOwnerDefaultForResolver:
    | { defaultDigitalPhotoPrice: number | null }
    | undefined;

  if (eventId != null && eventId > 0) {
    collaborativeEventPricing =
      await fetchCollaborativeEventPricingForAudit(eventId);
    if (collaborativeEventPricing != null && albumOwnerId != null) {
      const ownerDefaults = await prisma.user.findUnique({
        where: { id: albumOwnerId },
        select: { defaultDigitalPhotoPrice: true },
      });
      if (ownerDefaults) {
        albumOwnerDefaultForResolver = {
          defaultDigitalPhotoPrice: ownerDefaults.defaultDigitalPhotoPrice ?? null,
        };
      }
    }
  }

  const auditCollaborativeEventRow =
    isEventPhotoPricingAuditEnabled() ? collaborativeEventPricing : null;
  const albumOwnerDefaultsForAudit = isEventPhotoPricingAuditEnabled()
    ? albumOwnerDefaultForResolver
    : undefined;

  // Paso 13C: el quote ya muestra precio de evento, pero el checkout real todavía se validará/aplicará en Paso 13D.

  const foundPhotoIds = new Set(
    (album.photos || []).map((p: { id: number }) => p.id)
  );
  const missingPhotos = photoIds.filter((id) => !foundPhotoIds.has(id));
  console.info("[order-photos] foundPhotosCount", {
    albumId,
    foundPhotosCount: foundPhotoIds.size,
    requestedCount: photoIds.length,
  });
  if (missingPhotos.length > 0) {
    console.warn("[order-photos] missingPhotos", {
      albumId,
      missingCount: missingPhotos.length,
    });
  }

  if (photoIds.length > 0 && foundPhotoIds.size === 0) {
    return NextResponse.json(
      {
        error: "Algunas fotos ya no están disponibles",
        code: "photos_unavailable",
        missingPhotoIds: missingPhotos,
      },
      { status: 404 }
    );
  }

  const files = album.photos.map((p: { id: number; previewUrl: string; originalKey: string; userId?: number | null; sellDigital?: boolean; sellPrint?: boolean }) => {
    const uploaderId = p.userId ?? fallbackUploaderId;
    const url = resolveCheckoutOrderPhotoThumbUrl({
      photoId: p.id,
      albumId,
      storedPreviewUrl: p.previewUrl,
    });
    const uploaderPrice = uploaderId ? uploaderDigitalMap.get(uploaderId) ?? null : null;
    // Fotógrafo dueño: precio del álbum. Colaboradores: precio individual de cada uno.
    const legacyQuotePrice = (uploaderId === albumOwnerId && albumHasPrice)
      ? albumDigitalPriceCents
      : uploaderPrice;

    const legacyPriceNum =
      typeof legacyQuotePrice === "number" && Number.isFinite(legacyQuotePrice)
        ? Math.round(legacyQuotePrice)
        : 0;

    const uploaderRow = uploaderId
      ? uploaderUsers.find((u) => u.id === uploaderId)
      : undefined;

    if (auditCollaborativeEventRow != null && eventId != null && eventId > 0) {
      logEventDigitalPhotoPricingAuditDifference({
        kind: "quote_override_detected",
        albumId,
        eventId,
        collaborativeEvent: auditCollaborativeEventRow,
        legacyBasePricePesos: legacyPriceNum,
        album: { digitalPhotoPriceCents: albumDigitalPriceCents ?? undefined },
        albumOwnerUser: albumOwnerDefaultsForAudit,
        uploaderUser: uploaderRow
          ? {
              defaultDigitalPhotoPrice: uploaderRow.defaultDigitalPhotoPrice ?? null,
            }
          : undefined,
        photoId: p.id,
        photo: { id: p.id },
        globalMinimumPrice:
          typeof platformMinDigital === "number" &&
          Number.isFinite(platformMinDigital)
            ? platformMinDigital
            : null,
      });
    }

    let uploaderDigitalPriceCentsQuote: number | null =
      typeof legacyQuotePrice === "number" && Number.isFinite(legacyQuotePrice)
        ? Math.round(legacyQuotePrice)
        : null;

    if (collaborativeEventPricing != null && eventId != null && eventId > 0) {
      const resolution = resolveEventDigitalPhotoBasePrice({
        album: { digitalPhotoPriceCents: albumDigitalPriceCents ?? undefined },
        event: collaborativeEventPricing,
        currentResolvedBasePrice: legacyPriceNum,
        albumOwnerUser: albumOwnerDefaultForResolver,
        uploaderUser: uploaderRow
          ? {
              defaultDigitalPhotoPrice: uploaderRow.defaultDigitalPhotoPrice ?? null,
            }
          : undefined,
        photo: { id: p.id },
        globalMinimumPrice:
          typeof platformMinDigital === "number" &&
          Number.isFinite(platformMinDigital)
            ? platformMinDigital
            : null,
      });

      uploaderDigitalPriceCentsQuote = Math.round(resolution.basePrice);

      if (
        resolution.appliedRule === "ORGANIZER_FIXED" ||
        resolution.appliedRule === "ORGANIZER_MINIMUM"
      ) {
        console.info("[event-photo-pricing] quote_applied", {
          albumId,
          eventId,
          photoId: p.id,
          previousPrice: legacyPriceNum,
          appliedPrice: Math.round(resolution.basePrice),
          appliedRule: resolution.appliedRule,
          reason: resolution.reason,
        });
      }
    }

    return {
      fileKey: albumPhotoFileKey(p.id),
      url,
      originalName: `foto-${p.id}.jpg`,
      uploaderId: uploaderId ?? null,
      uploaderDigitalPriceCents: uploaderDigitalPriceCentsQuote,
      sellDigital: p.sellDigital ?? true,
      sellPrint: p.sellPrint ?? true,
    };
  });

  const u = album.user as { 
    id?: number;
    preferredLabId?: number | null; 
    profitMarginPercent?: number | null;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    logoUrl?: string | null;
    secondaryColor?: string | null;
    tertiaryColor?: string | null;
    isPublicPageEnabled?: boolean;
    publicPageHandler?: string | null;
  } | null;
  
  const profitMargin = (album as { albumProfitMarginPercent?: number | null }).albumProfitMarginPercent
    ?? u?.profitMarginPercent ?? 0;

  const selectedLabId = (album as { selectedLabId?: number | null }).selectedLabId ?? u?.preferredLabId ?? null;
  const pickupBy = (album as { pickupBy?: "CLIENT" | "PHOTOGRAPHER" | null }).pickupBy ?? "CLIENT";

  let platformPercent = 10;
  try {
    platformPercent = await resolvePlatformCommissionPercent({
      photographerId: u?.id ?? album.userId ?? null,
      labId: selectedLabId,
    });
  } catch (configError) {
    console.warn("No se pudo resolver el fee de plataforma, usando valor por defecto:", configError);
  }
  const baseDate = (album as { firstPhotoDate?: Date | null }).firstPhotoDate || (album as { createdAt?: Date }).createdAt;
  const extensionDays = getAlbumExtensionDays({
    firstPhotoDate: (album as { firstPhotoDate?: Date | null }).firstPhotoDate,
    createdAt: (album as { createdAt?: Date }).createdAt,
    expirationExtensionDays: (album as { expirationExtensionDays?: number | null }).expirationExtensionDays,
  });
  const baseEnd = baseDate ? new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const extensionEnd = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const extensionPricingActive = isAlbumExtensionPricingActive({
    firstPhotoDate: (album as { firstPhotoDate?: Date | null }).firstPhotoDate,
    createdAt: (album as { createdAt?: Date }).createdAt,
    expirationExtensionDays: (album as { expirationExtensionDays?: number | null }).expirationExtensionDays,
    },
    now
  );
  const extensionSurchargeMode =
    extensionPricingActive && (u?.id ?? album.userId)
      ? await loadAlbumExtensionSurchargeModeForPhotographer(
          prisma,
          u?.id ?? album.userId!
        )
      : null;
  const extensionDaysRemaining = extensionEnd
    ? Math.max(0, Math.ceil((extensionEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  let digitalClientFeePercent = 10;
  try {
    digitalClientFeePercent = await resolveAlbumOrderDigitalMarketplaceFeePercent({
      photographerId: u?.id ?? album.userId ?? null,
      labId: selectedLabId,
    });
  } catch {
    try {
      digitalClientFeePercent = await getAlbumDigitalClientFeePercent();
    } catch {
      /* default */
    }
  }

  const photographerIdForFee = u?.id ?? album.userId ?? null;
  scheduleCheckoutFeeShadowCompare({
    site: "order-photos.digital-client-fee",
    legacyFeePercent: digitalClientFeePercent,
    resolveInput: {
      component: "DIGITAL",
      flow: "ALBUM_ORDER",
      purpose: "DISPLAY",
      photographerId: photographerIdForFee,
      labId: selectedLabId,
      albumId,
    },
    albumId,
    photographerId: photographerIdForFee,
    labId: selectedLabId,
  });
  if (isCheckoutFeeShadowModeEnabled()) {
    try {
      const engineLineFeePercent = await getPlatformFeePercent();
      scheduleCheckoutFeeShadowCompare({
        site: "order-photos.pricing-engine-digital-line",
        legacyFeePercent: engineLineFeePercent,
        resolveInput: {
          component: "DIGITAL",
          flow: "ALBUM_ORDER",
          purpose: "CLIENT_LINE_UNIT",
          photographerId: photographerIdForFee,
          labId: selectedLabId,
          albumId,
        },
        albumId,
        photographerId: photographerIdForFee,
        labId: selectedLabId,
      });
    } catch {
      /* shadow only */
    }
  }

  const pricing = {
    photographerId: u?.id ?? null,
    digitalPhotoPriceCents: (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents ?? null,
    /** % fee sobre precio base digital (mismo criterio que `pricing-engine` para líneas digitales). */
    digitalClientFeePercent,
    enableFaceBulkPurchase: Boolean((album as { enableFaceBulkPurchase?: boolean }).enableFaceBulkPurchase),
    faceBulkPriceCents:
      typeof (album as { faceBulkPriceCents?: number | null }).faceBulkPriceCents === "number"
        ? (album as { faceBulkPriceCents: number }).faceBulkPriceCents
        : null,
    preferredLabId: selectedLabId,
    selectedLabId: selectedLabId,
    profitMarginPercent: Number(profitMargin) || 0,
    pickupBy,
    enablePrintedPhotos: isLegacyAlbumPrintSalesEnabled(
      (album as { enablePrintedPhotos?: boolean | null }).enablePrintedPhotos
    ),
    enableDigitalPhotos: isLegacyAlbumDigitalSalesEnabled(
      (album as { enableDigitalPhotos?: boolean | null }).enableDigitalPhotos
    ),
    includeDigitalWithPrint: (album as { includeDigitalWithPrint?: boolean }).includeDigitalWithPrint ?? false,
    digitalWithPrintDiscountPercent: (album as { digitalWithPrintDiscountPercent?: number | null }).digitalWithPrintDiscountPercent ?? 0,
    digitalDiscount5Plus: (album as { digitalDiscount5Plus?: number | null }).digitalDiscount5Plus ?? null,
    digitalDiscount10Plus: (album as { digitalDiscount10Plus?: number | null }).digitalDiscount10Plus ?? null,
    digitalDiscount20Plus: (album as { digitalDiscount20Plus?: number | null }).digitalDiscount20Plus ?? null,
    allowClientLabSelection: false,
    scanProtectionEnabled:
      (album as { scanProtectionEnabled?: boolean }).scanProtectionEnabled !== false,
    extensionPricingActive,
    extensionSurchargePercent:
      extensionPricingActive && extensionSurchargeMode?.kind === "PERCENT_OF_SUBTOTAL"
        ? extensionSurchargeMode.percent
        : 0,
    extensionBaseEndsAt: baseEnd ? baseEnd.toISOString() : null,
    extensionEndsAt: extensionEnd ? extensionEnd.toISOString() : null,
    extensionDaysRemaining,
    pickupInfo: pickupBy === "CLIENT" && album.selectedLab && album.selectedLab.name
      ? {
          type: "LAB" as const,
          name: album.selectedLab.name,
          phone: album.selectedLab.phone,
          address: album.selectedLab.address,
          city: album.selectedLab.city,
          province: album.selectedLab.province,
          country: album.selectedLab.country,
        }
      : pickupBy === "PHOTOGRAPHER" && u && u.name
      ? {
          type: "PHOTOGRAPHER" as const,
          name: u.name,
          phone: u.phone,
          address: u.address,
          city: u.city,
          province: u.province,
          country: u.country,
        }
      : null,
  };

  // Incluir información del fotógrafo si tiene página pública habilitada
  const photographer = u && u.isPublicPageEnabled && u.publicPageHandler
    ? {
        id: u.id,
        name: u.name,
        logoUrl: u.logoUrl,
        secondaryColor: u.secondaryColor,
        tertiaryColor: u.tertiaryColor,
        publicPageHandler: u.publicPageHandler,
      }
    : null;

  const elapsedMs = Date.now() - startedAt;
  if (debugCheckout || process.env.CHECKOUT_DEBUG_LOGS === "1") {
    console.info("[checkout-debug] /order-photos preparado", {
      albumId,
      requestedPhotoIds: photoIds.length,
      returnedFiles: files.length,
      elapsedMs,
      imageMode: "thumb",
    });
  }

  return NextResponse.json(
    {
      files,
      pricing,
      photographer,
      ...(missingPhotos.length > 0
        ? { missingPhotoIds: missingPhotos, partialSelection: true }
        : {}),
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

/**
 * GET /api/a/[id]/order-photos?ids=1,2,3
 * Devuelve las fotos de un álbum (público) para usarlas en el flujo de impresión.
 * ids: ids de fotos separados por coma; solo se devuelven las que pertenecen al álbum.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const idsParam = req.nextUrl.searchParams.get("ids");
    const photoIds = idsParam
      ? idsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
      : [];

    const debugCheckout = req.nextUrl.searchParams.get("debugCheckout") === "1";
    return await buildOrderPhotosResponse(albumId, photoIds, debugCheckout);
  } catch (e) {
    console.error("[order-photos] error", e);
    return NextResponse.json({ error: "Error obteniendo fotos" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const photoIds = ids.map((value: any) => parseInt(String(value), 10)).filter(Number.isFinite);

    const debugCheckout = body?.debugCheckout === true || body?.debugCheckout === "1";
    return await buildOrderPhotosResponse(albumId, photoIds, debugCheckout);
  } catch (e) {
    console.error("[order-photos] error", e);
    return NextResponse.json({ error: "Error obteniendo fotos" }, { status: 500 });
  }
}
