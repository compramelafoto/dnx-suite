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

/** Constantes welcome sin Node APIs (ficha / campañas client). */
export {
  WELCOME_GRAPHIC_SLOTS,
  DEFAULT_WELCOME_GRAPHIC_LIMITS,
  WELCOME_GRAPHIC_SAFE_AREA_COPY,
  WELCOME_GRAPHIC_CTA_COPY,
  WELCOME_PROFILE_SECTION_TITLE,
  WELCOME_PROFILE_SECTION_DESCRIPTION,
  WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX,
  WELCOME_GRAPHIC_ALLOWED_MIMES,
} from "./welcome-graphic-constants";
export type {
  WelcomeGraphicSlotKey,
  WelcomeGraphicSlotGuide,
  WelcomeGraphicDeviceTarget,
  WelcomeGraphicMotionVariant,
} from "./welcome-graphic-constants";

export {
  PARTNER_VIEWABILITY_MS,
  PARTNER_VIEWABILITY_RATIO,
  PARTNER_ANALYTICS_DISCLAIMER,
  analyticsLogicalViewKey,
  extractTrackingKeyFromHref,
  computeCtrPercent,
  formatCtrDisplay,
} from "./analytics";
