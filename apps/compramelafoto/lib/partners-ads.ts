import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import type {
  CampaignGeoAudience,
  DnxPartnerAdPlacementKey,
  DnxPartnerCampaignContextCategory,
  DnxPartnerCreativeDeviceTarget,
  ResolvedAdCreative,
} from "@repo/partners";

export { inferClfContextCategories } from "./partners-ads-context";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export async function loadClfAds(
  placementKey: DnxPartnerAdPlacementKey,
  opts?: {
    audience?: CampaignGeoAudience | null;
    categories?: readonly DnxPartnerCampaignContextCategory[] | null;
  },
): Promise<ResolvedAdCreative[]> {
  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    return await loadPartnerAdsForPlacement(prisma, {
      application: "COMPRAME_LA_FOTO",
      placementKey,
      device,
      audience: opts?.audience,
      audienceCategories: opts?.categories,
    });
  } catch (err) {
    console.error("[clf.partners-ads]", err);
    return [];
  }
}
