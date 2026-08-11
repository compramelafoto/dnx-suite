"use client";

import { PartnerAdCreative, PartnerViewableImpression } from "@repo/design-system/components/partners";
import type { ResolvedAdCreative } from "@repo/partners";

export function PartnerAdsSlot({
  ads,
  variant = "banner",
  label = "Publicidad",
  placementKey,
}: {
  ads: ResolvedAdCreative[];
  variant?: "banner" | "card" | "compact";
  label?: string;
  /** Required for impression tracking when ads are campaign creatives. */
  placementKey?: string;
}) {
  if (!ads.length) return null;
  return (
    <section aria-label={label} className="my-8 w-full">
      <div className="flex flex-col gap-6">
        {ads.map((ad) => {
          const creative = (
            <PartnerAdCreative
              partnerName={ad.partnerName}
              imageUrl={ad.imageUrl}
              href={ad.href}
              title={ad.title}
              body={ad.body}
              ctaText={ad.ctaText}
              variant={variant}
            />
          );
          if (!placementKey || !ad.href) return <div key={ad.creativeId}>{creative}</div>;
          return (
            <PartnerViewableImpression
              key={ad.creativeId}
              campaignId={ad.campaignId}
              creativeId={ad.creativeId}
              placementKey={placementKey}
              href={ad.href}
            >
              {creative}
            </PartnerViewableImpression>
          );
        })}
      </div>
    </section>
  );
}
