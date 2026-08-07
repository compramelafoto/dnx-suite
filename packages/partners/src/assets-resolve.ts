import type {
  DnxPartnerBrandAssetType,
  ListParticipationAssetsQuery,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  ResolvedPartnerImage,
} from "./assets-types";
import { PARTNER_LOGO_PLACEHOLDER } from "./assets-types";

const LOGO_TYPES = new Set<DnxPartnerBrandAssetType>([
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

/**
 * Resolución canónica de logo / imagen de display.
 * 1) tipo solicitado usable → 2) primary usable → 3) LOGO_PRIMARY → 4) logoUrl → 5) placeholder
 */
export function resolvePartnerPrimaryLogo(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  return resolvePartnerLogoVariant({ ...input, type: "LOGO_PRIMARY" });
}

export function resolvePartnerLogoVariant(input: {
  assets: readonly PartnerBrandAssetRecord[];
  type: DnxPartnerBrandAssetType;
  logoUrl?: string | null;
  now?: Date;
}): ResolvedPartnerImage {
  const now = input.now ?? new Date();
  const usable = input.assets.filter((a) => isUsableBrandAsset(a, now));

  const byType = usable.find((a) => a.type === input.type);
  if (byType) return toResolved(byType);

  const primary = usable.find((a) => a.isPrimary && LOGO_TYPES.has(a.type));
  if (primary) return toResolved(primary);

  const logoPrimary = usable.find((a) => a.type === "LOGO_PRIMARY");
  if (logoPrimary) return toResolved(logoPrimary);

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

export function resolvePartnerDisplayImage(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl?: string | null;
  preferredTypes?: readonly DnxPartnerBrandAssetType[];
  now?: Date;
}): ResolvedPartnerImage {
  const preferred = input.preferredTypes ?? ["LOGO_PRIMARY", "LOGO_HORIZONTAL", "ISOTYPE"];
  for (const type of preferred) {
    const resolved = resolvePartnerLogoVariant({ ...input, type });
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
