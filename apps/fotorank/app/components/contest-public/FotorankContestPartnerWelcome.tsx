"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import {
  FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_CONTEST_WELCOME_PLACEMENT,
  type FotorankContestWelcomePublicPayload,
} from "../../lib/fotorank/partners/contest-welcome-shared";

/**
 * Wrapper cliente mínimo — frecuencia, animación, cierre e impresión.
 * No convierte la landing del concurso en Client Component.
 */
export function FotorankContestPartnerWelcome({
  ad,
}: {
  ad: FotorankContestWelcomePublicPayload | null;
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
      placementKey={FOTORANK_CONTEST_WELCOME_PLACEMENT}
      appearDelayMs={FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS}
      animationVariant="random"
      sponsoredLabel="Contenido patrocinado"
    />
  );
}
