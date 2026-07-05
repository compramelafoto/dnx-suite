import { prisma } from "@/lib/prisma";
import { albumPhotoFileKey, stripCartCopySuffix } from "@/lib/album-photo-ref";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { getPhotographerPricing } from "@/lib/pricing/photographer-pricing";
import { getPlatformFeePercent, computePrintPricing } from "@/lib/pricing/print-pricing";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import {
  fetchCollaborativeEventPricingForAudit,
  isEventPhotoPricingAuditEnabled,
  logEventDigitalPhotoPricingAuditDifference,
} from "@/lib/pricing/event-photo-pricing-audit";
import {
  resolveEventDigitalPhotoBasePrice,
  type ResolverCollaborativeEvent,
} from "@/lib/pricing/event-digital-photo-price-resolver";
import {
  computeAlbumExtensionSurchargeArs,
  getAlbumExtensionDays,
  isAlbumExtensionPricingActive,
  loadAlbumExtensionSurchargeModeForPhotographer,
  resolveAlbumExtensionSurchargeMode,
  type AlbumExtensionSurchargeMode,
} from "@/lib/pricing/album-extension-surcharge";
import { PriceMode } from "@/lib/prisma";
import { expandAlbumCheckoutItemsWithPrintDigitalBundle } from "@/lib/pricing/album-checkout-print-digital-bundle";

export type PricingMode =
  | "FIXED_MARKUP_TABLE"
  | "MARKUP_OVER_LAB"
  | "LAB_RETAIL_PLUS_MARKUP";

export type CheckoutComponent = "DIGITAL" | "PRINT";

export type CheckoutFlow = "ALBUM_ORDER" | "PRINT_PHOTOGRAPHER" | "PRINT_PUBLIC" | "PRINT_LAB";

export type CheckoutInputItem = {
  fileKey?: string;
  size?: string | null;
  finish?: string | null;
  quantity?: number | null;
  tipo?: "digital" | "impresa";
  productId?: number | null;
  productName?: string | null;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  includedWithPrint?: boolean;
};

export type CheckoutPricingItem = {
  inputIndex: number;
  component: CheckoutComponent;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  basePriceCents: number;
  pricingMode: PricingMode;
};

export type CheckoutTotals = {
  displayTotalCents: number;
  mpTotalCents: number;
  marketplaceFeeCents: number;
  components: Array<{
    component: CheckoutComponent;
    displayTotalCents: number;
    mpTotalCents: number;
    marketplaceFeeCents: number;
  }>;
  items: CheckoutPricingItem[];
  snapshot: Record<string, unknown>;
};

type LabProduct = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  photographerPrice: number;
  retailPrice: number;
};

type LabBasePrice = {
  size: string;
  unitPrice: number;
};

type AlbumDigitalDiscountConfig = {
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
};

function normalizeProductName(name: string) {
  return name.split(" - ")[0].trim().toLowerCase();
}

function findLabProductForItem(
  item: CheckoutInputItem,
  products: LabProduct[]
): LabProduct | null {
  if (!products.length) return null;
  if (item.productId) {
    const byId = products.find((p) => p.id === Number(item.productId));
    if (byId) return byId;
  }
  if (item.productName) {
    const normalized = normalizeProductName(String(item.productName));
    const size = item.size || null;
    const finish = (item.finish ?? "").toString().trim().toUpperCase() || null;
    const exact = products.find((p) => {
      return normalizeProductName(p.name) === normalized &&
        (p.size || null) === size &&
        ((p.acabado || "").toString().trim().toUpperCase() || null) === finish;
    });
    if (exact) return exact;
    const sizeMatch = products.find((p) => normalizeProductName(p.name) === normalized && (p.size || null) === size);
    if (sizeMatch) return sizeMatch;
    const nameMatch = products.find((p) => normalizeProductName(p.name) === normalized);
    if (nameMatch) return nameMatch;
  }
  const sizeMatch = products.find((p) => (p.size || null) === (item.size || null));
  return sizeMatch || null;
}

function findBasePriceForSize(size: string | null | undefined, basePrices: LabBasePrice[]): number {
  if (!size) return 0;
  const base = basePrices.find((p) => p.size === size);
  return base?.unitPrice ?? 0;
}

function parseDiscountPercent(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function resolveDigitalBulkDiscountPercent(
  quantity: number,
  config: AlbumDigitalDiscountConfig
): number {
  if (quantity >= 20) {
    const discount = parseDiscountPercent(config.digitalDiscount20Plus);
    if (discount > 0) return discount;
  }
  if (quantity >= 10) {
    const discount = parseDiscountPercent(config.digitalDiscount10Plus);
    if (discount > 0) return discount;
  }
  if (quantity >= 5) {
    const discount = parseDiscountPercent(config.digitalDiscount5Plus);
    if (discount > 0) return discount;
  }
  return 0;
}

/** Fee % de Mercado Pago / plataforma según tipo de checkout (igual que `computeCheckoutTotals`). */
export async function resolveMarketplaceFeePercent(params: {
  flow: CheckoutFlow;
  photographerId?: number | null;
  labId?: number | null;
  labType?: "TYPE_A" | "TYPE_B" | null;
}): Promise<number> {
  const config = await getAppConfig();
  if (params.flow === "PRINT_PUBLIC") {
    const bps = params.labType === "TYPE_A"
      ? config?.commissionPublicTypeA_Bps
      : config?.commissionPublicTypeB_Bps;
    if (typeof bps === "number" && Number.isFinite(bps)) {
      return Math.round(bps) / 100;
    }
  }

  if (params.flow === "ALBUM_ORDER") {
    return resolveAlbumOrderDigitalMarketplaceFeePercent({
      photographerId: params.photographerId ?? null,
      labId: params.labId ?? null,
    });
  }

  if (params.flow === "PRINT_PHOTOGRAPHER") {
    const bps = config?.commissionPro_Bps;
    if (typeof bps === "number" && Number.isFinite(bps)) {
      return Math.round(bps) / 100;
    }
  }

  return resolvePlatformCommissionPercent({
    photographerId: params.photographerId ?? null,
    labId: params.labId ?? null,
  });
}

function calculateMarketplaceFeeCents(totalCents: number, percent: number): number {
  return feeFromTotal(totalCents, percent);
}

function resolveLabBasePrice(
  item: CheckoutInputItem,
  labProducts: LabProduct[],
  labBasePrices: LabBasePrice[],
  priceMode: PriceMode
): { basePriceCents: number; pricingMode: PricingMode } {
  const product = findLabProductForItem(item, labProducts);
  const wholesale = product?.photographerPrice ?? 0;
  const retail = product?.retailPrice ?? 0;
  const hasWholesale = Number.isFinite(wholesale) && wholesale > 0;
  const hasRetail = Number.isFinite(retail) && retail > 0;

  let basePriceCents = 0;
  let pricingMode: PricingMode = "MARKUP_OVER_LAB";

  if (priceMode === PriceMode.WHOLESALE) {
    basePriceCents = hasWholesale ? wholesale : 0;
    pricingMode = "MARKUP_OVER_LAB";
  } else if (priceMode === PriceMode.RETAIL) {
    basePriceCents = hasRetail ? retail : 0;
    pricingMode = "LAB_RETAIL_PLUS_MARKUP";
  } else {
    if (hasWholesale) {
      basePriceCents = wholesale;
      pricingMode = "MARKUP_OVER_LAB";
    } else if (hasRetail) {
      basePriceCents = retail;
      pricingMode = "LAB_RETAIL_PLUS_MARKUP";
    }
  }

  if (!basePriceCents) {
    const baseBySize = findBasePriceForSize(item.size, labBasePrices);
    if (baseBySize > 0) {
      basePriceCents = baseBySize;
      pricingMode = pricingMode === "MARKUP_OVER_LAB" ? "MARKUP_OVER_LAB" : "LAB_RETAIL_PLUS_MARKUP";
    }
  }

  return { basePriceCents: Math.round(basePriceCents || 0), pricingMode };
}

/**
 * Paso 13D: mismo criterio de “legacy servidor” por foto que `/order-photos` antes de política organizer
 * (dueño usa precio de álbum si está cargado (>0); colaboradores/uso default del map).
 */
function serverLegacyDigitalBasePesosForAlbumCheckout(params: {
  uploaderId: number | null;
  albumOwnerUserId: number;
  albumDigitalStoredRaw: number | null | undefined;
  uploaderDigitalMap: Map<number, number>;
  albumDigitalNormalizedFallback: number;
  photographerDigitalFallback: number | null;
}): number {
  const raw = params.albumDigitalStoredRaw;
  const albumHasCollaborativeStored =
    raw != null &&
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw > 0;
  const uid = params.uploaderId;
  let legacy = 0;
  if (
    uid != null &&
    uid === params.albumOwnerUserId &&
    albumHasCollaborativeStored
  ) {
    legacy = Math.round(Number(raw));
  } else if (uid != null && params.uploaderDigitalMap.has(uid)) {
    legacy = params.uploaderDigitalMap.get(uid)!;
  } else {
    legacy = Math.round(Number(params.albumDigitalNormalizedFallback || 0));
  }
  if (
    (!legacy || legacy <= 0) &&
    params.photographerDigitalFallback != null &&
    params.photographerDigitalFallback > 0
  ) {
    legacy = Math.round(Number(params.photographerDigitalFallback));
  }
  return legacy;
}

export async function computeCheckoutTotals(params: {
  flow: CheckoutFlow;
  albumId?: number | null;
  photographerId?: number | null;
  labId?: number | null;
  items: CheckoutInputItem[];
  /** Si el checkout incluye pack face-bulk: IDs de fotos del pack (precio único base+f fee en una sola línea comercial). */
  faceBulkPackPhotoIds?: number[] | null;
}): Promise<CheckoutTotals> {
  const { flow, albumId, photographerId, labId } = params;
  let items = Array.isArray(params.items) ? [...params.items] : [];

  if (flow === "ALBUM_ORDER" && !albumId) {
    throw new Error("albumId es requerido para calcular precios de álbum.");
  }

  let resolvedPhotographerId = photographerId ?? null;
  let resolvedLabId = labId ?? null;
  let labType: "TYPE_A" | "TYPE_B" | null = null;
  let photographerMarkupPct = 0;
  let albumMarginPct = 0;
  let albumDigitalPriceCents = 0;
  let albumDigitalWithPrintDiscountPercent = 0;
  let extensionPricingActive = false;

  let labProducts: LabProduct[] = [];
  let labBasePrices: LabBasePrice[] = [];
  let labPriceMode: PriceMode = PriceMode.AUTO;

  if (flow === "ALBUM_ORDER") {
    const album = await prisma.album.findUnique({
      where: { id: albumId! },
      include: {
        photos: { select: { id: true, originalKey: true, userId: true } },
        user: { select: { id: true, profitMarginPercent: true, defaultDigitalPhotoPrice: true } },
        selectedLab: { select: { id: true, labType: true, usePriceForPhotographerOrders: true } },
      },
    });

    if (!album) {
      throw new Error("Álbum no encontrado.");
    }

    const appConfig = await getAppConfig();
    const platformMinDigital = appConfig?.minDigitalPhotoPrice ?? 5000;

    resolvedPhotographerId = album.userId ?? resolvedPhotographerId ?? null;
    // FASE 1: selectedLabId null → pricing solo de PhotographerProduct. TODO FASE 2: selectedLabId != null, allowClientLabSelection, impresión directa al lab
    resolvedLabId = album.selectedLabId ?? resolvedLabId ?? null;
    labType = (album.selectedLab?.labType as "TYPE_A" | "TYPE_B" | null) ?? null;
    albumMarginPct = Number(album.albumProfitMarginPercent ?? 0) || 0;
    photographerMarkupPct = Number(album.user?.profitMarginPercent ?? 0) || 0;
    albumDigitalPriceCents = Number(album.digitalPhotoPriceCents ?? 0) || 0;
    albumDigitalWithPrintDiscountPercent = Number(album.digitalWithPrintDiscountPercent ?? 0) || 0;
    if (!albumDigitalPriceCents) {
      albumDigitalPriceCents = Number(album.user?.defaultDigitalPhotoPrice ?? platformMinDigital) || platformMinDigital;
    }

    if ((album as { includeDigitalWithPrint?: boolean | null }).includeDigitalWithPrint) {
      items = expandAlbumCheckoutItemsWithPrintDigitalBundle(
        items as Parameters<typeof expandAlbumCheckoutItemsWithPrintDigitalBundle>[0],
        album
      ) as CheckoutInputItem[];
    }

    if (resolvedLabId) {
      const lab = await prisma.lab.findUnique({
        where: { id: resolvedLabId },
        select: {
          labType: true,
          usePriceForPhotographerOrders: true,
          products: { select: { id: true, name: true, size: true, acabado: true, photographerPrice: true, retailPrice: true } },
          basePrices: { select: { size: true, unitPrice: true } },
        },
      });
      labType = (lab?.labType as "TYPE_A" | "TYPE_B" | null) ?? labType;
      labPriceMode = lab?.usePriceForPhotographerOrders ?? PriceMode.AUTO;
      labProducts = (lab?.products || []) as LabProduct[];
      labBasePrices = (lab?.basePrices || []) as LabBasePrice[];
    }

    const config = await getAppConfig();
    const extensionDays = getAlbumExtensionDays(album);
    extensionPricingActive = isAlbumExtensionPricingActive({
      firstPhotoDate: album.firstPhotoDate,
      createdAt: album.createdAt,
      expirationExtensionDays: album.expirationExtensionDays,
    });

    let extensionSurchargeMode: AlbumExtensionSurchargeMode = resolveAlbumExtensionSurchargeMode(null);
    if (extensionPricingActive && resolvedPhotographerId) {
      extensionSurchargeMode = await loadAlbumExtensionSurchargeModeForPhotographer(
        prisma,
        resolvedPhotographerId
      );
    }

    const fileKeyToPhoto = new Map<string, { id: number; uploaderId: number | null }>();
    album.photos.forEach((photo) => {
      const uploaderId = photo.userId ?? album.userId ?? null;
      const row = { id: photo.id, uploaderId };
      fileKeyToPhoto.set(photo.originalKey, row);
      fileKeyToPhoto.set(albumPhotoFileKey(photo.id), row);
    });

    const uploaderIds = Array.from(
      new Set(
        items
          .map((item) => {
            const fk = stripCartCopySuffix(String(item.fileKey || ""));
            return item.uploaderId ?? fileKeyToPhoto.get(fk)?.uploaderId ?? null;
          })
          .filter((id) => Number.isFinite(id as number))
      )
    ) as number[];

    const uploaderUsers = uploaderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, defaultDigitalPhotoPrice: true },
        })
      : [];

    const uploaderDigitalMap = new Map<number, number>();
    const platformMin = config?.minDigitalPhotoPrice ?? 5000;
    uploaderUsers.forEach((u) => {
      const price = Number(u.defaultDigitalPhotoPrice ?? platformMin) || platformMin;
      uploaderDigitalMap.set(u.id, price);
    });

    const pricingByUploader = new Map<number, Awaited<ReturnType<typeof getPhotographerPricing>>>();
    for (const uploaderId of uploaderIds) {
      pricingByUploader.set(uploaderId, await getPhotographerPricing(uploaderId));
    }

    const platformFeePercentPrint = await getPlatformFeePercent();
    const platformFeeMultiplier = 1 + platformFeePercentPrint / 100;
    const printBreakdowns: Array<ReturnType<typeof computePrintPricing>> = [];

    const computedItems: CheckoutPricingItem[] = [];
    let displayTotalCents = 0;
    let digitalTotalCents = 0;
    let printTotalCents = 0;
    const chargedDigitalPhotoIds = new Set<number>();
    const chargedDigitalFileKeys = new Set<string>();

    // Fallback: si el precio digital del álbum/usuario no se cargó, re-obtenerlo del fotógrafo (evita total $0 en resumen)
    let photographerDigitalFallback: number | null = null;
    if (resolvedPhotographerId && albumDigitalPriceCents === 0) {
      const photographer = await prisma.user.findUnique({
        where: { id: resolvedPhotographerId },
        select: { defaultDigitalPhotoPrice: true },
      });
      photographerDigitalFallback = photographer?.defaultDigitalPhotoPrice ?? config?.minDigitalPhotoPrice ?? null;
    }

    /** Event colaborativo: checkout (13D) y auditoría (13B) comparten esta carga. */
    let collaborativeEventPricing: ResolverCollaborativeEvent | null = null;
    if (
      typeof album.eventId === "number" &&
      Number.isFinite(album.eventId) &&
      album.eventId > 0
    ) {
      collaborativeEventPricing =
        await fetchCollaborativeEventPricingForAudit(album.eventId);
    }
    const auditCollaborativeEventRow =
      isEventPhotoPricingAuditEnabled() ? collaborativeEventPricing : null;
    const auditAlbumSliceForResolver = {
      digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    };    const rawFaceBulkPackIds = Array.isArray(params.faceBulkPackPhotoIds) ? params.faceBulkPackPhotoIds : [];
    const packPhotoIdSet = new Set(
      rawFaceBulkPackIds
        .filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n))
    );
    const albumPhotoIdSet = new Set(album.photos.map((p) => p.id));
    for (const pid of [...packPhotoIdSet]) {
      if (!albumPhotoIdSet.has(pid)) packPhotoIdSet.delete(pid);
    }

    const enableFaceBulkAlbum = Boolean((album as { enableFaceBulkPurchase?: boolean }).enableFaceBulkPurchase);
    const faceBulkBaseCents = Math.round(Number((album as { faceBulkPriceCents?: number | null }).faceBulkPriceCents ?? 0) || 0);

    const indexToPhotoId: (number | null)[] = items.map((item) => {
      const fk = stripCartCopySuffix(String(item.fileKey || ""));
      return fileKeyToPhoto.get(fk)?.id ?? null;
    });

    let faceBulkActive =
      enableFaceBulkAlbum && faceBulkBaseCents > 0 && packPhotoIdSet.size > 0;

    if (faceBulkActive) {
      for (const pid of packPhotoIdSet) {
        let foundPrimaryDigital = false;
        for (let i = 0; i < items.length; i++) {
          if (indexToPhotoId[i] !== pid) continue;
          const it = items[i];
          if (it.includedWithPrint) continue;
          const isD = it.tipo === "digital" || it.size === "DIGITAL";
          if (isD) {
            foundPrimaryDigital = true;
            break;
          }
        }
        if (!foundPrimaryDigital) {
          faceBulkActive = false;
          break;
        }
      }
    }
    if (faceBulkActive) {
      for (let i = 0; i < items.length; i++) {
        const pid = indexToPhotoId[i];
        if (!pid || !packPhotoIdSet.has(pid)) continue;
        const it = items[i];
        const isD = it.tipo === "digital" || it.size === "DIGITAL";
        if (!isD) {
          faceBulkActive = false;
          break;
        }
      }
    }

    const digitalBulkDiscountPercent = resolveDigitalBulkDiscountPercent(
      items.reduce((acc, item, index) => {
        const quantity = Math.max(1, Number(item.quantity ?? 1));
        const isDigital = item.tipo === "digital" || item.size === "DIGITAL";
        if (!isDigital || item.includedWithPrint) return acc;
        const photoId = indexToPhotoId[index];
        const inFaceBulkPack =
          faceBulkActive && Boolean(photoId && packPhotoIdSet.has(photoId));
        if (inFaceBulkPack) return acc;
        return acc + quantity;
      }, 0),
      {
        digitalDiscount5Plus: (album as { digitalDiscount5Plus?: number | null }).digitalDiscount5Plus ?? null,
        digitalDiscount10Plus: (album as { digitalDiscount10Plus?: number | null }).digitalDiscount10Plus ?? null,
        digitalDiscount20Plus: (album as { digitalDiscount20Plus?: number | null }).digitalDiscount20Plus ?? null,
      }
    );

    items.forEach((item, index) => {
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const isDigital = item.tipo === "digital" || item.size === "DIGITAL";
      const resolvedFileKey = stripCartCopySuffix(String(item.fileKey || ""));
      if (isDigital || item.includedWithPrint) {
        const photo = fileKeyToPhoto.get(resolvedFileKey);
        const uploaderId = item.uploaderId ?? photo?.uploaderId ?? resolvedPhotographerId ?? null;

        /** Face-bulk usa precio único aparte en el mismo carrito: no pisar líneas digitales incluidas en el pack con política organizer. */
        const inFaceBulkPackEarly =
          faceBulkActive &&
          Boolean(photo?.id && packPhotoIdSet.has(photo.id)) &&
          !item.includedWithPrint;

        /** Paso 13D: hint cliente solo si > 0 (0/null = ignorar y resolver en servidor). */
        const clientDigitalHint =
          typeof item.uploaderDigitalPriceCents === "number" &&
          Number.isFinite(item.uploaderDigitalPriceCents) &&
          item.uploaderDigitalPriceCents > 0
            ? Math.round(item.uploaderDigitalPriceCents)
            : null;
        let baseDigitalWithClientTrust =
          clientDigitalHint ??
          (uploaderId ? uploaderDigitalMap.get(uploaderId) : null) ??
          albumDigitalPriceCents ??
          0;
        if (
          baseDigitalWithClientTrust === 0 &&
          photographerDigitalFallback != null &&
          photographerDigitalFallback > 0
        ) {
          baseDigitalWithClientTrust = photographerDigitalFallback;
        }
        const digitalBaseDefault = Math.round(baseDigitalWithClientTrust);

        const legacyServerRounded = serverLegacyDigitalBasePesosForAlbumCheckout({
          uploaderId,
          albumOwnerUserId: album.user?.id ?? album.userId,
          albumDigitalStoredRaw: album.digitalPhotoPriceCents ?? null,
          uploaderDigitalMap,
          albumDigitalNormalizedFallback: albumDigitalPriceCents,
          photographerDigitalFallback,
        });

        let digitalBase = digitalBaseDefault;
        let organizerResolutionResult:
          | ReturnType<typeof resolveEventDigitalPhotoBasePrice>
          | null = null;

        if (
          collaborativeEventPricing != null &&
          typeof album.eventId === "number" &&
          Number.isFinite(album.eventId) &&
          album.eventId > 0 &&
          !inFaceBulkPackEarly
        ) {
          const uploaderDefaults = uploaderId
            ? uploaderUsers.find((u) => u.id === uploaderId)
            : undefined;

          organizerResolutionResult = resolveEventDigitalPhotoBasePrice({
            album: auditAlbumSliceForResolver,
            event: collaborativeEventPricing,
            currentResolvedBasePrice: legacyServerRounded,
            albumOwnerUser: album.user
              ? {
                  defaultDigitalPhotoPrice:
                    album.user.defaultDigitalPhotoPrice ?? null,
                }
              : undefined,
            uploaderUser: uploaderDefaults
              ? {
                  defaultDigitalPhotoPrice:
                    uploaderDefaults.defaultDigitalPhotoPrice ?? null,
                }
              : undefined,
            photo: photo?.id ? { id: photo.id } : undefined,
            globalMinimumPrice: config?.minDigitalPhotoPrice ?? null,
          });

          const applyCollaborativePricing =
            organizerResolutionResult.appliedRule === "ORGANIZER_FIXED" ||
            organizerResolutionResult.appliedRule === "ORGANIZER_MINIMUM";

          /** Config inválida del evento: mismo fallback que `/order-photos` — base servidor sin confiar precio spoofeado cliente. */
          const invalidCollaborativePricingConfig =
            organizerResolutionResult.appliedRule === "CURRENT_BEHAVIOR" &&
            organizerResolutionResult.reason.startsWith(
              "invalid_event_pricing_config"
            );

          if (applyCollaborativePricing) {
            digitalBase = Math.round(organizerResolutionResult.basePrice);
            console.info("[event-photo-pricing] checkout_applied", {
              albumId: albumId!,
              eventId: album.eventId,
              photoId: photo?.id ?? null,
              previousPrice: legacyServerRounded,
              appliedPrice: digitalBase,
              appliedRule: organizerResolutionResult.appliedRule,
              reason: organizerResolutionResult.reason,
            });
          } else if (invalidCollaborativePricingConfig) {
            digitalBase = Math.round(organizerResolutionResult.basePrice);
          }
        }

        /** Evitar auditoría redundante cuando 13D ya forzó FIXED/MÍNIMO (mismo log operativo `checkout_applied`). */
        const skipAuditBecauseCheckoutAppliedCollaborativeRules =
          organizerResolutionResult != null &&
          (organizerResolutionResult.appliedRule === "ORGANIZER_FIXED" ||
            organizerResolutionResult.appliedRule === "ORGANIZER_MINIMUM");

        if (
          auditCollaborativeEventRow &&
          typeof album.eventId === "number" &&
          Number.isFinite(album.eventId) &&
          album.eventId > 0 &&
          !skipAuditBecauseCheckoutAppliedCollaborativeRules
        ) {
          const uploaderDefaults = uploaderId
            ? uploaderUsers.find((u) => u.id === uploaderId)
            : undefined;
          logEventDigitalPhotoPricingAuditDifference({
            kind: "override_detected",
            albumId: albumId!,
            eventId: album.eventId,
            collaborativeEvent: auditCollaborativeEventRow,
            legacyBasePricePesos: digitalBaseDefault,
            album: auditAlbumSliceForResolver,
            albumOwnerUser: album.user
              ? {
                  defaultDigitalPhotoPrice:
                    album.user.defaultDigitalPhotoPrice ?? null,
                }
              : undefined,
            uploaderUser: uploaderDefaults
              ? {
                  defaultDigitalPhotoPrice:
                    uploaderDefaults.defaultDigitalPhotoPrice ?? null,
                }
              : undefined,
            photo: photo?.id ? { id: photo.id } : undefined,
            photoId: photo?.id ?? null,
            checkoutInputIndex: index,
            globalMinimumPrice: config?.minDigitalPhotoPrice ?? null,
          });
        }
        let shouldCharge = true;
        if (item.includedWithPrint) {
          const photoId = photo?.id;
          const fileKey = resolvedFileKey;
          if (photoId && chargedDigitalPhotoIds.has(photoId)) {
            shouldCharge = false;
          } else if (!photoId && fileKey && chargedDigitalFileKeys.has(fileKey)) {
            shouldCharge = false;
          }
          if (shouldCharge) {
            if (photoId) chargedDigitalPhotoIds.add(photoId);
            if (fileKey) chargedDigitalFileKeys.add(fileKey);
          }
        }
        const discountPct = item.includedWithPrint
          ? Math.min(100, Math.max(0, albumDigitalWithPrintDiscountPercent))
          : digitalBulkDiscountPercent;
        const discountedBase = Math.round(digitalBase * (1 - discountPct / 100));
        const inFaceBulkPack = inFaceBulkPackEarly;
        const unitPriceCents =
          inFaceBulkPack
            ? 0
            : shouldCharge
              ? Math.round(discountedBase * platformFeeMultiplier)
              : 0;
        const chargeQuantity = item.includedWithPrint ? 1 : quantity;
        const subtotalCents = unitPriceCents * chargeQuantity;
        computedItems.push({
          inputIndex: index,
          component: "DIGITAL",
          quantity: chargeQuantity,
          unitPriceCents,
          subtotalCents,
          basePriceCents: digitalBase,
          pricingMode: "FIXED_MARKUP_TABLE",
        });
        digitalTotalCents += subtotalCents;
        displayTotalCents += subtotalCents;
        return;
      }

      const photo = fileKeyToPhoto.get(resolvedFileKey);
      const uploaderId = item.uploaderId ?? photo?.uploaderId ?? resolvedPhotographerId ?? null;
      const pricing = uploaderId ? pricingByUploader.get(uploaderId) : null;
      let basePriceCents = 0;
      let pricingMode: PricingMode = "FIXED_MARKUP_TABLE";

      if (pricing && (pricing.products.length > 0 || pricing.basePrices.length > 0)) {
        const fixedPrice =
          findFixedPrice(item, pricing.products, pricing.basePrices);
        basePriceCents = fixedPrice;
        pricingMode = "FIXED_MARKUP_TABLE";
      } else if (resolvedLabId) {
        const resolved = resolveLabBasePrice(item, labProducts, labBasePrices, labPriceMode);
        basePriceCents = resolved.basePriceCents;
        pricingMode = resolved.pricingMode;
      }

      if (!basePriceCents) {
        throw new Error(`No hay precio configurado para ${item.size || "tamaño"} (${resolvedFileKey || "item"})`);
      }

      const markupPct = albumMarginPct || photographerMarkupPct || 0;
      const breakdown = computePrintPricing({
        baseUnitPrice: basePriceCents,
        albumMarginPercent: markupPct,
        platformFeePercent: platformFeePercentPrint,
        quantity,
      });
      printBreakdowns.push(breakdown);
      computedItems.push({
        inputIndex: index,
        component: "PRINT",
        quantity,
        unitPriceCents: breakdown.finalUnitPrice,
        subtotalCents: breakdown.subtotal,
        basePriceCents,
        pricingMode,
      });
      printTotalCents += breakdown.subtotal;
      displayTotalCents += breakdown.subtotal;
    });

    let faceBulkPackClientCents = 0;
    if (faceBulkActive) {
      faceBulkPackClientCents = Math.round(faceBulkBaseCents * platformFeeMultiplier);
      displayTotalCents += faceBulkPackClientCents;
      digitalTotalCents += faceBulkPackClientCents;
    }

    // Recargo por extensión: precio fijo del fotógrafo o % del subtotal de la venta por cada 30 días extra.
    const extensionSurchargeCents = extensionPricingActive
      ? computeAlbumExtensionSurchargeArs({
          clientSubtotalArs: displayTotalCents,
          extensionDays,
          mode: extensionSurchargeMode,
        })
      : 0;

    displayTotalCents += extensionSurchargeCents;

    const marketplaceFeePercent = await resolveMarketplaceFeePercent({
      flow,
      photographerId: resolvedPhotographerId,
      labId: resolvedLabId,
      labType,
    });
    // Comisión plataforma = % sobre base (sin extensión) + 100% del recargo por extensión
    const marketplaceFeeCents =
      calculateMarketplaceFeeCents(displayTotalCents - extensionSurchargeCents, marketplaceFeePercent) +
      extensionSurchargeCents;

    const hasPrintItems = printTotalCents > 0;
    const shadowCtx = {
      flow: "ALBUM_ORDER" as const,
      photographerId: resolvedPhotographerId,
      labId: resolvedLabId,
      albumId: albumId ?? null,
      hasPrintItems,
      hasOrganizer: Boolean(
        typeof album.eventId === "number" &&
          Number.isFinite(album.eventId) &&
          album.eventId > 0
      ),
    };
    if (digitalTotalCents > 0) {
      scheduleCheckoutFeeShadowCompare({
        site: "pricing-engine.digital-line",
        legacyFeePercent: platformFeePercentPrint,
        resolveInput: {
          component: "DIGITAL",
          flow: shadowCtx.flow,
          purpose: "CLIENT_LINE_UNIT",
          photographerId: shadowCtx.photographerId,
          labId: shadowCtx.labId,
          albumId: shadowCtx.albumId,
          hasPrintItems: shadowCtx.hasPrintItems,
        },
        albumId: shadowCtx.albumId,
        photographerId: shadowCtx.photographerId,
        labId: shadowCtx.labId,
        hasPrintItems: shadowCtx.hasPrintItems,
        hasOrganizer: shadowCtx.hasOrganizer,
        totalArsForEstimate: digitalTotalCents,
      });
    }
    if (printTotalCents > 0) {
      scheduleCheckoutFeeShadowCompare({
        site: "pricing-engine.print-line",
        legacyFeePercent: platformFeePercentPrint,
        resolveInput: {
          component: "PRINT",
          flow: shadowCtx.flow,
          purpose: "CLIENT_LINE_UNIT",
          photographerId: shadowCtx.photographerId,
          labId: shadowCtx.labId,
          albumId: shadowCtx.albumId,
          hasPrintItems: true,
        },
        albumId: shadowCtx.albumId,
        photographerId: shadowCtx.photographerId,
        labId: shadowCtx.labId,
        hasPrintItems: true,
        hasOrganizer: shadowCtx.hasOrganizer,
        totalArsForEstimate: printTotalCents,
      });
    }
    scheduleCheckoutFeeShadowCompare({
      site: "pricing-engine.marketplace-total",
      legacyFeePercent: marketplaceFeePercent,
      resolveInput: {
        component: hasPrintItems ? "PRINT" : "DIGITAL",
        flow: shadowCtx.flow,
        purpose: "MARKETPLACE_FEE_TOTAL",
        photographerId: shadowCtx.photographerId,
        labId: shadowCtx.labId,
        albumId: shadowCtx.albumId,
        hasPrintItems: shadowCtx.hasPrintItems,
      },
      albumId: shadowCtx.albumId,
      photographerId: shadowCtx.photographerId,
      labId: shadowCtx.labId,
      hasPrintItems: shadowCtx.hasPrintItems,
      hasOrganizer: shadowCtx.hasOrganizer,
      totalArsForEstimate: displayTotalCents - extensionSurchargeCents,
    });

    return {
      displayTotalCents,
      mpTotalCents: displayTotalCents,
      marketplaceFeeCents,
      components: [
        {
          component: "DIGITAL",
          displayTotalCents: digitalTotalCents,
          mpTotalCents: digitalTotalCents,
          marketplaceFeeCents: calculateMarketplaceFeeCents(digitalTotalCents, marketplaceFeePercent),
        },
        {
          component: "PRINT",
          displayTotalCents: printTotalCents + extensionSurchargeCents,
          mpTotalCents: printTotalCents + extensionSurchargeCents,
          marketplaceFeeCents: calculateMarketplaceFeeCents(printTotalCents + extensionSurchargeCents, marketplaceFeePercent),
        },
      ],
      items: computedItems,
      snapshot: {
        flow,
        albumId,
        labId: resolvedLabId,
        photographerId: resolvedPhotographerId,
        marketplaceFeePercent,
        marketplaceFeeCents,
        platformFeePercent: platformFeePercentPrint,
        printPricingBreakdowns: printBreakdowns,
        extensionPricingActive,
        extensionSurchargeCents,
        items: computedItems,
        faceBulkPack: faceBulkActive
          ? {
              packPhotoIds: Array.from(packPhotoIdSet).sort((a, b) => a - b),
              packBaseCents: faceBulkBaseCents,
              packClientTotalCents: faceBulkPackClientCents,
              packPhotoCount: packPhotoIdSet.size,
            }
          : null,
        digitalBulkDiscount: {
          percent: digitalBulkDiscountPercent,
        },
      },
    };
  }

  const resolvedPhotographer = resolvedPhotographerId
    ? await prisma.user.findUnique({
        where: { id: resolvedPhotographerId },
        select: { id: true, profitMarginPercent: true },
      })
    : null;

  photographerMarkupPct = Number(resolvedPhotographer?.profitMarginPercent ?? 0) || 0;

  if (resolvedLabId) {
    const lab = await prisma.lab.findUnique({
      where: { id: resolvedLabId },
      select: {
        labType: true,
        usePriceForPhotographerOrders: true,
        products: { select: { id: true, name: true, size: true, acabado: true, photographerPrice: true, retailPrice: true } },
        basePrices: { select: { size: true, unitPrice: true } },
      },
    });
    labType = (lab?.labType as "TYPE_A" | "TYPE_B" | null) ?? null;
    labPriceMode = lab?.usePriceForPhotographerOrders ?? PriceMode.AUTO;
    // FASE 1 landing lab: AUTO = precio base (RETAIL) por defecto
    if (!resolvedPhotographerId && labPriceMode === PriceMode.AUTO) {
      labPriceMode = PriceMode.RETAIL;
    }
    labProducts = (lab?.products || []) as LabProduct[];
    labBasePrices = (lab?.basePrices || []) as LabBasePrice[];
  }

  const pricing = resolvedPhotographerId ? await getPhotographerPricing(resolvedPhotographerId) : null;
  const hasFixedList = pricing && (pricing.products.length > 0 || pricing.basePrices.length > 0);
  const platformFeePercentPrint = await getPlatformFeePercent();
  const printBreakdowns: Array<ReturnType<typeof computePrintPricing>> = [];
  const computedItems: CheckoutPricingItem[] = [];
  let displayTotalCents = 0;

  items.forEach((item, index) => {
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    let basePriceCents = 0;
    let pricingMode: PricingMode = "FIXED_MARKUP_TABLE";

    if (hasFixedList && pricing) {
      basePriceCents = findFixedPrice(item, pricing.products, pricing.basePrices);
      pricingMode = "FIXED_MARKUP_TABLE";
    } else if (resolvedLabId) {
      const resolved = resolveLabBasePrice(item, labProducts, labBasePrices, labPriceMode);
      basePriceCents = resolved.basePriceCents;
      pricingMode = resolved.pricingMode;
    }

    if (!basePriceCents) {
      throw new Error(`No hay precio configurado para ${item.size || "tamaño"} (${item.fileKey || "item"})`);
    }

    const breakdown = computePrintPricing({
      baseUnitPrice: basePriceCents,
      albumMarginPercent: photographerMarkupPct,
      platformFeePercent: platformFeePercentPrint,
      quantity,
    });
    printBreakdowns.push(breakdown);

    computedItems.push({
      inputIndex: index,
      component: "PRINT",
      quantity,
      unitPriceCents: breakdown.finalUnitPrice,
      subtotalCents: breakdown.subtotal,
      basePriceCents,
      pricingMode,
    });
    displayTotalCents += breakdown.subtotal;
  });

  const marketplaceFeePercent = await resolveMarketplaceFeePercent({
    flow,
    photographerId: resolvedPhotographerId,
    labId: resolvedLabId,
    labType,
  });
  const marketplaceFeeCents = calculateMarketplaceFeeCents(displayTotalCents, marketplaceFeePercent);

  scheduleCheckoutFeeShadowCompare({
    site: "pricing-engine.print-only-marketplace",
    legacyFeePercent: marketplaceFeePercent,
    resolveInput: {
      component: "PRINT",
      flow,
      purpose: "MARKETPLACE_FEE_TOTAL",
      photographerId: resolvedPhotographerId,
      labId: resolvedLabId,
      labType,
    },
    photographerId: resolvedPhotographerId,
    labId: resolvedLabId,
    totalArsForEstimate: displayTotalCents,
  });
  scheduleCheckoutFeeShadowCompare({
    site: "pricing-engine.print-only-line",
    legacyFeePercent: platformFeePercentPrint,
    resolveInput: {
      component: "PRINT",
      flow,
      purpose: "CLIENT_LINE_UNIT",
      photographerId: resolvedPhotographerId,
      labId: resolvedLabId,
      labType,
    },
    photographerId: resolvedPhotographerId,
    labId: resolvedLabId,
    totalArsForEstimate: displayTotalCents,
  });

  return {
    displayTotalCents,
    mpTotalCents: displayTotalCents,
    marketplaceFeeCents,
    components: [
      {
        component: "PRINT",
        displayTotalCents,
        mpTotalCents: displayTotalCents,
        marketplaceFeeCents,
      },
    ],
    items: computedItems,
    snapshot: {
      flow,
      labId: resolvedLabId,
      photographerId: resolvedPhotographerId,
      marketplaceFeePercent,
      marketplaceFeeCents,
      platformFeePercent: platformFeePercentPrint,
      printPricingBreakdowns: printBreakdowns,
      items: computedItems,
    },
  };
}

function findFixedPrice(
  item: CheckoutInputItem,
  products: Array<{ id: number; name: string; size: string | null; acabado: string | null; retailPrice: number }>,
  basePrices: Array<{ size: string; unitPrice: number }>
): number {
  const productMatch = findLabProductForItem(item, products as LabProduct[]);
  if (productMatch && Number(productMatch.retailPrice) > 0) {
    return Math.round(productMatch.retailPrice);
  }
  const bySize = basePrices.find((p) => p.size === item.size);
  return Math.round(bySize?.unitPrice ?? 0);
}
