import type { DnxPartnerBrandAssetType } from "./assets-types";

export const DNX_PARTNER_ONBOARDING_INVITATION_STATUSES = [
  "PENDING",
  "OPENED",
  "SUBMITTED",
  "EXPIRED",
  "REVOKED",
] as const;
export type DnxPartnerOnboardingInvitationStatus =
  (typeof DNX_PARTNER_ONBOARDING_INVITATION_STATUSES)[number];

export const DNX_PARTNER_ONBOARDING_REVIEW_STATUSES = [
  "NONE",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
] as const;
export type DnxPartnerOnboardingReviewStatus =
  (typeof DNX_PARTNER_ONBOARDING_REVIEW_STATUSES)[number];

/** Columna admin "Datos del Partner" — dimensión distinta de PROSPECT/ACTIVE. */
export const DNX_PARTNER_ONBOARDING_ADMIN_STATUSES = [
  "NOT_REQUESTED",
  "INVITATION_SENT",
  "OPENED",
  "DATA_RECEIVED",
  "PENDING_REVIEW",
  "COMPLETE",
  "EXPIRED",
] as const;
export type DnxPartnerOnboardingAdminStatus =
  (typeof DNX_PARTNER_ONBOARDING_ADMIN_STATUSES)[number];

export const PARTNER_ONBOARDING_ADMIN_STATUS_LABELS: Record<
  DnxPartnerOnboardingAdminStatus,
  string
> = {
  NOT_REQUESTED: "No solicitado",
  INVITATION_SENT: "Invitación enviada",
  OPENED: "Abierto",
  DATA_RECEIVED: "Datos recibidos",
  PENDING_REVIEW: "Revisión pendiente",
  COMPLETE: "Completo",
  EXPIRED: "Vencido",
};

export type PartnerOnboardingDestinationKind =
  | "WEBSITE"
  | "INSTAGRAM"
  | "WHATSAPP"
  | "OTHER";

export type PartnerOnboardingCompanyDraft = {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  instagram?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  address?: string | null;
  city?: string | null;
  provinceOrState?: string | null;
  country?: string | null;
  postalCode?: string | null;
  destinationKind?: PartnerOnboardingDestinationKind | null;
  destinationUrl?: string | null;
  contributionNotes?: string | null;
  observations?: string | null;
};

export type PartnerOnboardingContactDraft = {
  firstName?: string;
  lastName?: string | null;
  roleTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  emailIsPublic?: boolean;
  phoneIsPublic?: boolean;
};

export type PartnerOnboardingLogoRef = {
  assetId: string;
  type: DnxPartnerBrandAssetType;
  backgroundType?: "COLOR" | "LIGHT" | "DARK" | null;
  fileUrl?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
};

export type PartnerOnboardingDraft = {
  company?: PartnerOnboardingCompanyDraft;
  contact?: PartnerOnboardingContactDraft;
  logos?: PartnerOnboardingLogoRef[];
  consents?: {
    authority: boolean;
    brandUsage: boolean;
    marketing?: boolean;
  };
  step?: number;
};

export type PartnerOnboardingSubmission = PartnerOnboardingDraft & {
  submittedAt: string;
};

export type OnboardingInvitationRecord = {
  id: string;
  partnerId: string;
  participationId: string | null;
  tokenHash: string;
  status: DnxPartnerOnboardingInvitationStatus;
  reviewStatus: DnxPartnerOnboardingReviewStatus;
  expiresAt: Date;
  openedAt: Date | null;
  submittedAt: Date | null;
  revokedAt: Date | null;
  reviewNotes: string | null;
  draftJson: PartnerOnboardingDraft | null;
  submissionJson: PartnerOnboardingSubmission | null;
  createdByUserId: number | null;
  reviewedByUserId: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOnboardingInvitationInput = {
  partnerId: string;
  participationId?: string | null;
  /** Días hasta expiración. Default 14. */
  expiresInDays?: number;
  createdByUserId?: number | null;
};

export type CreateOnboardingInvitationResult = {
  invitation: Omit<OnboardingInvitationRecord, "tokenHash">;
  /** Token plaintext — solo se expone una vez al crear. Nunca persistir ni loguear. */
  rawToken: string;
};

export type ReviewOnboardingAction =
  | "APPROVE_DATA"
  | "APPROVE_LOGOS"
  | "REQUEST_CHANGES"
  | "REJECT";

export type ReviewOnboardingInput = {
  invitationId: string;
  action: ReviewOnboardingAction;
  notes?: string | null;
  /** Si true al aprobar datos, aplica campos propuestos sobre DnxPartner / contacto. */
  applyProposedData?: boolean;
  /** Asset ids a aprobar cuando action=APPROVE_LOGOS. Si vacío, aprueba logos referenciados en submission. */
  logoAssetIds?: string[];
};
