import { prisma } from "@/lib/prisma";

/** Capabilities MVP para el upsell engine */
export const UPSELL_CAPABILITIES = [
  "DIGITAL_SALES",
  "PRINT_SALES",
  "RETOUCH_PRO",
  "EXPRESS_DELIVERY",
  "STORAGE_EXTEND",
] as const;

export type Capability = (typeof UPSELL_CAPABILITIES)[number];

export function isCapability(s: string): s is Capability {
  return UPSELL_CAPABILITIES.includes(s as Capability);
}

type PhotographerSalesSettingsRow = {
  capabilities: string[];
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
};

type AlbumRow = {
  expirationExtensionDays: number | null;
  expiresAt: Date | null;
};

/** Deriva el set de capabilities del fotógrafo desde flags si capabilities está vacío */
function photographerCapabilitiesFromSettings(
  settings: PhotographerSalesSettingsRow | null
): Set<Capability> {
  if (!settings) return new Set<Capability>();
  const fromArray =
    settings.capabilities?.length > 0
      ? settings.capabilities.filter(isCapability)
      : [];
  if (fromArray.length > 0) {
    return new Set(fromArray);
  }
  const set = new Set<Capability>();
  if (settings.digitalEnabled) set.add("DIGITAL_SALES");
  if (settings.printsEnabled) set.add("PRINT_SALES");
  if (settings.retouchEnabled) set.add("RETOUCH_PRO");
  if (settings.expressEnabled) set.add("EXPRESS_DELIVERY");
  if (settings.storageExtendEnabled) set.add("STORAGE_EXTEND");
  return set;
}

/**
 * Obtiene las capabilities efectivas para un usuario en un álbum (herencia o override).
 * - Si inherit: effective = photographerCaps - disabledCapabilities
 * - Si !inherit: effective = allowedCapabilities ∩ photographerCaps
 */
export async function getEffectiveCapabilities(params: {
  userId: number;
  albumId: number;
}): Promise<Set<Capability>> {
  try {
    const [photographerSettings, albumSettings, album] = await Promise.all([
      prisma.photographerSalesSettings.findUnique({
        where: { userId: params.userId },
      }),
      prisma.albumSalesSettings.findUnique({
        where: { albumId: params.albumId },
      }),
      prisma.album.findUnique({
        where: { id: params.albumId },
        select: { userId: true },
      }),
    ]);

    if (!album || album.userId !== params.userId) return new Set<Capability>();

    const photographerCaps = photographerCapabilitiesFromSettings(
      photographerSettings as PhotographerSalesSettingsRow | null
    );

    if (!albumSettings || albumSettings.inheritFromPhotographer) {
      const disabled = (albumSettings?.disabledCapabilities ?? []).filter(
        isCapability
      );
      const result = new Set(photographerCaps);
      disabled.forEach((c) => result.delete(c));
      return result;
    }

    const allowed = (albumSettings.allowedCapabilities ?? []).filter(
      isCapability
    );
    return new Set(allowed.filter((c) => photographerCaps.has(c)));
  } catch {
    return new Set<Capability>();
  }
}

function hasValidJson(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "object" && !Array.isArray(val)) {
    return Object.keys(val as object).length > 0;
  }
  if (Array.isArray(val)) return val.length > 0;
  return false;
}

/**
 * Valida si el fotógrafo tiene la configuración mínima para cumplir una capability.
 * Fail-safe: si algo falla, retorna false.
 */
export function validateAvailability(params: {
  capability: Capability;
  userSettings: PhotographerSalesSettingsRow | null;
  album?: AlbumRow | null;
}): boolean {
  try {
    const { capability, userSettings, album } = params;
    if (!userSettings) return false;

    switch (capability) {
      case "DIGITAL_SALES":
        return userSettings.digitalEnabled !== false;
      case "PRINT_SALES":
        return (
          userSettings.printsEnabled === true &&
          hasValidJson(userSettings.printsPriceListJson) &&
          hasValidJson(userSettings.printsFulfillmentJson)
        );
      case "RETOUCH_PRO":
        return (
          userSettings.retouchEnabled === true &&
          hasValidJson(userSettings.retouchPricingJson)
        );
      case "EXPRESS_DELIVERY":
        return (
          userSettings.expressEnabled === true &&
          hasValidJson(userSettings.expressPricingJson)
        );
      case "STORAGE_EXTEND":
        const hasStoragePricing =
          userSettings.storageExtendEnabled === true &&
          hasValidJson(userSettings.storageExtendPricingJson);
        if (!hasStoragePricing) return false;
        if (!album) return false;
        // El álbum debe tener días de extensión definidos para que el upsell tenga sentido
        const hasExpiry =
          album.expirationExtensionDays != null && album.expirationExtensionDays > 0;
        return hasExpiry;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Valida si una estrategia puede mostrarse: capabilities efectivas incluyen las requeridas
 * y la configuración del fotógrafo cumple validateAvailability para cada una.
 */
export function validateStrategyAvailability(params: {
  requiredCapabilities: string[];
  requiredConfigKeys: string[];
  effectiveCapabilities: Set<Capability>;
  userSettings: PhotographerSalesSettingsRow | null;
  album?: AlbumRow | null;
}): boolean {
  try {
    const {
      requiredCapabilities,
      requiredConfigKeys,
      effectiveCapabilities,
      userSettings,
      album,
    } = params;

    for (const cap of requiredCapabilities) {
      if (!isCapability(cap)) return false;
      if (!effectiveCapabilities.has(cap)) return false;
      if (!validateAvailability({ capability: cap, userSettings, album }))
        return false;
    }

    for (const key of requiredConfigKeys ?? []) {
      if (!userSettings) return false;
      const m: Record<string, unknown> = {
        printsPriceList: userSettings.printsPriceListJson,
        printsFulfillment: userSettings.printsFulfillmentJson,
        retouchPricing: userSettings.retouchPricingJson,
        expressPricing: userSettings.expressPricingJson,
        storageExtendPricing: userSettings.storageExtendPricingJson,
      };
      if (!hasValidJson(m[key])) return false;
    }

    return true;
  } catch {
    return false;
  }
}
