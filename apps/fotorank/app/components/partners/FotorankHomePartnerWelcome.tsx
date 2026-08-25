"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import {
  FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_HOME_WELCOME_PLACEMENT,
  type FotorankHomeWelcomePublicPayload,
} from "../../lib/fotorank/partners/home-welcome-shared";

/**
 * Wrapper cliente mínimo — frecuencia, animación, cierre e impresión.
 * No convierte la portada en Client Component.
 */
export function FotorankHomePartnerWelcome({
  ad,
}: {
  ad: FotorankHomeWelcomePublicPayload | null;
}) {
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
      placementKey={FOTORANK_HOME_WELCOME_PLACEMENT}
      appearDelayMs={FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS}
      animationVariant="random"
      sponsoredLabel="Contenido patrocinado"
    />
  );
}
