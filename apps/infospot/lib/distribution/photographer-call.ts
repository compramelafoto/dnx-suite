/**
 * Resolución de convocatorias públicas de fotógrafos (automática).
 */

import { isClfEventPublicPhotographerCall } from "../clf-event-sync/import-rules";
import { buildClfPublicEventUrl } from "../clf-event-sync/urls";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type PhotographerCallResolved = {
  eligible: boolean;
  joinUrl: string | null;
  shareSlug: string | null;
  maxPhotographers: number | null;
  activeCount: number | null;
  slotsLabel: string | null;
};

export function resolvePhotographerCallFromSources(input: {
  registrationUrl?: string | null;
  photographerCall?: {
    enabled: boolean;
    provisioningStatus: string;
    publicUrl: string | null;
    clfEventId: number | null;
    visibility: string;
    joinPolicy: string;
    maxPhotographers: number | null;
    desiredClfStatus: string;
  } | null;
  origin?: {
    externalUrl: string | null;
    externalId: string;
    operationalPayload?: unknown;
  } | null;
}): PhotographerCallResolved {
  const empty: PhotographerCallResolved = {
    eligible: false,
    joinUrl: null,
    shareSlug: null,
    maxPhotographers: null,
    activeCount: null,
    slotsLabel: null,
  };

  const raw = input.origin?.operationalPayload;
  const fromPayload =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  // Preferir snapshot operativo CLF (inbound / post-provision).
  if (fromPayload) {
    const shareSlug =
      asString(fromPayload.shareSlug) ||
      extractShareSlug(asString(fromPayload.publicUrl) || input.origin?.externalUrl);
    const visibility = asString(fromPayload.visibility) || "PRIVATE";
    const joinPolicy = asString(fromPayload.joinPolicy) || "INVITE_ONLY";
    const status = asString(fromPayload.status) || "CLOSED";
    const archivedAt = fromPayload.archivedAt
      ? new Date(String(fromPayload.archivedAt))
      : null;
    const maxPhotographers = asNumber(fromPayload.maxPhotographers);
    const activePhotographerCount = asNumber(fromPayload.activePhotographerCount);

    const eligible = isClfEventPublicPhotographerCall({
      visibility,
      joinPolicy,
      archivedAt: archivedAt && !Number.isNaN(archivedAt.getTime()) ? archivedAt : null,
      shareSlug,
      status,
      maxPhotographers,
      activePhotographerCount,
    });

    if (eligible && shareSlug) {
      const joinUrl =
        buildClfPublicEventUrl(shareSlug) ||
        asString(fromPayload.publicUrl) ||
        input.origin?.externalUrl ||
        null;
      return {
        eligible: true,
        joinUrl,
        shareSlug,
        maxPhotographers,
        activeCount: activePhotographerCount,
        slotsLabel: slotsLabel(maxPhotographers, activePhotographerCount),
      };
    }
  }

  // Fallback: convocatoria provisionada desde Info Spot (draft operativo).
  const call = input.photographerCall;
  if (
    call &&
    call.enabled &&
    call.provisioningStatus === "PROVISIONED" &&
    call.desiredClfStatus === "ACTIVE" &&
    call.publicUrl
  ) {
    const shareSlug = extractShareSlug(call.publicUrl);
    const eligible = isClfEventPublicPhotographerCall({
      visibility: call.visibility,
      joinPolicy: call.joinPolicy,
      archivedAt: null,
      shareSlug,
      status: "ACTIVE",
      maxPhotographers: call.maxPhotographers,
      activePhotographerCount: null,
    });
    if (eligible) {
      return {
        eligible: true,
        joinUrl: call.publicUrl,
        shareSlug,
        maxPhotographers: call.maxPhotographers,
        activeCount: null,
        slotsLabel: slotsLabel(call.maxPhotographers, null),
      };
    }
  }

  return empty;
}

function extractShareSlug(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const m = url.trim().match(/\/e\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

function slotsLabel(
  max: number | null,
  active: number | null,
): string | null {
  if (max == null) return null;
  if (active == null) return null;
  const left = Math.max(0, max - active);
  if (left <= 0) return null;
  if (left <= 3) return "Últimos cupos";
  return null;
}
