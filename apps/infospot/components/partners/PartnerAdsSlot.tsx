import { PartnerAdCreative } from "@repo/design-system/components/partners";
import type { ResolvedAdCreative } from "@repo/partners";

export function PartnerAdsSlot({
  ads,
  variant = "banner",
  label = "Publicidad",
}: {
  ads: ResolvedAdCreative[];
  variant?: "banner" | "card" | "compact";
  label?: string;
}) {
  if (!ads.length) return null;
  return (
    <section aria-label={label} className="my-8 w-full">
      <div className="flex flex-col gap-6">
        {ads.map((ad) => (
          <PartnerAdCreative
            key={ad.creativeId}
            partnerName={ad.partnerName}
            imageUrl={ad.imageUrl}
            href={ad.href}
            title={ad.title}
            body={ad.body}
            ctaText={ad.ctaText}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
