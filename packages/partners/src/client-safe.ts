/**
 * Exports seguros para Client Components (sin node:crypto / Node APIs).
 * Usar `@repo/partners/client-safe` en UI; el barrel principal queda para server.
 */

export {
  PARTNER_LOGO_VARIANT_GUIDES,
  PARTNER_LOGO_ASSET_TYPES,
  isPartnerLogoAssetType,
  getPartnerLogoVariantGuide,
} from "./logo-types";
export type { PartnerLogoVariantGuide } from "./logo-types";

export { PARTNER_ALLOWED_LOGO_MIMES } from "./assets-limits";

export { partnerLogoResolutionWarning } from "./assets-mime";

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

export type { DnxPartnerBrandAssetType } from "./assets-types";
export type { PartnerRecord } from "./types";
