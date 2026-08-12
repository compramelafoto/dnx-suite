"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import {
  CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS,
  CLICKATON_EVENT_WELCOME_PLACEMENT,
  type ClickatonEventWelcomePublicPayload,
} from "@/lib/public/partners-event-welcome-shared";

/**
 * Wrapper cliente mínimo: frecuencia, animación, cierre e impresión.
 * No convierte la página del maratón en Client Component.
 */
export function ClickatonEventPartnerWelcome({
  ad,
}: {
  ad: ClickatonEventWelcomePublicPayload | null;
}) {
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
      creativeId={ad.creativeId}
      placementKey={CLICKATON_EVENT_WELCOME_PLACEMENT}
      appearDelayMs={CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS}
      animationVariant="random"
      sponsoredLabel="Contenido patrocinado"
    />
  );
}
