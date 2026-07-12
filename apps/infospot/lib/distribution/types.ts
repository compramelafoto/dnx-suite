/**
 * Presentación unificada de eventos para home / listados.
 */

import type { EventTemporalState } from "./temporal";
import type { LocationVisibility } from "../geolocation/types";

export type DistributionEventCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  startAt: Date;
  endAt: Date | null;
  city: string;
  province: string;
  coverImageUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  temporalState: EventTemporalState;
  temporalLabel: string;
  seekingPhotographers: boolean;
  registrationUrl: string | null;
  clfJoinUrl: string | null;
  distanceKm: number | null;
  distanceLabel: string | null;
  locationLabel: string;
  locationVisibility: LocationVisibility;
  score: number | null;
  slotsLabel: string | null;
};

export type DistributionBannerItem = {
  id: string;
  placementId: string | null;
  kind: "event" | "article";
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
  source: "placement" | "fallback";
};

export type DistributionCoverageCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  coverImageUrl: string | null;
  coverCredit: string | null;
  authorName: string | null;
  photographerName: string | null;
  photosAvailable: boolean;
  relatedEventTitle: string | null;
  relatedEventCity: string | null;
  relatedEventSlug: string | null;
};
