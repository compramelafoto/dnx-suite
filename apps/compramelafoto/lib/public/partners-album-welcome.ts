/**
 * Activación destacada ComprameLaFoto — ALBUM (landing pública `/album/[slug]`).
 * Server-only. Requiere CLF_PARTNER_ADS_ENABLED + CLF_PARTNER_ALBUM_WELCOME_ENABLED.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  canMountPartnerWelcomeActivation,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  CLF_ALBUM_WELCOME_PLACEMENT,
  type ClfAlbumWelcomePublicPayload,
} from "./partners-album-welcome-shared";

export {
  CLF_ALBUM_WELCOME_APPEAR_DELAY_MS,
  CLF_ALBUM_WELCOME_PLACEMENT,
  type ClfAlbumWelcomePublicPayload,
} from "./partners-album-welcome-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export type LoadClfAlbumWelcomeInput = {
  /** ID canónico `Album.id` como string — nunca slug. */
  albumId: string;
  pathname: string;
  /** Álbum público listado (`isPublic && !isHidden`), no test, no bloqueado. */
  publicAlbumAllowed: boolean;
};

/**
 * Ambos flags OFF ⇒ cero consultas. Máximo una creative.
 */
export async function loadClfAlbumWelcomeAd(
  input: LoadClfAlbumWelcomeInput,
): Promise<ResolvedAdCreative | null> {
  if (!isClfPartnerAdsEnabled()) return null;
  if (!isClfPartnerAlbumWelcomeEnabled()) return null;
  if (!input.publicAlbumAllowed) return null;
  if (!input.albumId.trim()) return null;

  const mount = canMountPartnerWelcomeActivation({
    application: "COMPRAME_LA_FOTO",
    placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
    pathname: input.pathname,
  });
  if (!mount.ok) return null;

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    const ads = await loadPartnerAdsForPlacement(prisma, {
      application: "COMPRAME_LA_FOTO",
      placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
      device,
      albumContextId: input.albumId,
      requireActivePartner: true,
    });
    return ads[0] ?? null;
  } catch (err) {
    console.error("[clf.partners-album-welcome]", err);
    return null;
  }
}

export function toClfAlbumWelcomePublicPayload(
  ad: ResolvedAdCreative,
): ClfAlbumWelcomePublicPayload {
  return {
    campaignId: ad.campaignId,
    partnerName: ad.partnerName,
    creativeId: ad.creativeId,
    imageUrl: ad.imageUrl,
    href: ad.href,
    title: ad.title,
    body: ad.body,
    ctaText: ad.ctaText,
    welcomeMedia: ad.welcomeMedia ?? null,
  };
}
