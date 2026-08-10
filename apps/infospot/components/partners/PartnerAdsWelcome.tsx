"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import type { ResolvedAdCreative } from "@repo/partners";

export function PartnerAdsWelcome({ ad }: { ad: ResolvedAdCreative | null }) {
  if (!ad) return null;
  return (
    <PartnerWelcomeInterstitial
      campaignId={ad.campaignId}
      partnerName={ad.partnerName}
      imageUrl={ad.imageUrl}
      href={ad.href}
      title={ad.title}
      body={ad.body}
      ctaText={ad.ctaText}
      frequencyHours={24}
    />
  );
}
