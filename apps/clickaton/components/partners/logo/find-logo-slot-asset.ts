import {
  normalizePartnerLogoBackground,
  type DnxPartnerBrandAssetType,
  type PartnerLogoSlotBackground,
  type PartnerLogoSlotGuide,
} from "@repo/partners/client-safe";

export type LogoSlotAssetLike = {
  type: DnxPartnerBrandAssetType;
  backgroundType?: string | null;
};

/**
 * Último asset que cubre un slot (type + background), con compat legacy LIGHT/DARK.
 */
export function findLogoSlotAsset<T extends LogoSlotAssetLike>(
  assets: readonly T[],
  slot: PartnerLogoSlotGuide,
): T | undefined {
  const matches = assets.filter((a) => assetCoversLogoSlot(a, slot));
  return matches[matches.length - 1];
}

export function assetCoversLogoSlot(
  asset: LogoSlotAssetLike,
  slot: Pick<PartnerLogoSlotGuide, "type" | "backgroundType">,
): boolean {
  if (asset.type === slot.type) {
    const bg = normalizePartnerLogoBackground(
      (asset.backgroundType as PartnerLogoSlotBackground | null | undefined) ?? "UNKNOWN",
    );
    return bg === slot.backgroundType;
  }
  if (slot.backgroundType === "DARK" && asset.type === "LOGO_LIGHT") {
    return slot.type === "LOGO_PRIMARY" || slot.type === "LOGO_GENERAL";
  }
  if (slot.backgroundType === "LIGHT" && asset.type === "LOGO_DARK") {
    return slot.type === "LOGO_PRIMARY" || slot.type === "LOGO_GENERAL";
  }
  return false;
}
