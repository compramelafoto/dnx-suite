import type { DnxPartnerApplication } from "./types";

export const DNX_PARTNER_BRAND_ASSET_TYPES = [
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
  "LOGO_HORIZONTAL",
  "LOGO_VERTICAL",
  "LOGO_LIGHT",
  "LOGO_DARK",
  "LOGO_MONOCHROME",
  "ISOTYPE",
  "ICON",
  "BRAND_GUIDELINES",
  "BRAND_PHOTO",
  "DOCUMENT",
  "OTHER",
] as const;
export type DnxPartnerBrandAssetType = (typeof DNX_PARTNER_BRAND_ASSET_TYPES)[number];

export const DNX_PARTNER_ASSET_BACKGROUNDS = [
  "TRANSPARENT",
  "LIGHT",
  "DARK",
  "COLOR",
  "UNKNOWN",
] as const;
export type DnxPartnerAssetBackground = (typeof DNX_PARTNER_ASSET_BACKGROUNDS)[number];

export const DNX_PARTNER_ASSET_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type DnxPartnerAssetStatus = (typeof DNX_PARTNER_ASSET_STATUSES)[number];

export const DNX_PARTNER_ASSET_APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
] as const;
export type DnxPartnerAssetApprovalStatus =
  (typeof DNX_PARTNER_ASSET_APPROVAL_STATUSES)[number];

export const DNX_PARTNER_MATERIAL_CHANNELS = [
  "WEB",
  "MOBILE",
  "INSTAGRAM_POST",
  "INSTAGRAM_STORY",
  "INSTAGRAM_REEL",
  "FACEBOOK_POST",
  "FACEBOOK_STORY",
  "LINKEDIN_POST",
  "EMAIL",
  "NEWSLETTER",
  "PUSH_NOTIFICATION",
  "DIGITAL_SCREEN",
  "PRINT",
  "CREDENTIAL",
  "EVENT_SIGNAGE",
  "STORE",
  "OTHER",
] as const;
export type DnxPartnerMaterialChannel = (typeof DNX_PARTNER_MATERIAL_CHANNELS)[number];

export const DNX_PARTNER_MATERIAL_TYPES = [
  "LOGO",
  "IMAGE",
  "VIDEO",
  "BANNER",
  "COVER",
  "THUMBNAIL",
  "POST",
  "STORY",
  "REEL",
  "FLYER",
  "COUPON",
  "VOUCHER",
  "PRODUCT_IMAGE",
  "PRIZE_IMAGE",
  "BENEFIT_IMAGE",
  "DOCUMENT",
  "AUDIO",
  "OTHER",
] as const;
export type DnxPartnerMaterialType = (typeof DNX_PARTNER_MATERIAL_TYPES)[number];

export const DNX_PARTNER_MATERIAL_PURPOSES = [
  "BRANDING",
  "SPONSOR_VISIBILITY",
  "BENEFIT_PROMOTION",
  "PRIZE_PROMOTION",
  "EVENT_PROMOTION",
  "SOCIAL_PUBLICATION",
  "EMAIL_CONTENT",
  "WEBSITE_CONTENT",
  "PRINT_CONTENT",
  "INTERNAL_REFERENCE",
  "OTHER",
] as const;
export type DnxPartnerMaterialPurpose = (typeof DNX_PARTNER_MATERIAL_PURPOSES)[number];

export const DNX_PARTNER_ASSET_ORIENTATIONS = [
  "SQUARE",
  "PORTRAIT",
  "LANDSCAPE",
  "VERTICAL",
  "HORIZONTAL",
  "FREE",
  "UNKNOWN",
] as const;
export type DnxPartnerAssetOrientation = (typeof DNX_PARTNER_ASSET_ORIENTATIONS)[number];

export const DNX_PARTNER_STORAGE_PROVIDERS = [
  "R2",
  "LOCAL",
  "INLINE",
  "EXTERNAL",
] as const;
export type DnxPartnerStorageProvider = (typeof DNX_PARTNER_STORAGE_PROVIDERS)[number];

export type PartnerBrandAssetRecord = {
  id: string;
  partnerId: string;
  type: DnxPartnerBrandAssetType;
  name: string;
  description: string | null;
  storageProvider: DnxPartnerStorageProvider;
  storageKey: string | null;
  fileUrl: string | null;
  mediaAssetId: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  backgroundType: DnxPartnerAssetBackground;
  isPrimary: boolean;
  status: DnxPartnerAssetStatus;
  approvalStatus: DnxPartnerAssetApprovalStatus;
  altText: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  uploadedById: number | null;
  approvedById: number | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ParticipationAssetRecord = {
  id: string;
  participationId: string;
  benefitId: string | null;
  contributionId: string | null;
  prizeBundleId: string | null;
  application: DnxPartnerApplication;
  channel: DnxPartnerMaterialChannel;
  assetType: DnxPartnerMaterialType;
  purpose: DnxPartnerMaterialPurpose;
  name: string;
  description: string | null;
  storageProvider: DnxPartnerStorageProvider;
  storageKey: string | null;
  fileUrl: string | null;
  mediaAssetId: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  orientation: DnxPartnerAssetOrientation;
  status: DnxPartnerAssetStatus;
  approvalStatus: DnxPartnerAssetApprovalStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  altText: string | null;
  caption: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  uploadedById: number | null;
  approvedById: number | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CreateBrandAssetInput = {
  partnerId: string;
  type: DnxPartnerBrandAssetType;
  name: string;
  description?: string | null;
  storageProvider?: DnxPartnerStorageProvider;
  storageKey?: string | null;
  fileUrl?: string | null;
  mediaAssetId?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileExtension?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  backgroundType?: DnxPartnerAssetBackground;
  isPrimary?: boolean;
  status?: DnxPartnerAssetStatus;
  approvalStatus?: DnxPartnerAssetApprovalStatus;
  altText?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  uploadedById?: number | null;
};

export type UpdateBrandAssetInput = Partial<
  Omit<CreateBrandAssetInput, "partnerId" | "uploadedById">
> & {
  approvedById?: number | null;
  approvedAt?: Date | null;
  archivedAt?: Date | null;
};

export type CreateParticipationAssetInput = {
  participationId: string;
  benefitId?: string | null;
  contributionId?: string | null;
  prizeBundleId?: string | null;
  application?: DnxPartnerApplication;
  channel?: DnxPartnerMaterialChannel;
  assetType?: DnxPartnerMaterialType;
  purpose?: DnxPartnerMaterialPurpose;
  name: string;
  description?: string | null;
  storageProvider?: DnxPartnerStorageProvider;
  storageKey?: string | null;
  fileUrl?: string | null;
  mediaAssetId?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileExtension?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  orientation?: DnxPartnerAssetOrientation;
  status?: DnxPartnerAssetStatus;
  approvalStatus?: DnxPartnerAssetApprovalStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  altText?: string | null;
  caption?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
  uploadedById?: number | null;
};

export type UpdateParticipationAssetInput = Partial<
  Omit<CreateParticipationAssetInput, "participationId" | "uploadedById">
> & {
  approvedById?: number | null;
  approvedAt?: Date | null;
  archivedAt?: Date | null;
};

export type ListParticipationAssetsQuery = {
  participationId?: string;
  application?: DnxPartnerApplication;
  channel?: DnxPartnerMaterialChannel;
  assetType?: DnxPartnerMaterialType;
  purpose?: DnxPartnerMaterialPurpose;
  benefitId?: string;
  contributionId?: string;
  prizeBundleId?: string;
  status?: DnxPartnerAssetStatus;
  approvalStatus?: DnxPartnerAssetApprovalStatus;
  includeExpired?: boolean;
  includeRejected?: boolean;
  includeArchived?: boolean;
  adminList?: boolean;
  now?: Date;
};

export type ResolvedPartnerImage = {
  source: "brand_asset" | "logo_url" | "placeholder";
  url: string | null;
  assetId: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
};

export const PARTNER_LOGO_PLACEHOLDER = {
  source: "placeholder" as const,
  url: null,
  assetId: null,
  altText: "Sin logo",
  width: null,
  height: null,
  mimeType: null,
};
