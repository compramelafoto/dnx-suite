import { marathonCatalog } from "@/content/fixtures/demo-marathon";
import { PublicMarathonPayloadError } from "@/data/public-marathons/errors";
import { normalizePublicMarathon } from "@/data/public-marathons/normalize";
import { clonePublicMarathon, sanitizePublicMarathon } from "@/data/public-marathons/sanitize";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";
import { getPublicMarathonVisibility } from "@/data/public-marathons/visibility";
import type { PublicMarathon } from "@/types/marathon";

function prepare(raw: PublicMarathon): PublicMarathon {
  return sanitizePublicMarathon(normalizePublicMarathon(clonePublicMarathon(raw)));
}

function loadCatalog(): PublicMarathon[] {
  try {
    return marathonCatalog.map((item) => prepare(item));
  } catch (error) {
    if (error instanceof PublicMarathonPayloadError) throw error;
    throw new PublicMarathonPayloadError(
      error instanceof Error ? error.message : "local catalog failed",
    );
  }
}

/**
 * Fuente local basada en fixtures.
 * Sustituible por un adaptador FotoRank con la misma interfaz.
 */
export const localPublicMarathonDataSource: PublicMarathonDataSource = {
  listListed() {
    return loadCatalog().filter((m) => getPublicMarathonVisibility(m).listed);
  },

  getBySlug(slug: string) {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) return null;

    const match = loadCatalog().find((m) => m.slug === normalizedSlug);
    if (!match) return null;

    if (!getPublicMarathonVisibility(match).routable) return null;
    return match;
  },

  listRoutableSlugs() {
    return loadCatalog()
      .filter((m) => getPublicMarathonVisibility(m).routable)
      .map((m) => m.slug);
  },

  getRegistrationOffer() {
    // Sin oferta en fixtures; el contrato existe para el futuro adaptador.
    return null;
  },

  getCapabilities() {
    return null;
  },

  getResults() {
    return null;
  },

  getGallery() {
    return null;
  },
};
