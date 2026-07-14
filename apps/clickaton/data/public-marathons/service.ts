/**
 * Servicio público consumido por páginas y SSG.
 * No importar fixtures desde UI; usar estas funciones.
 */

import { localPublicMarathonDataSource } from "@/data/public-marathons/local-source";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";
import {
  canShowPublicGallery,
  canShowPublicResults,
  getPublicMarathonVisibility,
  type PublicMarathonVisibility,
} from "@/data/public-marathons/visibility";
import type { PublicMarathon } from "@/types/marathon";
import type {
  PublicMarathonCapabilities,
  PublicMarathonGallery,
  PublicMarathonResults,
  PublicRegistrationOffer,
} from "@/types/public";

let activeSource: PublicMarathonDataSource = localPublicMarathonDataSource;

/** Solo para tests o sustitución futura controlada. */
export function setPublicMarathonDataSource(source: PublicMarathonDataSource): void {
  activeSource = source;
}

export function getPublicMarathonDataSource(): PublicMarathonDataSource {
  return activeSource;
}

export async function listPublicMarathons(): Promise<PublicMarathon[]> {
  return Promise.resolve(activeSource.listListed());
}

export async function getPublicMarathonBySlug(
  slug: string,
): Promise<PublicMarathon | null> {
  return Promise.resolve(activeSource.getBySlug(slug));
}

export async function listRoutableMarathonSlugs(): Promise<string[]> {
  return Promise.resolve(activeSource.listRoutableSlugs());
}

export async function getPublicMarathonVisibilityBySlug(
  slug: string,
): Promise<PublicMarathonVisibility | null> {
  const marathon = await getPublicMarathonBySlug(slug);
  if (!marathon) return null;
  return getPublicMarathonVisibility(marathon);
}

export async function getPublicRegistrationOffer(
  marathonId: string,
): Promise<PublicRegistrationOffer | null> {
  if (!activeSource.getRegistrationOffer) return null;
  return Promise.resolve(activeSource.getRegistrationOffer(marathonId));
}

export async function getPublicMarathonCapabilities(
  marathonId: string,
): Promise<PublicMarathonCapabilities | null> {
  if (!activeSource.getCapabilities) return null;
  return Promise.resolve(activeSource.getCapabilities(marathonId));
}

export async function getPublicMarathonResults(
  marathonId: string,
): Promise<PublicMarathonResults | null> {
  if (!activeSource.getResults) return null;
  const results = await Promise.resolve(activeSource.getResults(marathonId));
  if (!results) return null;
  if (!canShowPublicResults(results.status)) return null;
  return results;
}

export async function getPublicMarathonGallery(
  marathonId: string,
): Promise<PublicMarathonGallery | null> {
  if (!activeSource.getGallery) return null;
  const gallery = await Promise.resolve(activeSource.getGallery(marathonId));
  if (!gallery) return null;
  if (!canShowPublicGallery(gallery.status)) return null;
  return gallery;
}

export {
  getPublicMarathonVisibility,
  canShowPublicResults,
  canShowPublicGallery,
};
