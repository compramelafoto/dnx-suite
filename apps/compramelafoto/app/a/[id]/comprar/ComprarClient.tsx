"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import OrderItem from "@/components/order/OrderItem";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import CheckoutLeakGuard from "@/components/checkout/CheckoutLeakGuard";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import {
  computeAlbumPrintDigitalBundleAddon,
  expandAlbumCheckoutItemsWithPrintDigitalBundle,
} from "@/lib/pricing/album-checkout-print-digital-bundle";
import { isCarnetOrPolaroidProduct } from "@/lib/print-products";
import {
  clearAlbumCheckoutSelection,
  mergeUniqueSortedPhotoIds,
  photoIdsFromCheckoutItems,
  readAlbumCheckoutSelection,
  readFaceBulkPackPhotoIds,
  writeAlbumCheckoutSelection,
  writeFaceBulkPackPhotoIds,
} from "@/lib/album-checkout-selection";
import { stripCartCopySuffix } from "@/lib/album-photo-ref";
import {
  buildRedeemSelectionsFromCheckoutItems,
  photosPerUnitForRedeem,
  redeemPreflightHints,
  totalPhotosRequiredForRedeem,
  type RedeemSnapshotBenefitRow,
} from "@/lib/preventa-canjeable/build-redeem-selections-from-items";
import {
  classifyOrderPhotosFetchError,
  messageForCheckoutPrepareError,
  signalCheckoutNavLanded,
  signalCheckoutPrepareReady,
} from "@/lib/checkout-prepare";

type UploadedFile = {
  fileKey: string;
  url: string;
  originalName: string;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

type Finish = "BRILLO" | "MATE";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: Finish;
  quantity: number;
  tipo?: "digital" | "impresa";
  productId?: number | null;
  productName?: string | null;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  includedWithPrint?: boolean;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

type AlbumPricing = {
  digitalPhotoPriceCents: number | null;
  preferredLabId?: number | null;
  selectedLabId?: number | null;
  profitMarginPercent: number;
  pickupBy?: "CLIENT" | "PHOTOGRAPHER";
  enablePrintedPhotos?: boolean;
  enableDigitalPhotos?: boolean;
  includeDigitalWithPrint?: boolean;
  digitalWithPrintDiscountPercent?: number;
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
  allowClientLabSelection?: boolean | null;
  extensionPricingActive?: boolean;
  extensionSurchargePercent?: number;
  extensionBaseEndsAt?: string | null;
  extensionEndsAt?: string | null;
  extensionDaysRemaining?: number | null;
  pickupInfo?: {
    type: "LAB" | "PHOTOGRAPHER";
    name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
  } | null;
  /** % fee sobre precio base digital (alineado con pricing-engine / order-photos). */
  digitalClientFeePercent?: number;
  enableFaceBulkPurchase?: boolean;
  faceBulkPriceCents?: number | null;
};

type LabPricing = {
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
  platformCommissionPercent?: number;
  products?: LabProduct[];
};

type LabProduct = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  retailPrice: number;
  isActive: boolean;
};

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  secondaryColor: string | null;
  tertiaryColor?: string | null;
  publicPageHandler: string;
} | null;

type OrderPhotosResponse = {
  files: UploadedFile[];
  pricing: AlbumPricing & { photographerId?: number | null };
  photographer: Photographer;
  missingPhotoIds?: number[];
  partialSelection?: boolean;
};

// Helper para formatear moneda ARS
function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// Función para obtener precio base por tamaño
function getBasePrice(size: string, pricing: LabPricing): number {
  const basePrice = pricing.basePrices.find((p) => p.size === size);
  return basePrice?.unitPrice ?? 0;
}

function pickDiscountFromThresholds(qty: number, discounts: Array<{ minQty: number; discountPercent: number }>): number {
  const applicable = discounts.filter((d) => d.minQty <= qty).sort((a, b) => b.minQty - a.minQty);
  return applicable[0]?.discountPercent ?? 0;
}

function getDiscountPercent(size: string, sizeQty: number, pricing: LabPricing): number {
  const sizeDiscounts = pricing.discounts.filter((d) => d.size === size);
  if (sizeDiscounts.length > 0) {
    return pickDiscountFromThresholds(sizeQty, sizeDiscounts.map((d) => ({ minQty: d.minQty, discountPercent: d.discountPercent })));
  }
  const globalDiscounts = pricing.discounts.filter((d) => d.size === "GLOBAL");
  if (globalDiscounts.length > 0) {
    return pickDiscountFromThresholds(sizeQty, globalDiscounts.map((d) => ({ minQty: d.minQty, discountPercent: d.discountPercent })));
  }
  return 0;
}

function getDigitalBulkDiscountPercent(qty: number, albumPricing: AlbumPricing | null): number {
  if (!albumPricing || qty <= 0) return 0;
  const d20 = Number(albumPricing.digitalDiscount20Plus ?? 0);
  const d10 = Number(albumPricing.digitalDiscount10Plus ?? 0);
  const d5 = Number(albumPricing.digitalDiscount5Plus ?? 0);
  if (qty >= 20 && Number.isFinite(d20) && d20 > 0) return Math.min(100, Math.max(0, d20));
  if (qty >= 10 && Number.isFinite(d10) && d10 > 0) return Math.min(100, Math.max(0, d10));
  if (qty >= 5 && Number.isFinite(d5) && d5 > 0) return Math.min(100, Math.max(0, d5));
  return 0;
}

// Función para calcular precio unitario final (incluye fee de plataforma para que el cliente vea el precio final)
function calculateFinalUnitPrice(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  const basePrice = getBasePrice(size, pricing);
  if (!basePrice || basePrice === 0 || !Number.isFinite(basePrice)) {
    return 0;
  }
  const platformFeePct = pricing.platformCommissionPercent ?? 0;
  const result = totalFromBase(Math.round(basePrice), platformFeePct);
  return Number.isFinite(result) ? result : 0;
}

/**
 * Parsea `photoIds` de la query (p. ej. grilla o face bulk desde ClientAlbumView).
 * Ignora segmentos vacíos/NaN/≤0, deduplica y ordena para un POST estable a order-photos.
 */
function parsePhotoIdsParam(raw: string): number[] {
  const set = new Set<number>();
  for (const part of raw.split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function parsePhotoIdFromCheckoutFileKey(fileKey: string): number | null {
  const base = stripCartCopySuffix(fileKey);
  const m = /^photo:(\d+)$/.exec(base);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function countPhotoImageRequestsInPerformance(): number {
  if (typeof window === "undefined" || typeof performance === "undefined") return 0;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  return resources.filter((entry) => {
    const name = String(entry.name || "");
    return name.includes("/api/photos/") && name.includes("mode=");
  }).length;
}

function normalizeSnapshotBenefitsForRedeem(raw: unknown): RedeemSnapshotBenefitRow[] {
  if (raw == null || typeof raw !== "object") return [];
  const o = raw as { benefits?: unknown };
  const arr = Array.isArray(o.benefits) ? o.benefits : [];
  return arr
    .map((b, i) => {
      const x = b as Record<string, unknown>;
      return {
        stableKey: String(x.stableKey ?? ""),
        kind: String(x.kind ?? "DIGITAL"),
        selectionMode: String(x.selectionMode ?? "SINGLE_PHOTO"),
        includedQuantity: Math.max(0, Number(x.includedQuantity) || 0),
        requiredPhotoCount: Math.max(1, Number(x.requiredPhotoCount) || 1),
        maxPhotosPerUnit: x.maxPhotosPerUnit == null ? null : Number(x.maxPhotosPerUnit),
        sortOrder: Number.isFinite(Number(x.sortOrder)) ? Number(x.sortOrder) : i,
        name: typeof x.name === "string" ? x.name : undefined,
      };
    })
    .filter((b) => b.stableKey.length > 0);
}

function computeFaceBulkPricingActive(
  checkoutItems: Item[],
  packPhotoIds: number[],
  ap: AlbumPricing | null
): boolean {
  if (!ap?.enableFaceBulkPurchase || !(Number(ap.faceBulkPriceCents) > 0) || packPhotoIds.length === 0) {
    return false;
  }
  const packSet = new Set(packPhotoIds);
  for (const pid of packSet) {
    let foundDigital = false;
    for (const it of checkoutItems) {
      if (parsePhotoIdFromCheckoutFileKey(it.fileKey) !== pid) continue;
      const isDigital = (it.tipo || "digital") === "digital" || it.size === "DIGITAL";
      if (!isDigital) return false;
      foundDigital = true;
      break;
    }
    if (!foundDigital) return false;
  }
  return true;
}

export default function ComprarClient() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const albumId = params.id as string;

  /** Solo UX / trazabilidad; la selección real sigue siendo `photoIds`. */
  const purchaseSourceParam = useMemo(() => {
    const raw = searchParams.get("source");
    if (raw == null) return null;
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }, [searchParams]);
  const isFaceBulkCheckout = purchaseSourceParam === "face-bulk";
  const checkoutDebugEnabled =
    searchParams.get("debugCheckout") === "1" ||
    process.env.NEXT_PUBLIC_CHECKOUT_DEBUG === "1";

  /** Entrada canje preventa V1: `/cliente/pack/[orderId|token]` → checkout con query de canje. */
  const preventaPackOrderIdParam = useMemo(() => {
    const raw = searchParams.get("preventaPackOrderId");
    if (raw == null) return null;
    const n = parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const preventaPackTokenParam = useMemo(() => {
    const raw = searchParams.get("preventaPackToken");
    if (!raw) return null;
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }, [searchParams]);

  const redeemMode = preventaPackOrderIdParam != null || preventaPackTokenParam != null;

  type RedeemPackLoaded = {
    packOrderId: number;
    snapshotBenefits: RedeemSnapshotBenefitRow[];
  };
  const [redeemPackMeta, setRedeemPackMeta] = useState<RedeemPackLoaded | null>(null);
  const [redeemPackLoadError, setRedeemPackLoadError] = useState<string | null>(null);
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);

  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  /** IDs persistidos del pack face-bulk (session); estado para evitar mismatch SSR/hidratación. */
  const [faceBulkPackPhotoIds, setFaceBulkPackPhotoIds] = useState<number[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setFaceBulkPackPhotoIds(readFaceBulkPackPhotoIds(albumId));
  }, [albumId, items, searchParams]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [checkoutPartialWarning, setCheckoutPartialWarning] = useState<string | null>(null);
  const [checkoutLoadAttempt, setCheckoutLoadAttempt] = useState(0);
  const [albumPricing, setAlbumPricing] = useState<AlbumPricing | null>(null);
  const [photographer, setPhotographer] = useState<Photographer>(null);
  const [showSlide, setShowSlide] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [continueSubmitting, setContinueSubmitting] = useState(false);

  // Precios del laboratorio
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [labProducts, setLabProducts] = useState<LabProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [usePhotographerPrice, setUsePhotographerPrice] = useState(false);
  const [pricingByUploader, setPricingByUploader] = useState<Record<number, LabPricing>>({});

  // Laboratorio seleccionado por el cliente
  const [clientSelectedLabId, setClientSelectedLabId] = useState<number | null>(null);
  const [availableLabs, setAvailableLabs] = useState<Array<{ id: number; name: string; city?: string | null; province?: string | null; address?: string | null }>>([]);
  const [labSearch, setLabSearch] = useState("");
  const [showLabDropdown, setShowLabDropdown] = useState(false);

  // Configuración masiva
  const [bulkSize, setBulkSize] = useState<string>("");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkProductId, setBulkProductId] = useState<number | null>(null);
  const [bulkProductName, setBulkProductName] = useState<string | null>(null);

  const selectedLab = useMemo(() => {
    if (!clientSelectedLabId) return null;
    return availableLabs.find((lab) => lab.id === clientSelectedLabId) || null;
  }, [availableLabs, clientSelectedLabId]);

  function formatLabInline(lab: { city?: string | null; province?: string | null; address?: string | null }) {
    const parts = [lab.city, lab.province, lab.address].filter(Boolean);
    return parts.length > 0 ? ` — ${parts.join(" - ")}` : "";
  }

  function pickDefaultProduct(currentSize?: string, products: LabProduct[] = labProducts) {
    const filtered = products.filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()));
    if (filtered.length === 0) return null;
    const first = filtered.find((p) => p.isActive) || filtered[0];
    if (!first) return null;
    if (currentSize) {
      const match = filtered.find((p) => {
        const name = p.name.split(" - ")[0].trim();
        const firstName = first.name.split(" - ")[0].trim();
        return name === firstName && p.size === currentSize;
      });
      return match || first;
    }
    return first;
  }

  function normalizeProductName(name: string) {
    return name.split(" - ")[0].trim();
  }

  function findProductForItem(item: Item, products: LabProduct[] = labProducts) {
    if (item.productId) {
      const byId = products.find((p) => p.id === item.productId);
      if (byId) return byId;
    }
    if (item.productName) {
      const normalized = item.productName.trim();
      const finish = item.finish || null;
      const size = item.size || null;
      return (
        products.find((p) => {
          return normalizeProductName(p.name) === normalized &&
            (p.size || null) === size &&
            (p.acabado || null) === finish;
        }) ||
        products.find((p) => {
          return normalizeProductName(p.name) === normalized &&
            (p.size || null) === size;
        }) ||
        products.find((p) => normalizeProductName(p.name) === normalized)
      );
    }
    return undefined;
  }

  function getProductUnitPrice(product?: LabProduct | null) {
    if (!product) return null;
    const retail = product.retailPrice || 0;
    return retail > 0 ? retail : null;
  }

  function getPricingForItem(item: Item) {
    if (item.uploaderId && pricingByUploader[item.uploaderId]) {
      return pricingByUploader[item.uploaderId];
    }
    return labPricing;
  }

  function getItemBasePrice(item: Item) {
    const pricing = getPricingForItem(item);
    const product = findProductForItem(item, pricing.products || []);
    const productPrice = getProductUnitPrice(product);
    if (productPrice && productPrice > 0) return productPrice;
    return getBasePrice(item.size, pricing);
  }

  // Actualizar bulkSize cuando se carguen los precios del laboratorio
  useEffect(() => {
    if (pricingLoaded && labPricing.basePrices.length > 0 && !bulkSize) {
      setBulkSize(labPricing.basePrices[0].size);
    }
  }, [pricingLoaded, labPricing.basePrices, bulkSize]);

  // Calcular cantidad total por tamaño
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const tipo = it.tipo || "digital";
      if (tipo !== "digital" && it.size && it.size !== "DIGITAL") {
        map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
      }
    }
    return map;
  }, [items]);

  // Calcular máximos descuentos para el tip
  const maxDiscounts = useMemo(() => {
    if (!pricingLoaded || labPricing.discounts.length === 0) {
      return { d50: 0, d100: 0 };
    }

    let maxD50 = 0;
    let maxD100 = 0;

    for (const d of labPricing.discounts) {
      if (d.minQty === 50 && d.discountPercent > maxD50) {
        maxD50 = d.discountPercent;
      }
      if (d.minQty === 100 && d.discountPercent > maxD100) {
        maxD100 = d.discountPercent;
      }
    }

    return { d50: Math.round(maxD50), d100: Math.round(maxD100) };
  }, [labPricing, pricingLoaded]);

  const faceBulkPricingActive = useMemo(
    () => computeFaceBulkPricingActive(items, faceBulkPackPhotoIds, albumPricing),
    [items, faceBulkPackPhotoIds, albumPricing]
  );
  const digitalBulkDiscountPercent = useMemo(() => {
    const packSet = new Set(faceBulkPackPhotoIds);
    const digitalQty = items.reduce((acc, item) => {
      const tipo = item.tipo || "digital";
      if (tipo !== "digital") return acc;
      const pid = parsePhotoIdFromCheckoutFileKey(item.fileKey);
      if (faceBulkPricingActive && pid != null && packSet.has(pid)) return acc;
      return acc + Math.max(1, Number(item.quantity) || 1);
    }, 0);
    return getDigitalBulkDiscountPercent(digitalQty, albumPricing);
  }, [items, faceBulkPackPhotoIds, faceBulkPricingActive, albumPricing]);

  // Calcular totales (impresas: lab + margen fotógrafo; digitales: precio del álbum; pack face-bulk: una línea)
  const totals = useMemo(() => {
    let totalBase = 0;
    let totalFinal = 0;
    let totalDiscount = 0;
    const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
    const fallbackDigital = albumPricing?.digitalPhotoPriceCents ?? 0;
    const faceBulkActive = computeFaceBulkPricingActive(items, faceBulkPackPhotoIds, albumPricing);
    const packSet = new Set(faceBulkPackPhotoIds);
    const digitalFeePctDefault =
      typeof albumPricing?.digitalClientFeePercent === "number" &&
      Number.isFinite(albumPricing.digitalClientFeePercent) &&
      albumPricing.digitalClientFeePercent >= 0
        ? albumPricing.digitalClientFeePercent
        : null;
    const chargedPrintBundleDigitalKeys = new Set<string>();

    for (const item of items) {
      const tipo = item.tipo || "digital";
      const pricing = getPricingForItem(item);
      const platformFeePct = digitalFeePctDefault ?? pricing.platformCommissionPercent ?? 0;
      if (tipo === "digital") {
        const pid = parsePhotoIdFromCheckoutFileKey(item.fileKey);
        if (faceBulkActive && pid != null && packSet.has(pid)) {
          continue;
        }
        const hinted = Number(item.uploaderDigitalPriceCents);
        const digitalPrice =
          Number.isFinite(hinted) && hinted > 0 ? hinted : fallbackDigital || 0;
        const discountedDigitalPrice = Math.round(
          digitalPrice * (1 - digitalBulkDiscountPercent / 100)
        );
        const originalUnitClient = totalFromBase(Math.round(digitalPrice), platformFeePct);
        const discountedUnitClient = totalFromBase(
          Math.round(discountedDigitalPrice),
          platformFeePct
        );
        totalFinal += discountedUnitClient;
        totalDiscount += Math.max(0, originalUnitClient - discountedUnitClient);
        continue;
      }
      if (!item.size || item.size === "DIGITAL" || !pricingLoaded) continue;
      const basePrice = getItemBasePrice(item);
      if (basePrice === 0) continue; // Si el tamaño no existe en el lab, saltar
      const withMargin = Math.round(basePrice * (1 + margin));
      const withFee = totalFromBase(Math.round(withMargin), platformFeePct);
      const qty = Number(item.quantity) || 1;
      totalBase += basePrice * qty;
      totalFinal += withFee * qty;

      if (albumPricing?.includeDigitalWithPrint) {
        const bundleKey = stripCartCopySuffix(String(item.fileKey || ""));
        if (bundleKey && !chargedPrintBundleDigitalKeys.has(bundleKey)) {
          chargedPrintBundleDigitalKeys.add(bundleKey);
          const digitalBase =
            Number.isFinite(Number(item.uploaderDigitalPriceCents)) &&
            Number(item.uploaderDigitalPriceCents) > 0
              ? Number(item.uploaderDigitalPriceCents)
              : fallbackDigital;
          const addon = computeAlbumPrintDigitalBundleAddon({
            album: albumPricing,
            digitalBaseCents: digitalBase,
            platformFeePct,
            printQuantity: qty,
          });
          if (addon?.active) {
            totalFinal += addon.total;
          }
        }
      }
    }

    if (faceBulkActive && albumPricing?.faceBulkPriceCents != null) {
      const pct = digitalFeePctDefault ?? labPricing.platformCommissionPercent ?? 0;
      totalFinal += totalFromBase(Math.round(Number(albumPricing.faceBulkPriceCents)), pct);
    }

    const extensionSurchargePercent = albumPricing?.extensionSurchargePercent ?? 0;
    const extensionSurcharge = albumPricing?.extensionPricingActive
      ? Math.round(totalFinal * (extensionSurchargePercent / 100))
      : 0;

    return {
      totalBase,
      totalFinal,
      totalDiscount,
      extensionSurcharge,
      totalWithSurcharge: totalFinal + extensionSurcharge,
    };
  }, [
    items,
    qtyBySize,
    pricingLoaded,
    albumPricing,
    labProducts,
    pricingByUploader,
    faceBulkPackPhotoIds,
    labPricing.platformCommissionPercent,
    digitalBulkDiscountPercent,
  ]);

  const packFeePctForDisplay =
    typeof albumPricing?.digitalClientFeePercent === "number" &&
    Number.isFinite(albumPricing.digitalClientFeePercent) &&
    albumPricing.digitalClientFeePercent >= 0
      ? albumPricing.digitalClientFeePercent
      : labPricing.platformCommissionPercent ?? 0;
  const faceBulkPackClientTotal = useMemo(() => {
    if (!faceBulkPricingActive || albumPricing?.faceBulkPriceCents == null) return 0;
    return totalFromBase(Math.round(Number(albumPricing.faceBulkPriceCents)), packFeePctForDisplay);
  }, [faceBulkPricingActive, albumPricing?.faceBulkPriceCents, packFeePctForDisplay]);

  const faceBulkPackIdSet = useMemo(() => new Set(faceBulkPackPhotoIds), [faceBulkPackPhotoIds]);

  /** Evita doble fetch al sincronizar query `photoIds` con sessionStorage (carrito acumulativo). */
  const lastLoadedPhotoIdsKeyRef = useRef<string>("");

  const handleRetryLoadCheckout = useCallback(() => {
    lastLoadedPhotoIdsKeyRef.current = "";
    setError(null);
    setCheckoutPartialWarning(null);
    setCheckoutLoadAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    lastLoadedPhotoIdsKeyRef.current = "";
  }, [albumId]);

  // Cargar fotos del álbum y precios (selección manual, face bulk y merge con carrito en sessionStorage)
  useEffect(() => {
    signalCheckoutNavLanded(albumId);
    console.info("[checkout-prepare] starting", { albumId });

    const raw = searchParams.get("photoIds");
    if (raw == null || raw.trim() === "") {
      setError("No se especificaron fotos para comprar");
      return;
    }

    const urlIds = parsePhotoIdsParam(raw);
    const sessionIds = readAlbumCheckoutSelection(albumId);
    const merged = mergeUniqueSortedPhotoIds(urlIds, sessionIds);
    const sourceParam = (searchParams.get("source") || "").trim();

    if (merged.length === 0) {
      setError("No se especificaron fotos para comprar");
      return;
    }

    writeAlbumCheckoutSelection(albumId, merged);

    if (typeof window !== "undefined") {
      if (sourceParam === "face-bulk" && readFaceBulkPackPhotoIds(albumId).length === 0 && urlIds.length > 0) {
        writeFaceBulkPackPhotoIds(albumId, urlIds);
        setFaceBulkPackPhotoIds(readFaceBulkPackPhotoIds(albumId));
      }
    }

    const mergedKey = merged.join(",");
    const urlOnlyKey = mergeUniqueSortedPhotoIds(urlIds).join(",");
    if (mergedKey !== urlOnlyKey) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("photoIds", mergedKey);
      const packLen = readFaceBulkPackPhotoIds(albumId).length;
      if (sourceParam === "face-bulk" || packLen > 0) {
        p.set("source", "face-bulk");
      }
      router.replace(`/a/${albumId}/comprar?${p.toString()}`, { scroll: false });
    }

    if (lastLoadedPhotoIdsKeyRef.current === mergedKey) {
      return;
    }
    lastLoadedPhotoIdsKeyRef.current = mergedKey;

    async function loadAlbumPhotos() {
      let orderPhotosRes: Response | null = null;
      try {
        setError(null);
        setCheckoutPartialWarning(null);
        console.info("[checkout-prepare] selectedCount", {
          albumId,
          selectedCount: merged.length,
        });
        const requestStartedAt = performance.now();
        const initialImageReqCount = countPhotoImageRequestsInPerformance();
        const res = await fetch(`/api/a/${albumId}/order-photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: merged,
            ...(checkoutDebugEnabled ? { debugCheckout: true } : {}),
          }),
        });
        orderPhotosRes = res;
        console.info("[checkout-prepare] orderPhotosStatus", {
          albumId,
          status: res.status,
          ok: res.ok,
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errorData = await res.json().catch(() => ({}));
            const kind = classifyOrderPhotosFetchError({
              res,
              message: errorData?.error,
              code: typeof errorData?.code === "string" ? errorData.code : undefined,
              missingCount: Array.isArray(errorData?.missingPhotoIds)
                ? errorData.missingPhotoIds.length
                : 0,
            });
            console.error("[checkout-prepare] error", { albumId, kind, status: res.status });
            setError(messageForCheckoutPrepareError(kind));
            lastLoadedPhotoIdsKeyRef.current = "";
            return;
          }
          const text = await res.text();
          const kind = classifyOrderPhotosFetchError({ res, message: text });
          console.error("[checkout-prepare] error", { albumId, kind, status: res.status });
          setError(messageForCheckoutPrepareError(kind));
          lastLoadedPhotoIdsKeyRef.current = "";
          return;
        }
        const data = (await res.json()) as OrderPhotosResponse;
        const requestElapsedMs = Math.round(performance.now() - requestStartedAt);
        
        const files = Array.isArray(data?.files) ? data.files : [];
        if (
          data.partialSelection &&
          Array.isArray(data.missingPhotoIds) &&
          data.missingPhotoIds.length > 0
        ) {
          setCheckoutPartialWarning(
            `Algunas fotos (${data.missingPhotoIds.length}) ya no están disponibles y se omitieron del carrito.`
          );
        }
        if (!files.length) {
          setError(messageForCheckoutPrepareError("missing_photos"));
          lastLoadedPhotoIdsKeyRef.current = "";
          return;
        }

        signalCheckoutPrepareReady(albumId);

        // Solo incluir fotos que tengan al menos un formato habilitado (Digital o Impresa)
        const purchasableFiles = files.filter(
          (f) => (f.sellDigital ?? true) || (f.sellPrint ?? true)
        );
        if (!purchasableFiles.length) {
          setError("Ninguna de las fotos seleccionadas está disponible para compra. El fotógrafo debe habilitar al menos Digital o Impresa por foto.");
          lastLoadedPhotoIdsKeyRef.current = "";
          return;
        }
        setPhotos(purchasableFiles);
        if (checkoutDebugEnabled) {
          const sampleUrl = purchasableFiles[0]?.url || "";
          const sampleMode = sampleUrl.includes("mode=thumb")
            ? "thumb"
            : sampleUrl.includes("mode=preview")
              ? "preview"
              : sampleUrl.includes("mode=original")
                ? "original"
                : "unknown";
          console.info("[checkout-debug] Carga /order-photos completada", {
            albumId,
            selectedCount: merged.length,
            purchasableCount: purchasableFiles.length,
            elapsedMs: requestElapsedMs,
            sampleMode,
            sampleUrl,
            imageRequestsBefore: initialImageReqCount,
          });
        }

        const navStartRaw = sessionStorage.getItem(`album_${albumId}_checkout_nav_start_perf`);
        if (checkoutDebugEnabled && navStartRaw) {
          const navStartPerf = Number(navStartRaw);
          if (Number.isFinite(navStartPerf) && navStartPerf > 0) {
            console.info("[checkout-debug] Tiempo click->respuesta inicial checkout", {
              albumId,
              elapsedMs: Math.round(performance.now() - navStartPerf),
            });
          }
        }

        const uploaderIds = Array.from(
          new Set<number>(
            purchasableFiles
              .map((f) => Number(f.uploaderId))
              .filter((id) => Number.isFinite(id))
          )
        );
        
        // Guardar información del fotógrafo si está disponible
        if (data?.photographer) {
          setPhotographer(data.photographer);
          sessionStorage.setItem(`album_${albumId}_photographer`, JSON.stringify(data.photographer));
        }
        
        if (data?.pricing) {
          setAlbumPricing(data.pricing);
          sessionStorage.setItem(`album_${albumId}_pricing`, JSON.stringify(data.pricing));
          setPricingLoaded(true);
        } else {
          setAlbumPricing(null);
          setPricingLoaded(true);
        }

        if (uploaderIds.length > 0) {
          void (async () => {
            try {
              const entries: Array<[number, LabPricing]> = await Promise.all(
                uploaderIds.map(async (id) => {
                  const res = await fetch(`/api/public/lab-pricing?photographerId=${id}`, { cache: "no-store" });
                  if (!res.ok) {
                    return [
                      id,
                      { basePrices: [], discounts: [], platformCommissionPercent: 0, products: [] },
                    ] as [number, LabPricing];
                  }
                  const pricing = await res.json();
                  return [
                    id,
                    {
                      basePrices: Array.isArray(pricing.basePrices) ? pricing.basePrices : [],
                      discounts: Array.isArray(pricing.discounts) ? pricing.discounts : [],
                      platformCommissionPercent: Number(pricing.platformCommissionPercent ?? 0) || 0,
                      products: Array.isArray(pricing.products)
                        ? pricing.products.filter((p: LabProduct) => p.isActive !== false)
                        : [],
                    },
                  ] as [number, LabPricing];
                })
              );
              const map: Record<number, LabPricing> = {};
              entries.forEach(([id, pricing]) => {
                map[id] = pricing;
              });
              setPricingByUploader(map);
              const photographerId = Number(data?.pricing?.photographerId);
              const fallbackId = uploaderIds[0];
              const defaultPricing =
                (Number.isFinite(photographerId) && map[photographerId]) ||
                (Number.isFinite(fallbackId) ? map[fallbackId] : undefined);
              if (defaultPricing) {
                setLabPricing(defaultPricing);
                setLabProducts(defaultPricing.products || []);
                setProductsLoaded(true);
              }
              if (checkoutDebugEnabled) {
                console.info("[checkout-debug] Precios por fotógrafo listos", {
                  albumId,
                  uploaderCount: uploaderIds.length,
                });
              }
            } catch (e) {
              console.error("Error cargando precios por fotógrafo:", e);
            }
          })();
        }

        void (async () => {
          try {
            const labsRes = await fetch("/api/labs");
            if (labsRes.ok) {
              const labsData = await labsRes.json();
              setAvailableLabs(Array.isArray(labsData) ? labsData : []);
            }
          } catch (e) {
            console.error("Error cargando laboratorios:", e);
          }
        })();

        if (checkoutDebugEnabled) {
          window.setTimeout(() => {
            const afterImageReqCount = countPhotoImageRequestsInPerformance();
            console.info("[checkout-debug] Requests de imágenes tras entrar al checkout", {
              albumId,
              photoImageRequestsDelta: Math.max(0, afterImageReqCount - initialImageReqCount),
              photoImageRequestsTotal: afterImageReqCount,
            });
          }, 2500);
        }
      } catch (e: any) {
        const kind = classifyOrderPhotosFetchError({
          res: orderPhotosRes,
          message: e?.message,
        });
        console.error("[checkout-prepare] error", { albumId, kind, message: e?.message });
        lastLoadedPhotoIdsKeyRef.current = "";
        setError(messageForCheckoutPrepareError(kind));
      }
    }

    loadAlbumPhotos();
  }, [albumId, searchParams, router, checkoutDebugEnabled, checkoutLoadAttempt]);

  useEffect(() => {
    if (!redeemMode || (preventaPackOrderIdParam == null && !preventaPackTokenParam)) {
      setRedeemPackMeta(null);
      setRedeemPackLoadError(null);
      return;
    }
    let cancelled = false;
    setRedeemPackLoadError(null);
    (async () => {
      try {
        const apiUrl =
          preventaPackOrderIdParam != null
            ? `/api/orders/${preventaPackOrderIdParam}`
            : `/api/public/pack/${encodeURIComponent(preventaPackTokenParam || "")}`;
        const res = await fetch(apiUrl, {
          credentials: preventaPackOrderIdParam != null ? "include" : "omit",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            data?.error === "token_invalid"
              ? "El link ya no es válido o expiró."
              : data?.error === "pack_not_paid"
                ? "Este pack todavía no tiene el pago confirmado."
              : data?.error === "unauthorized"
              ? "Iniciá sesión como cliente para canjear el pack."
              : typeof data?.error === "string"
                ? data.error
                : "No se pudo cargar el pack";
          throw new Error(msg);
        }
        const order = data?.order;
        if (!order) throw new Error("Respuesta inválida");
        const aid = parseInt(albumId, 10);
        if (!Number.isFinite(aid) || order.album?.id !== aid) {
          throw new Error("Este pack no corresponde a este álbum.");
        }
        if (order.origin !== "PREVENTA_PACK") throw new Error("El pedido no es un pack de preventa.");
        if (order.status !== "PAID") throw new Error("El pack debe estar pagado para canjearlo.");
        if (order.redemptionOrderId != null) throw new Error("Este pack ya fue canjeado.");
        const benefits = normalizeSnapshotBenefitsForRedeem(order.preventaPackSnapshotJson);
        if (benefits.length === 0) throw new Error("El pack no tiene beneficios para canjear.");
        if (!cancelled) {
          setRedeemPackMeta({
            packOrderId: order.id,
            snapshotBenefits: benefits,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setRedeemPackMeta(null);
          setRedeemPackLoadError(e instanceof Error ? e.message : "Error al cargar el pack");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redeemMode, preventaPackOrderIdParam, preventaPackTokenParam, albumId]);

  // Restaurar fotógrafo desde sessionStorage si existe
  useEffect(() => {
    const savedPhotographer = sessionStorage.getItem(`album_${albumId}_photographer`);
    if (savedPhotographer) {
      try {
        const photographerData = JSON.parse(savedPhotographer);
        setPhotographer(photographerData);
      } catch (e) {
        // Ignorar errores de parsing
      }
    }
  }, [albumId]);

  // Restaurar laboratorio seleccionado desde sessionStorage si existe y está permitido
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    // Solo restaurar si allowClientLabSelection está habilitado
    if (albumPricing?.allowClientLabSelection) {
      const savedLabId = sessionStorage.getItem(`album_${albumId}_clientLabId`);
      if (savedLabId) {
        const labId = Number(savedLabId);
        if (Number.isFinite(labId)) {
          setClientSelectedLabId(labId);
        }
      }
    } else if (albumPricing?.selectedLabId || albumPricing?.preferredLabId) {
      // Si no está permitido, usar siempre el laboratorio del álbum
      const labId = albumPricing.selectedLabId || albumPricing.preferredLabId;
      if (labId) {
        setClientSelectedLabId(labId);
        sessionStorage.setItem(`album_${albumId}_clientLabId`, labId.toString());
      }
    }
  }, [albumId, albumPricing]);

  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!albumPricing) return;
    if (albumPricing.allowClientLabSelection) {
      setUsePhotographerPrice(false);
      return;
    }
    const photographerId = sessionStorage.getItem("photographerId");
    setUsePhotographerPrice(!!photographerId);
  }, [albumPricing]);

  // Cargar precios cuando el cliente cambia el laboratorio seleccionado
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!clientSelectedLabId) return;

    async function loadLabPricing() {
      setPricingLoaded(false);
      try {
        // El cliente siempre usa precio retail (no es fotógrafo)
        const labRes = await fetch(`/api/lab/pricing?labId=${clientSelectedLabId}&isPhotographer=false`, { cache: "no-store" });
        if (labRes.ok) {
          const labData = await labRes.json();
          setLabPricing({
            basePrices: Array.isArray(labData.basePrices) ? labData.basePrices : [],
            discounts: Array.isArray(labData.discounts) ? labData.discounts : [],
          });
          setPricingLoaded(true);
        } else {
          setPricingLoaded(true);
        }
      } catch (e) {
        console.error("Error cargando precios del laboratorio:", e);
        setPricingLoaded(true);
      }
    }

    loadLabPricing();
  }, [clientSelectedLabId]);

  // Cargar productos cuando cambia el laboratorio
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!clientSelectedLabId) {
      setLabProducts([]);
      setProductsLoaded(false);
      return;
    }
    async function loadProducts() {
      try {
        const res = await fetch(`/api/lab/products?labId=${clientSelectedLabId}`, { cache: "no-store" });
        if (!res.ok) {
          setLabProducts([]);
          setProductsLoaded(true);
          return;
        }
        const data = await res.json();
        const products = Array.isArray(data) ? data.filter((p: LabProduct) => p.isActive) : [];
        setLabProducts(products);
        setProductsLoaded(true);
        if (products.length > 0) {
          setItems((prev) => {
            const updated = prev.map((item) => {
              if ((item.tipo || "digital") === "impresa" && !item.productName) {
                const pick = pickDefaultProduct(item.size, products);
                if (pick) {
                  return {
                    ...item,
                    productId: pick.id,
                    productName: pick.name.split(" - ")[0].trim(),
                    ...(pick.size && pick.size !== item.size ? { size: pick.size } : {}),
                    ...(pick.acabado ? { finish: pick.acabado as Finish } : {}),
                  };
                }
              }
              return item;
            });
            sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (e) {
        console.error("Error cargando productos del laboratorio:", e);
        setLabProducts([]);
        setProductsLoaded(true);
      }
    }
    loadProducts();
  }, [clientSelectedLabId]);

  // Restaurar items guardados o crear desde fotos
  useEffect(() => {
    if (photos.length === 0) return;

    const savedItems = sessionStorage.getItem(`album_${albumId}_items`);
    const defaultSize = labPricing.basePrices.length > 0 ? labPricing.basePrices[0].size : "10x15";
    let defaultTipo: "digital" | "impresa" = "digital";
    if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
      defaultTipo = "digital";
    } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
      defaultTipo = "impresa";
    } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
      defaultTipo = "digital"; // Por defecto digital; el cliente puede cambiar a impresa si quiere
    }

    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems) as Item[];
        const availableKeys = new Set(photos.map((p) => p.fileKey));
        const savedMap = new Map(
          parsed.filter((it: any) => availableKeys.has(it.fileKey)).map((it: any) => [it.fileKey, it])
        );
        const merged = photos.map((photo) => {
          const existing = savedMap.get(photo.fileKey);
          const sd = photo.sellDigital ?? true;
          const sp = photo.sellPrint ?? true;
          let tipo = (existing?.tipo || defaultTipo) as "digital" | "impresa";
          if (tipo === "digital" && !sd) tipo = "impresa";
          if (tipo === "impresa" && !sp) tipo = "digital";
          if (tipo === "digital" && !sd && sp) tipo = "impresa";
          if (tipo === "impresa" && !sp && sd) tipo = "digital";
          const size = tipo === "digital"
            ? "DIGITAL"
            : (existing?.size || defaultSize);
          return {
            fileKey: photo.fileKey,
            previewUrl: photo.url,
            originalName: photo.originalName,
            size,
            finish: (existing?.finish || "BRILLO") as Finish,
            quantity: existing?.quantity ?? 1,
            tipo,
            productId: existing?.productId ?? null,
            productName: existing?.productName ?? null,
            uploaderId: existing?.uploaderId ?? photo.uploaderId ?? null,
            // Paso 13C: priorizar el precio por foto devuelto por /order-photos frente al carrito en sessionStorage.
            uploaderDigitalPriceCents:
              photo.uploaderDigitalPriceCents ?? existing?.uploaderDigitalPriceCents ?? null,
            sellDigital: sd,
            sellPrint: sp,
          };
        });
        if (merged.length > 0) {
          setItems(merged);
          return;
        }
      } catch {}
    }

    // Esperar a que se carguen los precios del laboratorio antes de crear items
    if (!pricingLoaded) return;

    // Crear items desde fotos (default según configuración; por foto: sellDigital/sellPrint)
    if (!pricingLoaded) return;
    const fallbackTipo = defaultTipo || "digital";
    const newItems: Item[] = photos.map((photo) => {
      const sd = photo.sellDigital ?? true;
      const sp = photo.sellPrint ?? true;
      let tipo: "digital" | "impresa" = fallbackTipo;
      if (sd && !sp) tipo = "digital";
      else if (!sd && sp) tipo = "impresa";
      return {
        fileKey: photo.fileKey,
        previewUrl: photo.url,
        originalName: photo.originalName,
        size: tipo === "digital" ? "DIGITAL" : defaultSize,
        finish: "BRILLO",
        quantity: 1,
        tipo,
        productId: null,
        productName: null,
        uploaderId: photo.uploaderId ?? null,
        uploaderDigitalPriceCents: photo.uploaderDigitalPriceCents ?? null,
        sellDigital: sd,
        sellPrint: sp,
      };
    });
    setItems(newItems);
  }, [photos, albumId, pricingLoaded, labPricing.basePrices, albumPricing]);

  // Guardar items en sessionStorage cuando cambien
  useEffect(() => {
    if (items.length > 0 && typeof window !== "undefined") {
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(items));
    }
  }, [items, albumId]);

  // Mantener `album_*_selection` alineado al carrito (grilla del álbum + merge al reentrar al checkout)
  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    writeAlbumCheckoutSelection(albumId, photoIdsFromCheckoutItems(items));
  }, [items, albumId]);

  function handleRemovePhoto(fileKey: string) {
    setItems((prev) => {
      const updated = prev.filter((i) => i.fileKey !== fileKey);
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });

    setSelectedItems((prev) => {
      const index = items.findIndex((i) => i.fileKey === fileKey);
      if (index !== -1) {
        const newSet = new Set(prev);
        newSet.delete(index);
        const adjusted = new Set<number>();
        newSet.forEach((idx) => {
          if (idx < index) adjusted.add(idx);
          else if (idx > index) adjusted.add(idx - 1);
        });
        return adjusted;
      }
      return prev;
    });
  }

  function updateItem(index: number, updates: Partial<Item>) {
    setItems((prev) => {
      const updated = prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });
  }

  function handleDuplicatePhoto(index: number) {
    setItems((prev) => {
      const itemToDuplicate = prev[index];
      if (!itemToDuplicate) return prev;
      
      // Crear una copia del item con un nuevo fileKey único
      const duplicatedItem: Item = {
        ...itemToDuplicate,
        fileKey: `${itemToDuplicate.fileKey}_copy_${Date.now()}`,
      };
      
      // Insertar después del item original
      const updated = [...prev];
      updated.splice(index + 1, 0, duplicatedItem);
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });
  }

  function toggleItemSelection(index: number) {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  }

  // Calcular precio estimado para configuración masiva (solo impresas)
  const bulkPriceEstimate = useMemo(() => {
    if (!pricingLoaded || labPricing.basePrices.length === 0 || !bulkSize) return { base: 0, discount: 0, final: 0 };
    const impresaCount = items.filter((it) => (it.tipo || "digital") !== "digital").length;
    const selImpresaCount = selectedItems.size > 0
      ? [...selectedItems].filter((idx) => (items[idx]?.tipo || "digital") !== "digital").length
      : 0;
    const bulkProduct =
      bulkProductId ? labProducts.find((p) => p.id === bulkProductId) : undefined;
    const base = getProductUnitPrice(bulkProduct) || getBasePrice(bulkSize, labPricing);
    const estimatedQty = selectedItems.size > 0
      ? bulkQuantity * Math.max(selImpresaCount, 1)
      : bulkQuantity * Math.max(impresaCount, 1);
    const discount = getDiscountPercent(bulkSize, estimatedQty, labPricing);
    const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
    const final = Math.round(base * (1 - discount / 100) * (1 + margin));
    return { base, discount, final };
  }, [bulkSize, bulkQuantity, selectedItems, items, labPricing, pricingLoaded, albumPricing, labProducts, usePhotographerPrice, bulkProductId]);

  function applyBulkToSelected() {
    if (selectedItems.size === 0) {
      setError("Seleccioná al menos una foto para aplicar la configuración");
      return;
    }
    setItems((prev) => {
      const updated = prev.map((item, i) =>
        selectedItems.has(i) && (item.tipo || "digital") !== "digital"
          ? { ...item, productId: bulkProductId, productName: bulkProductName, size: bulkSize, finish: bulkFinish, quantity: bulkQuantity }
          : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      setError(null);
      return updated;
    });
  }

  function applyBulkToAll() {
    setItems((prev) => {
      const updated = prev.map((item) =>
        (item.tipo || "digital") !== "digital"
          ? { ...item, productId: bulkProductId, productName: bulkProductName, size: bulkSize, finish: bulkFinish, quantity: bulkQuantity }
          : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      setError(null);
      return updated;
    });
  }

  function persistCheckoutPhotoSelectionForAlbum() {
    if (typeof window === "undefined") return;
    if (items.length === 0) {
      clearAlbumCheckoutSelection(albumId);
      return;
    }
    writeAlbumCheckoutSelection(albumId, photoIdsFromCheckoutItems(items));
    sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(items));
  }

  function handleVolverAlAlbum() {
    persistCheckoutPhotoSelectionForAlbum();
    router.push(`/a/${albumId}`);
  }

  function handleContinue() {
    if (continueSubmitting) return;
    if (items.length === 0) {
      setError("No hay fotos configuradas para comprar");
      return;
    }
    setContinueSubmitting(true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setContinueSubmitting(false), 10000);
    }

    // Preparar items para enviar
    const itemsToSend: any[] = [];
    const packActiveForSend = computeFaceBulkPricingActive(items, faceBulkPackPhotoIds, albumPricing);
    const packSetForSend = new Set(faceBulkPackPhotoIds);
    const expandedItems = expandAlbumCheckoutItemsWithPrintDigitalBundle(items, albumPricing);

    expandedItems.forEach((it) => {
      const t = it.tipo || "digital";

      const pidSend = parsePhotoIdFromCheckoutFileKey(it.fileKey);
      const digitalInFaceBulkPack =
        t === "digital" &&
        !it.includedWithPrint &&
        packActiveForSend &&
        pidSend != null &&
        packSetForSend.has(pidSend);

      itemsToSend.push({
        fileKey: it.fileKey,
        originalName: it.originalName,
        size: t === "digital" ? "DIGITAL" : it.size,
        acabado: t === "digital" ? "DIGITAL" : it.finish,
        quantity: t === "digital" ? 1 : it.quantity,
        tipo: t,
        includedWithPrint: it.includedWithPrint ?? false,
        uploaderId: it.uploaderId ?? null,
        uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
        priceCents: t === "digital"
          ? digitalInFaceBulkPack
            ? 0
            : Math.round((albumPricing?.digitalPhotoPriceCents ?? 0))
          : (() => {
              if (!it.size || it.size === "DIGITAL" || !pricingLoaded || labPricing.basePrices.length === 0) {
                return 0;
              }
              const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
              const sizeQty = qtyBySize.get(it.size) ?? it.quantity;
              const basePrice = getItemBasePrice(it);
              if (!basePrice) return 0;
              const discountPercent = getDiscountPercent(it.size, sizeQty, labPricing);
              const labUnit = Math.round(basePrice * (1 - discountPercent / 100));
              return Math.round(labUnit * (1 + margin)) * it.quantity;
            })(),
      });
    });

    // Guardar en sessionStorage
    sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(items));
    sessionStorage.setItem(`album_${albumId}_itemsToSend`, JSON.stringify(itemsToSend));
    if (albumPricing) {
      sessionStorage.setItem(`album_${albumId}_pricing`, JSON.stringify(albumPricing));
    }
    if (checkoutDebugEnabled) {
      console.info("[checkout-debug] Continuar al resumen", {
        albumId,
        itemCount: items.length,
      });
    }
    router.push(`/a/${albumId}/comprar/resumen`);
  }

  const redeemPhotoStats = useMemo(() => {
    if (!redeemMode || !redeemPackMeta) return null;
    const required = totalPhotosRequiredForRedeem(redeemPackMeta.snapshotBenefits);
    const seen = new Set<number>();
    let uniqueInCart = 0;
    for (const it of items) {
      const pid = parsePhotoIdFromCheckoutFileKey(it.fileKey);
      if (pid == null || seen.has(pid)) continue;
      seen.add(pid);
      uniqueInCart += 1;
    }
    return { required, uniqueInCart };
  }, [redeemMode, redeemPackMeta, items]);

  const redeemPreflight = useMemo(() => {
    if (!redeemMode || !redeemPackMeta) return null;
    return redeemPreflightHints(redeemPackMeta.snapshotBenefits, items);
  }, [redeemMode, redeemPackMeta, items]);

  async function handleRedeemPack() {
    if (!redeemMode || (!preventaPackOrderIdParam && !preventaPackTokenParam) || !redeemPackMeta) {
      return;
    }
    setRedeemSubmitting(true);
    setError(null);
    try {
      const built = buildRedeemSelectionsFromCheckoutItems(
        redeemPackMeta.snapshotBenefits,
        items
      );
      if (!built.ok) {
        setError(built.message);
        return;
      }
      const isTokenFlow = !!preventaPackTokenParam;
      const redeemUrl = isTokenFlow
        ? `/api/public/pack/${encodeURIComponent(preventaPackTokenParam || "")}/redeem`
        : `/api/orders/${preventaPackOrderIdParam}/redeem`;
      const res = await fetch(redeemUrl, {
        method: "POST",
        credentials: isTokenFlow ? "omit" : "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: built.selections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No se pudo completar el canje");
        return;
      }
      const successTarget = isTokenFlow
        ? `/cliente/pack/${encodeURIComponent(preventaPackTokenParam || "")}?redeemed=true`
        : `/cliente/pack/${preventaPackOrderIdParam}?redeemed=true`;
      router.push(successTarget);
    } finally {
      setRedeemSubmitting(false);
    }
  }

  const slidePhotos = useMemo(() => {
    return items.map((item, index) => ({
      id: item.fileKey,
      src: (() => {
        const pid = parsePhotoIdFromCheckoutFileKey(item.fileKey);
        return pid != null
          ? `/api/photos/${pid}/view?albumId=${albumId}&mode=preview`
          : item.previewUrl;
      })(),
      alt: item.originalName,
      selected: selectedItems.has(index),
    }));
  }, [items, selectedItems, albumId]);

  const itemIndexById = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, index) => {
      map.set(item.fileKey, index);
    });
    return map;
  }, [items]);

  const albumIdNum = albumId ? parseInt(albumId, 10) : undefined;

  useEffect(() => {
    if (!albumId) return;
    void (async () => {
      const { trackFunnelEvent, FUNNEL_EVENTS } = await import("@/lib/funnel-track-client");
      await trackFunnelEvent(FUNNEL_EVENTS.ORDER_CONFIG_VIEW, { albumId });
    })();
  }, [albumId]);

  return (
    <ProtectedAlbumWrapper enableProtection={false} albumId={Number.isFinite(albumIdNum) ? albumIdNum : undefined}>
      <>
        {photographer ? (
          <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
        ) : null}
        <CheckoutLeakGuard active>
        <section
          className="py-12 md:py-16 bg-white"
          {...(purchaseSourceParam
            ? { "data-checkout-source": purchaseSourceParam }
            : {})}
          {...(redeemMode && redeemPackMeta?.packOrderId != null
            ? { "data-redeem-pack-order-id": String(redeemPackMeta.packOrderId) }
            : {})}
        >
        <div className="container-custom">
          <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center px-4">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#1a1a1a] mb-2">
              {redeemMode ? "Canje de pack — elegí tus fotos" : "Configurá tu pedido"}
            </h1>
            <p className="text-[#6b7280] mb-4">
              {redeemMode
                ? "Estás seleccionando las fotos incluidas en tu pack. No hay pago: al confirmar se registra el canje."
                : "Elegí tamaño, acabado y cantidad para cada foto. El precio se calcula automáticamente."}
            </p>
            {!redeemMode && isFaceBulkCheckout && (
              <p
                className="mb-4 w-full max-w-5xl mx-auto rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 text-left leading-normal"
                role="status"
              >
                Incluimos las fotos del pack{" "}
                <strong className="font-semibold">donde aparecés</strong>. Si querés sumar otras del
                evento (aunque no salgas), usá{" "}
                <strong className="font-semibold">«Volver al álbum para modificar selección»</strong>{" "}
                arriba: no perdés lo que ya elegiste.
              </p>
            )}
            {redeemMode && redeemPackLoadError && (
              <div
                className="mb-4 w-full max-w-5xl mx-auto rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 text-left"
                role="alert"
              >
                {redeemPackLoadError}
              </div>
            )}
            {redeemMode && !redeemPackLoadError && !redeemPackMeta && (
              <p className="mb-4 text-sm text-[#6b7280]">Cargando datos del pack…</p>
            )}
            {redeemMode && redeemPackMeta && (
              <div
                className="mb-4 w-full max-w-5xl mx-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 text-left space-y-2"
                role="status"
              >
                <p className="font-semibold text-slate-900">
                  Pack pedido <span className="font-mono">#{redeemPackMeta.packOrderId}</span>
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>
                    <strong>No estás comprando de nuevo</strong> este pack: ya lo pagaste en la preventa.
                  </li>
                  <li>
                    <strong>Solo estás eligiendo las fotos</strong> incluidas en tu preventa (el orden de la lista
                    importa).
                  </li>
                  <li>
                    Elegir <strong>Digital</strong> o <strong>Impresa</strong> en cada foto{" "}
                    <strong>sí afecta el canje</strong> cuando el beneficio lo requiere.
                  </li>
                </ul>
                <p className="text-slate-600 text-sm pt-1">
                  Los beneficios se completan en orden; en cada foto usá el formato que pida cada parte del pack.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {[...redeemPackMeta.snapshotBenefits]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((b) => (
                      <li key={b.stableKey}>
                        <span className="font-medium">{b.name?.trim() || b.stableKey}</span>
                        {" — "}
                        {b.includedQuantity <= 0 ? (
                          <span className="text-slate-600">sin unidades incluidas</span>
                        ) : (
                          <span className="text-slate-600">
                            {b.includedQuantity} u. × {photosPerUnitForRedeem(b)} foto(s) ·{" "}
                            {b.kind === "PHYSICAL" ? "Impresa" : "Digital"}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
                {redeemPhotoStats ? (
                  <p className="text-slate-700 pt-1 border-t border-slate-200">
                    <span className="font-medium text-slate-800">Progreso: </span>
                    fotos únicas en el pedido{" "}
                    <strong>{redeemPhotoStats.uniqueInCart}</strong> / mínimo según pack{" "}
                    <strong>{redeemPhotoStats.required}</strong>
                  </p>
                ) : null}
                {redeemPreflight ? (
                  <div
                    className={`mt-2 rounded-lg border px-3 py-2 text-sm space-y-2 ${
                      redeemPreflight.build.ok
                        ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                    role="status"
                  >
                    {redeemPreflight.build.ok ? (
                      <p>
                        Con esta selección y orden, el canje puede enviarse.{" "}
                        <span className="text-emerald-900/90">
                          La comprobación final (plazos, fotos en el álbum, producto de laboratorio) ocurre al
                          confirmar.
                        </span>
                      </p>
                    ) : (
                      <p className="font-medium">{redeemPreflight.build.message}</p>
                    )}
                    {redeemPreflight.poolDigitalCount < redeemPreflight.requiredDigitalPhotos ? (
                      <p>
                        Faltan fotos en formato <strong>Digital</strong>: necesitás al menos{" "}
                        {redeemPreflight.requiredDigitalPhotos} “cupos” digitales y en el pedido hay{" "}
                        {redeemPreflight.poolDigitalCount} foto(s) únicas marcadas como digital.
                      </p>
                    ) : null}
                    {redeemPreflight.poolPrintCount < redeemPreflight.requiredPrintPhotos ? (
                      <p>
                        Faltan fotos en formato <strong>Impresa</strong>: necesitás al menos{" "}
                        {redeemPreflight.requiredPrintPhotos} “cupos” para impresión y en el pedido hay{" "}
                        {redeemPreflight.poolPrintCount} foto(s) únicas marcadas como impresa.
                      </p>
                    ) : null}
                    {!redeemPreflight.build.ok &&
                    redeemPreflight.poolDigitalCount >= redeemPreflight.requiredDigitalPhotos &&
                    redeemPreflight.poolPrintCount >= redeemPreflight.requiredPrintPhotos ? (
                      <p className="text-slate-700">
                        En cantidad de digitales e impresas podría alcanzar, pero <strong>el orden</strong> no coincide
                        con los beneficios del pack: reordená las filas o revisá el formato en cada una.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-xs text-slate-500">
                  <a
                    className="underline font-medium"
                    href={
                      preventaPackTokenParam
                        ? `/cliente/pack/${encodeURIComponent(preventaPackTokenParam)}`
                        : `/cliente/pack/${redeemPackMeta.packOrderId}`
                    }
                  >
                    Volver al resumen del pack
                  </a>
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleVolverAlAlbum} className="text-sm">
                ← Volver al álbum para modificar selección
              </Button>
            </div>
          </div>

          {checkoutPartialWarning && !error ? (
            <Card className="bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-900">{checkoutPartialWarning}</p>
            </Card>
          ) : null}

          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{error}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 text-sm"
                onClick={handleRetryLoadCheckout}
              >
                Reintentar
              </Button>
            </Card>
          )}

          {!redeemMode && albumPricing?.extensionPricingActive && (
            <Card className="bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                ⏱ Este álbum está en período de extensión. Los productos tienen un recargo especial durante estos días.
              </p>
            </Card>
          )}

          {/* Paso 1: selector de laboratorio */}
          {!redeemMode && albumPricing?.enablePrintedPhotos && albumPricing?.allowClientLabSelection && (
            <Card className="bg-blue-100 border border-blue-300 ring-2 ring-blue-200 shadow-sm overflow-visible">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-700 text-white">
                    Paso 1
                  </span>
                  <h2 className="text-lg font-semibold text-[#0f172a]">
                    Elegí el laboratorio donde deseas imprimir
                  </h2>
                </div>
                <p className="text-sm text-[#1f2937]">
                  Este paso es obligatorio para calcular precios de impresión y tiempos de entrega.
                </p>
                <div className="relative space-y-2">
                  <div className="relative">
                    <label className="sr-only">Buscar laboratorio</label>
                    <Input
                      type="text"
                      placeholder="Buscar por nombre, ciudad, provincia..."
                      value={labSearch}
                      onChange={(e) => {
                        const search = e.target.value;
                        setLabSearch(search);
                        setShowLabDropdown(true);
                        // Cargar laboratorios: todos si está vacío, filtrados si hay 3+ caracteres
                        const url = search.trim().length >= 3
                          ? `/api/labs?search=${encodeURIComponent(search.trim())}`
                          : "/api/labs";
                        fetch(url)
                          .then((r) => r.json())
                          .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                          .catch(() => {});
                      }}
                      className="w-full"
                      aria-label="Buscar laboratorio"
                      onFocus={() => {
                        setShowLabDropdown(true);
                        if (!labSearch.trim()) {
                          fetch("/api/labs")
                            .then((r) => r.json())
                            .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                            .catch(() => {});
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowLabDropdown(false), 150);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowLabDropdown((prev) => !prev);
                        if (!labSearch.trim()) {
                          fetch("/api/labs")
                            .then((r) => r.json())
                            .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                            .catch(() => {});
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280]"
                      aria-label="Mostrar laboratorios"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {showLabDropdown && availableLabs.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-72 overflow-auto rounded-2xl border border-[#eef2f7] bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
                        {availableLabs.map((lab) => (
                          <button
                            key={lab.id}
                            type="button"
                            onClick={() => {
                              setClientSelectedLabId(lab.id);
                              setLabSearch(lab.name);
                              sessionStorage.setItem(`album_${albumId}_clientLabId`, String(lab.id));
                              setShowLabDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                              clientSelectedLabId === lab.id ? "bg-[#fdecec]" : "hover:bg-[#f8fafc]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fdecec] text-[#c27b3d]">
                                🏭
                              </span>
                              <div>
                                <div className="font-medium text-[#1a1a1a]">{lab.name}</div>
                                {formatLabInline(lab) && (
                                  <div className="text-xs text-[#6b7280]">{formatLabInline(lab)}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showLabDropdown && labSearch.trim() && availableLabs.length === 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-[#e5e7eb] bg-white shadow-lg px-3 py-2 text-sm text-[#6b7280]">
                        No se encontraron laboratorios.
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#1f2937]">
                  {clientSelectedLabId
                    ? "Los precios se calcularán según el laboratorio seleccionado."
                    : "Seleccioná un laboratorio para ver los precios de impresión."}
                </p>
                {selectedLab && (
                  <div className="mt-2 text-xs text-[#374151]">
                    <div className="font-medium text-[#1a1a1a]">{selectedLab.name}</div>
                    <div className="mt-1 space-y-1">
                      {(selectedLab.city || selectedLab.province) && (
                        <div>📍 {selectedLab.city || ""}{selectedLab.city && selectedLab.province ? ", " : ""}{selectedLab.province || ""}</div>
                      )}
                      {selectedLab.address && (
                        <div>🏠 {selectedLab.address}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {!redeemMode && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-[#111827]">Consejos de compra</h3>
          </div>
          )}

          {/* Tip de ahorro */}
          {!redeemMode && pricingLoaded && (maxDiscounts.d50 > 0 || maxDiscounts.d100 > 0) && (
            <Card className="bg-[#fafafa] border-[#eee]">
              <p className="text-sm text-[#374151]">
                <span className="font-medium">💡 Tip de ahorro:</span>{" "}
                {maxDiscounts.d50 > 0 && maxDiscounts.d100 > 0 ? (
                  <>
                    con este laboratorio, si pedís 50+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d50}% OFF</strong>. Y si pedís 100+ copias del mismo
                    tamaño, tenés hasta <strong>{maxDiscounts.d100}% OFF</strong>.
                  </>
                ) : maxDiscounts.d50 > 0 ? (
                  <>
                    con este laboratorio, si pedís 50+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d50}% OFF</strong>.
                  </>
                ) : (
                  <>
                    con este laboratorio, si pedís 100+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d100}% OFF</strong>.
                  </>
                )}
              </p>
            </Card>
          )}

          {!redeemMode && albumPricing?.includeDigitalWithPrint && (
            <Card className="bg-green-50 border border-green-200">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-900 mb-2">
                  📧 Archivo digital incluido
                </h3>
                <p className="text-sm text-green-800">
                  Al comprar fotos impresas, también recibirás el archivo digital por email
                  {albumPricing.digitalWithPrintDiscountPercent
                    ? ` con ${Math.round(albumPricing.digitalWithPrintDiscountPercent)}% de descuento.`
                    : " con el precio digital configurado."}
                </p>
              </div>
            </Card>
          )}

          {!redeemMode && albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos && (
            <Card className="bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-900">
                🔥 Recomendado: elegí <strong>Impresas</strong> para tener tus fotos en papel. Podés combinar con digital si querés.
              </p>
            </Card>
          )}

          {items.length > 0 && (
            <>
              {!redeemMode && albumPricing?.enablePrintedPhotos && selectedItems.size <= 1 && (
                <p className="text-sm text-[#6b7280]">
                  Seleccioná más de una fotografía para hacer una configuración masiva.
                </p>
              )}
              {!redeemMode && albumPricing?.enablePrintedPhotos && selectedItems.size > 1 && (
                <Card className="bg-[#f6f6f6] border border-[#e5e5e5]">
                  <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">
                    Configuración rápida
                  </h2>
                  <p className="text-sm text-[#6b7280] mb-4">
                    Aplicá producto, tamaño, acabado y cantidad de forma masiva.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {productsLoaded && labProducts.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                          Producto
                        </label>
                        <Select
                          value={bulkProductName || ""}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            if (!selectedName) {
                              setBulkProductName(null);
                              setBulkProductId(null);
                              return;
                            }
                            const match =
                              labProducts.find(
                                (p) =>
                                  p.name.split(" - ")[0].trim() === selectedName &&
                                  (p.size === bulkSize || !bulkSize)
                              ) ||
                              labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                            if (match) {
                              setBulkProductName(selectedName);
                              setBulkProductId(match.id);
                              if (match.size && match.size !== bulkSize) setBulkSize(match.size);
                              if (match.acabado) setBulkFinish(match.acabado as Finish);
                            }
                          }}
                        >
                          <option value="">Sin producto específico</option>
                          {Array.from(
                            new Set(
                              labProducts
                                .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                                .map((p) => p.name.split(" - ")[0].trim())
                            )
                          ).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Tamaño
                      </label>
                      <Select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)} disabled={!pricingLoaded || labPricing.basePrices.length === 0}>
                        {pricingLoaded && labPricing.basePrices.length > 0 ? (
                          labPricing.basePrices.map((bp) => (
                            <option key={bp.size} value={bp.size}>
                              {bp.size} cm
                            </option>
                          ))
                        ) : (
                          <option value="">Cargando...</option>
                        )}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Acabado
                      </label>
                      <Select
                        value={bulkFinish}
                        onChange={(e) => setBulkFinish(e.target.value as Finish)}
                      >
                        <option value="BRILLO">Brillo</option>
                        <option value="MATE">Mate</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Cantidad
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={bulkQuantity}
                        onChange={(e) => setBulkQuantity(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-end">
                    <Button
                      variant="primary"
                      onClick={applyBulkToAll}
                      className="text-sm px-4 py-2"
                    >
                      Aplicar a todas
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={applyBulkToSelected}
                      disabled={selectedItems.size === 0}
                      className="text-sm px-4 py-2"
                    >
                      Aplicar a seleccionadas ({selectedItems.size})
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={toggleSelectAll}
                      className="text-sm px-4 py-2"
                    >
                      {selectedItems.size === items.length
                        ? "Deseleccionar todas"
                        : "Seleccionar todas"}
                    </Button>
                  </div>
                </Card>
              )}

              <p className="text-sm text-[#6b7280]">
                {redeemMode
                  ? "Incluí en el pedido solo las fotos que querés usar para el canje. Ordená los ítems como querés que se consuman los beneficios (la asignación sigue el orden de la lista)."
                  : "Hacé clic en cada foto para incluirla o excluirla de tu pedido. Las que lleven el distintivo «Incluida en el pedido» forman parte del pedido y podés aplicar la configuración masiva a esas."}
              </p>

              {!redeemMode && faceBulkPricingActive && (
                <Card className="border border-emerald-200 bg-emerald-50/80 p-4 md:p-5">
                  <h2 className="text-base font-semibold text-emerald-950">
                    Pack: todas las fotos donde aparecés
                  </h2>
                  <p className="mt-1 text-sm text-emerald-900">
                    Incluye{" "}
                    <strong>{faceBulkPackPhotoIds.length}</strong>{" "}
                    {faceBulkPackPhotoIds.length === 1 ? "foto" : "fotos"} en digital. El precio del pack es una sola
                    línea (ya incluye comisión de plataforma); las fotos listadas abajo no se cobran por separado mientras
                    sigan en digital dentro del pack.
                  </p>
                  <p className="mt-3 text-lg font-semibold text-emerald-950">
                    {formatARS(faceBulkPackClientTotal)}
                  </p>
                </Card>
              )}

              <div id="checkout-fotos-pedido" className="space-y-6 scroll-mt-24">
                {items.map((item, index) => {
                  // Determinar tipo inicial basado en configuraciones del álbum
                  let tipo = item.tipo;
                  if (!tipo) {
                    if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
                      tipo = "digital";
                    } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
                      tipo = "impresa";
                    } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
                      tipo = "impresa";
                    } else {
                      tipo = "digital"; // Default
                    }
                  }
                  const pricingForItem = getPricingForItem(item);
                  const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
                  const digitalFeePctItem =
                    typeof albumPricing?.digitalClientFeePercent === "number" &&
                    Number.isFinite(albumPricing.digitalClientFeePercent) &&
                    albumPricing.digitalClientFeePercent >= 0
                      ? albumPricing.digitalClientFeePercent
                      : pricingForItem.platformCommissionPercent ?? 0;
                  const platformFeePctItem = digitalFeePctItem;
                  const hintedDigital = Number(item.uploaderDigitalPriceCents);
                  const digitalUnit =
                    Number.isFinite(hintedDigital) && hintedDigital > 0
                      ? hintedDigital
                      : (albumPricing?.digitalPhotoPriceCents ?? 0);
                  const photoIdForItem = parsePhotoIdFromCheckoutFileKey(item.fileKey);
                  const inFaceBulkPackDigital =
                    !redeemMode &&
                    faceBulkPricingActive &&
                    photoIdForItem != null &&
                    faceBulkPackIdSet.has(photoIdForItem) &&
                    tipo === "digital";
                  const showTipoChoice = redeemMode
                    ? (item.sellDigital ?? true) || (item.sellPrint ?? true)
                    : ((item.sellDigital ?? true) || (item.sellPrint ?? true)) &&
                      (albumPricing?.enableDigitalPhotos || albumPricing?.enablePrintedPhotos) &&
                      ((albumPricing?.digitalPhotoPriceCents ?? 0) > 0 || albumPricing?.enablePrintedPhotos);

                  let basePrice = 0;
                  let finalUnitPrice = 0;
                  let subtotal = 0;
                  let printDigitalBundleCents = 0;
                  let discountPercent = 0;
                  let qty = Number(item.quantity) || 1;

                  if (tipo === "digital") {
                    if (inFaceBulkPackDigital) {
                      finalUnitPrice = 0;
                      subtotal = 0;
                    } else {
                      discountPercent = digitalBulkDiscountPercent;
                      const discountedDigitalUnit = Math.round(
                        digitalUnit * (1 - discountPercent / 100)
                      );
                      finalUnitPrice = discountedDigitalUnit > 0
                        ? totalFromBase(discountedDigitalUnit, platformFeePctItem)
                        : 0;
                      subtotal = finalUnitPrice * 1;
                    }
                    qty = 1;
                  } else {
                    if (pricingLoaded && item.size && item.size !== "DIGITAL") {
                      basePrice = getItemBasePrice(item);
                      if (basePrice > 0) {
                        const withMargin = Math.round(basePrice * (1 + margin));
                        finalUnitPrice = totalFromBase(Math.round(withMargin), platformFeePctItem);
                        subtotal = (Number.isFinite(finalUnitPrice) && Number.isFinite(qty) ? finalUnitPrice * qty : 0);
                        const bundleAddon = computeAlbumPrintDigitalBundleAddon({
                          album: albumPricing,
                          digitalBaseCents: digitalUnit,
                          platformFeePct: platformFeePctItem,
                          printQuantity: qty,
                        });
                        if (bundleAddon?.active) {
                          printDigitalBundleCents = bundleAddon.total;
                          subtotal += bundleAddon.total;
                        }
                      } else {
                        finalUnitPrice = 0;
                        subtotal = 0;
                      }
                    } else {
                      finalUnitPrice = 0;
                      subtotal = 0;
                    }
                  }

                  return (
                    <OrderItem
                      key={item.fileKey}
                      id={item.fileKey}
                      previewUrl={item.previewUrl}
                      originalName={item.originalName}
                      size={item.size}
                      finish={item.finish}
                      quantity={tipo === "digital" ? 1 : item.quantity}
                      basePrice={basePrice}
                      discountPercent={discountPercent}
                      finalUnitPrice={finalUnitPrice}
                      subtotal={subtotal}
                      includesPrintDigitalBundle={printDigitalBundleCents > 0}
                      selected={selectedItems.has(index)}
                      onSelect={() => toggleItemSelection(index)}
                      onRemove={() => handleRemovePhoto(item.fileKey)}
                      onDuplicate={() => handleDuplicatePhoto(index)}
                      onOpenSlide={() => {
                        setSlideIndex(index);
                        setShowSlide(true);
                      }}
                      onSizeChange={(size) => updateItem(index, { size })}
                      onFinishChange={(finish) => updateItem(index, { finish: finish as Finish })}
                      onQuantityChange={(q) => updateItem(index, { quantity: q })}
                      tipo={tipo}
                      sellDigital={item.sellDigital ?? true}
                      sellPrint={item.sellPrint ?? true}
                      onTipoChange={showTipoChoice ? (t) => {
                        if (t === "digital" && (item.sellDigital ?? true)) {
                          updateItem(index, { tipo: "digital", quantity: 1 });
                        } else if (t === "impresa" && (item.sellPrint ?? true)) {
                          let validSize = item.size && item.size !== "DIGITAL" ? item.size : "10x15";
                          if (pricingLoaded && pricingForItem.basePrices.length > 0) {
                            const sizeExists = pricingForItem.basePrices.find((bp) => bp.size === validSize);
                            if (!sizeExists) {
                              validSize = pricingForItem.basePrices[0].size;
                            }
                          }
                          const pick = pickDefaultProduct(validSize);
                          updateItem(index, {
                            tipo: "impresa",
                            size: pick?.size || validSize,
                            ...(pick?.acabado ? { finish: pick.acabado as Finish } : {}),
                            ...(pick ? { productId: pick.id, productName: pick.name.split(" - ")[0].trim() } : {}),
                          });
                        }
                      } : undefined}
                      availableSizes={pricingLoaded ? pricingForItem.basePrices : undefined}
                      availableProducts={pricingForItem.products && pricingForItem.products.length > 0
                        ? pricingForItem.products
                            .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                            .map((p) => ({ id: p.id, name: p.name, size: p.size, acabado: p.acabado }))
                        : undefined}
                      productId={item.productId || null}
                      productName={item.productName || null}
                      showProductInHeader
                      onProductChange={(productId, productName) => {
                        if (!productId) {
                          updateItem(index, { productId: null, productName: null });
                          return;
                        }
                        const selectedProduct = labProducts.find((p) => p.id === productId);
                        if (selectedProduct) {
                          const prodName = productName || selectedProduct.name.split(" - ")[0].trim();
                          const match =
                            labProducts.find((p) => {
                              const pName = p.name.split(" - ")[0].trim();
                              return pName === prodName && (p.size === item.size || !item.size);
                            }) ||
                            labProducts.find((p) => p.name.split(" - ")[0].trim() === prodName);
                          updateItem(index, {
                            productId: match?.id || productId,
                            productName: prodName,
                            ...(match?.size && match.size !== item.size ? { size: match.size } : {}),
                            ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                          });
                        }
                      }}
                      tertiaryColor={photographer?.tertiaryColor}
                      checkoutPrivacy
                      faceBulkIncluded={inFaceBulkPackDigital}
                      hidePricing={redeemMode}
                      redeemMinimalUi={redeemMode}
                    />
                  );
                })}
              </div>

              {/* Mensaje de retiro de fotos impresas */}
              {!redeemMode && albumPricing?.pickupInfo && items.some((item) => (item.tipo || "digital") === "impresa") && (
                <Card className="bg-blue-50 border border-blue-200">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">
                      📍 Retiro de fotos impresas
                    </h3>
                    <p className="text-sm text-blue-800">
                      La dirección completa y el contacto para coordinar el retiro te los enviamos por email cuando el pago esté confirmado (así evitamos usos de la galería solo como listado para compras por fuera).
                    </p>
                    {albumPricing.pickupInfo.name && (
                      <p className="text-sm text-blue-900 font-medium">{albumPricing.pickupInfo.name}</p>
                    )}
                    {(albumPricing.pickupInfo.city || albumPricing.pickupInfo.province) && (
                      <p className="text-xs text-blue-700">
                        {[albumPricing.pickupInfo.city, albumPricing.pickupInfo.province].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Resumen final */}
              {!redeemMode && (
              <Card className="bg-[#f8f9fa]">
                <div className="space-y-4">
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-[#1a1a1a]">
                        Total descuento
                      </span>
                      <span className="text-xl font-normal text-[#10b981]">
                        -{formatARS(totals.totalDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-[#e5e7eb] gap-2">
                    <span className="text-lg sm:text-xl font-medium text-[#1a1a1a]">Total de tu pedido</span>
                    <span className="text-2xl sm:text-3xl font-normal text-[#1a1a1a]">
                      {formatARS(totals.totalWithSurcharge)}
                    </span>
                  </div>
                  {albumPricing?.extensionPricingActive && totals.extensionSurcharge > 0 && (
                    <div className="flex justify-between items-center text-sm text-amber-700">
                      <span>Recargo por extensión de álbum</span>
                      <span className="font-medium">+{formatARS(totals.extensionSurcharge)}</span>
                    </div>
                  )}
                </div>
              </Card>
              )}

              <div className="flex flex-col items-stretch sm:items-center gap-3 pt-6">
                {redeemMode ? (
                  <p className="text-center text-xs text-slate-500 max-w-xl mx-auto order-2 sm:order-1">
                    Al confirmar, el servidor valida el plazo del pack, que las fotos sigan en el álbum y, en beneficios
                    impresos, que el producto del laboratorio siga disponible.
                  </p>
                ) : null}
                <div className="flex justify-between items-center flex-wrap gap-3 w-full order-1 sm:order-2">
                <Button variant="secondary" onClick={handleVolverAlAlbum}>
                  ← Volver al álbum
                </Button>
                {redeemMode ? (
                  <Button
                    variant="primary"
                    onClick={() => void handleRedeemPack()}
                    disabled={
                      redeemSubmitting ||
                      !redeemPackMeta ||
                      !!redeemPackLoadError ||
                      items.length === 0 ||
                      (redeemPreflight != null && !redeemPreflight.build.ok)
                    }
                  >
                    {redeemSubmitting ? "Canjeando…" : "Confirmar canje del pack"}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleContinue} disabled={continueSubmitting}>
                    {continueSubmitting ? "Abriendo resumen..." : "Continuar al resumen"}
                  </Button>
                )}
                </div>
              </div>
            </>
          )}

          {items.length === 0 && !error && (
            <Card>
              <p className="text-[#6b7280] text-center">Cargando fotos...</p>
            </Card>
          )}
        </div>
      </div>
    </section>
        </CheckoutLeakGuard>
    {showSlide && slidePhotos.length > 0 && (
      <PhotoSlideViewer
        photos={slidePhotos}
        initialIndex={slideIndex}
        onClose={() => setShowSlide(false)}
        onPhotoSelect={(id) => {
          const index = itemIndexById.get(id);
          if (index !== undefined) {
            toggleItemSelection(index);
          }
        }}
        renderControls={(_, index) => {
          const item = items[index];
          if (!item) return null;

          let tipo = item.tipo;
          if (!tipo) {
            const sd = item.sellDigital ?? true;
            const sp = item.sellPrint ?? true;
            if (sd && !sp) tipo = "digital";
            else if (!sd && sp) tipo = "impresa";
            else if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
              tipo = "digital";
            } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
              tipo = "impresa";
            } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
              tipo = "digital"; // Por defecto digital
            } else {
              tipo = "digital";
            }
          }

          const showTipoChoice = redeemMode
            ? (item.sellDigital ?? true) || (item.sellPrint ?? true)
            : ((item.sellDigital ?? true) || (item.sellPrint ?? true)) &&
              (albumPricing?.enableDigitalPhotos || albumPricing?.enablePrintedPhotos) &&
              ((albumPricing?.digitalPhotoPriceCents ?? 0) > 0 || albumPricing?.enablePrintedPhotos);

          if (redeemMode) {
            return (
              <div className="w-full max-w-sm mx-auto px-2 py-2 rounded-lg bg-black/55 text-white backdrop-blur-sm">
                <p className="text-[10px] text-center text-white/90 mb-2 leading-snug">
                  Canje: no elegís producto ni tamaño acá; solo <strong>Digital</strong> o <strong>Impresa</strong>.
                </p>
                {showTipoChoice ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {(item.sellPrint ?? true) && (
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                          tipo === "impresa" ? "bg-[#c27b3d] text-white" : "bg-white text-[#374151]"
                        }`}
                        onClick={() => updateItem(index, { tipo: "impresa" })}
                      >
                        Impresa
                      </button>
                    )}
                    {(item.sellDigital ?? true) && (
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                          tipo === "digital" ? "bg-[#111827] text-white" : "bg-white text-[#374151]"
                        }`}
                        onClick={() => updateItem(index, { tipo: "digital", quantity: 1 })}
                      >
                        Digital
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-center text-white/85">Un solo formato disponible para esta foto.</p>
                )}
              </div>
            );
          }

          const productNames = Array.from(
            new Set(
              labProducts
                .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                .map((p) => p.name.split(" - ")[0].trim())
            )
          );

          const sizes = labProducts.length > 0 && item.productName
            ? Array.from(
                new Set(
                  labProducts
                    .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size)
                    .map((p) => p.size as string)
                )
              )
            : Array.from(new Set(labPricing.basePrices.map((bp) => bp.size)));

          const finishes = labProducts.length > 0 && item.productName && item.size
            ? Array.from(
                new Set(
                  labProducts
                    .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size === item.size && p.acabado)
                    .map((p) => p.acabado as string)
                )
              )
            : ["BRILLO", "MATE"];

          return (
            <div className="grid grid-cols-4 gap-2 items-end text-black">
              {labProducts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-medium mb-1">Producto</label>
                  <Select
                    className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                    value={item.productName || ""}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      if (!selectedName) {
                        updateItem(index, { productId: null, productName: null });
                        return;
                      }
                      const match =
                        labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName && (p.size === item.size || !item.size)) ||
                        labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                      updateItem(index, {
                        productId: match?.id ?? null,
                        productName: selectedName,
                        ...(match?.size ? { size: match.size } : {}),
                        ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                      });
                    }}
                  >
                    <option value="">Seleccionar producto</option>
                    {productNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-medium mb-1">Tamaño</label>
                <Select
                  className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                  value={item.size}
                  onChange={(e) => updateItem(index, { size: e.target.value })}
                  disabled={tipo === "digital"}
                >
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s} cm
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1">Acabado</label>
                <Select
                  className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                  value={item.finish}
                  onChange={(e) => updateItem(index, { finish: e.target.value as Finish })}
                  disabled={tipo === "digital"}
                >
                  {finishes.map((f) => (
                    <option key={f} value={f}>
                      {f === "BRILLO" ? "Brillo" : f === "MATE" ? "Mate" : f}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1">Cantidad</label>
                <Input
                  className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                  disabled={tipo === "digital"}
                />
              </div>
              {showTipoChoice && (
                <div className="col-span-4 flex items-center justify-end gap-2 mt-1">
                  <span className="text-[11px] text-[#6b7280]">Formato:</span>
                  {(item.sellPrint ?? true) && (redeemMode || albumPricing?.enablePrintedPhotos) && (
                    <button
                      className={`px-2 py-1 rounded-md text-[11px] ${tipo === "impresa" ? "bg-[#c27b3d] text-white" : "bg-white text-[#374151]"}`}
                      onClick={() => updateItem(index, { tipo: "impresa" })}
                    >
                      Impresa
                    </button>
                  )}
                  {(item.sellDigital ?? true) && (redeemMode || albumPricing?.enableDigitalPhotos) && (
                    <button
                      className={`px-2 py-1 rounded-md text-[11px] ${tipo === "digital" ? "bg-[#111827] text-white" : "bg-white text-[#374151]"}`}
                      onClick={() => updateItem(index, { tipo: "digital", quantity: 1 })}
                    >
                      Digital
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    )}
        {photographer ? (
          <PhotographerFooter photographer={photographer} />
        ) : null}
      </>
    </ProtectedAlbumWrapper>
  );
}
