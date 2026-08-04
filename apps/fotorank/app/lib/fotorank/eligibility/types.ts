/** Políticas de elegibilidad Santa Fe en Foco / genéricas reutilizables. */

export type EligibilityDecision =
  | "ELIGIBLE"
  | "MANUAL_REVIEW_REQUIRED"
  | "NOT_ELIGIBLE"
  | "DECLARED_VALID"
  | "GPS_SUPPORTED"
  | "REVIEW_REQUIRED"
  | "WITHIN_CAPTURE_WINDOW"
  | "DATE_MISSING_REVIEW"
  | "OUTSIDE_CAPTURE_WINDOW_REVIEW"
  | "DATE_INVALID_REVIEW";

export type DeviceKind =
  | "SMARTPHONE"
  | "TABLET"
  | "DSLR"
  | "MIRRORLESS"
  | "COMPACT_CAMERA"
  | "BRIDGE_CAMERA"
  | "OTHER_CAMERA"
  | "DRONE"
  | "AI_GENERATED"
  | "UNKNOWN";

export type EligibilityReasonCode =
  | "PROFESSIONAL_PHONE_NOT_ALLOWED"
  | "PROFESSIONAL_DRONE_NOT_ALLOWED"
  | "AMATEUR_DEVICE_ALLOWED"
  | "AMATEUR_DRONE_NOT_ALLOWED"
  | "ARGRA_NUMBER_MISSING"
  | "ARGRA_NUMBER_INVALID"
  | "ARGRA_VERIFICATION_PENDING"
  | "ARGRA_NOT_REQUIRED"
  | "AERIAL_DRONE_REQUIRED"
  | "DEVICE_EXIF_MISMATCH"
  | "DEVICE_UNKNOWN"
  | "EXIF_MISSING"
  | "MANUAL_REVIEW_REQUIRED"
  | "TERRITORY_DECLARED_VALID"
  | "TERRITORY_LOCALITY_MISSING"
  | "TERRITORY_CONFIRMATION_MISSING"
  | "TERRITORY_GPS_SUPPORTED"
  | "TERRITORY_GPS_REVIEW"
  | "CAPTURE_WITHIN_WINDOW"
  | "CAPTURE_DATE_MISSING"
  | "CAPTURE_OUTSIDE_WINDOW"
  | "CAPTURE_DATE_INVALID"
  | "RESIDENCY_NOT_REQUIRED"
  | "OPEN_PARTICIPATION";

export type EligibilityResult = {
  decision: EligibilityDecision;
  reasonCode: EligibilityReasonCode;
  publicMessage: string;
  internalMessage: string;
  evidence: Record<string, unknown>;
};

export type ArgraVerificationStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "NOT_REQUIRED"
  | "EVIDENCE_REQUESTED";

export type TerritoryStatus =
  | "TERRITORY_CONFIRMED_BY_DECLARATION"
  | "TERRITORY_SUPPORTED_BY_GPS"
  | "TERRITORY_REVIEW_REQUIRED"
  | "TERRITORY_REJECTED";

export type RegistrationAnswers = {
  argraMembershipNumber?: string | null;
  argraVerificationStatus?: ArgraVerificationStatus;
  argraDeclaredOwn?: boolean;
  openParticipationAcknowledged?: boolean;
  /** Handle sin @; también se persiste en User.instagram. */
  instagramHandle?: string | null;
  /** Obligatorio: comunicaciones operativas del concurso. */
  operationalCommunicationsAccepted?: boolean;
};

export type EntryEligibilityAnswers = {
  captureLocality: string;
  captureDepartment?: string | null;
  territoryConfirmedSantaFe: boolean;
  declaredDeviceKind: DeviceKind;
  declaredDeviceMake?: string | null;
  declaredDeviceModel?: string | null;
  captureWithinPeriodDeclared: boolean;
  authorshipDeclared?: boolean;
  droneRegulationAcknowledged?: boolean;
  territoryStatus?: TerritoryStatus;
  captureWindowStatus?: EligibilityDecision;
  deviceEligibilityStatus?: EligibilityDecision;
  deviceReasonCode?: EligibilityReasonCode;
  /** Never expose on public APIs. */
  gpsPresent?: boolean;
};

/** Bounding box aproximado Provincia de Santa Fe (evidencia, no geofencing legal). */
export const SANTA_FE_APPROX_BOUNDS = {
  latMin: -34.75,
  latMax: -27.95,
  lngMin: -63.4,
  lngMax: -58.85,
} as const;

export const SANTA_FE_CATEGORY_SLUGS = {
  professional: "fotografo-profesional",
  amateur: "fotografo-amateur",
  reporter: "reportero-grafico",
  aerial: "fotografia-aerea",
} as const;
