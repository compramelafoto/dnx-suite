import type { RecommendationItem } from "../types";

export type FotofficeStudioRecSource = {
  id: number | string;
  name: string;
  city?: string | null;
  slug?: string | null;
};

/** Stub — FotoOffice. */
export function fotofficeStudioToRecommendationItem(
  studio: FotofficeStudioRecSource,
): RecommendationItem {
  return {
    id: `fotoffice:studio:${studio.id}`,
    source: "FOTOFFICE",
    sourceEntityId: String(studio.id),
    contentType: "COURSE",
    title: studio.name,
    publicUrl: studio.slug ? `/estudios/${studio.slug}` : null,
    cityName: studio.city,
  };
}
