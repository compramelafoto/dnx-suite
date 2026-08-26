import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  CLF_AD_PLACEMENT_KEYS,
  type ClfAdPlacementKey,
  type DnxPartnerCreativeDeviceTarget,
} from "@repo/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

/**
 * Ads públicos CLF (kill-switch + elegibilidad). No PII.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const placement = url.searchParams.get("placement") as ClfAdPlacementKey | null;
  if (!placement || !(CLF_AD_PLACEMENT_KEYS as readonly string[]).includes(placement)) {
    return NextResponse.json({ error: "invalid_placement" }, { status: 400 });
  }

  const device = detectDevice(request.headers.get("user-agent"));
  const ads = await loadPartnerAdsForPlacement(prisma, {
    application: "COMPRAME_LA_FOTO",
    placementKey: placement,
    device,
  });

  return NextResponse.json({
    ads: ads.map((a) => ({
      creativeId: a.creativeId,
      campaignId: a.campaignId,
      partnerName: a.partnerName,
      imageUrl: a.imageUrl,
      href: a.href,
      title: a.title,
      body: a.body,
      ctaText: a.ctaText,
      format: a.format,
    })),
  });
}
