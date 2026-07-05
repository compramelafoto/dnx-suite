import type { PrintPricingSource } from "@prisma/client";
import type { Capability } from "@/lib/upsells/capabilities";
import type { EventDigitalPhotoBasePriceResolution } from "@/lib/pricing/event-digital-photo-price-resolver";

export type AlbumSalesPolicyVersion = "v1";

export type DigitalPriceSource =
  | "album_stored"
  | "photographer_default"
  | "platform_minimum"
  | "event_fixed"
  | "event_minimum"
  | "event_photographer_decides"
  | "none";

export type MarginSource = "album" | "photographer" | "none";

export type EffectiveLabSource = "album_selected" | "photographer_preferred" | "none";

export type AlbumSalesPolicyCapabilities = {
  photographer: Capability[];
  effective: Capability[];
  inheritFromPhotographer: boolean;
  allowed: Capability[];
  disabled: Capability[];
  digitalSales: boolean;
  printSales: boolean;
};

export type AlbumSalesPolicyDigital = {
  /** Capability DIGITAL_SALES efectiva (modelo nuevo). */
  capabilityEnabled: boolean;
  /** Flag legacy en Album.enableDigitalPhotos (checkout productivo hoy). */
  legacyEnabled: boolean;
  /** Igual que legacyEnabled en Fase 1 — no cambia cobro. */
  checkoutEnabled: boolean;
  legacyBasePriceArs: number | null;
  effectiveBasePriceArs: number | null;
  legacyBasePriceSource: DigitalPriceSource;
  effectiveBasePriceSource: DigitalPriceSource;
  eventResolution: EventDigitalPhotoBasePriceResolution | null;
  organizerLocksPricing: boolean;
};

export type AlbumSalesPolicyPrint = {
  capabilityEnabled: boolean;
  legacyEnabled: boolean;
  checkoutEnabled: boolean;
  marginPercent: number;
  marginSource: MarginSource;
  pricingSource: PrintPricingSource;
  pickupBy: "CLIENT" | "PHOTOGRAPHER" | null;
  hasMarginConfigured: boolean;
  hasPickupWhenLab: boolean;
};

export type AlbumSalesPolicyLab = {
  selectedLabId: number | null;
  preferredLabId: number | null;
  effectiveLabId: number | null;
  effectiveLabSource: EffectiveLabSource;
};

export type AlbumSalesPolicyFees = {
  digitalMarketplacePercent: number;
  printPlatformPercent: number;
};

export type AlbumSalesPolicyFaceBulk = {
  enabled: boolean;
  basePriceArs: number | null;
};

export type AlbumSalesPolicyCompleteness = {
  /** Misma regla que `isAlbumComplete` (checkout productivo). */
  legacyIsComplete: boolean;
  canAcceptStandardCheckoutOrders: boolean;
  termsOk: boolean;
  hasAnySaleChannel: boolean;
  digitalConfigReady: boolean;
  printConfigReady: boolean;
  blockingReasons: string[];
  informationalReasons: string[];
};

export type AlbumSalesPolicyDivergence = {
  digitalLegacyVsCapability: boolean;
  printLegacyVsCapability: boolean;
  hasAny: boolean;
  summaryLines: string[];
};

export type AlbumSalesPolicy = {
  version: AlbumSalesPolicyVersion;
  albumId: number;
  photographerId: number;
  eventId: number | null;
  capabilities: AlbumSalesPolicyCapabilities;
  digital: AlbumSalesPolicyDigital;
  print: AlbumSalesPolicyPrint;
  lab: AlbumSalesPolicyLab;
  fees: AlbumSalesPolicyFees;
  faceBulk: AlbumSalesPolicyFaceBulk;
  completeness: AlbumSalesPolicyCompleteness;
  divergence: AlbumSalesPolicyDivergence;
  resolvedAt: string;
};
