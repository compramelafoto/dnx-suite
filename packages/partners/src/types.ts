export const DNX_PARTNER_TYPES = [
  "COMPANY",
  "BUSINESS",
  "BRAND",
  "INSTITUTION",
  "ORGANIZATION",
  "PERSON",
  "GOVERNMENT",
  "OTHER",
] as const;
export type DnxPartnerType = (typeof DNX_PARTNER_TYPES)[number];

export const DNX_PARTNER_STATUSES = [
  "PROSPECT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
] as const;
export type DnxPartnerStatus = (typeof DNX_PARTNER_STATUSES)[number];

export const DNX_PARTNER_APPLICATIONS = [
  "DNX_SUITE",
  "CLICKATON",
  "FOTO_OFFICE",
  "FOTO_RANK",
  "COMPRAME_LA_FOTO",
  "INFO_SPOT",
  "OTHER",
] as const;
export type DnxPartnerApplication = (typeof DNX_PARTNER_APPLICATIONS)[number];

export const DNX_PARTNER_CONTEXT_TYPES = [
  "GLOBAL",
  "ORGANIZATION",
  "EVENT",
  "EDITION",
  "VENUE",
  "CONTEST",
  "CATEGORY",
  "ALBUM",
  "MEMBERSHIP",
  "CAMPAIGN",
  "PLATFORM",
  "OTHER",
] as const;
export type DnxPartnerContextType = (typeof DNX_PARTNER_CONTEXT_TYPES)[number];

export const DNX_PARTNER_PARTICIPATION_TYPES = [
  "SPONSOR",
  "BENEFIT_PROVIDER",
  "PRIZE_PROVIDER",
  "SERVICE_PROVIDER",
  "INSTITUTIONAL_PARTNER",
  "MEDIA_PARTNER",
  "COMMERCIAL_PARTNER",
  "COLLABORATOR",
  "OTHER",
] as const;
export type DnxPartnerParticipationType =
  (typeof DNX_PARTNER_PARTICIPATION_TYPES)[number];

export const DNX_PARTNER_PARTICIPATION_STATUSES = [
  "DRAFT",
  "PROPOSED",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export type DnxPartnerParticipationStatus =
  (typeof DNX_PARTNER_PARTICIPATION_STATUSES)[number];

export const DNX_PARTNER_PAYMENT_MODES = [
  "NONE",
  "ONE_TIME",
  "INSTALLMENTS",
  "RECURRING",
  "MANUAL",
  "EXTERNAL",
] as const;
export type DnxPartnerPaymentMode = (typeof DNX_PARTNER_PAYMENT_MODES)[number];

export const DNX_PARTNER_CONTRIBUTION_TYPES = [
  "MONEY",
  "PRODUCT",
  "PRIZE",
  "VOUCHER",
  "DISCOUNT",
  "SERVICE",
  "EQUIPMENT",
  "PROMOTION",
  "CONTENT",
  "INSTITUTIONAL_SUPPORT",
  "VENUE",
  "LOGISTICS",
  "OTHER",
] as const;
export type DnxPartnerContributionType =
  (typeof DNX_PARTNER_CONTRIBUTION_TYPES)[number];

export const DNX_PARTNER_CONTRIBUTION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type DnxPartnerContributionStatus =
  (typeof DNX_PARTNER_CONTRIBUTION_STATUSES)[number];

export const DNX_PARTNER_BENEFIT_TYPES = [
  "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT",
  "PROMO_CODE",
  "FREE_SERVICE",
  "FREE_PRODUCT",
  "VOUCHER",
  "PRIORITY_SERVICE",
  "SPECIAL_PRICE",
  "UPGRADE",
  "OTHER",
] as const;
export type DnxPartnerBenefitType = (typeof DNX_PARTNER_BENEFIT_TYPES)[number];

export const DNX_PARTNER_REDEMPTION_METHODS = [
  "PROMO_CODE",
  "DIGITAL_CREDENTIAL",
  "PHYSICAL_CREDENTIAL",
  "IDENTITY_VERIFICATION",
  "MANUAL_APPROVAL",
  "EXTERNAL_LINK",
  "CONTACT_PARTNER",
  "OTHER",
] as const;
export type DnxPartnerRedemptionMethod =
  (typeof DNX_PARTNER_REDEMPTION_METHODS)[number];

export const DNX_PARTNER_BENEFIT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "ARCHIVED",
] as const;
export type DnxPartnerBenefitStatus =
  (typeof DNX_PARTNER_BENEFIT_STATUSES)[number];

export const DNX_PARTNER_AUDIENCE_TYPES = [
  "ALL_USERS",
  "ORGANIZATION_MEMBERS",
  "EVENT_PARTICIPANTS",
  "EDITION_PARTICIPANTS",
  "PRODUCT_PURCHASERS",
  "MEMBERSHIP_HOLDERS",
  "MANUAL_USERS",
  "CUSTOM_GROUP",
  "OTHER",
] as const;
export type DnxPartnerAudienceType = (typeof DNX_PARTNER_AUDIENCE_TYPES)[number];

export const DNX_PARTNER_CAPABILITIES = [
  "PARTNER_VIEW",
  "PARTNER_CREATE",
  "PARTNER_UPDATE",
  "PARTNER_ARCHIVE",
  "PARTNER_PARTICIPATIONS_MANAGE",
  "PARTNER_CONTRIBUTIONS_MANAGE",
  "PARTNER_BENEFITS_VIEW",
  "PARTNER_BENEFITS_MANAGE",
  "PARTNER_BENEFITS_PUBLISH",
  /** Otorgar / revocar acceso manual a un beneficio (≠ DnxPartnerGrant RBAC). */
  "PARTNER_BENEFITS_GRANT",
  "PARTNER_PAYMENTS_VIEW",
  "PARTNER_PAYMENTS_MANAGE",
  "PARTNER_CONTACT_SENSITIVE",
] as const;
export type DnxPartnerCapability = (typeof DNX_PARTNER_CAPABILITIES)[number];

export const DNX_PARTNER_BENEFIT_ACCESS_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type DnxPartnerBenefitAccessStatus =
  (typeof DNX_PARTNER_BENEFIT_ACCESS_STATUSES)[number];

export type PartnerRecord = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  description: string | null;
  type: DnxPartnerType;
  status: DnxPartnerStatus;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  notes: string | null;
  financialIdentityId: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type PartnerContactRecord = {
  id: string;
  partnerId: string;
  firstName: string;
  lastName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ParticipationRecord = {
  id: string;
  partnerId: string;
  organizationId: string | null;
  application: DnxPartnerApplication;
  contextType: DnxPartnerContextType;
  contextId: string | null;
  participationType: DnxPartnerParticipationType;
  title: string | null;
  description: string | null;
  status: DnxPartnerParticipationStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  requiresPayment: boolean;
  paymentMode: DnxPartnerPaymentMode;
  paymentAmountMinor: number | null;
  paymentCurrency: string | null;
  paymentNotes: string | null;
  estimatedValueMinor: number | null;
  currency: string | null;
  notes: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ContributionRecord = {
  id: string;
  participationId: string;
  type: DnxPartnerContributionType;
  title: string;
  description: string | null;
  quantity: number | null;
  estimatedUnitValueMinor: number | null;
  estimatedTotalValueMinor: number | null;
  currency: string | null;
  status: DnxPartnerContributionStatus;
  deliveryDate: Date | null;
  deliveredAt: Date | null;
  promotionId: string | null;
  prizeBundleId: string | null;
  externalCode: string | null;
  notes: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BenefitRecord = {
  id: string;
  partnerId: string;
  participationId: string | null;
  title: string;
  description: string | null;
  benefitType: DnxPartnerBenefitType;
  status: DnxPartnerBenefitStatus;
  discountPercentage: number | null;
  discountAmountMinor: number | null;
  currency: string | null;
  promoCode: string | null;
  promotionId: string | null;
  redemptionMethod: DnxPartnerRedemptionMethod;
  redemptionInstructions: string | null;
  terms: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  totalRedemptionLimit: number | null;
  perUserRedemptionLimit: number | null;
  isPublic: boolean;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type BenefitAudienceRecord = {
  id: string;
  benefitId: string;
  audienceType: DnxPartnerAudienceType;
  organizationId: string | null;
  contextType: DnxPartnerContextType | null;
  contextId: string | null;
  manualUserId: number | null;
  label: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type PartnerAuditEventRecord = {
  id: string;
  partnerId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: number | null;
  summary: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: Date;
};

export type PartnerGrantRecord = {
  id: string;
  userId: number;
  capability: DnxPartnerCapability;
  scopeType: string | null;
  scopeId: string | null;
  status: "ACTIVE" | "REVOKED";
  grantedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
};

/**
 * Acceso individual a un beneficio (cortesía / excepción / asignación manual).
 * Distinto de PartnerGrantRecord (= capabilities RBAC del módulo).
 */
export type BenefitAccessRecord = {
  id: string;
  benefitId: string;
  userId: number;
  status: DnxPartnerBenefitAccessStatus;
  reason: string | null;
  notes: string | null;
  grantedByUserId: number | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GrantBenefitAccessInput = {
  benefitId: string;
  userId: number;
  reason?: string | null;
  notes?: string | null;
  grantedByUserId?: number | null;
};

export type PartnerListItem = PartnerRecord & {
  activeParticipationsCount: number;
  activeBenefitsCount: number;
};

export type CreatePartnerInput = {
  name: string;
  legalName?: string | null;
  slug?: string | null;
  description?: string | null;
  type?: DnxPartnerType;
  status?: DnxPartnerStatus;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  instagram?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  notes?: string | null;
  createdByUserId?: number | null;
};

export type UpdatePartnerInput = Partial<
  Omit<CreatePartnerInput, "createdByUserId">
> & {
  updatedByUserId?: number | null;
  status?: DnxPartnerStatus;
};

export type CreateParticipationInput = {
  partnerId: string;
  organizationId?: string | null;
  application: DnxPartnerApplication;
  contextType?: DnxPartnerContextType;
  contextId?: string | null;
  participationType?: DnxPartnerParticipationType;
  title?: string | null;
  description?: string | null;
  status?: DnxPartnerParticipationStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  requiresPayment?: boolean;
  paymentMode?: DnxPartnerPaymentMode;
  paymentAmountMinor?: number | null;
  paymentCurrency?: string | null;
  paymentNotes?: string | null;
  estimatedValueMinor?: number | null;
  currency?: string | null;
  notes?: string | null;
  createdByUserId?: number | null;
  /**
   * Si ya existe participación activa similar (mismo partner+app+contexto+tipo),
   * exige confirmación explícita para no duplicar en silencio.
   */
  allowDuplicateActive?: boolean;
};

export type ListParticipationsByContextQuery = {
  application: DnxPartnerApplication;
  contextType: DnxPartnerContextType;
  contextId: string;
  status?: DnxPartnerParticipationStatus;
  includeArchived?: boolean;
};

export type UpdateParticipationInput = Partial<
  Omit<CreateParticipationInput, "partnerId" | "createdByUserId">
> & {
  updatedByUserId?: number | null;
};

export type CreateContributionInput = {
  participationId: string;
  type: DnxPartnerContributionType;
  title: string;
  description?: string | null;
  quantity?: number | null;
  estimatedUnitValueMinor?: number | null;
  estimatedTotalValueMinor?: number | null;
  currency?: string | null;
  status?: DnxPartnerContributionStatus;
  deliveryDate?: Date | null;
  promotionId?: string | null;
  prizeBundleId?: string | null;
  externalCode?: string | null;
  notes?: string | null;
  createdByUserId?: number | null;
};

export type UpdateContributionInput = Partial<
  Omit<CreateContributionInput, "participationId" | "createdByUserId">
> & {
  updatedByUserId?: number | null;
  deliveredAt?: Date | null;
};

export type CreateBenefitInput = {
  partnerId: string;
  participationId?: string | null;
  title: string;
  description?: string | null;
  benefitType: DnxPartnerBenefitType;
  status?: DnxPartnerBenefitStatus;
  discountPercentage?: number | null;
  discountAmountMinor?: number | null;
  currency?: string | null;
  promoCode?: string | null;
  promotionId?: string | null;
  redemptionMethod?: DnxPartnerRedemptionMethod;
  redemptionInstructions?: string | null;
  terms?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  totalRedemptionLimit?: number | null;
  perUserRedemptionLimit?: number | null;
  isPublic?: boolean;
  createdByUserId?: number | null;
};

export type UpdateBenefitInput = Partial<
  Omit<CreateBenefitInput, "partnerId" | "createdByUserId">
> & {
  updatedByUserId?: number | null;
};

export type AssignAudienceInput = {
  benefitId: string;
  audienceType: DnxPartnerAudienceType;
  organizationId?: string | null;
  contextType?: DnxPartnerContextType | null;
  contextId?: string | null;
  manualUserId?: number | null;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateContactInput = {
  partnerId: string;
  firstName: string;
  lastName?: string | null;
  roleTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
};

export type PartnerActor = {
  userId: number;
  /** Bundle ops Clickatón admin: todas las capabilities excepto las que se listen aparte. */
  isOpsAdmin?: boolean;
  capabilities?: readonly DnxPartnerCapability[];
};

export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVALID_STATE";

export class PartnersDomainError extends Error {
  readonly code: DomainErrorCode;
  readonly fieldErrors: Record<string, string>;

  constructor(
    code: DomainErrorCode,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "PartnersDomainError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
