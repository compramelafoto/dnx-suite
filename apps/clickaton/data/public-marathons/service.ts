/**
 * Servicio público consumido por páginas y SSG.
 * No importar fixtures desde UI; usar estas funciones.
 */

import "server-only";

import { localPublicMarathonDataSource } from "@/data/public-marathons/local-source";
import { resolvePublicMarathonDataSource } from "@/data/public-marathons/resolve-source";
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

let activeSource: PublicMarathonDataSource | null = null;
let resolved = false;

function ensureSource(): PublicMarathonDataSource {
  if (!resolved || !activeSource) {
    try {
      activeSource = resolvePublicMarathonDataSource();
    } catch (error) {
      // Config inválida en bootstrap: caer a fixture solo si no se pidió fotorank.
      // Si fotorank está mal configurado, re-lanzar (fail loud).
      const kind = (process.env.CLICKATON_PUBLIC_DATA_SOURCE ?? "fixture")
        .trim()
        .toLowerCase();
      if (kind === "fotorank") {
        throw error;
      }
      activeSource = localPublicMarathonDataSource;
    }
    resolved = true;
  }
  return activeSource;
}

/** Solo para tests o sustitución futura controlada. */
export function setPublicMarathonDataSource(source: PublicMarathonDataSource): void {
  activeSource = source;
  resolved = true;
}

export function getPublicMarathonDataSource(): PublicMarathonDataSource {
  return ensureSource();
}

/** Reinicia la resolución (tests / self-checks). */
export function resetPublicMarathonDataSourceResolution(): void {
  activeSource = null;
  resolved = false;
}

export async function listPublicMarathons(): Promise<PublicMarathon[]> {
  return Promise.resolve(ensureSource().listListed());
}

export async function getPublicMarathonBySlug(
  slug: string,
): Promise<PublicMarathon | null> {
  return Promise.resolve(ensureSource().getBySlug(slug));
}

export async function listRoutableMarathonSlugs(): Promise<string[]> {
  return Promise.resolve(ensureSource().listRoutableSlugs());
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
  const source = ensureSource();
  if (!source.getRegistrationOffer) return null;
  return Promise.resolve(source.getRegistrationOffer(marathonId));
}

export async function getPublicMarathonCapabilities(
  marathonId: string,
): Promise<PublicMarathonCapabilities | null> {
  const source = ensureSource();
  if (!source.getCapabilities) return null;
  return Promise.resolve(source.getCapabilities(marathonId));
}

export async function getPublicMarathonResults(
  marathonId: string,
): Promise<PublicMarathonResults | null> {
  const source = ensureSource();
  if (!source.getResults) return null;
  const results = await Promise.resolve(source.getResults(marathonId));
  if (!results) return null;
  if (!canShowPublicResults(results.status)) return null;
  return results;
}

export async function getPublicMarathonGallery(
  marathonId: string,
): Promise<PublicMarathonGallery | null> {
  const source = ensureSource();
  if (!source.getGallery) return null;
  const gallery = await Promise.resolve(source.getGallery(marathonId));
  if (!gallery) return null;
  if (!canShowPublicGallery(gallery.status)) return null;
  return gallery;
}

export {
  getPublicMarathonVisibility,
  canShowPublicResults,
  canShowPublicGallery,
};
