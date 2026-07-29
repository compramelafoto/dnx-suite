/**
 * Adaptador InfoSpot → EditorialDraftSnapshot.
 */

import type {
  EditorialCategoryOption,
  EditorialDraftSnapshot,
  EditorialRelatedHit,
} from "@repo/editorial-intelligence";

export type InfoSpotAssistantFormState = {
  title: string;
  excerpt: string;
  content: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  categoryId: string;
  categories: EditorialCategoryOption[];
  geographicScope: string | null;
  countryName: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  hasCover: boolean;
  hasAuthor: boolean;
  hasSource: boolean;
  publishedAt: string | null;
  editorialPriority?: number | null;
  selectedTags?: string[];
  linkedEventStartsAt?: string | null;
  linkedEventTitle?: string | null;
  hasPhotographerCall?: boolean;
  relatedHits?: EditorialRelatedHit[];
  duplicateHits?: EditorialRelatedHit[];
  linkHits?: EditorialRelatedHit[];
};

export function buildInfoSpotDraftSnapshot(
  state: InfoSpotAssistantFormState,
): EditorialDraftSnapshot {
  const cat = state.categories.find((c) => c.id === state.categoryId) ?? null;
  return {
    title: state.title,
    excerpt: state.excerpt,
    content: state.content,
    slug: state.slug,
    seoTitle: state.seoTitle,
    seoDescription: state.seoDescription,
    categoryId: state.categoryId || null,
    categorySlug: cat?.slug ?? null,
    categoryName: cat?.name ?? null,
    availableCategories: state.categories,
    geographicScope: state.geographicScope,
    countryName: state.countryName,
    countryCode: state.countryCode,
    province: state.province,
    city: state.city,
    placeName: state.placeName,
    latitude: state.latitude,
    longitude: state.longitude,
    hasCover: state.hasCover,
    hasAuthor: state.hasAuthor,
    hasSource: state.hasSource,
    publishedAt: state.publishedAt,
    editorialPriority: state.editorialPriority ?? null,
    selectedTags: state.selectedTags ?? [],
    linkedEventStartsAt: state.linkedEventStartsAt ?? null,
    linkedEventTitle: state.linkedEventTitle ?? null,
    hasPhotographerCall: state.hasPhotographerCall ?? false,
    relatedHits: state.relatedHits,
    duplicateHits: state.duplicateHits,
    linkHits: state.linkHits,
  };
}
