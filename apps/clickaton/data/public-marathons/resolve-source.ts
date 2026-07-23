/**
 * Resolución central del PublicMarathonDataSource (Etapa 08D).
 *
 * CLICKATON_PUBLIC_DATA_SOURCE=fixture|fotorank
 * FOTORANK_PUBLIC_API_BASE_URL=https://… (requerida si source=fotorank)
 *
 * Default: fixture (seguro para build/dev sin FotoRank).
 * Producción con fotorank: errores de fuente NO caen silenciosamente al fixture.
 */

import "server-only";

import { PublicMarathonPayloadError } from "@/data/public-marathons/errors";
import { createFotorankHttpPublicMarathonDataSource } from "@/data/public-marathons/fotorank-http-source";
import { localPublicMarathonDataSource } from "@/data/public-marathons/local-source";
import { createPrismaPublicMarathonDataSource } from "@/data/public-marathons/prisma-source";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";

export type ClickatonPublicDataSourceKind = "fixture" | "fotorank" | "prisma";

const DEMO_SLUG = "demo";

export function parseClickatonPublicDataSourceKind(
  raw: string | undefined,
): ClickatonPublicDataSourceKind {
  const value = (raw ?? "prisma").trim().toLowerCase();
  if (value === "fixture" || value === "local") {
    return "fixture";
  }
  if (value === "fotorank") {
    return "fotorank";
  }
  if (value === "" || value === "prisma") {
    return "prisma";
  }
  throw new PublicMarathonPayloadError(
    `Invalid CLICKATON_PUBLIC_DATA_SOURCE: ${raw ?? ""}`,
  );
}

/**
 * Combina remoto (FotoRank) + demo técnica local.
 * El demo no entra en listListed; sí es routable por slug.
 */
export function createHybridPublicMarathonDataSource(
  remote: PublicMarathonDataSource,
  local: PublicMarathonDataSource = localPublicMarathonDataSource,
): PublicMarathonDataSource {
  return {
    listListed() {
      return remote.listListed();
    },

    async getBySlug(slug: string) {
      const normalized = slug.trim();
      if (normalized === DEMO_SLUG) {
        return local.getBySlug(DEMO_SLUG);
      }
      return remote.getBySlug(normalized);
    },

    async listRoutableSlugs() {
      // generateStaticParams / build no deben depender de FotoRank remoto.
      // Listado de página (`listListed`) sigue fallando loud si FR está caído.
      let remoteSlugs: string[] = [];
      try {
        remoteSlugs = await Promise.resolve(remote.listRoutableSlugs());
      } catch {
        remoteSlugs = [];
      }
      const demo = await Promise.resolve(local.getBySlug(DEMO_SLUG));
      const slugs = [...remoteSlugs];
      if (demo && !slugs.includes(DEMO_SLUG)) {
        slugs.push(DEMO_SLUG);
      }
      return slugs;
    },

    getRegistrationOffer(marathonId) {
      return remote.getRegistrationOffer?.(marathonId) ?? null;
    },

    async getCapabilities(marathonId) {
      const fromRemote = await Promise.resolve(
        remote.getCapabilities?.(marathonId) ?? null,
      );
      if (fromRemote) return fromRemote;
      return local.getCapabilities?.(marathonId) ?? null;
    },

    getResults(marathonId) {
      return remote.getResults?.(marathonId) ?? null;
    },

    getGallery(marathonId) {
      return remote.getGallery?.(marathonId) ?? null;
    },
  };
}

export function resolvePublicMarathonDataSource(
  env: NodeJS.ProcessEnv = process.env,
): PublicMarathonDataSource {
  const kind = parseClickatonPublicDataSourceKind(
    env.CLICKATON_PUBLIC_DATA_SOURCE,
  );

  if (kind === "fixture") {
    return localPublicMarathonDataSource;
  }

  if (kind === "prisma") {
    return createHybridPublicMarathonDataSource(
      createPrismaPublicMarathonDataSource(),
      localPublicMarathonDataSource,
    );
  }

  const baseUrl = env.FOTORANK_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new PublicMarathonPayloadError(
      "FOTORANK_PUBLIC_API_BASE_URL is required when CLICKATON_PUBLIC_DATA_SOURCE=fotorank",
    );
  }

  const remote = createFotorankHttpPublicMarathonDataSource({ baseUrl });
  return createHybridPublicMarathonDataSource(remote);
}
