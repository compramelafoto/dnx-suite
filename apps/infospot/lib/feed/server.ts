/**
 * API de servidor del feed (Prisma + unstable_cache + revalidate).
 * No importar desde Client Components.
 */

export {
  getPublicFeed,
  getCachedPublicFeedGeneral,
  rankFeedCandidatesForTest,
} from "./query";
export {
  revalidatePublicFeedCache,
  PUBLIC_FEED_CACHE_TAGS,
  collectPublicFeedRevalidateTags,
} from "./invalidate";
export { toFeedItemDto } from "./normalize";
export { parseFeedSearchParams } from "./validate";
export {
  getNearbyUnifiedContent,
  getNearbyUpcomingActivities,
  getNearbyOpenPhotographerCalls,
  getAlsoNearThisPlace,
} from "./nearby-blocks";
export type {
  GetPublicFeedInput,
  GetPublicFeedResult,
  InfoSpotFeedItem,
  InfoSpotFeedItemDto,
} from "./types";
