/**
 * Slider de marcas — portada Clickatón.
 * Server-only. Flag OFF ⇒ cero consultas a DNX Partners.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  isClickatonHomeMarqueeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  CLICKATON_HOME_MARQUEE_PLACEMENT,
  type ClickatonMarqueePublicItem,
} from "@/lib/public/partners-marquee-shared";

export {
  CLICKATON_HOME_MARQUEE_PLACEMENT,
  CLICKATON_HOME_MARQUEE_TITLE,
  type ClickatonMarqueePublicItem,
} from "@/lib/public/partners-marquee-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

/**
 * Resuelve hasta 12 creatives públicas para CLICKATON_HOME_MARQUEE.
 * Sin editionContextId: solo GLOBAL/PLATFORM explícito.
 */
export async function loadClickatonHomeMarqueeAds(): Promise<ResolvedAdCreative[]> {
  if (!isClickatonHomeMarqueeEnabled()) return [];

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    return await loadPartnerAdsForPlacement(prisma, {
      application: "CLICKATON",
      placementKey: CLICKATON_HOME_MARQUEE_PLACEMENT,
      device,
      requireActivePartner: true,
    });
  } catch (err) {
    console.error("[clickaton.partners-home-marquee]", err);
    return [];
  }
}

export function toClickatonMarqueePublicItems(
  ads: readonly ResolvedAdCreative[],
): ClickatonMarqueePublicItem[] {
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
