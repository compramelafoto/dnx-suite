export type {
  DnxPartnerType,
  DnxPartnerStatus,
  DnxPartnerApplication,
  DnxPartnerContextType,
  DnxPartnerParticipationType,
  DnxPartnerParticipationStatus,
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
  DNX_PARTNER_PARTICIPATION_STATUSES,
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
  PARTICIPATION_STATUS_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  BENEFIT_STATUS_LABELS,
  PARTICIPATION_TYPE_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  CLICKATON_PARTICIPATION_ROLE_OPTIONS,
  CLICKATON_AUDIENCE_OPTIONS,
  resolveClickatonParticipationType,
} from "./labels";
export type { ClickatonParticipationRoleOption } from "./labels";

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
