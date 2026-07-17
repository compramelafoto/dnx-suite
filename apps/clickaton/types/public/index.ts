/**
 * Barrel de contratos públicos satélite (Etapa 05A).
 * `PublicMarathon` estructural permanece en `../marathon.ts`.
 */

export type {
  PublicMarathonCapabilities,
} from "./capabilities";

export type {
  PublicCapacity,
  PublicCategoryCapacity,
  CapacityVisibility,
} from "./capacity";

export type {
  PublicMarathonGallery,
  PublicGalleryImage,
  GalleryImageCommercialAvailability,
} from "./gallery";

export type {
  PublicEventNotice,
  PublicEventNoticeType,
  PublicEventNoticeLevel,
} from "./notices";

export type {
  PublicRegistrationOffer,
  PublicRegistrationSummary,
  PublicDisplayPrice,
  RegistrationPricingMode,
  RegistrationEligibility,
  ParticipantRegistrationSummary,
  ParticipantRegistrationStatus,
  RegistrationOfferMode,
  EligibilityBlockedReason,
  EligibilityBlockedReasonCode,
  RegistrationPaymentStatus,
  AccreditationStatus,
} from "./registration";

export type {
  PublicMarathonResults,
  PublicRankingEntry,
  PublicCategoryRanking,
  PublicResultMention,
  PublicResultSelection,
  PublicPrizeAward,
} from "./results";

export type {
  PublicRulesVersion,
  PublicRulesVersionStatus,
} from "./rules-version";

export type {
  PublicScheduleWindow,
  PublicScheduleWindowKind,
} from "./schedule-window";

export type {
  PublicValidationRule,
  PublicValidationRuleType,
} from "./validation";
