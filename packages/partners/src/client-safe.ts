/**
 * Exports seguros para Client Components (sin node:crypto / Node APIs).
 * Usar `@repo/partners/client-safe` en UI; el barrel principal queda para server.
 */

export {
  PARTNER_LOGO_FAMILIES,
  PARTNER_LOGO_SLOTS,
  PARTNER_LOGO_VARIANT_GUIDES,
  PARTNER_LOGO_ASSET_TYPES,
  partnerLogoSlotKey,
  isPartnerLogoAssetType,
  isPartnerLogoSlotBackground,
  getPartnerLogoSlotGuide,
  getPartnerLogoVariantGuide,
  getPartnerLogoFamilyGuide,
} from "./logo-types";
export type {
  PartnerLogoVariantGuide,
  PartnerLogoSlotGuide,
  PartnerLogoFamilyGuide,
  PartnerLogoSlotBackground,
  PartnerLogoPreviewKind,
} from "./logo-types";

export {
  canReusePartnerLogoFamilyFromGeneral,
  partnerLogoFamilyMatchesGeneral,
  partnerLogoFamilyReuseBackgrounds,
} from "./logo-reuse-general";

export {
  evaluatePartnerSponsorReadiness,
  readinessLabel,
  buildInstagramProfileUrl,
} from "./sponsor-readiness";
export type {
  PartnerSponsorReadiness,
  PartnerSponsorReadinessLevel,
  PartnerSponsorReadinessMissing,
} from "./sponsor-readiness";

export {
  DEFAULT_PARTNER_ASSET_LIMITS,
  PARTNER_ALLOWED_LOGO_MIMES,
} from "./assets-limits";

export { partnerLogoResolutionWarning } from "./assets-mime";

export {
  brandAssetMatchesLogoSlot,
  normalizePartnerLogoBackground,
} from "./assets-resolve";

export type { DnxPartnerAssetBackground, DnxPartnerBrandAssetType } from "./assets-types";

export {
  DNX_PARTNER_ONBOARDING_INVITATION_STATUSES,
  DNX_PARTNER_ONBOARDING_REVIEW_STATUSES,
  DNX_PARTNER_ONBOARDING_ADMIN_STATUSES,
  PARTNER_ONBOARDING_ADMIN_STATUS_LABELS,
} from "./onboarding-types";
export type {
  DnxPartnerOnboardingInvitationStatus,
  DnxPartnerOnboardingReviewStatus,
  DnxPartnerOnboardingAdminStatus,
  PartnerOnboardingDestinationKind,
  PartnerOnboardingCompanyDraft,
  PartnerOnboardingContactDraft,
  PartnerOnboardingLogoRef,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
  OnboardingInvitationRecord,
} from "./onboarding-types";

export type { PartnerRecord } from "./types";
