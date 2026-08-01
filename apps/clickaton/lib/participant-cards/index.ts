export type {
  ClickatonParticipantCardType,
  ParticipantCardActor,
  ParticipantCardActorKind,
  ParticipantCardConsentInput,
  ParticipantCardDisposition,
  ParticipantCardEligibility,
  ParticipantCardMode,
  ParticipantCardRegistrationSnapshot,
  ParticipantCardSourceSummary,
  ParticipantCardWarning,
  ParticipantCardWarningCode,
  GenerateClickatonParticipantCardInput,
  GenerateClickatonParticipantCardResult,
} from "./participant-card-types";

export {
  ClickatonCardError,
  cardConsentRequired,
  cardForbidden,
  cardNotEligible,
  cardNotFound,
  cardPhotoRequired,
  cardRateLimited,
  cardRegistrationInvalid,
  cardRenderFailed,
  cardRenderUnavailable,
  cardTemplateInvalid,
  cardUnauthorized,
} from "./participant-card-errors";
export type { ClickatonCardErrorCode } from "./participant-card-errors";

export { hasClickatonCardConsent } from "./participant-card-consent";
export { evaluateClickatonCardEligibility } from "./participant-card-eligibility";
export type { EvaluateClickatonCardEligibilityInput } from "./participant-card-eligibility";

export {
  requireParticipantCardReadAccess,
  requireParticipantCardAdminAccess,
} from "./participant-card-authorization";

export {
  buildClickatonParticipantTemplateData,
  buildParticipantCardFilename,
  sanitizeParticipantCardFilenamePart,
} from "./participant-card-data";
export type { BuildClickatonParticipantTemplateDataInput } from "./participant-card-data";

export {
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_MEMBER_STORY_V1,
  getClickatonParticipantCardPreset,
  instantiatePresetPayload,
  layout,
  normalizeParticipantCardType,
} from "./participant-card-presets";
export type { ClickatonCardPreset } from "./participant-card-presets";

export {
  renderClickatonParticipantCard,
  resolveClickatonParticipantCardDocument,
} from "./participant-card-renderer";
export type {
  RenderClickatonParticipantCardInput,
  RenderClickatonParticipantCardResult,
} from "./participant-card-renderer";

export {
  checkParticipantCardRateLimit,
  __resetParticipantCardRateLimitForTests,
} from "./participant-card-rate-limit";
export type { ParticipantCardRateLimitResult } from "./participant-card-rate-limit";

export {
  recordParticipantCardAttempt,
  recordParticipantCardError,
  recordParticipantCardSuccess,
  getParticipantCardMetricsSnapshot,
  __resetParticipantCardMetricsForTests,
} from "./participant-card-metrics";
export type {
  ParticipantCardMetricOutcome,
  ParticipantCardMetricSnapshot,
} from "./participant-card-metrics";

export { resolveParticipantPhotoDataUrl } from "./participant-card-photo";

export { generateClickatonParticipantCard } from "./participant-card-service";

export {
  getOrGenerateClickatonParticipantCard,
  forceRegenerateClickatonParticipantCard,
  getClickatonParticipantCardStatus,
  cleanupStaleClickatonParticipantCards,
  loadParticipantCardRegistration,
  InMemoryParticipantCardRepository,
  createPrismaParticipantCardRepository,
} from "./participant-card-persistence";
export type {
  GetOrGenerateClickatonParticipantCardInput,
  GetOrGenerateClickatonParticipantCardResult,
  ParticipantCardCacheStatus,
  ParticipantCardDbStatus,
  ParticipantCardPersistenceDeps,
  ParticipantCardRecord,
  ParticipantCardRepository,
  CleanupStaleCardsResult,
} from "./participant-card-persistence";

export { CLICKATON_CARD_RENDERER_VERSION } from "./participant-card-renderer-version";

export {
  computeClickatonParticipantCardRenderHash,
  normalizeTemplateDocumentForHash,
  renderHashPrefix,
  CLICKATON_CARD_FONT_CONFIG_VERSION,
} from "./participant-card-hash";
export type { ClickatonParticipantCardHashInput } from "./participant-card-hash";

export { buildParticipantCardStorageKey } from "./participant-card-r2-keys";

export {
  createParticipantCardAssetStore,
  persistParticipantCardMediaAsset,
  loadParticipantCardPngFromAsset,
  MemoryParticipantCardAssetStore,
  LocalParticipantCardAssetStore,
  KeyOnlyParticipantCardAssetStore,
  R2ParticipantCardAssetStore,
} from "./participant-card-asset-store";
export type {
  ParticipantCardAssetStore,
  ParticipantCardPutMetadata,
  StoredParticipantCardObject,
} from "./participant-card-asset-store";

export {
  resolveParticipantCardRenderProvider,
  LocalPlaywrightRenderProvider,
  UnavailableRenderProvider,
  RemoteRenderProvider,
  FixedPngRenderProvider,
} from "./participant-card-render-provider";
export type {
  ParticipantCardRenderProvider,
  ParticipantCardRenderResult,
} from "./participant-card-render-provider";

export { recordParticipantCardAudit } from "./participant-card-audit";
export type {
  ParticipantCardAuditEvent,
  ParticipantCardAuditFields,
} from "./participant-card-audit";

export {
  parseParticipantCardTypeParam,
  parseDisposition,
  parseMode,
  parseForceRegenerate,
  wantsJsonDiagnostic,
  pngResponse,
  notModifiedResponse,
  cardErrorResponse,
  runParticipantCardHttp,
  runParticipantCardStatusHttp,
  matchesIfNoneMatch,
} from "./participant-card-http";
