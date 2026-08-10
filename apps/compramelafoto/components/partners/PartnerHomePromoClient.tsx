"use client";

import { useEffect, useState } from "react";
import { PartnerAdCreative } from "@repo/design-system/components/partners";

type AdDto = {
  creativeId: string;
  partnerName: string;
  imageUrl?: string | null;
  href?: string | null;
  title?: string | null;
  body?: string | null;
  ctaText?: string | null;
};

/**
 * Promo home CLF — carga soft vía API (home es client component).
 * Kill switch / empty → no render.
 */
export function PartnerHomePromoClient() {
  const [ads, setAds] = useState<AdDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/partners/ads?placement=CLF_HOME_PROMO")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.ads)) setAds(data.ads);
      })
      .catch(() => {
        /* soft */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ads.length) return null;

  return (
    <section aria-label="Publicidad" className="w-full max-w-5xl mx-auto px-4 py-8">
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
            variant="banner"
          />
        ))}
      </div>
    </section>
  );
}
