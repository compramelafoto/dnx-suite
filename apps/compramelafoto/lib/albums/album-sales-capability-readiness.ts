import type { Capability } from "@/lib/upsells/capabilities";

export const ALBUM_SALES_CAPABILITIES = [
  "DIGITAL_SALES",
  "PRINT_SALES",
  "RETOUCH_PRO",
  "EXPRESS_DELIVERY",
  "STORAGE_EXTEND",
] as const satisfies readonly Capability[];

/** Capabilities visibles/configurables por el fotógrafo (sin extensión de almacenamiento). */
export const PHOTOGRAPHER_ALBUM_SALES_CAPABILITIES = ALBUM_SALES_CAPABILITIES.filter(
  (cap) => cap !== "STORAGE_EXTEND"
);

export type AlbumSalesCapabilityId = (typeof ALBUM_SALES_CAPABILITIES)[number];

export type PhotographerSalesSnapshot = {
  digitalEnabled: boolean;
  printsEnabled: boolean;
  retouchEnabled: boolean;
  expressEnabled: boolean;
  storageExtendEnabled: boolean;
  printsPriceListJson: unknown;
  printsFulfillmentJson: unknown;
  retouchPricingJson: unknown;
  expressPricingJson: unknown;
  storageExtendPricingJson: unknown;
  preferredLabId?: number | null;
};

export type AlbumSalesReadinessAlbum = {
  digitalPhotoPriceCents?: number | null;
  expirationExtensionDays?: number | null;
  eventCollaborativePhotoPricing?: {
    locksPhotographerDigitalPricing?: boolean;
    fixedPhotoPrice?: number | null;
  } | null;
};

export type AlbumCapabilityUiStatus =
  | "active"
  | "needs_config"
  | "inherited_global"
  | "disabled_in_album"
  | "not_offered_globally";

export type AlbumCapabilityReadiness = {
  capability: AlbumSalesCapabilityId;
  globallyOffered: boolean;
  globallyConfigured: boolean;
  configHint: string;
  uiStatus: AlbumCapabilityUiStatus;
  canToggleInAlbum: boolean;
};

function hasValidJson(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "object" && !Array.isArray(val)) {
    return Object.keys(val as object).length > 0;
  }
  if (Array.isArray(val)) return val.length > 0;
  return false;
}

function hasPositivePriceJson(val: unknown): boolean {
  if (!hasValidJson(val)) return false;
  if (typeof val !== "object" || val == null || Array.isArray(val)) return true;
  const o = val as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : typeof o.priceCents === "number" ? o.priceCents / 100 : null;
  if (price != null) return Number.isFinite(price) && price >= 0;
  return true;
}

export function isDigitalPriceReadyForAlbum(
  album: AlbumSalesReadinessAlbum,
  digitalPriceInput?: string | null
): { ready: boolean; hint: string } {
  const locks = Boolean(album.eventCollaborativePhotoPricing?.locksPhotographerDigitalPricing);
  const fixed = album.eventCollaborativePhotoPricing?.fixedPhotoPrice;
  if (locks && typeof fixed === "number" && Number.isFinite(fixed) && fixed > 0) {
    return { ready: true, hint: "Precio del evento definido por el organizador." };
  }

  const fromInput = digitalPriceInput?.trim().replace(",", ".");
  if (fromInput) {
    const parsed = parseFloat(fromInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { ready: true, hint: "Precio digital configurado en este álbum." };
    }
  }

  const stored = album.digitalPhotoPriceCents;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return { ready: true, hint: "Precio digital configurado en este álbum." };
  }

  return {
    ready: false,
    hint: "Definí el precio digital en la pestaña Venta → Qué vendés.",
  };
}

export function isPhotographerCapabilityGloballyOffered(
  capability: AlbumSalesCapabilityId,
  settings: PhotographerSalesSnapshot | null
): boolean {
  if (!settings) {
    return capability === "DIGITAL_SALES";
  }
  switch (capability) {
    case "DIGITAL_SALES":
      return settings.digitalEnabled !== false;
    case "PRINT_SALES":
      return settings.printsEnabled === true;
    case "RETOUCH_PRO":
      return settings.retouchEnabled === true;
    case "EXPRESS_DELIVERY":
      return settings.expressEnabled === true;
    case "STORAGE_EXTEND":
      return settings.storageExtendEnabled === true;
    default:
      return false;
  }
}

export function isPhotographerCapabilityGloballyConfigured(
  capability: AlbumSalesCapabilityId,
  settings: PhotographerSalesSnapshot | null,
  ctx: {
    album: AlbumSalesReadinessAlbum;
    digitalPriceInput?: string | null;
    hasActivePrintProducts?: boolean;
  }
): { configured: boolean; hint: string } {
  if (!isPhotographerCapabilityGloballyOffered(capability, settings)) {
    return {
      configured: false,
      hint: "Activá y configurá esta opción en Ventas globales.",
    };
  }

  switch (capability) {
    case "DIGITAL_SALES": {
      const digital = isDigitalPriceReadyForAlbum(ctx.album, ctx.digitalPriceInput);
      return { configured: digital.ready, hint: digital.hint };
    }
    case "PRINT_SALES": {
      if (!settings) {
        return { configured: false, hint: "Configurá impresiones en Ventas globales." };
      }
      const fulfillment = hasValidJson(settings.printsFulfillmentJson);
      const priceList = hasValidJson(settings.printsPriceListJson);
      const lab = settings.preferredLabId != null && Number.isFinite(settings.preferredLabId);
      const ownProducts = Boolean(ctx.hasActivePrintProducts);
      if (fulfillment && (priceList || lab || ownProducts)) {
        return { configured: true, hint: "Lista de precios y entrega configuradas." };
      }
      if (!fulfillment) {
        return { configured: false, hint: "Completá el tipo de entrega de impresiones." };
      }
      return {
        configured: false,
        hint: "Elegí un laboratorio, cargá productos impresos o definí la lista de precios.",
      };
    }
    case "RETOUCH_PRO":
      if (hasPositivePriceJson(settings?.retouchPricingJson)) {
        return { configured: true, hint: "Precio de retoque configurado." };
      }
      return { configured: false, hint: "Definí el precio del adicional de retoque." };
    case "EXPRESS_DELIVERY":
      if (hasPositivePriceJson(settings?.expressPricingJson)) {
        return { configured: true, hint: "Precio de entrega express configurado." };
      }
      return { configured: false, hint: "Definí el precio del adicional de entrega express." };
    case "STORAGE_EXTEND": {
      if (!hasPositivePriceJson(settings?.storageExtendPricingJson)) {
        return { configured: false, hint: "Definí el precio de extensión de almacenamiento." };
      }
      const days = ctx.album.expirationExtensionDays;
      if (typeof days === "number" && days > 0) {
        return { configured: true, hint: "Precio y días de extensión del álbum configurados." };
      }
      return {
        configured: false,
        hint: "Configurá los días de extensión del álbum (vencimiento) para ofrecer esta opción.",
      };
    }
    default:
      return { configured: false, hint: "" };
  }
}

export function resolveAlbumCapabilityReadiness(params: {
  capability: AlbumSalesCapabilityId;
  inheritFromPhotographer: boolean;
  disabledCapabilities: string[];
  allowedCapabilities: string[];
  photographerSettings: PhotographerSalesSnapshot | null;
  album: AlbumSalesReadinessAlbum;
  digitalPriceInput?: string | null;
  hasActivePrintProducts?: boolean;
}): AlbumCapabilityReadiness {
  const {
    capability,
    inheritFromPhotographer,
    disabledCapabilities,
    allowedCapabilities,
    photographerSettings,
    album,
    digitalPriceInput,
    hasActivePrintProducts,
  } = params;

  const globallyOffered = isPhotographerCapabilityGloballyOffered(capability, photographerSettings);
  const { configured: globallyConfigured, hint: configHint } =
    isPhotographerCapabilityGloballyConfigured(capability, photographerSettings, {
      album,
      digitalPriceInput,
      hasActivePrintProducts,
    });

  let uiStatus: AlbumCapabilityUiStatus;
  if (!globallyOffered) {
    uiStatus = "not_offered_globally";
  } else if (!globallyConfigured) {
    uiStatus = "needs_config";
  } else if (inheritFromPhotographer) {
    uiStatus = disabledCapabilities.includes(capability)
      ? "disabled_in_album"
      : "inherited_global";
  } else {
    uiStatus = allowedCapabilities.includes(capability) ? "active" : "disabled_in_album";
  }

  const canToggleInAlbum = globallyOffered && globallyConfigured;

  return {
    capability,
    globallyOffered,
    globallyConfigured,
    configHint,
    uiStatus,
    canToggleInAlbum,
  };
}

export const CAPABILITY_STATUS_LABELS: Record<AlbumCapabilityUiStatus, string> = {
  active: "Activo",
  needs_config: "Falta configurar",
  inherited_global: "Heredado de configuración general",
  disabled_in_album: "Desactivado en este álbum",
  not_offered_globally: "No ofrecido globalmente",
};

export type CapabilityQuickActionId =
  | "configure_price"
  | "configure_prints"
  | "configure_addons"
  | "global_sales";

export function quickActionForCapability(
  capability: AlbumSalesCapabilityId,
  albumId: number
): { id: CapabilityQuickActionId; label: string; href: string } | null {
  switch (capability) {
    case "DIGITAL_SALES":
      return {
        id: "configure_price",
        label: "Configurar precio digital",
        href: `/dashboard/albums/${albumId}?tab=ventas#album-ventas-precio-digital`,
      };
    case "PRINT_SALES":
      return {
        id: "configure_prints",
        label: "Configurar impresiones",
        href: `/dashboard/albums/${albumId}?tab=ventas#album-ventas-impresiones`,
      };
    case "RETOUCH_PRO":
    case "EXPRESS_DELIVERY":
      return {
        id: "configure_addons",
        label: "Configurar adicionales",
        href:
          capability === "RETOUCH_PRO"
            ? "/dashboard/sales-settings#config-retoque"
            : "/dashboard/sales-settings#config-express",
      };
    case "STORAGE_EXTEND":
      return {
        id: "configure_addons",
        label: "Configurar adicionales",
        href: "/dashboard/sales-settings#config-storage",
      };
    default:
      return null;
  }
}

export const GLOBAL_SALES_HREF = "/dashboard/sales-settings";

/** Fase 1 — análisis unificado (sin impacto en checkout). */
export {
  buildSalesPolicyDiagnosticItems,
  buildSalesPolicyReadinessSummary,
  eventCollaborativePricingFromPolicy,
  salesPolicyReadinessSeverity,
} from "@/lib/sales/album-sales-policy-readiness";
export type { SalesPolicyReadinessSummary } from "@/lib/sales/album-sales-policy-readiness";
export type { AlbumSalesPolicy } from "@/lib/sales/album-sales-policy-types";
export { resolveAlbumSalesPolicy, resolveAlbumSalesPolicyFromInput } from "@/lib/sales/resolve-album-sales-policy";
