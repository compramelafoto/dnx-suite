import { TERMS_VERSION } from "@/lib/terms/photographerTerms";

/** Estado comercial del álbum para dashboard y galería. */
export type AlbumSalesStatus = "pending" | "incomplete" | "active";

export type AlbumSalesReadinessGap =
  | "active_product"
  | "digital_price"
  | "terms"
  | "prints";

export type AlbumSalesReadinessInput = {
  enableDigitalPhotos?: boolean | null;
  enablePrintedPhotos?: boolean | null;
  digitalPhotoPriceCents?: number | null;
  albumProfitMarginPercent?: number | null;
  selectedLabId?: number | null;
  pickupBy?: string | null;
  printPricingSource?: string | null;
  termsAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
  eventCollaborativePhotoPricing?: {
    locksPhotographerDigitalPricing?: boolean;
    fixedPhotoPrice?: number | null;
  } | null;
  /**
   * Si es `false`, impresiones en modo fotógrafo no están listas.
   * Si es `undefined`, no se exige en contextos sin catálogo (p. ej. listado).
   */
  hasActivePrintProducts?: boolean;
};

export type AlbumSalesReadinessResult = {
  status: AlbumSalesStatus;
  readyToSell: boolean;
  gaps: AlbumSalesReadinessGap[];
  enableDigital: boolean;
  enablePrinted: boolean;
  hasAnySaleChannel: boolean;
  termsOk: boolean;
  digitalReady: boolean;
  printsReady: boolean;
};

export const GALLERY_SALES_NOT_READY_MESSAGE =
  "Las fotos ya están disponibles, pero la venta todavía no fue habilitada por el fotógrafo.";

export const CHECKOUT_SALES_NOT_READY_MESSAGE =
  "Este álbum todavía no está disponible para compra.";

/** Código estable en respuestas JSON de APIs de checkout. */
export const ALBUM_SALES_NOT_READY_API_CODE = "SALES_NOT_READY";

export const ALBUM_SALES_STATUS_LABELS: Record<AlbumSalesStatus, string> = {
  pending: "Venta pendiente de configurar",
  incomplete: "Venta incompleta",
  active: "Venta activa",
};

export const ALBUM_SALES_GAP_LABELS: Record<AlbumSalesReadinessGap, string> = {
  active_product: "Activar al menos un producto (digital o impresiones)",
  digital_price: "Configurar precio digital",
  terms: "Aceptar términos y condiciones",
  prints: "Configurar impresiones",
};

function boolOrDefault(value: boolean | null | undefined, defaultValue: boolean): boolean {
  return value !== undefined && value !== null ? Boolean(value) : defaultValue;
}

function positiveStoredDigitalPrice(cents: number | null | undefined): boolean {
  const n = Number(cents);
  return Number.isFinite(n) && n > 0;
}

export function isAlbumTermsAccepted(input: Pick<AlbumSalesReadinessInput, "termsAcceptedAt" | "termsVersion">): boolean {
  return Boolean(input.termsAcceptedAt) && input.termsVersion === TERMS_VERSION;
}

/** Precio digital listo: solo valor guardado en el álbum o precio fijado por organizador. */
export function isAlbumDigitalSalesReady(
  input: Pick<
    AlbumSalesReadinessInput,
    "digitalPhotoPriceCents" | "eventCollaborativePhotoPricing"
  >
): boolean {
  const locks = Boolean(input.eventCollaborativePhotoPricing?.locksPhotographerDigitalPricing);
  const fixed = input.eventCollaborativePhotoPricing?.fixedPhotoPrice;
  if (locks && typeof fixed === "number" && Number.isFinite(fixed) && fixed > 0) {
    return true;
  }
  return positiveStoredDigitalPrice(input.digitalPhotoPriceCents);
}

/** Impresiones listas: margen explícito + lab/retiro + productos si aplica. */
export function isAlbumPrintsSalesReady(input: AlbumSalesReadinessInput): boolean {
  const enablePrinted = boolOrDefault(input.enablePrintedPhotos, true);
  if (!enablePrinted) return true;

  const margin = input.albumProfitMarginPercent;
  if (margin == null || !Number.isFinite(Number(margin))) {
    return false;
  }

  const pricingSource = input.printPricingSource === "LAB_PREFERRED" ? "LAB_PREFERRED" : "PHOTOGRAPHER";
  if (pricingSource === "LAB_PREFERRED") {
    if (input.selectedLabId == null) return false;
  }
  // Fase 1 (PHOTOGRAPHER, sin lab): alcanza con margen; el catálogo se valida al cotizar impresiones.

  if (input.selectedLabId != null && input.pickupBy !== "CLIENT" && input.pickupBy !== "PHOTOGRAPHER") {
    return false;
  }

  return true;
}

/**
 * Criterio para compra suelta (digitales / impresiones individuales en grilla).
 * Los packs de galería usan `isAlbumPackGalleryAvailable` y no requieren este flag.
 * FaceBulk tiene flujo propio.
 */
export function evaluateAlbumSalesReadiness(input: AlbumSalesReadinessInput): AlbumSalesReadinessResult {
  const enableDigital = boolOrDefault(input.enableDigitalPhotos, true);
  const enablePrinted = boolOrDefault(input.enablePrintedPhotos, true);
  const hasAnySaleChannel = enableDigital || enablePrinted;
  const termsOk = isAlbumTermsAccepted(input);
  const digitalReady = !enableDigital || isAlbumDigitalSalesReady(input);
  const printsReady = isAlbumPrintsSalesReady(input);

  const gaps: AlbumSalesReadinessGap[] = [];
  if (!hasAnySaleChannel) {
    gaps.push("active_product");
  }
  if (enableDigital && !digitalReady) {
    gaps.push("digital_price");
  }
  if (!termsOk) {
    gaps.push("terms");
  }
  if (enablePrinted && !printsReady) {
    gaps.push("prints");
  }

  const readyToSell =
    hasAnySaleChannel && termsOk && digitalReady && printsReady;

  let status: AlbumSalesStatus;
  if (readyToSell) {
    status = "active";
  } else if (!hasAnySaleChannel) {
    status = "pending";
  } else {
    status = "incomplete";
  }

  return {
    status,
    readyToSell,
    gaps,
    enableDigital,
    enablePrinted,
    hasAnySaleChannel,
    termsOk,
    digitalReady,
    printsReady,
  };
}

export function isAlbumReadyToSell(input: AlbumSalesReadinessInput): boolean {
  return evaluateAlbumSalesReadiness(input).readyToSell;
}

/**
 * Compra suelta en grilla/checkout: basta con que al menos un canal (digital o impresiones)
 * esté listo. No exige que ambos canales estén configurados si solo uno está activo.
 */
export function isAlbumSinglesPurchaseReady(input: AlbumSalesReadinessInput): boolean {
  const readiness = evaluateAlbumSalesReadiness(input);
  if (!readiness.termsOk || !readiness.hasAnySaleChannel) return false;
  return (
    (readiness.enableDigital && readiness.digitalReady) ||
    (readiness.enablePrinted && readiness.printsReady)
  );
}
