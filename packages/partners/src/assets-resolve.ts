import type {
  DnxPartnerAssetBackground,
  DnxPartnerBrandAssetType,
  ListParticipationAssetsQuery,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  ResolvedPartnerImage,
} from "./assets-types";
import { PARTNER_LOGO_PLACEHOLDER } from "./assets-types";
import type { PartnerLogoSlotBackground } from "./logo-types";

const LOGO_TYPES = new Set<DnxPartnerBrandAssetType>([
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
  "LOGO_HORIZONTAL",
  "LOGO_VERTICAL",
  "LOGO_LIGHT",
  "LOGO_DARK",
  "LOGO_MONOCHROME",
  "ISOTYPE",
  "ICON",
]);

function isUsableBrandAsset(asset: PartnerBrandAssetRecord, now = new Date()): boolean {
  void now;
  if (asset.archivedAt) return false;
  if (asset.status !== "ACTIVE") return false;
  if (asset.approvalStatus !== "APPROVED") return false;
  if (!asset.fileUrl && !asset.storageKey) return false;
  return true;
}

function isUsableParticipationAsset(
  asset: ParticipationAssetRecord,
  now: Date,
  opts?: {
    includeExpired?: boolean;
    includeRejected?: boolean;
    includeArchived?: boolean;
    /** Admin listing: no exigir APPROVED+ACTIVE. */
    adminList?: boolean;
  },
): boolean {
  if (!opts?.includeArchived && (asset.status === "ARCHIVED" || asset.archivedAt)) {
    return false;
  }
  if (!opts?.includeRejected && asset.approvalStatus === "REJECTED") return false;
  if (!opts?.adminList) {
    if (asset.approvalStatus !== "APPROVED") return false;
    if (asset.status !== "ACTIVE") return false;
  }
  if (!opts?.includeExpired) {
    if (asset.endsAt && asset.endsAt.getTime() < now.getTime()) return false;
    if (asset.startsAt && asset.startsAt.getTime() > now.getTime()) return false;
  }
  return Boolean(asset.fileUrl || asset.storageKey) || Boolean(opts?.adminList);
}

function toResolved(asset: PartnerBrandAssetRecord): ResolvedPartnerImage {
  const url =
    asset.fileUrl?.trim() ||
    (asset.storageKey ? `/api/media/${asset.storageKey}` : null);
  return {
    source: "brand_asset",
    url,
    assetId: asset.id,
    altText: asset.altText ?? asset.name,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
  };
}

/** Normaliza background del asset; UNKNOWN/TRANSPARENT se tratan como COLOR en resolución. */
export function normalizePartnerLogoBackground(
  backgroundType: DnxPartnerAssetBackground | null | undefined,
): PartnerLogoSlotBackground {
  if (backgroundType === "LIGHT" || backgroundType === "DARK" || backgroundType === "COLOR") {
    return backgroundType;
  }
  return "COLOR";
}

/**
 * ¿El asset cubre el slot pedido?
 * Legacy: LOGO_LIGHT ≡ fondo oscuro; LOGO_DARK ≡ fondo claro; sin background ≡ COLOR.
 */
export function brandAssetMatchesLogoSlot(
  asset: PartnerBrandAssetRecord,
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
): boolean {
  if (asset.type === type) {
    return normalizePartnerLogoBackground(asset.backgroundType) === backgroundType;
  }
  // Legacy dedicados
  if (backgroundType === "DARK" && asset.type === "LOGO_LIGHT") {
    return type === "LOGO_PRIMARY" || type === "LOGO_GENERAL";
  }
  if (backgroundType === "LIGHT" && asset.type === "LOGO_DARK") {
    return type === "LOGO_PRIMARY" || type === "LOGO_GENERAL";
  }
  return false;
}

function findUsableSlot(
  usable: readonly PartnerBrandAssetRecord[],
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
): PartnerBrandAssetRecord | undefined {
  return usable.find((a) => brandAssetMatchesLogoSlot(a, type, backgroundType));
}

/**
 * Resolución canónica de logo / imagen de display.
 * Prefiere Logo general Color → Principal Color → primary flag → cualquier logo → logoUrl.
 */
export function resolvePartnerPrimaryLogo(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  return resolvePartnerLogoSlot({
    ...input,
    type: "LOGO_GENERAL",
    backgroundType: "COLOR",
  });
}

export function resolvePartnerLogoSlot(input: {
  assets: readonly PartnerBrandAssetRecord[];
  type: DnxPartnerBrandAssetType;
  backgroundType?: PartnerLogoSlotBackground;
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  const now = input.now ?? new Date();
  const backgroundType = input.backgroundType ?? "COLOR";
  const usable = input.assets.filter((a) => isUsableBrandAsset(a, now));

  const exact = findUsableSlot(usable, input.type, backgroundType);
  if (exact) return toResolved(exact);

  // Misma familia, color como fallback del tratamiento pedido
  if (backgroundType !== "COLOR") {
    const color = findUsableSlot(usable, input.type, "COLOR");
    if (color) return toResolved(color);
  }

  // General / primary cruzados
  if (input.type !== "LOGO_GENERAL") {
    const general = findUsableSlot(usable, "LOGO_GENERAL", backgroundType);
    if (general) return toResolved(general);
    const generalColor = findUsableSlot(usable, "LOGO_GENERAL", "COLOR");
    if (generalColor) return toResolved(generalColor);
  }
  if (input.type !== "LOGO_PRIMARY") {
    const primary = findUsableSlot(usable, "LOGO_PRIMARY", backgroundType);
    if (primary) return toResolved(primary);
    const primaryColor = findUsableSlot(usable, "LOGO_PRIMARY", "COLOR");
    if (primaryColor) return toResolved(primaryColor);
  }

  // Legacy type-only (sin background) o cualquier LOGO_PRIMARY/GENERAL
  const legacyPrimary = usable.find((a) => a.type === "LOGO_PRIMARY");
  if (legacyPrimary) return toResolved(legacyPrimary);
  const legacyGeneral = usable.find((a) => a.type === "LOGO_GENERAL");
  if (legacyGeneral) return toResolved(legacyGeneral);

  const primaryFlag = usable.find((a) => a.isPrimary && LOGO_TYPES.has(a.type));
  if (primaryFlag) return toResolved(primaryFlag);

  const anyLogo = usable.find((a) => LOGO_TYPES.has(a.type));
  if (anyLogo) return toResolved(anyLogo);

  const logoUrl = input.logoUrl?.trim();
  if (logoUrl) {
    return {
      source: "logo_url",
      url: logoUrl,
      assetId: null,
      altText: null,
      width: null,
      height: null,
      mimeType: null,
    };
  }

  return { ...PARTNER_LOGO_PLACEHOLDER };
}

export function resolvePartnerLogoVariant(input: {
  assets: readonly PartnerBrandAssetRecord[];
  type: DnxPartnerBrandAssetType;
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  // Compat: LOGO_LIGHT/DARK legacy como pedido de superficie
  if (input.type === "LOGO_LIGHT") {
    return resolvePartnerLogoSlot({
      ...input,
      type: "LOGO_PRIMARY",
      backgroundType: "DARK",
    });
  }
  if (input.type === "LOGO_DARK") {
    return resolvePartnerLogoSlot({
      ...input,
      type: "LOGO_PRIMARY",
      backgroundType: "LIGHT",
    });
  }
  return resolvePartnerLogoSlot({
    ...input,
    backgroundType: "COLOR",
  });
}

/**
 * Para placas / superficies: pide el mejor archivo disponible para ese fondo.
 * Cadena: familia pedida → general → principal → color → cualquier logo.
 */
export function resolvePartnerLogoForSurface(input: {
  assets: readonly PartnerBrandAssetRecord[];
  surface: PartnerLogoSlotBackground;
  preferredType?: DnxPartnerBrandAssetType;
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  const preferred = input.preferredType ?? "LOGO_GENERAL";
  const families: DnxPartnerBrandAssetType[] = [
    preferred,
    "LOGO_GENERAL",
    "LOGO_PRIMARY",
    "LOGO_HORIZONTAL",
    "ISOTYPE",
    "LOGO_VERTICAL",
  ];
  const seen = new Set<string>();
  for (const type of families) {
    if (seen.has(type)) continue;
    seen.add(type);
    const resolved = resolvePartnerLogoSlot({
      assets: input.assets,
      type,
      backgroundType: input.surface,
      logoUrl: input.logoUrl,
      now: input.now,
    });
    if (resolved.source !== "placeholder") return resolved;
  }
  return resolvePartnerPrimaryLogo(input);
}

export function resolvePartnerDisplayImage(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl?: string | null;
  preferredTypes?: readonly DnxPartnerBrandAssetType[];
  now?: Date;
}): ResolvedPartnerImage {
  const preferred = input.preferredTypes ?? [
    "LOGO_GENERAL",
    "LOGO_PRIMARY",
    "LOGO_HORIZONTAL",
    "ISOTYPE",
  ];
  for (const type of preferred) {
    const resolved = resolvePartnerLogoSlot({
      ...input,
      type,
      backgroundType: "COLOR",
    });
    if (resolved.source !== "placeholder") return resolved;
  }
  return resolvePartnerPrimaryLogo(input);
}

export function filterParticipationAssets(
  assets: readonly ParticipationAssetRecord[],
  query: ListParticipationAssetsQuery = {},
): ParticipationAssetRecord[] {
  const now = query.now ?? new Date();
  return [...assets]
    .filter((a) => {
      if (query.participationId && a.participationId !== query.participationId) return false;
      if (query.application && a.application !== query.application) return false;
      if (query.channel && a.channel !== query.channel) return false;
      if (query.assetType && a.assetType !== query.assetType) return false;
      if (query.purpose && a.purpose !== query.purpose) return false;
      if (query.benefitId && a.benefitId !== query.benefitId) return false;
      if (query.contributionId && a.contributionId !== query.contributionId) return false;
      if (query.prizeBundleId && a.prizeBundleId !== query.prizeBundleId) return false;
      if (query.status && a.status !== query.status) return false;
      if (query.approvalStatus && a.approvalStatus !== query.approvalStatus) return false;
      return isUsableParticipationAsset(a, now, {
        includeExpired: query.includeExpired,
        includeRejected: query.includeRejected,
        includeArchived: query.includeArchived,
        adminList: query.adminList,
      });
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** Mejor pieza: menor sortOrder entre usable + filtros. */
export function findBestAssetForChannel(
  assets: readonly ParticipationAssetRecord[],
  input: {
    participationId: string;
    application?: ParticipationAssetRecord["application"];
    channel: ParticipationAssetRecord["channel"];
    assetType?: ParticipationAssetRecord["assetType"];
    now?: Date;
  },
): ParticipationAssetRecord | null {
  const listed = filterParticipationAssets(assets, {
    participationId: input.participationId,
    application: input.application,
    channel: input.channel,
    assetType: input.assetType,
    now: input.now,
  });
  return listed[0] ?? null;
}
