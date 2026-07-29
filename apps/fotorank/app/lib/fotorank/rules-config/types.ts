/**
 * ContestRulesConfiguration — fuente de verdad estructurada (P0-09A).
 * Las bases textuales referencian una versión publicada de esta configuración.
 */

export type RequirementLevel = "REQUIRED" | "RECOMMENDED" | "INFORMATIVE" | "NOT_REQUIRED";
export type MissingInfoAction = "ALLOW" | "WARN" | "REQUIRES_REVIEW" | "BLOCK" | "REJECT";
export type EditingRuleState = "ALLOWED" | "LIMITED" | "PROHIBITED" | "REQUIRES_DECLARATION";
export type AiRuleState = "ALLOWED" | "PROHIBITED" | "REQUIRES_DECLARATION" | "REQUIRES_REVIEW";
export type DeviceType = "MOBILE" | "CAMERA" | "DRONE" | "OPEN" | "OTHER";
export type PricingMode = "FREE" | "PAID" | "INVITATION_ONLY";
export type OptionalLimit = number | null; // null = no definido / no aplicable

export type ValidationStatus =
  | "VALID"
  | "VALID_WITH_WARNINGS"
  | "INVALID"
  | "PENDING_HUMAN_CONFIRMATION";

export type TextCompareStatus =
  | "MATCH"
  | "CONFLICT"
  | "MISSING"
  | "EXTRA_RULE"
  | "UNVERIFIABLE"
  /** @deprecated Preferir MISSING (P0-09B). */
  | "NOT_MENTIONED";

export type TextCompareSeverity = "INFO" | "WARNING" | "BLOCKING";

export type ContestRulesIdentity = {
  officialName: string;
  slug: string;
  description: string | null;
  organizers: Array<{ name: string; role?: string }>;
  participatingInstitutions: string[];
  territoryScope: string | null;
  country: string;
  province: string | null;
  siteUrl: string | null;
  contactEmail: string | null;
  language: string;
  timezone: string;
  platformName: string;
};

export type ContestRulesSchedule = {
  registrationOpensAt: string; // ISO local wall or UTC ISO — stored as UTC ISO
  registrationClosesAtExclusive: string;
  submissionOpensAt: string;
  submissionClosesAtExclusive: string;
  replaceClosesAtExclusive: string | null;
  judgingStartsAt: string | null;
  judgingEndsAt: string | null;
  resultsAt: string | null;
  awardsAt: string | null;
  captureWindowStartsAt: string | null;
  captureWindowEndsExclusiveAt: string | null;
  timezone: string;
  publicScheduleNote: string | null;
};

export type ContestRulesParticipation = {
  pricingMode: PricingMode;
  priceAmountMinor: number;
  currency: string;
  platformFeeBps: number;
  minAge: number | null;
  minorsAllowed: boolean | null;
  adultAuthorizationRequired: boolean | null;
  adultAuthorizationPendingHumanConfirmation: boolean;
  residencyRequired: boolean;
  residencyScope: string | null;
  individualOnly: boolean;
  maxRegistrationsPerPerson: number;
  maxCategoriesPerRegistration: number;
  maxEntriesPerRegistration: number;
  allowReplaceUntilClose: boolean;
  allowWithdrawal: boolean;
};

export type ContestRulesCategory = {
  name: string;
  slug: string;
  description: string | null;
  deviceType: DeviceType;
  particularRequirements: string | null;
  maxEntries: number;
  active: boolean;
  sortOrder: number;
  membershipRestriction: string | null;
};

export type ContestRulesFile = {
  /** Formatos que el pipeline soporta realmente. */
  supportedMimeTypes: string[];
  supportedExtensions: string[];
  /** Límites reglamentarios: null = no definidos por el concurso. */
  maxFileSizeBytes: OptionalLimit;
  minWidth: OptionalLimit;
  minHeight: OptionalLimit;
  maxWidth: OptionalLimit;
  maxHeight: OptionalLimit;
  minMegapixels: OptionalLimit;
  aspectRatioRestricted: boolean;
  orientationFree: boolean;
  colorAllowed: boolean;
  blackAndWhiteAllowed: boolean;
  originalFileRequired: boolean;
  rawEventuallyRequested: boolean;
  /** Límites internos de infraestructura (no reglamentarios). */
  internalSafetyMaxFileSizeBytes: number;
  note: string | null;
};

export type MetadataFieldPolicy = {
  level: RequirementLevel;
  missingAction: MissingInfoAction;
};

export type ContestRulesMetadata = {
  exifGeneral: MetadataFieldPolicy;
  captureDate: MetadataFieldPolicy;
  gps: MetadataFieldPolicy;
  deviceModel: MetadataFieldPolicy;
  lens: MetadataFieldPolicy;
  altitude: MetadataFieldPolicy;
  editingSoftware: MetadataFieldPolicy;
};

export type ContestRulesEditing = {
  exposure: EditingRuleState;
  contrast: EditingRuleState;
  highlights: EditingRuleState;
  shadows: EditingRuleState;
  whiteBalance: EditingRuleState;
  color: EditingRuleState;
  saturation: EditingRuleState;
  crop: EditingRuleState;
  rotate: EditingRuleState;
  sharpen: EditingRuleState;
  noiseReduction: EditingRuleState;
  opticalCorrections: EditingRuleState;
  radialMasks: EditingRuleState;
  linearMasks: EditingRuleState;
  subjectMasks: EditingRuleState;
  skyMasks: EditingRuleState;
  hdr: EditingRuleState;
  panoramas: EditingRuleState;
  removeElements: EditingRuleState;
  addElements: EditingRuleState;
  skyReplacement: EditingRuleState;
  photomontage: EditingRuleState;
  multiComposition: EditingRuleState;
  signatures: EditingRuleState;
  frames: EditingRuleState;
  watermarks: EditingRuleState;
  notes: string | null;
};

export type ContestRulesAi = {
  fullyGeneratedImage: AiRuleState;
  generativeFill: AiRuleState;
  generativeRemove: AiRuleState;
  generativeExpand: AiRuleState;
  generativeAdd: AiRuleState;
  generativeReplace: AiRuleState;
  aiNoiseReduction: AiRuleState;
  aiSharpen: AiRuleState;
  smartMasks: AiRuleState;
  autoSelect: AiRuleState;
  autoDevelop: AiRuleState;
  assistedColorCorrection: AiRuleState;
  notes: string | null;
};

export type ContestRulesRights = {
  authorRetainsOwnership: boolean;
  authorshipDeclarationRequired: boolean;
  thirdPartyRightsCleared: boolean;
  imageAuthorizationRequired: boolean;
  licenseMandatory: boolean;
  licenseAppliesToAllWorks: boolean;
  exclusive: boolean;
  compensated: boolean;
  durationMonths: number | null;
  territory: string | null;
  purposes: string[];
  allowReproduction: boolean;
  allowPublication: boolean;
  allowExhibition: boolean;
  allowInstitutional: boolean;
  allowEducational: boolean;
  allowCultural: boolean;
  allowPromotional: boolean;
  allowCommercial: boolean;
  allowPrint: boolean;
  allowCatalog: boolean;
  allowProducts: boolean;
  allowSocial: boolean;
  archivalHeritagePermanentForSelected: boolean;
  attributionRequired: boolean;
  sublicenseAllowed: boolean | null;
  conserveOriginal: boolean;
  deletionPolicyNote: string | null;
  legalReviewFlags: string[];
};

export type ContestRulesJury = {
  minJudges: number | null;
  maxJudges: number | null;
  judgesPendingHumanConfirmation: boolean;
  perCategory: boolean;
  decisionFinal: boolean;
  prizesMayBeDeserted: boolean;
  conflictOfInterestEnabled: boolean;
  anonymizedEvaluation: boolean;
  generalCriteria: string | null;
};

export type ContestRulesPrize = {
  categorySlug: string;
  place: number;
  amountMinor: number;
  currency: string;
  inKindDescription: string | null;
  isMention: boolean;
};

export type ContestRulesDisqualification = {
  code: string;
  label: string;
  severity: "WARNING" | "MANUAL_REVIEW" | "REQUEST_REPLACE" | "TECHNICAL_REJECT" | "DISQUALIFY";
  enabled: boolean;
};

export type ContestRulesTheme = {
  summary: string;
  geographicScope: string;
  temporalScopeNote: string;
  subjectNotes: string[];
};

export type ContestRulesConfiguration = {
  schemaVersion: 1;
  identity: ContestRulesIdentity;
  schedule: ContestRulesSchedule;
  participation: ContestRulesParticipation;
  theme: ContestRulesTheme;
  categories: ContestRulesCategory[];
  file: ContestRulesFile;
  metadata: ContestRulesMetadata;
  editing: ContestRulesEditing;
  ai: ContestRulesAi;
  rights: ContestRulesRights;
  jury: ContestRulesJury;
  prizes: ContestRulesPrize[];
  disqualifications: ContestRulesDisqualification[];
};

export type ValidationFinding = {
  code: string;
  severity: "error" | "warning" | "pending_human";
  message: string;
  path?: string;
};

export type ValidationResult = {
  status: ValidationStatus;
  findings: ValidationFinding[];
};
