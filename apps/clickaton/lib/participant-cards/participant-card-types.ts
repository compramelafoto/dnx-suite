export type ClickatonParticipantCardType = "welcome" | "member";

export type ParticipantCardActorKind = "participant" | "admin";

export type ParticipantCardActor = {
  kind: ParticipantCardActorKind;
  userId?: number;
  email?: string;
  /** Requerido para validar admin cuando kind === "admin". */
  globalRole?: string;
};

export type ParticipantCardMode = "final" | "preview";

export type ParticipantCardDisposition = "inline" | "attachment";

export type ParticipantCardWarningCode =
  | "PAYMENT_MANUAL_REVIEW"
  | "CONSENT_MISSING"
  | "PHOTO_PLACEHOLDER"
  | "EVENT_DATE_MISSING"
  | "INSTAGRAM_MISSING";

export type ParticipantCardWarning = {
  code: ParticipantCardWarningCode;
  message: string;
};

export type ParticipantCardEligibility = {
  eligible: boolean;
  blocked: boolean;
  warnings: ParticipantCardWarning[];
  blockReason?: string;
};

export type ParticipantCardRegistrationSnapshot = {
  id: string;
  userId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  city: string | null;
  province: string | null;
  country: string;
  instagramHandle: string | null;
  instagramHandleNormalized: string | null;
  profilePhotoAssetId: string | null;
  profilePhotoStatus: string | null;
  visibleCode: string | null;
  sequenceNumber: number | null;
  status: string;
  paymentStatus: string;
  imageUsageConsent: boolean;
  socialPublicationConsent: boolean;
  consentAcceptedAt: Date | null;
  acceptedImageAt: Date | null;
  acceptedTermsAt: Date | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  ticketType: { name: string };
  edition: {
    name: string;
    slug: string;
    city: string | null;
    startAt: Date | null;
    location: string | null;
    timezone: string | null;
    coverImageUrl: string | null;
  };
  venue: { name: string; city: string } | null;
};

export type GenerateClickatonParticipantCardInput = {
  registrationId: string;
  cardType: ClickatonParticipantCardType | "WELCOME" | "MEMBER";
  actor: ParticipantCardActor;
  mode?: ParticipantCardMode;
  disposition?: ParticipantCardDisposition;
};

export type ParticipantCardSourceSummary = {
  presetId: string;
  templateKey: string;
  templateVersion: number;
  blockCount: number;
  imageCount: number;
};

export type GenerateClickatonParticipantCardResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  filename: string;
  cardType: ClickatonParticipantCardType;
  registrationId: string;
  eligibility: ParticipantCardEligibility;
  warnings: ParticipantCardWarning[];
  durationMs: number;
  sourceSummary?: ParticipantCardSourceSummary;
  cacheStatus?: "HIT" | "MISS" | "REGENERATED";
  renderHash?: string;
  renderHashPrefix?: string;
  recordId?: string;
  recordStatus?: "NOT_GENERATED" | "GENERATING" | "READY" | "FAILED" | "STALE";
  generatedAt?: Date | null;
};

export type ParticipantCardConsentInput = Pick<
  ParticipantCardRegistrationSnapshot,
  | "imageUsageConsent"
  | "acceptedImageAt"
  | "acceptedTermsAt"
  | "termsAcceptedAt"
>;
