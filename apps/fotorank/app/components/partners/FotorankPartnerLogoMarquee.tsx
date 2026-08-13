"use client";

import { PartnerLogoMarquee } from "@repo/design-system/components/partners";
import { PageContainer, PublicSectionHeader } from "../public-ui";
import type { FotorankMarqueePublicItem } from "../../lib/fotorank/partners/marquee-shared";

export type FotorankPartnerLogoMarqueeProps = {
  title: string;
  titleId: string;
  placementKey: "FOTORANK_HOME_MARQUEE" | "FOTORANK_CONTEST_MARQUEE";
  items: FotorankMarqueePublicItem[];
  sectionId?: string;
};

/**
 * Wrapper cliente mínimo: solo monta si hay items (la página no debe pasar array vacío).
 * Reutiliza PartnerLogoMarquee; no incorpora gráficas welcome.
 */
export function FotorankPartnerLogoMarquee({
  title,
  titleId,
  placementKey,
  items,
  sectionId,
}: FotorankPartnerLogoMarqueeProps) {
  if (items.length === 0) return null;

  return (
    <section
      className="fr-public-section"
      id={sectionId}
      aria-labelledby={titleId}
      data-testid={`fotorank-marquee-${placementKey}`}
    >
      <PageContainer>
        <PublicSectionHeader titleId={titleId} title={title} />
        <div className="fr-public-stack-content">
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
              placementKey,
            }))}
          />
        </div>
      </PageContainer>
    </section>
  );
}
