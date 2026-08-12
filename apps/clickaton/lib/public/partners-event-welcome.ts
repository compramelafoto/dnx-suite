/**
 * Activación destacada Clickatón — EVENT (landing maratón).
 * Server-only. Flag OFF ⇒ cero consultas a DNX Partners.
 */
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { loadPartnerAdsForPlacement } from "@repo/db/partners-ads-loader";
import {
  canMountPartnerWelcomeActivation,
  isClickatonPartnerWelcomeEnabled,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
} from "@repo/partners";
import {
  CLICKATON_EVENT_WELCOME_PLACEMENT,
  type ClickatonEventWelcomePublicPayload,
} from "@/lib/public/partners-event-welcome-shared";

export {
  CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS,
  CLICKATON_EVENT_WELCOME_PLACEMENT,
  type ClickatonEventWelcomePublicPayload,
} from "@/lib/public/partners-event-welcome-shared";

function detectDevice(ua: string | null): DnxPartnerCreativeDeviceTarget {
  if (!ua) return "ALL";
  if (/tablet|ipad/i.test(ua)) return "TABLET";
  if (/mobi|iphone|android/i.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export type LoadClickatonEventWelcomeInput = {
  editionId: string;
  /** Pathname canónico, p. ej. `/maratones/rosario-2026` */
  pathname: string;
  /**
   * Solo landings públicas routable (no draft/cancelled/archived/demo técnica).
   * La página debe pasar false si no corresponde.
   */
  publicLandingAllowed: boolean;
};

/**
 * Resuelve como máximo una creative pública para CLICKATON_EVENT_WELCOME.
 * Campos ya sanitizados por el loader (sin contactos / PII).
 */
export async function loadClickatonEventWelcomeAd(
  input: LoadClickatonEventWelcomeInput,
): Promise<ResolvedAdCreative | null> {
  if (!isClickatonPartnerWelcomeEnabled()) return null;
  if (!input.publicLandingAllowed) return null;
  if (!input.editionId.trim()) return null;

  const mount = canMountPartnerWelcomeActivation({
    application: "CLICKATON",
    placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
    pathname: input.pathname,
  });
  if (!mount.ok) return null;

  try {
    const h = await headers();
    const device = detectDevice(h.get("user-agent"));
    const ads = await loadPartnerAdsForPlacement(prisma, {
      application: "CLICKATON",
      placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
      device,
      editionContextId: input.editionId,
      requireActivePartner: true,
    });
    return ads[0] ?? null;
  } catch (err) {
    console.error("[clickaton.partners-welcome]", err);
    return null;
  }
}

export function toClickatonEventWelcomePublicPayload(
  ad: ResolvedAdCreative,
): ClickatonEventWelcomePublicPayload {
  return {
    campaignId: ad.campaignId,
    partnerName: ad.partnerName,
    creativeId: ad.creativeId,
    imageUrl: ad.imageUrl,
    href: ad.href,
    title: ad.title,
    body: ad.body,
    ctaText: ad.ctaText,
  };
}
