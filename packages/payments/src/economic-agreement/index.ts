export type {
  AgreementParticipant,
  AgreementParticipantRoleLabel,
  AgreementParticipantStatus,
  DistributionRuleKind,
  DistributionRuleRecord,
  DistributionVersion,
  DistributionVersionStatus,
  EconomicAgreement,
  EconomicAgreementStatus,
  OrderDistributionSnapshot,
  OrderDistributionSnapshotParticipant,
  OrderDistributionSnapshotPayload,
} from "./types.js";
export { PERCENTAGE_BPS_TOTAL } from "./types.js";
export { EconomicAgreementError } from "./errors.js";
export { EconomicAgreementService } from "./service.js";
export {
  CLICKATON_PARTNERS_AGREEMENT,
  CLICKATON_PARTNERS_BPS,
  CLICKATON_PARTNERS_MP_IDS,
  configureClickatonPartnersAgreement,
} from "./configure-clickaton-partners.js";
export type {
  ConfigureClickatonPartnersInput,
  ConfigureClickatonPartnersResult,
  PartnerKey,
  PartnerUserRef,
  PermissionProbeResult,
} from "./configure-clickaton-partners.js";
