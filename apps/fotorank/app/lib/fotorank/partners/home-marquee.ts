/**
 * Slider de marcas — portada FotoRank.
 * Server-only. Flag OFF ⇒ cero consultas a DNX Partners.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  isFotorankHomeMarqueeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  FOTORANK_HOME_MARQUEE_PLACEMENT,
  type FotorankMarqueePublicItem,
} from "./marquee-shared";

export {
  FOTORANK_HOME_MARQUEE_PLACEMENT,
  FOTORANK_HOME_MARQUEE_TITLE,
  type FotorankMarqueePublicItem,
} from "./marquee-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

/**
 * Resuelve hasta 12 creatives para FOTORANK_HOME_MARQUEE.
 * Sin contestContextId en la llamada: solo GLOBAL/PLATFORM explícito (participation null ≠ global).
 */
export async function loadFotorankHomeMarqueeAds(): Promise<ResolvedAdCreative[]> {
  if (!isFotorankHomeMarqueeEnabled()) return [];

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    return await loadPartnerAdsForPlacement(prisma, {
      application: "FOTO_RANK",
      placementKey: FOTORANK_HOME_MARQUEE_PLACEMENT,
      device,
      requireActivePartner: true,
    });
  } catch (err) {
    console.error("[fotorank.partners-home-marquee]", err);
    return [];
  }
}

export function toFotorankMarqueePublicItems(
  ads: readonly ResolvedAdCreative[],
): FotorankMarqueePublicItem[] {
  return ads
    .filter((ad) => Boolean(ad.imageUrl?.trim()) || Boolean(ad.partnerName?.trim()))
    .map((ad) => ({
      campaignId: ad.campaignId,
      creativeId: ad.creativeId,
      partnerName: ad.partnerName,
      logoUrl: ad.imageUrl ?? null,
      alt: ad.partnerName ?? null,
      href: ad.href ?? null,
    }));
}
