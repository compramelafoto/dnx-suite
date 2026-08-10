/**
 * ETAPA 17B — Capacidades Instagram derivadas de auditoría Meta 2026-08-10.
 * Valores honestos: no asumir precisión al segundo ni webhooks de likes.
 */
export type InstagramProviderCapabilities = {
  canPublishSingleImage: boolean;
  canPublishCarousel: boolean;
  canPublishStory: boolean;
  canPublishReel: boolean;
  canReadLikeCount: boolean;
  canReceiveLikeWebhook: boolean;
  canReadMetricTimestamp: boolean;
  canProvideFinalSnapshot: boolean;
  supportsExactCutoff: boolean;
  canUseCarouselAsCompetitiveUnit: boolean;
  metricField: "like_count";
  cutoffPolicy: "LAST_VALID_OBSERVATION_BEFORE_CUTOFF";
  requiresPolling: boolean;
};

export const INSTAGRAM_PROVIDER_CAPABILITIES: InstagramProviderCapabilities = {
  canPublishSingleImage: true,
  canPublishCarousel: true,
  canPublishStory: true,
  canPublishReel: true,
  canReadLikeCount: true,
  canReceiveLikeWebhook: false,
  canReadMetricTimestamp: false,
  canProvideFinalSnapshot: false,
  supportsExactCutoff: false,
  canUseCarouselAsCompetitiveUnit: false,
  metricField: "like_count",
  cutoffPolicy: "LAST_VALID_OBSERVATION_BEFORE_CUTOFF",
  requiresPolling: true,
};
