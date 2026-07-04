import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { getPhotographerPricing } from "@/lib/pricing/photographer-pricing";
import { getPlatformFeePercent, computePrintPricing } from "@/lib/pricing/print-pricing";
import { PriceMode } from "@prisma/client";

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

async function resolveMarketplaceFeePercent(params: {
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
    const bps = config?.commissionDigital_Bps;
    if (typeof bps === "number" && Number.isFinite(bps)) {
      return Math.round(bps) / 100;
    }
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

export async function computeCheckoutTotals(params: {
  flow: CheckoutFlow;
  albumId?: number | null;
  photographerId?: number | null;
  labId?: number | null;
  items: CheckoutInputItem[];
}): Promise<CheckoutTotals> {
  const { flow, albumId, photographerId, labId } = params;
  const items = Array.isArray(params.items) ? params.items : [];

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
    const baseDate = album.firstPhotoDate || album.createdAt;
    const extensionDays = album.expirationExtensionDays ?? 0;
    const baseEnd = baseDate ? new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    const extensionEnd = baseDate ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000) : null;
    const now = new Date();
    extensionPricingActive = Boolean(
      baseEnd && extensionEnd && extensionDays > 0 && now >= baseEnd && now <= extensionEnd
    );

    let extensionPricePer30DaysARS: number | null = null;
    if (extensionPricingActive && resolvedPhotographerId) {
      const salesSettings = await prisma.photographerSalesSettings.findUnique({
        where: { userId: resolvedPhotographerId },
        select: { storageExtendPricingJson: true },
      });
      const json = salesSettings?.storageExtendPricingJson as { price?: number } | null;
      const p = json?.price;
      if (typeof p === "number" && Number.isFinite(p) && p > 0) {
        extensionPricePer30DaysARS = p;
      }
    }

    const fileKeyToPhoto = new Map<string, { id: number; uploaderId: number | null }>();
    album.photos.forEach((photo) => {
      const uploaderId = photo.userId ?? album.userId ?? null;
      fileKeyToPhoto.set(photo.originalKey, { id: photo.id, uploaderId });
    });

    const uploaderIds = Array.from(
      new Set(
        items
          .map((item) => item.uploaderId ?? fileKeyToPhoto.get(String(item.fileKey))?.uploaderId ?? null)
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

    items.forEach((item, index) => {
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const isDigital = item.tipo === "digital" || item.size === "DIGITAL";
      if (isDigital || item.includedWithPrint) {
        const photo = fileKeyToPhoto.get(String(item.fileKey || ""));
        const uploaderId = item.uploaderId ?? photo?.uploaderId ?? resolvedPhotographerId ?? null;
        let baseDigital =
          (Number.isFinite(item.uploaderDigitalPriceCents as number) ? Number(item.uploaderDigitalPriceCents) : null) ??
          (uploaderId ? uploaderDigitalMap.get(uploaderId) : null) ??
          albumDigitalPriceCents ??
          0;
        if (baseDigital === 0 && photographerDigitalFallback != null && photographerDigitalFallback > 0) {
          baseDigital = photographerDigitalFallback;
        }
        const digitalBase = Math.round(baseDigital);
        let shouldCharge = true;
        if (item.includedWithPrint) {
          const photoId = photo?.id;
          const fileKey = String(item.fileKey || "");
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
          : 0;
        const discountedBase = Math.round(digitalBase * (1 - discountPct / 100));
        const unitPriceCents = shouldCharge
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

      const photo = fileKeyToPhoto.get(String(item.fileKey || ""));
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
        throw new Error(`No hay precio configurado para ${item.size || "tamaño"} (${item.fileKey || "item"})`);
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

    // Extensión de almacenamiento: precio del fotógrafo por cada 30 días, o 15% del total digital por cada 30 días si no configuró precio
    const extensionSurchargeCents = extensionPricingActive
      ? extensionPricePer30DaysARS != null && extensionPricePer30DaysARS > 0
        ? Math.round(extensionPricePer30DaysARS * 100 * (extensionDays / 30))
        : Math.round(digitalTotalCents * 0.15 * (extensionDays / 30))
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
