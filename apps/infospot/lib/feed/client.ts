/**
 * API segura para Client Components (sin next/cache ni Prisma).
 */

export { FEED_CONFIG } from "./config";
export {
  calculateDistanceKm,
  formatDistanceLabel,
  formatLocationLabel,
} from "./distance";
export {
  calculateInfoSpotFeedScore,
  compareFeedItems,
  geographicAffinityScore,
} from "./score";
export { diversifyFeedTypes, countConsecutiveTypes } from "./diversity";
export {
  classifyArticleFeedType,
  classifyEventFeedType,
} from "./classify";
export {
  encodeFeedCursor,
  decodeFeedCursor,
  isAfterFeedCursor,
} from "./cursor";
export { parseFeedSearchParams, feedQuerySchema } from "./validate";
export { trackFeedAnalytics } from "./analytics";
export { infoSpotFeedItemToGeoFeedItem } from "./geo-bridge";
export type { FutureMultiAppFeedIngest } from "./geo-bridge";
export {
  LOCATION_PREFERENCE_KEY,
  LOCATION_PROMPT_KEY,
  MANUAL_CITY_OPTIONS,
  COORD_STORAGE_DECIMALS,
  roundCoordinate,
  readLocationPreference,
  writeLocationPreference,
  clearLocationPreference,
  readPromptState,
  writePromptState,
  preferenceControlLabel,
  sanitizePreferenceForStorage,
} from "./location-preference";
export type {
  StoredLocationPreference,
  StoredPromptState,
} from "./location-preference";
export type {
  InfoSpotFeedItem,
  InfoSpotFeedItemDto,
  InfoSpotFeedItemType,
  FeedLocationMode,
  LocationPermissionState,
  GetPublicFeedInput,
  GetPublicFeedResult,
  FeedScoreInput,
  FeedScoreBreakdown,
  FeedScoreExplain,
  FeedGenerationMetrics,
  FeedOrigin,
} from "./types";
export {
  INFO_SPOT_FEED_ITEM_TYPES,
  FEED_TYPE_LABELS,
  LOCATION_PERMISSION_STATES,
} from "./types";
