import type { RecommendationItem } from "../types";

export type ClickatonVenueRecSource = {
  id: number | string;
  name: string;
  city?: string | null;
  province?: string | null;
  slug?: string | null;
};

export function clickatonVenueToRecommendationItem(
  venue: ClickatonVenueRecSource,
): RecommendationItem {
  return {
    id: `clickaton:venue:${venue.id}`,
    source: "CLICKATON",
    sourceEntityId: String(venue.id),
    contentType: "EVENT",
    title: venue.name,
    publicUrl: venue.slug ? `/sedes/${venue.slug}` : null,
    cityName: venue.city,
    provinceName: venue.province,
  };
}
