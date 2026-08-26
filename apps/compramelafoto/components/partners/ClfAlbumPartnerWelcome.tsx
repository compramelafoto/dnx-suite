"use client";

import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import {
  CLF_ALBUM_WELCOME_APPEAR_DELAY_MS,
  CLF_ALBUM_WELCOME_PLACEMENT,
  type ClfAlbumWelcomePublicPayload,
} from "@/lib/public/partners-album-welcome-shared";

/**
 * Wrapper cliente mínimo — frecuencia, animación, cierre e impresión.
 * No convierte la galería del álbum en Client Component.
 */
export function ClfAlbumPartnerWelcome({
  ad,
}: {
  ad: ClfAlbumWelcomePublicPayload | null;
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
      placementKey={CLF_ALBUM_WELCOME_PLACEMENT}
      appearDelayMs={CLF_ALBUM_WELCOME_APPEAR_DELAY_MS}
      animationVariant="random"
      sponsoredLabel="Contenido patrocinado"
    />
  );
}
