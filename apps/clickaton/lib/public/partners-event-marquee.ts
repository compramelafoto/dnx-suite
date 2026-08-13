/**
 * Slider de marcas — landing de evento/maratón Clickatón.
 * Server-only. Flag OFF ⇒ cero consultas.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  isClickatonEventMarqueeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  CLICKATON_EVENT_MARQUEE_PLACEMENT,
  type ClickatonMarqueePublicItem,
} from "@/lib/public/partners-marquee-shared";

export {
  CLICKATON_EVENT_MARQUEE_PLACEMENT,
  CLICKATON_EVENT_MARQUEE_TITLE,
  type ClickatonMarqueePublicItem,
} from "@/lib/public/partners-marquee-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export type LoadClickatonEventMarqueeInput = {
  editionId: string;
  /** Pathname canónico, p. ej. `/maratones/rosario-2026` */
  pathname: string;
  publicLandingAllowed: boolean;
};

/**
 * Resuelve hasta 12 creatives para CLICKATON_EVENT_MARQUEE.
 * Requiere editionId; rechaza huérfanas / otra edición vía loader.
 */
export async function loadClickatonEventMarqueeAds(
  input: LoadClickatonEventMarqueeInput,
): Promise<ResolvedAdCreative[]> {
  if (!isClickatonEventMarqueeEnabled()) return [];
  if (!input.publicLandingAllowed) return [];
  if (!input.editionId.trim()) return [];
  if (!input.pathname.startsWith("/maratones/")) return [];

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    return await loadPartnerAdsForPlacement(prisma, {
      application: "CLICKATON",
      placementKey: CLICKATON_EVENT_MARQUEE_PLACEMENT,
      device,
      editionContextId: input.editionId,
      requireActivePartner: true,
    });
  } catch (err) {
    console.error("[clickaton.partners-event-marquee]", err);
    return [];
  }
}

export function toClickatonEventMarqueePublicItems(
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
