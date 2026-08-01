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

  listBenefits(partnerId: string): Promise<BenefitRecord[]>;
  listBenefitsByParticipationIds(participationIds: string[]): Promise<BenefitRecord[]>;
  getBenefitById(id: string): Promise<BenefitRecord | null>;
  createBenefit(input: CreateBenefitInput): Promise<BenefitRecord>;
  updateBenefit(id: string, input: UpdateBenefitInput): Promise<BenefitRecord>;
  archiveBenefit(id: string, actorUserId: number | null): Promise<BenefitRecord>;

  listAudiences(benefitId: string): Promise<BenefitAudienceRecord[]>;
  assignAudience(input: AssignAudienceInput): Promise<BenefitAudienceRecord>;

  listBenefitAccess(benefitId: string): Promise<BenefitAccessRecord[]>;
  getActiveBenefitAccess(
    benefitId: string,
    userId: number,
  ): Promise<BenefitAccessRecord | null>;
  upsertBenefitAccess(input: GrantBenefitAccessInput): Promise<BenefitAccessRecord>;
  revokeBenefitAccess(
    benefitId: string,
    userId: number,
    actorUserId: number | null,
  ): Promise<BenefitAccessRecord>;

  appendAudit(
    event: Omit<PartnerAuditEventRecord, "id" | "createdAt"> & { id?: string },
  ): Promise<void>;
};
