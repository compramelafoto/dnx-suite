export type AuthorizationBasis =
  | "OWNED_BY_DNX"
  | "PHOTOGRAPHER_PERMISSION"
  | "ORGANIZER_PERMISSION"
  | "LICENSED_ASSET"
  | "UNKNOWN";

export type VisualReferenceRights = {
  usageAuthorized: boolean;
  authorizedForInternalReview: boolean;
  /** En esta etapa debe permanecer false en todos los fixtures. */
  authorizedForPublicAssistant: boolean;
  authorizationBasis: AuthorizationBasis;
  authorName?: string;
  authorUrl?: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  attributionRequired: boolean;
  attributionText?: string;
  expiresAt?: string;
  notes?: string;
};
