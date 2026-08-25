"use client";

import { PartnerLogoMarquee } from "@repo/design-system/components/partners";
import type { FotorankMarqueePublicItem } from "../../lib/fotorank/partners/home-marquee-shared";
import { FOTORANK_HOME_MARQUEE_PLACEMENT } from "../../lib/fotorank/partners/home-marquee-shared";

export type FotorankPartnerLogoMarqueeProps = {
  title: string;
  titleId: string;
  items: FotorankMarqueePublicItem[];
};

/**
 * Wrapper cliente mínimo: solo monta si hay items (la página no debe pasar
 * un array vacío).
 */
export function FotorankPartnerLogoMarquee({
  title,
  titleId,
  items,
}: FotorankPartnerLogoMarqueeProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <h2 id={titleId} className="fr-title-card text-center tracking-tight">
          {title}
        </h2>
        <div className="mt-8">
          <PartnerLogoMarquee
            aria-label={title}
            items={items.map((item) => ({
              id: item.creativeId,
              name: item.partnerName,
              logoUrl: item.logoUrl,
              href: item.href,
              alt: item.alt ?? item.partnerName,
              campaignId: item.campaignId,
              creativeId: item.creativeId,
              placementKey: FOTORANK_HOME_MARQUEE_PLACEMENT,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
