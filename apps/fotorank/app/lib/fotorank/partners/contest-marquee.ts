/**
 * Slider de marcas — concurso público FotoRank (`/concursos/[slug]`).
 * Server-only. Flag OFF ⇒ cero consultas.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  isFotorankContestMarqueeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  FOTORANK_CONTEST_MARQUEE_PLACEMENT,
  type FotorankMarqueePublicItem,
} from "./marquee-shared";
import { toFotorankMarqueePublicItems } from "./home-marquee";

export {
  FOTORANK_CONTEST_MARQUEE_PLACEMENT,
  FOTORANK_CONTEST_MARQUEE_TITLE,
  type FotorankMarqueePublicItem,
} from "./marquee-shared";

export { toFotorankMarqueePublicItems };

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export type LoadFotorankContestMarqueeInput = {
  /** ID canónico `FotorankContest.id` — nunca slug. */
  contestId: string;
  pathname: string;
  /** Landing ya resuelta como pública (PUBLISHED/ACTIVE + visibility PUBLIC). */
  publicLandingAllowed: boolean;
};

/**
 * Resuelve hasta 12 creatives para FOTORANK_CONTEST_MARQUEE.
 * Acepta CONTEST del mismo id + GLOBAL/PLATFORM explícitos; rechaza null/huérfanas/ajenos.
 */
export async function loadFotorankContestMarqueeAds(
  input: LoadFotorankContestMarqueeInput,
): Promise<ResolvedAdCreative[]> {
  if (!isFotorankContestMarqueeEnabled()) return [];
  if (!input.publicLandingAllowed) return [];
  if (!input.contestId.trim()) return [];
  if (!input.pathname.startsWith("/concursos/")) return [];
  // No montar en subrutas (inscripción, carga, jurado, etc.).
  const rest = input.pathname.slice("/concursos/".length);
  if (rest.includes("/")) return [];

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    return await loadPartnerAdsForPlacement(prisma, {
      application: "FOTO_RANK",
      placementKey: FOTORANK_CONTEST_MARQUEE_PLACEMENT,
      device,
      contestContextId: input.contestId,
      requireActivePartner: true,
    });
  } catch (err) {
    console.error("[fotorank.partners-contest-marquee]", err);
    return [];
  }
}
