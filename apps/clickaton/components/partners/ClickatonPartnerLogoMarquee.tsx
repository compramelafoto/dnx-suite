"use client";

import { PartnerLogoMarquee } from "@repo/design-system/components/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import type { ClickatonMarqueePublicItem } from "@/lib/public/partners-marquee-shared";

export type ClickatonPartnerLogoMarqueeProps = {
  title: string;
  titleId: string;
  placementKey: "CLICKATON_HOME_MARQUEE" | "CLICKATON_EVENT_MARQUEE";
  items: ClickatonMarqueePublicItem[];
  /** Tone del Section Clickatón. */
  tone?: "default" | "muted";
};

/**
 * Wrapper cliente mínimo: solo monta si hay items (la página no debe pasar array vacío).
 */
export function ClickatonPartnerLogoMarquee({
  title,
  titleId,
  placementKey,
  items,
  tone = "default",
}: ClickatonPartnerLogoMarqueeProps) {
  if (items.length === 0) return null;

  return (
    <Section aria-labelledby={titleId} tone={tone}>
      <Container>
        <h2
          id={titleId}
          className="ck-heading-md text-center tracking-tight text-ck-text"
        >
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
              placementKey,
            }))}
          />
        </div>
      </Container>
    </Section>
  );
}
