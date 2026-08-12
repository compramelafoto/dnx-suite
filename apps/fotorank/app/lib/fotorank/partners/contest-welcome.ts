/**
 * Activación destacada FotoRank — CONTEST (landing pública).
 * Server-only. Flag OFF ⇒ cero consultas a DNX Partners.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  canMountPartnerWelcomeActivation,
  isFotorankPartnerWelcomeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  FOTORANK_CONTEST_WELCOME_PLACEMENT,
  type FotorankContestWelcomePublicPayload,
} from "./contest-welcome-shared";

export {
  FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_CONTEST_WELCOME_PLACEMENT,
  type FotorankContestWelcomePublicPayload,
} from "./contest-welcome-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export type LoadFotorankContestWelcomeInput = {
  /** ID canónico `FotorankContest.id` — nunca slug. */
  contestId: string;
  pathname: string;
  /** Landing ya resuelta como pública (PUBLISHED/ACTIVE + visibility PUBLIC). */
  publicLandingAllowed: boolean;
};

export async function loadFotorankContestWelcomeAd(
  input: LoadFotorankContestWelcomeInput,
): Promise<ResolvedAdCreative | null> {
  if (!isFotorankPartnerWelcomeEnabled()) return null;
  if (!input.publicLandingAllowed) return null;
  if (!input.contestId.trim()) return null;

  const mount = canMountPartnerWelcomeActivation({
    application: "FOTO_RANK",
    placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
    pathname: input.pathname,
  });
  if (!mount.ok) return null;

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    const ads = await loadPartnerAdsForPlacement(prisma, {
      application: "FOTO_RANK",
      placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
      device,
      contestContextId: input.contestId,
      requireActivePartner: true,
    });
    return ads[0] ?? null;
  } catch (err) {
    console.error("[fotorank.partners-welcome]", err);
    return null;
  }
}

export function toFotorankContestWelcomePublicPayload(
  ad: ResolvedAdCreative,
): FotorankContestWelcomePublicPayload {
  return {
    campaignId: ad.campaignId,
    partnerName: ad.partnerName,
    creativeId: ad.creativeId,
    imageUrl: ad.imageUrl,
    href: ad.href,
    title: ad.title,
    body: ad.body,
    ctaText: ad.ctaText,
  };
}
