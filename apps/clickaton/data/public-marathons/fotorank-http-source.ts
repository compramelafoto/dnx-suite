/**
 * `FotorankHttpPublicMarathonDataSource` — adaptador HTTP V1 (Etapa 08D).
 * Implementa `PublicMarathonDataSource` sin Prisma ni imports internos de FotoRank.
 *
 * Política de producto (08D): V1 solo expone `eventType: "contest"`.
 * Esos eventos se mapean internamente pero **no** se publican como maratones
 * oficiales de Clickatón (listado vacío; detalle remoto → null) hasta existir
 * discriminador de canal/marca o tipo de evento compatible.
 */

import "server-only";

import {
  PublicMarathonNotFoundError,
  PublicMarathonPayloadError,
  PublicMarathonSourceUnavailableError,
} from "@/data/public-marathons/errors";
import {
  createFotorankPublicClient,
  type FotorankPublicClient,
} from "@/data/public-marathons/fotorank-public-client";
import {
  mapFotorankCapabilitiesToClickaton,
  mapFotorankEventListItemToPublicMarathon,
  mapFotorankEventToPublicMarathon,
} from "@/data/public-marathons/map-fotorank-event";
import { normalizePublicMarathon } from "@/data/public-marathons/normalize";
import { sanitizePublicMarathon } from "@/data/public-marathons/sanitize";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";
import type { PublicMarathonCapabilities } from "@/types/public";

export type FotorankHttpPublicMarathonDataSourceOptions = {
  baseUrl: string;
  revalidateSeconds?: number;
  timeoutMs?: number;
  client?: FotorankPublicClient;
};

function prepareMapped(
  marathon: ReturnType<typeof mapFotorankEventToPublicMarathon>,
) {
  return sanitizePublicMarathon(normalizePublicMarathon(marathon));
}

/** V1 solo emite contest; no son maratones Clickatón publicables. */
function isPublishableAsClickatonMarathon(eventType: string): boolean {
  return eventType !== "contest";
}

export function createFotorankHttpPublicMarathonDataSource(
  options: FotorankHttpPublicMarathonDataSourceOptions,
): PublicMarathonDataSource {
  const client =
    options.client ??
    createFotorankPublicClient({
      baseUrl: options.baseUrl,
      revalidateSeconds: options.revalidateSeconds,
      timeoutMs: options.timeoutMs,
    });

  const capabilitiesById = new Map<string, PublicMarathonCapabilities>();

  function rememberCapabilities(
    marathonId: string,
    capabilities: ReturnType<typeof mapFotorankCapabilitiesToClickaton>,
  ) {
    capabilitiesById.set(marathonId, capabilities);
  }

  return {
    async listListed() {
      try {
        const items = await client.listEvents();
        return items
          .filter((item) => isPublishableAsClickatonMarathon(item.eventType))
          .map((item) => {
            const mapped = prepareMapped(
              mapFotorankEventListItemToPublicMarathon(item),
            );
            rememberCapabilities(
              mapped.id,
              mapFotorankCapabilitiesToClickaton(mapped.id, item.capabilities),
            );
            return mapped;
          });
      } catch (error) {
        if (
          error instanceof PublicMarathonSourceUnavailableError ||
          error instanceof PublicMarathonPayloadError
        ) {
          throw error;
        }
        throw new PublicMarathonSourceUnavailableError(
          error instanceof Error ? error.message : "listListed failed",
        );
      }
    },

    async getBySlug(slug: string) {
      const normalizedSlug = slug.trim();
      if (!normalizedSlug) return null;

      try {
        const event = await client.getEventBySlug(normalizedSlug);
        if (!isPublishableAsClickatonMarathon(event.eventType)) {
          return null;
        }
        const mapped = prepareMapped(mapFotorankEventToPublicMarathon(event));
        rememberCapabilities(
          mapped.id,
          mapFotorankCapabilitiesToClickaton(mapped.id, event.capabilities),
        );
        return mapped;
      } catch (error) {
        if (
          error instanceof PublicMarathonNotFoundError ||
          error instanceof PublicMarathonPayloadError
        ) {
          return null;
        }
        if (error instanceof PublicMarathonSourceUnavailableError) {
          throw error;
        }
        throw new PublicMarathonSourceUnavailableError(
          error instanceof Error ? error.message : "getBySlug failed",
        );
      }
    },

    async listRoutableSlugs() {
      // Solo slugs publicables. Contests V1 no entran.
      // UNLISTED routable de futuros tipos: limitación sin endpoint dedicado.
      const listed = await this.listListed();
      return listed.map((item) => item.slug);
    },

    getRegistrationOffer() {
      return null;
    },

    getCapabilities(marathonId: string) {
      return capabilitiesById.get(marathonId) ?? null;
    },

    getResults() {
      return null;
    },

    getGallery() {
      return null;
    },
  };
}

export const createFotorankPublicMarathonDataSource =
  createFotorankHttpPublicMarathonDataSource;

/** @deprecated Preferir createFotorankHttpPublicMarathonDataSource */
export type FotorankPublicMarathonDataSourceOptions =
  FotorankHttpPublicMarathonDataSourceOptions;
