/**
 * @repo/notifications — DNX Notifications Engine
 *
 * Dominio puro (sin Prisma / Next / React).
 * Persistencia, workers y adaptadores reales viven en las apps.
 */

export {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  IMPLEMENTED_CHANNELS,
  isNotificationEventType,
  type NotificationEventType,
  type NotificationChannel,
  type RecipientKind,
  type ConsentState,
  type EligibilityState,
  type DeliveryStatus,
  type DedupState,
  type NotificationEvent,
  type NotificationRecipient,
  type NotificationCandidate,
  type NotificationDeliveryPlan,
  type PhotographerAudienceInput,
  type CallAudienceContext,
  type AudienceBucketCounts,
  type AudiencePreview,
} from "./contracts";

export {
  AUDIENCE_RADIUS_PRESETS_KM,
  DEFAULT_AUDIENCE_RADIUS_KM,
  CUSTOM_RADIUS_LIMITS_KM,
  ANTI_SPAM_DEFAULTS,
  RETRY_DEFAULTS,
  TEMPLATE_LIMITS,
  type AudienceRadiusPresetKm,
  type AudienceScopeMode,
} from "./config";

export {
  buildEventIdempotencyKey,
  createNotificationEvent,
  shouldEmitPhotographerCallOpened,
  FUTURE_EVENT_HOOKS,
} from "./events";

export {
  parseAudienceScope,
  scopeLabel,
  isPresetRadiusKm,
  selectPhotographerAudience,
  audiencePreviewSummary,
} from "./audience";

export {
  buildDeliveryDedupeKey,
  buildCampaignDedupeKey,
  isRetrySameDelivery,
} from "./deduplication";

export {
  defaultPreferenceForLegacyUser,
  resolveAvailableChannels,
  resolveConsentState,
  mergeNearbyCallsPreference,
  type NotificationPreferenceSnapshot,
} from "./preferences";

export {
  evaluateCampaignPolicy,
  applyRecipientAntiSpam,
  confirmationSummary,
  withAntiSpamOnPreview,
  type CampaignPolicyContext,
  type PolicyDecision,
  type AntiSpamLimits,
} from "./policies";

export {
  renderNearbyPhotographerCallTemplate,
  appendAttributionParams,
  renderNearbyCallEmail,
  type TemplateVariables,
  type RenderedNotification,
  type RenderedEmail,
} from "./templates";

export {
  NOTIFICATION_WORKER_DEFAULTS,
  resolveWorkerConfig,
  type NotificationWorkerConfig,
} from "./worker-config";

export {
  classifyDeliveryError,
  nextBackoffMs,
  resolveNextDeliveryStatus,
  emptyDeliveryMetrics,
  type RetryableErrorKind,
  type DeliveryMetrics,
} from "./delivery";

export { planSchedule, isDue, type SchedulePlan } from "./scheduling";

export {
  explainAudienceSelection,
  explainCandidate,
  type SelectionExplanation,
} from "./explain";

export {
  NotificationEngine,
  notificationEngine,
  type BuildAudienceInput,
  type CampaignDraft,
} from "./engine";

export {
  toInAppRequest,
  UnwiredEmailAdapter,
  toEmailRequest,
  type InAppDeliveryRequest,
  type InAppDeliveryResult,
  type InAppNotificationAdapter,
  type EmailDeliveryRequest,
  type EmailDeliveryResult,
  type EmailNotificationAdapter,
} from "./adapters";
