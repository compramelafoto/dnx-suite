"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import type { ResolvedAdCreative } from "@repo/partners";

/**
 * Wrapper InfoSpot — conserva contrato y placement clave estable.
 * Frecuencia 24h; flag INFOSPOT_PARTNER_ADS_ENABLED controla la carga aguas arriba.
 */
export function PartnerAdsWelcome({ ad }: { ad: ResolvedAdCreative | null }) {
  if (!ad) return null;
  return (
    <PartnerWelcomeInterstitial
      campaignId={ad.campaignId}
      partnerName={ad.partnerName}
      imageUrl={ad.imageUrl}
      media={ad.welcomeMedia ?? null}
      href={ad.href}
      title={ad.title}
      body={ad.body}
      ctaText={ad.ctaText}
      frequencyHours={24}
      creativeId={ad.creativeId}
      placementKey="INFOSPOT_HOME_WELCOME"
      animationVariant="fade"
      sponsoredLabel="Contenido patrocinado"
    />
  );
}
