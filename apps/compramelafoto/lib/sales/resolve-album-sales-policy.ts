import { PrintPricingSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAlbumComplete } from "@/lib/album-helpers";
import { isAlbumDigitalSalesReady, isAlbumPrintsSalesReady } from "@/lib/albums/album-sales-readiness";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import {
  collaborativeEventPricingFromPricingRow,
  type CollaborativeEventPricingLockSnapshot,
} from "@/lib/events/collaborative-event-pricing-lock";
import { resolveEventDigitalPhotoBasePrice } from "@/lib/pricing/event-digital-photo-price-resolver";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { getPlatformFeePercent } from "@/lib/pricing/print-pricing";
import {
  isCapability,
  photographerCapabilitiesFromSettings,
  resolveEffectiveCapabilitySet,
  type AlbumSalesSettingsCapabilityRow,
  type Capability,
} from "@/lib/upsells/capabilities";
import type {
  AlbumSalesPolicy,
  AlbumSalesPolicyCompleteness,
  AlbumSalesPolicyDigital,
  AlbumSalesPolicyDivergence,
  AlbumSalesPolicyFees,
  AlbumSalesPolicyPrint,
  DigitalPriceSource,
  MarginSource,
} from "@/lib/sales/album-sales-policy-types";

const DEFAULT_PLATFORM_MIN_DIGITAL_ARS = 5000;

export type PhotographerSalesSettingsInput = {
  capabilities?: string[];
  digitalEnabled?: boolean;
  printsEnabled?: boolean;
  retouchEnabled?: boolean;
  expressEnabled?: boolean;
  storageExtendEnabled?: boolean;
};

export type AlbumSalesPolicyAlbumInput = {
  enableDigitalPhotos?: boolean | null;
  enablePrintedPhotos?: boolean | null;
  digitalPhotoPriceCents?: number | null;
  albumProfitMarginPercent?: number | null;
  selectedLabId?: number | null;
  printPricingSource?: PrintPricingSource | string | null;
  pickupBy?: string | null;
  termsAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
  enableFaceBulkPurchase?: boolean | null;
  faceBulkPriceCents?: number | null;
  eventId?: number | null;
  expirationExtensionDays?: number | null;
};

export type AlbumSalesPolicyPhotographerInput = {
  defaultDigitalPhotoPrice?: number | null;
  profitMarginPercent?: number | null;
  preferredLabId?: number | null;
};

export type AlbumSalesPolicyResolveInput = {
  albumId: number;
  photographerId: number;
  album: AlbumSalesPolicyAlbumInput;
  photographer: AlbumSalesPolicyPhotographerInput;
  photographerSalesSettings: PhotographerSalesSettingsInput | null;
  albumSalesSettings: AlbumSalesSettingsCapabilityRow | null;
  eventPricing: CollaborativeEventPricingLockSnapshot | null;
  platformMinDigitalPriceArs?: number;
  fees?: AlbumSalesPolicyFees;
};

function boolOrDefault(value: boolean | null | undefined, defaultValue: boolean): boolean {
  return value !== undefined && value !== null ? Boolean(value) : defaultValue;
}

function positiveArs(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parsePrintPricingSource(raw: unknown): PrintPricingSource {
  return raw === PrintPricingSource.LAB_PREFERRED
    ? PrintPricingSource.LAB_PREFERRED
    : PrintPricingSource.PHOTOGRAPHER;
}

function parsePickupBy(raw: unknown): "CLIENT" | "PHOTOGRAPHER" | null {
  if (raw === "CLIENT" || raw === "PHOTOGRAPHER") return raw;
  return null;
}

function capabilityList(set: Set<Capability>): Capability[] {
  return Array.from(set).sort();
}

function resolveLegacyDigitalBasePrice(params: {
  albumStored: number | null;
  photographerDefault: number | null;
  platformMin: number;
}): { priceArs: number | null; source: DigitalPriceSource } {
  const fromAlbum = positiveArs(params.albumStored);
  if (fromAlbum != null) {
    return { priceArs: fromAlbum, source: "album_stored" };
  }
  const fromPhotographer = positiveArs(params.photographerDefault);
  if (fromPhotographer != null) {
    return { priceArs: fromPhotographer, source: "photographer_default" };
  }
  const min = positiveArs(params.platformMin);
  if (min != null) {
    return { priceArs: min, source: "platform_minimum" };
  }
  return { priceArs: null, source: "none" };
}

function mapEventResolutionToSource(
  resolution: ReturnType<typeof resolveEventDigitalPhotoBasePrice>
): DigitalPriceSource {
  switch (resolution.appliedRule) {
    case "ORGANIZER_FIXED":
      return "event_fixed";
    case "ORGANIZER_MINIMUM":
      return "event_minimum";
    case "PHOTOGRAPHER_DECIDES":
      return "event_photographer_decides";
    default:
      return "none";
  }
}

function resolveDigitalPricing(params: {
  album: AlbumSalesPolicyAlbumInput;
  photographer: AlbumSalesPolicyPhotographerInput;
  eventPricing: CollaborativeEventPricingLockSnapshot | null;
  platformMinDigitalPriceArs: number;
  legacyDigitalEnabled: boolean;
  capabilityDigitalEnabled: boolean;
}): AlbumSalesPolicyDigital {
  const legacyBase = resolveLegacyDigitalBasePrice({
    albumStored: params.album.digitalPhotoPriceCents ?? null,
    photographerDefault: params.photographer.defaultDigitalPhotoPrice ?? null,
    platformMin: params.platformMinDigitalPriceArs,
  });

  let effectiveBasePriceArs = legacyBase.priceArs;
  let effectiveBasePriceSource = legacyBase.source;
  let eventResolution: AlbumSalesPolicyDigital["eventResolution"] = null;
  const organizerLocksPricing = Boolean(
    params.eventPricing?.locksPhotographerDigitalPricing
  );

  if (params.eventPricing && params.album.eventId) {
    eventResolution = resolveEventDigitalPhotoBasePrice({
      album: { digitalPhotoPriceCents: params.album.digitalPhotoPriceCents ?? null },
      event: {
        photoPricingMode: params.eventPricing.photoPricingMode,
        fixedPhotoPrice: params.eventPricing.fixedPhotoPrice,
        minimumPhotoPrice: params.eventPricing.minimumPhotoPrice,
      },
      currentResolvedBasePrice: legacyBase.priceArs ?? 0,
      albumOwnerUser: {
        defaultDigitalPhotoPrice: params.photographer.defaultDigitalPhotoPrice ?? null,
      },
      globalMinimumPrice: params.platformMinDigitalPriceArs,
    });

    const applyEventPrice =
      eventResolution.appliedRule === "ORGANIZER_FIXED" ||
      eventResolution.appliedRule === "ORGANIZER_MINIMUM" ||
      (eventResolution.appliedRule === "CURRENT_BEHAVIOR" &&
        eventResolution.reason.startsWith("invalid_event_pricing_config"));

    if (applyEventPrice) {
      effectiveBasePriceArs = positiveArs(eventResolution.basePrice);
      effectiveBasePriceSource = mapEventResolutionToSource(eventResolution);
    } else if (eventResolution.appliedRule === "PHOTOGRAPHER_DECIDES") {
      effectiveBasePriceSource = "event_photographer_decides";
    }
  }

  return {
    capabilityEnabled: params.capabilityDigitalEnabled,
    legacyEnabled: params.legacyDigitalEnabled,
    checkoutEnabled: params.legacyDigitalEnabled,
    legacyBasePriceArs: legacyBase.priceArs,
    effectiveBasePriceArs,
    legacyBasePriceSource: legacyBase.source,
    effectiveBasePriceSource,
    eventResolution,
    organizerLocksPricing,
  };
}

function resolveMargin(params: {
  albumMargin: number | null | undefined;
  photographerMargin: number | null | undefined;
}): { percent: number; source: MarginSource } {
  /** Misma cadena que `pricing-engine`: álbum 0/null → margen del fotógrafo. */
  const albumMarginPct = Number(params.albumMargin ?? 0) || 0;
  const photographerMarginPct = Number(params.photographerMargin ?? 0) || 0;
  const markupPct = albumMarginPct || photographerMarginPct || 0;
  if (albumMarginPct > 0) {
    return { percent: markupPct, source: "album" };
  }
  if (photographerMarginPct > 0) {
    return { percent: markupPct, source: "photographer" };
  }
  return { percent: 0, source: "none" };
}

function legacyHasPrintMargin(albumMargin: number | null | undefined): boolean {
  const marginValue = Number(albumMargin);
  return Number.isFinite(marginValue) ? marginValue >= 0 : false;
}

function resolvePrintPolicy(params: {
  album: AlbumSalesPolicyAlbumInput;
  photographer: AlbumSalesPolicyPhotographerInput;
  legacyPrintEnabled: boolean;
  capabilityPrintEnabled: boolean;
}): AlbumSalesPolicyPrint {
  const margin = resolveMargin({
    albumMargin: params.album.albumProfitMarginPercent,
    photographerMargin: params.photographer.profitMarginPercent,
  });
  const selectedLabId = params.album.selectedLabId ?? null;
  const pickupBy = parsePickupBy(params.album.pickupBy);
  const hasMarginConfigured = legacyHasPrintMargin(params.album.albumProfitMarginPercent);
  const hasPickupWhenLab =
    selectedLabId == null ? true : pickupBy != null;

  return {
    capabilityEnabled: params.capabilityPrintEnabled,
    legacyEnabled: params.legacyPrintEnabled,
    checkoutEnabled: params.legacyPrintEnabled,
    marginPercent: margin.percent,
    marginSource: margin.source,
    pricingSource: parsePrintPricingSource(params.album.printPricingSource),
    pickupBy,
    hasMarginConfigured,
    hasPickupWhenLab,
  };
}

function resolveLabPolicy(params: {
  album: AlbumSalesPolicyAlbumInput;
  photographer: AlbumSalesPolicyPhotographerInput;
}): AlbumSalesPolicy["lab"] {
  const selectedLabId =
    typeof params.album.selectedLabId === "number" &&
    Number.isFinite(params.album.selectedLabId)
      ? params.album.selectedLabId
      : null;
  const preferredLabId =
    typeof params.photographer.preferredLabId === "number" &&
    Number.isFinite(params.photographer.preferredLabId)
      ? params.photographer.preferredLabId
      : null;

  if (selectedLabId != null) {
    return {
      selectedLabId,
      preferredLabId,
      effectiveLabId: selectedLabId,
      effectiveLabSource: "album_selected",
    };
  }
  if (preferredLabId != null) {
    return {
      selectedLabId: null,
      preferredLabId,
      effectiveLabId: preferredLabId,
      effectiveLabSource: "photographer_preferred",
    };
  }
  return {
    selectedLabId: null,
    preferredLabId: null,
    effectiveLabId: null,
    effectiveLabSource: "none",
  };
}

function buildCompleteness(params: {
  album: AlbumSalesPolicyAlbumInput;
  digital: AlbumSalesPolicyDigital;
  print: AlbumSalesPolicyPrint;
  divergence: AlbumSalesPolicyDivergence;
}): AlbumSalesPolicyCompleteness {
  const legacyIsComplete = isAlbumComplete({
    isPublic: true,
    isHidden: false,
    enablePrintedPhotos: params.album.enablePrintedPhotos,
    enableDigitalPhotos: params.album.enableDigitalPhotos,
    selectedLabId: params.album.selectedLabId,
    albumProfitMarginPercent: params.album.albumProfitMarginPercent,
    pickupBy: params.album.pickupBy,
    digitalPhotoPriceCents: params.album.digitalPhotoPriceCents,
    termsAcceptedAt: params.album.termsAcceptedAt,
    termsVersion: params.album.termsVersion,
  });

  const termsOk =
    Boolean(params.album.termsAcceptedAt) &&
    params.album.termsVersion === TERMS_VERSION;

  const legacyDigitalEnabled = params.digital.legacyEnabled;
  const legacyPrintEnabled = params.print.legacyEnabled;
  const hasAnySaleChannel = legacyDigitalEnabled || legacyPrintEnabled;

  const digitalConfigReady =
    !legacyDigitalEnabled ||
    isAlbumDigitalSalesReady({
      digitalPhotoPriceCents: params.album.digitalPhotoPriceCents,
      eventCollaborativePhotoPricing: null,
    });

  const printConfigReady =
    !legacyPrintEnabled ||
    isAlbumPrintsSalesReady({
      enablePrintedPhotos: true,
      albumProfitMarginPercent: params.album.albumProfitMarginPercent,
      selectedLabId: params.album.selectedLabId,
      pickupBy: params.album.pickupBy,
      printPricingSource: params.album.printPricingSource,
    });

  const blockingReasons: string[] = [];
  const informationalReasons: string[] = [];

  if (!hasAnySaleChannel) {
    blockingReasons.push("Sin canal de venta legacy activo (digital ni impresión).");
  }
  if (!termsOk) {
    blockingReasons.push(
      `Términos incompletos o versión distinta de ${TERMS_VERSION}.`
    );
  }
  if (legacyDigitalEnabled && !digitalConfigReady) {
    blockingReasons.push("Digital legacy habilitado sin precio válido.");
  }
  if (legacyPrintEnabled && !printConfigReady) {
    if (!params.print.hasMarginConfigured) {
      blockingReasons.push("Impresión legacy habilitada sin margen configurado.");
    }
    if (!params.print.hasPickupWhenLab) {
      blockingReasons.push("Impresión con laboratorio sin pickupBy definido.");
    }
  }
  if (!legacyIsComplete && blockingReasons.length === 0) {
    blockingReasons.push("isAlbumComplete=false por reglas legacy no cubiertas arriba.");
  }

  if (params.divergence.digitalLegacyVsCapability) {
    informationalReasons.push(
      "Divergencia: enableDigitalPhotos ≠ capability DIGITAL_SALES."
    );
  }
  if (params.divergence.printLegacyVsCapability) {
    informationalReasons.push(
      "Divergencia: enablePrintedPhotos ≠ capability PRINT_SALES."
    );
  }

  return {
    legacyIsComplete,
    canAcceptStandardCheckoutOrders: legacyIsComplete,
    termsOk,
    hasAnySaleChannel,
    digitalConfigReady,
    printConfigReady,
    blockingReasons,
    informationalReasons,
  };
}

function buildDivergence(params: {
  digitalLegacy: boolean;
  digitalCapability: boolean;
  printLegacy: boolean;
  printCapability: boolean;
}): AlbumSalesPolicyDivergence {
  const digitalLegacyVsCapability = params.digitalLegacy !== params.digitalCapability;
  const printLegacyVsCapability = params.printLegacy !== params.printCapability;
  const summaryLines: string[] = [];

  if (digitalLegacyVsCapability) {
    summaryLines.push(
      `Digital: legacy=${params.digitalLegacy ? "on" : "off"}, capability=${params.digitalCapability ? "on" : "off"}`
    );
  }
  if (printLegacyVsCapability) {
    summaryLines.push(
      `Impresión: legacy=${params.printLegacy ? "on" : "off"}, capability=${params.printCapability ? "on" : "off"}`
    );
  }

  return {
    digitalLegacyVsCapability,
    printLegacyVsCapability,
    hasAny: digitalLegacyVsCapability || printLegacyVsCapability,
    summaryLines,
  };
}

/**
 * Resuelve la política de ventas de un álbum a partir de datos ya cargados (puro, testeable).
 * Fase 1: `checkoutEnabled` sigue el modelo legacy; capabilities son analíticas.
 */
export function resolveAlbumSalesPolicyFromInput(
  input: AlbumSalesPolicyResolveInput
): AlbumSalesPolicy {
  const platformMin =
    positiveArs(input.platformMinDigitalPriceArs) ?? DEFAULT_PLATFORM_MIN_DIGITAL_ARS;

  const photographerSettingsRow = input.photographerSalesSettings as Parameters<
    typeof resolveEffectiveCapabilitySet
  >[0]["photographerSettings"];

  const effectiveCaps = resolveEffectiveCapabilitySet({
    photographerSettings: photographerSettingsRow,
    albumSettings: input.albumSalesSettings,
  });

  const legacyDigitalEnabled = boolOrDefault(input.album.enableDigitalPhotos, true);
  const legacyPrintEnabled = boolOrDefault(input.album.enablePrintedPhotos, true);
  const capabilityDigitalEnabled = effectiveCaps.has("DIGITAL_SALES");
  const capabilityPrintEnabled = effectiveCaps.has("PRINT_SALES");

  const divergence = buildDivergence({
    digitalLegacy: legacyDigitalEnabled,
    digitalCapability: capabilityDigitalEnabled,
    printLegacy: legacyPrintEnabled,
    printCapability: capabilityPrintEnabled,
  });

  const digital = resolveDigitalPricing({
    album: input.album,
    photographer: input.photographer,
    eventPricing: input.eventPricing,
    platformMinDigitalPriceArs: platformMin,
    legacyDigitalEnabled,
    capabilityDigitalEnabled,
  });

  const print = resolvePrintPolicy({
    album: input.album,
    photographer: input.photographer,
    legacyPrintEnabled,
    capabilityPrintEnabled,
  });

  const faceBulkEnabled = Boolean(input.album.enableFaceBulkPurchase);
  const faceBulkBase = positiveArs(input.album.faceBulkPriceCents);

  const fees: AlbumSalesPolicyFees = input.fees ?? {
    digitalMarketplacePercent: 10,
    printPlatformPercent: 10,
  };

  const completeness = buildCompleteness({
    album: input.album,
    digital,
    print,
    divergence,
  });

  const photographerOnlyCaps = photographerCapabilitiesFromSettings(
    input.photographerSalesSettings as Parameters<
      typeof photographerCapabilitiesFromSettings
    >[0]
  );

  const allowed = (input.albumSalesSettings?.allowedCapabilities ?? []).filter(
    isCapability
  );
  const disabled = (input.albumSalesSettings?.disabledCapabilities ?? []).filter(
    isCapability
  );

  return {
    version: "v1",
    albumId: input.albumId,
    photographerId: input.photographerId,
    eventId: input.album.eventId ?? null,
    capabilities: {
      photographer: capabilityList(photographerOnlyCaps),
      effective: capabilityList(effectiveCaps),
      inheritFromPhotographer: input.albumSalesSettings?.inheritFromPhotographer ?? true,
      allowed,
      disabled,
      digitalSales: capabilityDigitalEnabled,
      printSales: capabilityPrintEnabled,
    },
    digital: {
      capabilityEnabled: digital.capabilityEnabled,
      legacyEnabled: digital.legacyEnabled,
      checkoutEnabled: digital.checkoutEnabled,
      legacyBasePriceArs: digital.legacyBasePriceArs,
      effectiveBasePriceArs: digital.effectiveBasePriceArs,
      legacyBasePriceSource: digital.legacyBasePriceSource,
      effectiveBasePriceSource: digital.effectiveBasePriceSource,
      eventResolution: digital.eventResolution,
      organizerLocksPricing: digital.organizerLocksPricing,
    },
    print: {
      capabilityEnabled: print.capabilityEnabled,
      legacyEnabled: print.legacyEnabled,
      checkoutEnabled: print.checkoutEnabled,
      marginPercent: print.marginPercent,
      marginSource: print.marginSource,
      pricingSource: print.pricingSource,
      pickupBy: print.pickupBy,
      hasMarginConfigured: print.hasMarginConfigured,
      hasPickupWhenLab: print.hasPickupWhenLab,
    },
    lab: resolveLabPolicy({
      album: input.album,
      photographer: input.photographer,
    }),
    fees,
    faceBulk: {
      enabled: faceBulkEnabled,
      basePriceArs: faceBulkEnabled ? faceBulkBase : null,
    },
    completeness,
    divergence,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Carga datos del álbum y resuelve la política de ventas (Fase 1 — solo análisis/diagnóstico).
 */
export async function resolveAlbumSalesPolicy(
  albumId: number
): Promise<AlbumSalesPolicy | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      userId: true,
      eventId: true,
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
      digitalPhotoPriceCents: true,
      albumProfitMarginPercent: true,
      selectedLabId: true,
      printPricingSource: true,
      pickupBy: true,
      termsAcceptedAt: true,
      termsVersion: true,
      enableFaceBulkPurchase: true,
      faceBulkPriceCents: true,
      expirationExtensionDays: true,
      user: {
        select: {
          id: true,
          defaultDigitalPhotoPrice: true,
          profitMarginPercent: true,
          preferredLabId: true,
        },
      },
      event: {
        select: {
          photoPricingMode: true,
          fixedPhotoPrice: true,
          minimumPhotoPrice: true,
        },
      },
    },
  });

  if (!album) return null;

  const [photographerSalesSettings, albumSalesSettings] = await Promise.all([
    prisma.photographerSalesSettings.findUnique({
      where: { userId: album.userId },
    }),
    prisma.albumSalesSettings.findUnique({
      where: { albumId: album.id },
    }),
  ]);

  const effectiveLabId = album.selectedLabId ?? album.user?.preferredLabId ?? null;

  const [digitalMarketplacePercent, printPlatformPercent] = await Promise.all([
    resolveAlbumOrderDigitalMarketplaceFeePercent({
      photographerId: album.userId,
      labId: effectiveLabId,
    }),
    getPlatformFeePercent(),
  ]);

  const eventPricing = album.event
    ? collaborativeEventPricingFromPricingRow(album.event)
    : null;

  return resolveAlbumSalesPolicyFromInput({
    albumId: album.id,
    photographerId: album.userId,
    album: {
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      digitalPhotoPriceCents: album.digitalPhotoPriceCents,
      albumProfitMarginPercent: album.albumProfitMarginPercent,
      selectedLabId: album.selectedLabId,
      printPricingSource: album.printPricingSource,
      pickupBy: album.pickupBy,
      termsAcceptedAt: album.termsAcceptedAt,
      termsVersion: album.termsVersion,
      enableFaceBulkPurchase: album.enableFaceBulkPurchase,
      faceBulkPriceCents: album.faceBulkPriceCents,
      eventId: album.eventId,
      expirationExtensionDays: album.expirationExtensionDays,
    },
    photographer: {
      defaultDigitalPhotoPrice: album.user?.defaultDigitalPhotoPrice ?? null,
      profitMarginPercent: album.user?.profitMarginPercent ?? null,
      preferredLabId: album.user?.preferredLabId ?? null,
    },
    photographerSalesSettings: photographerSalesSettings,
    albumSalesSettings: albumSalesSettings
      ? {
          inheritFromPhotographer: albumSalesSettings.inheritFromPhotographer,
          allowedCapabilities: albumSalesSettings.allowedCapabilities,
          disabledCapabilities: albumSalesSettings.disabledCapabilities,
        }
      : null,
    eventPricing,
    fees: {
      digitalMarketplacePercent,
      printPlatformPercent,
    },
  });
}
