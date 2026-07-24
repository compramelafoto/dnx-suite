/**
 * @repo/geo — DNX GEO ENGINE
 *
 * Core puro (sin Next/Prisma). React opcional vía `@repo/geo/react`.
 */

export type {
  Coordinates,
  BoundingBox,
  LocationPrecision,
  GeographicScope,
  NormalizedPlace,
  GeocodingSearchContext,
  DnxLocation,
  GeocodingProvider,
} from "./types";
export { LOCATION_PRECISIONS, GEOGRAPHIC_SCOPES } from "./types";

export {
  validateCoordinates,
  hasUsableCoordinates,
  hasUsableEventCoordinates,
  parseLatLon,
  type CoordinateValidation,
} from "./coordinates";

export {
  distanceKm,
  distanceMeters,
  distanceBetweenCoordinates,
  calculateDistanceKm,
  haversineDistanceMeters,
  isWithinRadius,
  buildBoundingBox,
  boundingBoxForRadiusKm,
  formatDistanceLabel,
  formatLocationLabel,
  centroid,
} from "./distance";

export {
  encodeGeohash,
  geohashPrefixForRadiusKm,
  geohashSharesPrefix,
  DEFAULT_GEOHASH_PRECISION,
} from "./geohash";

export {
  normalizePlaceToken,
  normalizeCountryCode,
  formatProvinceName,
  formatCityName,
  placesMatch,
} from "./normalize";

export {
  isGeographicScope,
  geographicScopeLabel,
  validateLocationForPublish,
  withGeohash,
} from "./location";

export {
  NominatimGeocodingProvider,
  createNominatimProvider,
  normalizeNominatimHit,
  type NominatimClientOptions,
} from "./nominatim/index";

export {
  GeoRankingEngine,
  scoreGeoItem,
  rankGeoItems,
  DEFAULT_GEO_RANKING_WEIGHTS,
  type GeoRankable,
  type GeoRankingWeights,
  type GeoRankedItem,
} from "./ranking/geo-ranking-engine";

export {
  planNearbyQuery,
  filterNearbyInMemory,
  boundingBoxWhere,
  geohashPrefixWhere,
  type NearbyCandidate,
  type NearbyQueryPlan,
  type NearbyMatch,
} from "./nearby/query";

export type {
  GeoFeedItem,
  GeoFeedSource,
  GeoFeedAdapter,
} from "./feed-item";
export { GEO_FEED_SOURCES } from "./feed-item";
