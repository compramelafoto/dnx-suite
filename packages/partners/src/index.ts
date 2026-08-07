export type {
  DnxPartnerType,
  DnxPartnerStatus,
  DnxPartnerApplication,
  DnxPartnerContextType,
  DnxPartnerParticipationType,
  DnxPartnerInstitutionalRole,
  DnxPartnerDisplayTier,
  DnxPartnerParticipationStatus,
  DnxPartnerPublicVisibility,
  DnxPartnerPaymentMode,
  DnxPartnerContributionType,
  DnxPartnerContributionStatus,
  DnxPartnerBenefitType,
  DnxPartnerRedemptionMethod,
  DnxPartnerBenefitStatus,
  DnxPartnerAudienceType,
  DnxPartnerCapability,
  DnxPartnerBenefitAccessStatus,
  PartnerRecord,
  PartnerContactRecord,
  ParticipationRecord,
  ContributionRecord,
  BenefitRecord,
  BenefitAudienceRecord,
  BenefitAccessRecord,
  PartnerAuditEventRecord,
  PartnerGrantRecord,
  PartnerListItem,
  CreatePartnerInput,
  UpdatePartnerInput,
  CreateParticipationInput,
  UpdateParticipationInput,
  CreateContributionInput,
  UpdateContributionInput,
  CreateBenefitInput,
  UpdateBenefitInput,
  AssignAudienceInput,
  GrantBenefitAccessInput,
  ListParticipationsByContextQuery,
  CreateContactInput,
  PartnerActor,
  DomainErrorCode,
} from "./types";

export {
  DNX_PARTNER_TYPES,
  DNX_PARTNER_STATUSES,
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_CONTEXT_TYPES,
  DNX_PARTNER_PARTICIPATION_TYPES,
  DNX_PARTNER_INSTITUTIONAL_ROLES,
  DNX_PARTNER_DISPLAY_TIERS,
  DNX_PARTNER_PARTICIPATION_STATUSES,
  DNX_PARTNER_PUBLIC_VISIBILITIES,
  DNX_PARTNER_PAYMENT_MODES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_CONTRIBUTION_STATUSES,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_REDEMPTION_METHODS,
  DNX_PARTNER_BENEFIT_STATUSES,
  DNX_PARTNER_AUDIENCE_TYPES,
  DNX_PARTNER_CAPABILITIES,
  DNX_PARTNER_BENEFIT_ACCESS_STATUSES,
  PartnersDomainError,
} from "./types";

export {
  PARTNER_TYPE_LABELS,
  PARTNER_STATUS_LABELS,
  PARTICIPATION_STATUS_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  BENEFIT_STATUS_LABELS,
  PARTICIPATION_TYPE_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  BENEFIT_TYPE_LABELS,
  REDEMPTION_METHOD_LABELS,
  AUDIENCE_TYPE_LABELS,
  APPLICATION_LABELS,
  CONTEXT_TYPE_LABELS,
  PAYMENT_MODE_LABELS,
  PUBLIC_VISIBILITY_LABELS,
  OUTBOUND_LINK_STATUS_LABELS,
  CLICKATON_PARTICIPATION_ROLE_OPTIONS,
  CLICKATON_AUDIENCE_OPTIONS,
  resolveClickatonParticipationType,
} from "./labels";
export type { ClickatonParticipationRoleOption } from "./labels";

export {
  INSTITUTIONAL_ROLE_LABELS,
  DISPLAY_TIER_LABELS,
  INSTITUTIONAL_ROLE_GROUP_HEADINGS,
  PUBLIC_INSTITUTIONAL_ROLE_ORDER,
  DEFAULT_PUBLIC_HIDDEN_ROLES,
  INSTITUTIONAL_ROLE_OPTIONS,
  DISPLAY_TIER_OPTIONS,
  defaultDisplayTierForRole,
  institutionalRoleFromParticipationType,
  participationTypeFromInstitutionalRole,
  resolvePublicRoleLabel,
  sanitizePublicRoleLabel,
  groupPartnersForPublicDisplay,
  normalizeInstitutionalFields,
  resolvePartnerLogoAdminState,
  resolvePartnerPublicationAdminState,
  assertParticipationPublicPublishable,
} from "./institutional";
export type {
  PublicPartnerDisplayItem,
  PublicPartnerGroup,
  GroupPublicPartnersOptions,
  PartnerLogoAdminState,
  PartnerPublicationAdminState,
} from "./institutional";

export {
  normalizePartnerSlug,
  slugFromPartnerName,
  isValidPartnerSlug,
} from "./slug";

export {
  assertDateRange,
  assertNonNegativeLimit,
  assertDiscountPercentage,
  normalizeCreatePartnerInput,
  normalizePaymentFields,
  validateParticipationDates,
  validateContributionInput,
  validateBenefitFields,
  assertNoAutomaticPaymentSideEffects,
} from "./validate";

export {
  OPS_ADMIN_CAPABILITIES,
  resolveActorCapabilities,
  hasPartnerCapability,
  assertPartnerCapability,
  PARTNER_CAPABILITY_LABELS,
} from "./permissions";

export type { PartnersRepository } from "./repository";
export {
  createMemoryPartnersRepository,
  createMemoryPartnersRepositoryWithAudit,
} from "./memory-repository";
export type { MemoryPartnersRepositoryWithAudit } from "./memory-repository";
export { createPartnersService } from "./service";
export type { PartnersService } from "./service";
export { createPartnerTrackingApi } from "./tracking-api";
export type { PartnerTrackingApi } from "./tracking-api";

export {
  DNX_PARTNER_PLACEMENTS,
  DNX_PARTNER_OUTBOUND_LINK_STATUSES,
  DNX_PARTNER_DEVICE_CLASSES,
  assertSafePartnerDestinationUrl,
  resolveParticipationDestinationUrl,
  buildTrackingKey,
  defaultUtmSource,
  buildPartnerAttributedUrl,
  sanitizeReferrerHost,
  classifyDeviceClass,
  classifyBrowserFamily,
  isLikelyBotUserAgent,
  shouldSkipClickForRateLimit,
  isOutboundLinkCurrentlyValid,
  isPartnerClickTrackingEnabled,
  partnerRedirectPath,
  aggregateClickEvents,
  emptyTrafficSummary,
} from "./tracking";
export type {
  DnxPartnerPlacement,
  DnxPartnerOutboundLinkStatus,
  DnxPartnerDeviceClass,
  OutboundLinkRecord,
  ClickEventRecord,
  PartnerTrafficSummary,
} from "./tracking";

export type {
  DnxPartnerBrandAssetType,
  DnxPartnerAssetBackground,
  DnxPartnerAssetStatus,
  DnxPartnerAssetApprovalStatus,
  DnxPartnerMaterialChannel,
  DnxPartnerMaterialType,
  DnxPartnerMaterialPurpose,
  DnxPartnerAssetOrientation,
  DnxPartnerStorageProvider,
  PartnerBrandAssetRecord,
  ParticipationAssetRecord,
  CreateBrandAssetInput,
  UpdateBrandAssetInput,
  CreateParticipationAssetInput,
  UpdateParticipationAssetInput,
  ListParticipationAssetsQuery,
  ResolvedPartnerImage,
} from "./assets-types";

export {
  DNX_PARTNER_BRAND_ASSET_TYPES,
  DNX_PARTNER_ASSET_BACKGROUNDS,
  DNX_PARTNER_ASSET_STATUSES,
  DNX_PARTNER_ASSET_APPROVAL_STATUSES,
  DNX_PARTNER_MATERIAL_CHANNELS,
  DNX_PARTNER_MATERIAL_TYPES,
  DNX_PARTNER_MATERIAL_PURPOSES,
  DNX_PARTNER_ASSET_ORIENTATIONS,
  DNX_PARTNER_STORAGE_PROVIDERS,
  PARTNER_LOGO_PLACEHOLDER,
} from "./assets-types";

export {
  DEFAULT_PARTNER_ASSET_LIMITS,
  resolvePartnerAssetLimits,
  PARTNER_ALLOWED_IMAGE_MIMES,
  PARTNER_ALLOWED_LOGO_MIMES,
  PARTNER_ALLOWED_PDF_MIMES,
  PARTNER_ALLOWED_VIDEO_MIMES,
  PARTNER_SVG_ENABLED,
} from "./assets-limits";

export {
  detectPartnerFileMime,
  assertPartnerUploadAllowed,
  assertPartnerLogoUploadAllowed,
  partnerLogoResolutionWarning,
  assertSafeStorageFilename,
  assertValidCtaUrl,
  buildPartnerBrandStorageKey,
  buildPartnerParticipationStorageKey,
} from "./assets-mime";

export {
  PARTNER_LOGO_VARIANT_GUIDES,
  PARTNER_LOGO_ASSET_TYPES,
  isPartnerLogoAssetType,
  getPartnerLogoVariantGuide,
} from "./logo-types";
export type { PartnerLogoVariantGuide } from "./logo-types";

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
  CreateOnboardingInvitationInput,
  CreateOnboardingInvitationResult,
  ReviewOnboardingAction,
  ReviewOnboardingInput,
} from "./onboarding-types";

export {
  createPartnerOnboardingToken,
  hashPartnerOnboardingToken,
  buildPartnerOnboardingPath,
  buildPartnerOnboardingUrl,
  resolveOnboardingExpiresInDays,
  shouldSkipOnboardingRateLimit,
} from "./onboarding-token";

export { resolveOnboardingAdminStatus } from "./onboarding-status";
export { createPartnerOnboardingApi } from "./onboarding-api";

export {
  resolvePartnerPrimaryLogo,
  resolvePartnerLogoVariant,
  resolvePartnerDisplayImage,
  filterParticipationAssets,
  findBestAssetForChannel,
} from "./assets-resolve";

export type {
  EligibilityReasonCode,
  EligibilitySourceType,
  ClickatonRegistrationSubject,
  ClickatonWinnerSubject,
  ClickatonFinalistSubject,
  ClickatonEligibilitySnapshot,
  BenefitAudienceInput,
  BenefitForEligibility,
  EligibilitySubjectResult,
  AudienceEvaluationResult,
  BenefitEligibilityEvaluation,
  SyncAccessPlanItem,
  BenefitAccessSyncPlan,
  EffectiveBenefitAccess,
} from "./eligibility-types";

export {
  ELIGIBILITY_REASON_CODES,
  ELIGIBILITY_SOURCE_TYPES,
} from "./eligibility-types";

export {
  buildManualAccessKey,
  buildAutomaticAccessKey,
  buildPendingAccessKey,
  normalizeEligibilityEmail,
} from "./eligibility-access-key";

export {
  evaluateBenefitEligibility,
  evaluateBenefitAudience,
  listEligibleSubjects,
  explainBenefitEligibility,
  isBenefitEligibleForMaterialization,
} from "./eligibility-evaluate";

export {
  buildBenefitAccessSyncPlan,
  planFromEvaluation,
  summarizeSyncPlan,
} from "./eligibility-sync";

export {
  canUserAccessBenefit,
  listAccessibleBenefitsForUser,
  getBenefitAccessExplanation,
} from "./eligibility-query";

export {
  BENEFIT_EXPIRING_SOON_DAYS,
  isBenefitCurrentlyAvailable,
  isBenefitExpiringSoon,
  extractSafeHttpUrl,
} from "./eligibility-availability";

export type {
  PartnerBenefitSyncEventType,
  PartnerBenefitSyncEventPayload,
  BenefitAudienceScopeHint,
  AffectedBenefitsResolution,
} from "./auto-sync-types";
export { PARTNER_BENEFIT_SYNC_EVENT_TYPES } from "./auto-sync-types";
export { buildPartnerBenefitSyncEventKey } from "./auto-sync-event-key";
export {
  resolveAffectedBenefitsForRegistrationEvent,
  resolveAffectedBenefitsForPaymentEvent,
  resolveAffectedBenefitsForWinnerEvent,
  resolveAffectedSubjectsForBenefitChange,
  resolveAffectedBenefitsFromPayload,
} from "./auto-sync-scope";

export {
  DNX_PARTNER_BENEFIT_ACCESS_SOURCES,
} from "./types";
export type { DnxPartnerBenefitAccessSource } from "./types";
