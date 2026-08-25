/**
 * Activación destacada FotoRank — portada.
 * Server-only. Flag OFF ⇒ cero consultas a DNX Partners.
 *
 * Es inventario **global** de la plataforma. A diferencia de la placa de
 * concurso, no lleva `contestContextId`: solo alcance GLOBAL o PLATFORM
 * explícito. Eso impide que el sponsor de un concurso aparezca en la portada
 * sin haberla contratado.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  canMountPartnerWelcomeActivation,
  isFotorankHomeWelcomeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import { FOTORANK_HOME_WELCOME_PLACEMENT } from "./home-welcome-shared";

export {
  FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_HOME_WELCOME_PLACEMENT,
  type FotorankHomeWelcomePublicPayload,
} from "./home-welcome-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export async function loadFotorankHomeWelcomeAd(input: {
  pathname: string;
}): Promise<ResolvedAdCreative | null> {
  if (!isFotorankHomeWelcomeEnabled()) return null;

  const mount = canMountPartnerWelcomeActivation({
    application: "FOTO_RANK",
    placementKey: FOTORANK_HOME_WELCOME_PLACEMENT,
    pathname: input.pathname,
  });
  if (!mount.ok) return null;

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    const ads = await loadPartnerAdsForPlacement(prisma, {
      application: "FOTO_RANK",
      placementKey: FOTORANK_HOME_WELCOME_PLACEMENT,
      device,
      requireActivePartner: true,
    });
    return ads[0] ?? null;
  } catch (err) {
    console.error("[fotorank.partners-home-welcome]", err);
    return null;
  }
}

export function toFotorankHomeWelcomePublicPayload(ad: ResolvedAdCreative) {
  return {
    campaignId: ad.campaignId,
    partnerName: ad.partnerName,
    creativeId: ad.creativeId,
    imageUrl: ad.imageUrl,
    href: ad.href,
    title: ad.title,
    body: ad.body,
    ctaText: ad.ctaText,
    welcomeMedia: ad.welcomeMedia ?? null,
  };
}
