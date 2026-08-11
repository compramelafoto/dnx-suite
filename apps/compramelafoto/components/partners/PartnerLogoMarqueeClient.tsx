"use client";

import { useEffect, useState } from "react";
import { PartnerLogoMarquee } from "@repo/design-system/components/partners";

type AdDto = {
  creativeId: string;
  campaignId: string;
  partnerName: string;
  imageUrl?: string | null;
  href?: string | null;
};

/** Marquee home CLF — soft fetch; kill switch OFF ⇒ vacío. */
export function PartnerLogoMarqueeClient() {
  const [items, setItems] = useState<AdDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/partners/ads?placement=CLF_LOGO_MARQUEE")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.ads)) setItems(data.ads);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length) return null;

  return (
    <section aria-label="Nos acompañan" className="w-full max-w-5xl mx-auto px-4 py-10 space-y-6">
      <h2 className="text-center text-lg font-semibold tracking-tight text-[#111827]">
        Nos acompañan
      </h2>
      <PartnerLogoMarquee
        aria-label="Sponsors"
        items={items.map((ad) => ({
          id: ad.creativeId,
          name: ad.partnerName,
          logoUrl: ad.imageUrl ?? null,
          href: ad.href ?? null,
          campaignId: ad.campaignId,
          creativeId: ad.creativeId,
          placementKey: "CLF_LOGO_MARQUEE",
        }))}
      />
    </section>
  );
}
