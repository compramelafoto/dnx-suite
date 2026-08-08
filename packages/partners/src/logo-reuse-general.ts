import type { DnxPartnerBrandAssetType } from "./assets-types";
import {
  PARTNER_LOGO_ASSET_TYPES,
  PARTNER_LOGO_FAMILIES,
  type PartnerLogoSlotBackground,
} from "./logo-types";

const REUSABLE_FROM_GENERAL = new Set<DnxPartnerBrandAssetType>(
  PARTNER_LOGO_ASSET_TYPES.filter((t) => t !== "LOGO_GENERAL"),
);

export function canReusePartnerLogoFamilyFromGeneral(
  type: DnxPartnerBrandAssetType,
): boolean {
  return REUSABLE_FROM_GENERAL.has(type);
}

export function partnerLogoFamilyReuseBackgrounds(
  type: DnxPartnerBrandAssetType,
): readonly PartnerLogoSlotBackground[] {
  const family = PARTNER_LOGO_FAMILIES.find((f) => f.type === type);
  if (!family) return ["COLOR", "LIGHT", "DARK"] as const;
  return family.slots.map((s) => s.backgroundType);
}

type LogoReuseAssetLike = {
  type: DnxPartnerBrandAssetType;
  backgroundType?: string | null;
  storageKey?: string | null;
  fileUrl?: string | null;
  reusedFromGeneral?: boolean | null;
};

/** ¿Los assets de la familia apuntan a los mismos archivos que Logo general? */
export function partnerLogoFamilyMatchesGeneral(input: {
  familyType: DnxPartnerBrandAssetType;
  assets: readonly LogoReuseAssetLike[];
}): boolean {
  if (!canReusePartnerLogoFamilyFromGeneral(input.familyType)) return false;
  const backgrounds = partnerLogoFamilyReuseBackgrounds(input.familyType);
  let matched = 0;
  for (const bg of backgrounds) {
    const own = latestFor(input.assets, input.familyType, bg);
    const general = latestFor(input.assets, "LOGO_GENERAL", bg);
    if (!own) continue;
    if (own.reusedFromGeneral) {
      matched += 1;
      continue;
    }
    if (!general) return false;
    const sameKey =
      Boolean(own.storageKey && general.storageKey && own.storageKey === general.storageKey) ||
      Boolean(own.fileUrl && general.fileUrl && own.fileUrl === general.fileUrl);
    if (!sameKey) return false;
    matched += 1;
  }
  return matched > 0;
}

function latestFor(
  assets: readonly LogoReuseAssetLike[],
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
): LogoReuseAssetLike | undefined {
  const matches = assets.filter((a) => {
    if (a.type !== type) return false;
    const bg = (a.backgroundType ?? "COLOR").toUpperCase();
    return (
      bg === backgroundType ||
      (backgroundType === "COLOR" && (bg === "UNKNOWN" || !a.backgroundType))
    );
  });
  return matches[matches.length - 1];
}
