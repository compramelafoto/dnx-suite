import type {
  CreateBrandAssetInput,
  CreateParticipationAssetInput,
  ListParticipationAssetsQuery,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  UpdateBrandAssetInput,
  UpdateParticipationAssetInput,
} from "./assets-types";
import type {
  ClickEventRecord,
  DnxPartnerPlacement,
  OutboundLinkRecord,
} from "./tracking";
import type {
  OnboardingInvitationRecord,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
  DnxPartnerOnboardingInvitationStatus,
  DnxPartnerOnboardingReviewStatus,
} from "./onboarding-types";
import type {
  AssignAudienceInput,
  BenefitAccessRecord,
  BenefitAudienceRecord,
  BenefitRecord,
  ContributionRecord,
  CreateBenefitInput,
  CreateContactInput,
  CreateContributionInput,
  CreateParticipationInput,
  CreatePartnerInput,
  GrantBenefitAccessInput,
  ListParticipationsByContextQuery,
  PartnerAuditEventRecord,
  PartnerContactRecord,
  PartnerListItem,
  PartnerRecord,
  ParticipationRecord,
  UpdateBenefitInput,
  UpdateContributionInput,
  UpdateParticipationInput,
  UpdatePartnerInput,
} from "./types";

export type CreateOnboardingInvitationRepoInput = {
  partnerId: string;
  participationId?: string | null;
  tokenHash: string;
  expiresAt: Date;
  createdByUserId?: number | null;
};

export type UpdateOnboardingInvitationRepoInput = {
  status?: DnxPartnerOnboardingInvitationStatus;
  reviewStatus?: DnxPartnerOnboardingReviewStatus;
  expiresAt?: Date;
  openedAt?: Date | null;
  submittedAt?: Date | null;
  revokedAt?: Date | null;
  reviewNotes?: string | null;
  draftJson?: PartnerOnboardingDraft | null;
  submissionJson?: PartnerOnboardingSubmission | null;
  reviewedByUserId?: number | null;
  reviewedAt?: Date | null;
};

export type CreateOutboundLinkInput = {
  trackingKey: string;
  partnerId: string;
  participationId?: string | null;
  application: ParticipationRecord["application"];
  contextType: ParticipationRecord["contextType"];
  contextId?: string | null;
  assetId?: string | null;
  placement: DnxPartnerPlacement;
  destinationUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  status?: OutboundLinkRecord["status"];
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export type UpdateOutboundLinkInput = Partial<
  Omit<CreateOutboundLinkInput, "trackingKey" | "partnerId">
> & {
  status?: OutboundLinkRecord["status"];
  archivedAt?: Date | null;
};

export type CreateClickEventInput = {
  outboundLinkId: string;
  partnerId: string;
  participationId?: string | null;
  application: ParticipationRecord["application"];
  contextType: ParticipationRecord["contextType"];
  contextId?: string | null;
  assetId?: string | null;
  placement: DnxPartnerPlacement;
  referrerHost?: string | null;
  deviceClass: ClickEventRecord["deviceClass"];
  browserFamily?: string | null;
  countryCode?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PartnersRepository = {
  listPartners(query?: { search?: string; status?: string }): Promise<PartnerListItem[]>;
  getPartnerById(id: string): Promise<PartnerRecord | null>;
  getPartnerBySlug(slug: string): Promise<PartnerRecord | null>;
  createPartner(input: CreatePartnerInput & { slug: string; name: string }): Promise<PartnerRecord>;
  updatePartner(id: string, input: UpdatePartnerInput): Promise<PartnerRecord>;
  archivePartner(id: string, actorUserId: number | null): Promise<PartnerRecord>;

  listContacts(partnerId: string): Promise<PartnerContactRecord[]>;
  createContact(input: CreateContactInput): Promise<PartnerContactRecord>;

  listParticipations(partnerId: string): Promise<ParticipationRecord[]>;
  listParticipationsByContext(
    query: ListParticipationsByContextQuery,
  ): Promise<ParticipationRecord[]>;
  getParticipationById(id: string): Promise<ParticipationRecord | null>;
  createParticipation(input: CreateParticipationInput): Promise<ParticipationRecord>;
  updateParticipation(id: string, input: UpdateParticipationInput): Promise<ParticipationRecord>;
  archiveParticipation(id: string, actorUserId: number | null): Promise<ParticipationRecord>;

  listContributions(participationId: string): Promise<ContributionRecord[]>;
  listContributionsByPrizeBundleId(prizeBundleId: string): Promise<ContributionRecord[]>;
  getContributionById(id: string): Promise<ContributionRecord | null>;
  createContribution(input: CreateContributionInput): Promise<ContributionRecord>;
  updateContribution(id: string, input: UpdateContributionInput): Promise<ContributionRecord>;
  deleteContribution(id: string): Promise<void>;

  listBenefits(partnerId: string): Promise<BenefitRecord[]>;
  listBenefitsByParticipationIds(participationIds: string[]): Promise<BenefitRecord[]>;
  getBenefitById(id: string): Promise<BenefitRecord | null>;
  createBenefit(input: CreateBenefitInput): Promise<BenefitRecord>;
  updateBenefit(id: string, input: UpdateBenefitInput): Promise<BenefitRecord>;
  archiveBenefit(id: string, actorUserId: number | null): Promise<BenefitRecord>;

  listAudiences(benefitId: string): Promise<BenefitAudienceRecord[]>;
  assignAudience(input: AssignAudienceInput): Promise<BenefitAudienceRecord>;

  listBenefitAccess(benefitId: string): Promise<BenefitAccessRecord[]>;
  getBenefitAccessByAccessKey(accessKey: string): Promise<BenefitAccessRecord | null>;
  /** Cualquier acceso ACTIVE para el par beneficio+usuario (efectivo). */
  getActiveBenefitAccess(
    benefitId: string,
    userId: number,
  ): Promise<BenefitAccessRecord | null>;
  listActiveBenefitAccessForUser(
    benefitId: string,
    userId: number,
  ): Promise<BenefitAccessRecord[]>;
  upsertBenefitAccess(input: GrantBenefitAccessInput): Promise<BenefitAccessRecord>;
  revokeBenefitAccessByAccessKey(
    accessKey: string,
    actorUserId: number | null,
  ): Promise<BenefitAccessRecord>;
  /** Revoca todos los ACTIVE del par (manual admin). */
  revokeBenefitAccess(
    benefitId: string,
    userId: number,
    actorUserId: number | null,
  ): Promise<BenefitAccessRecord>;

  listBrandAssets(partnerId: string): Promise<PartnerBrandAssetRecord[]>;
  getBrandAssetById(id: string): Promise<PartnerBrandAssetRecord | null>;
  createBrandAsset(input: CreateBrandAssetInput): Promise<PartnerBrandAssetRecord>;
  updateBrandAsset(id: string, input: UpdateBrandAssetInput): Promise<PartnerBrandAssetRecord>;
  clearPrimaryBrandAssets(partnerId: string, exceptId?: string): Promise<void>;

  listParticipationAssets(
    query: ListParticipationAssetsQuery,
  ): Promise<ParticipationAssetRecord[]>;
  getParticipationAssetById(id: string): Promise<ParticipationAssetRecord | null>;
  createParticipationAsset(
    input: CreateParticipationAssetInput,
  ): Promise<ParticipationAssetRecord>;
  updateParticipationAsset(
    id: string,
    input: UpdateParticipationAssetInput,
  ): Promise<ParticipationAssetRecord>;

  appendAudit(
    event: Omit<PartnerAuditEventRecord, "id" | "createdAt"> & { id?: string },
  ): Promise<void>;

  getOutboundLinkByTrackingKey(trackingKey: string): Promise<OutboundLinkRecord | null>;
  findOutboundLinkByParticipationPlacement(
    participationId: string,
    placement: DnxPartnerPlacement,
  ): Promise<OutboundLinkRecord | null>;
  listOutboundLinksByPartner(partnerId: string): Promise<OutboundLinkRecord[]>;
  createOutboundLink(input: CreateOutboundLinkInput): Promise<OutboundLinkRecord>;
  updateOutboundLink(id: string, input: UpdateOutboundLinkInput): Promise<OutboundLinkRecord>;
  createClickEvent(input: CreateClickEventInput): Promise<ClickEventRecord>;
  listClickEventsByPartner(partnerId: string): Promise<ClickEventRecord[]>;
  countClickEvents(query: {
    partnerId?: string;
    participationId?: string;
    application?: ParticipationRecord["application"];
    contextId?: string;
    since?: Date;
  }): Promise<number>;

  createOnboardingInvitation(
    input: CreateOnboardingInvitationRepoInput,
  ): Promise<OnboardingInvitationRecord>;
  getOnboardingInvitationById(id: string): Promise<OnboardingInvitationRecord | null>;
  getOnboardingInvitationByTokenHash(
    tokenHash: string,
  ): Promise<OnboardingInvitationRecord | null>;
  listOnboardingInvitationsByPartner(
    partnerId: string,
  ): Promise<OnboardingInvitationRecord[]>;
  updateOnboardingInvitation(
    id: string,
    input: UpdateOnboardingInvitationRepoInput,
  ): Promise<OnboardingInvitationRecord>;
};
