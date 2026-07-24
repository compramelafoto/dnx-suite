import {
  distanceKm,
  hasUsableCoordinates,
  normalizePlaceToken,
  placesMatch,
} from "@repo/geo";
import {
  AUDIENCE_RADIUS_PRESETS_KM,
  CUSTOM_RADIUS_LIMITS_KM,
  DEFAULT_AUDIENCE_RADIUS_KM,
  type AudienceScopeMode,
} from "./config";
import type {
  AudienceBucketCounts,
  AudiencePreview,
  CallAudienceContext,
  NotificationCandidate,
  NotificationChannel,
  PhotographerAudienceInput,
} from "./contracts";
import { buildDeliveryDedupeKey } from "./deduplication";
import { resolveConsentState } from "./preferences";

export function parseAudienceScope(input: {
  mode: "RADIUS_KM" | "CITY" | "PROVINCE";
  km?: number | null;
}): AudienceScopeMode {
  if (input.mode === "CITY") return { kind: "CITY" };
  if (input.mode === "PROVINCE") return { kind: "PROVINCE" };
  const km = Number(input.km ?? DEFAULT_AUDIENCE_RADIUS_KM);
  if (!Number.isFinite(km)) {
    throw new Error("Radio inválido.");
  }
  if (km < CUSTOM_RADIUS_LIMITS_KM.min || km > CUSTOM_RADIUS_LIMITS_KM.max) {
    throw new Error(
      `Radio fuera de rango (${CUSTOM_RADIUS_LIMITS_KM.min}–${CUSTOM_RADIUS_LIMITS_KM.max} km).`,
    );
  }
  return { kind: "RADIUS_KM", km: Math.round(km) };
}

export function scopeLabel(scope: AudienceScopeMode): string {
  if (scope.kind === "CITY") return "Toda la ciudad";
  if (scope.kind === "PROVINCE") return "Toda la provincia";
  return `${scope.km} km`;
}

export function isPresetRadiusKm(km: number): boolean {
  return (AUDIENCE_RADIUS_PRESETS_KM as readonly number[]).includes(km);
}

function emptyBuckets(): AudienceBucketCounts {
  return {
    found: 0,
    eligible: 0,
    excluded: 0,
    outOfRadius: 0,
    prefDisabled: 0,
    noChannel: 0,
    blockedOrInactive: 0,
    alreadyApplied: 0,
    duplicates: 0,
    invalidLocation: 0,
    antiSpam: 0,
  };
}

function distanceBucket(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "sin_distancia";
  if (km <= 10) return "0-10";
  if (km <= 25) return "10-25";
  if (km <= 50) return "25-50";
  if (km <= 100) return "50-100";
  return "100+";
}

function matchesScope(
  photographer: PhotographerAudienceInput,
  ctx: CallAudienceContext,
): { ok: boolean; distanceKm: number | null; reason?: string } {
  const origin = ctx.origin;
  const scope = ctx.scope;

  if (scope.kind === "CITY") {
    if (!origin.city || !photographer.city) {
      return { ok: false, distanceKm: null, reason: "Sin ciudad comparable" };
    }
    const match = placesMatch(origin.city, photographer.city);
    return match
      ? { ok: true, distanceKm: null }
      : { ok: false, distanceKm: null, reason: "Fuera de la ciudad" };
  }

  if (scope.kind === "PROVINCE") {
    if (!origin.province || !photographer.province) {
      return { ok: false, distanceKm: null, reason: "Sin provincia comparable" };
    }
    const match = placesMatch(origin.province, photographer.province);
    return match
      ? { ok: true, distanceKm: null }
      : { ok: false, distanceKm: null, reason: "Fuera de la provincia" };
  }

  const originOk = hasUsableCoordinates(origin.latitude, origin.longitude);
  const photoOk = hasUsableCoordinates(
    photographer.latitude,
    photographer.longitude,
  );

  if (!originOk) {
    // Fallback: ciudad si el evento no tiene coords
    if (origin.city && photographer.city && placesMatch(origin.city, photographer.city)) {
      return { ok: true, distanceKm: null };
    }
    return { ok: false, distanceKm: null, reason: "Origen sin coordenadas válidas" };
  }
  if (!photoOk) {
    return { ok: false, distanceKm: null, reason: "Fotógrafo sin ubicación válida" };
  }

  const dist = distanceKm(
    { latitude: origin.latitude!, longitude: origin.longitude! },
    { latitude: photographer.latitude!, longitude: photographer.longitude! },
  );
  if (dist > scope.km) {
    return { ok: false, distanceKm: dist, reason: `Fuera del radio (${scope.km} km)` };
  }
  return { ok: true, distanceKm: Math.round(dist * 10) / 10 };
}

function pickChannel(
  photographer: PhotographerAudienceInput,
  requested: NotificationChannel[],
): NotificationChannel | null {
  for (const ch of requested) {
    if (photographer.availableChannels.includes(ch)) return ch;
  }
  return null;
}

/**
 * Selección pura de audiencia. No usa @repo/recommendations como autorización.
 */
export function selectPhotographerAudience(
  photographers: PhotographerAudienceInput[],
  ctx: CallAudienceContext,
): AudiencePreview {
  const buckets = emptyBuckets();
  const byDistanceKm: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const eligible: NotificationCandidate[] = [];
  const excluded: NotificationCandidate[] = [];

  buckets.found = photographers.length;

  if (!ctx.callOpen) {
    return {
      buckets: { ...buckets, excluded: photographers.length },
      byDistanceKm,
      byCity,
      eligible: [],
      excluded: photographers.map((p) => ({
        recipient: { kind: p.kind ?? "PHOTOGRAPHER", userId: p.userId },
        eventType: ctx.eventType,
        channel: "IN_APP",
        selectionReason: "Convocatoria cerrada",
        score: 0,
        distanceKm: null,
        city: p.city,
        province: p.province,
        consent: resolveConsentState(p),
        dedup: "NEW",
        eligibility: "CALL_CLOSED",
        excludeReason: "Convocatoria cerrada",
      })),
      scopeLabel: scopeLabel(ctx.scope),
    };
  }

  if (ctx.callExpired) {
    return {
      buckets: { ...buckets, excluded: photographers.length },
      byDistanceKm,
      byCity,
      eligible: [],
      excluded: photographers.map((p) => ({
        recipient: { kind: p.kind ?? "PHOTOGRAPHER", userId: p.userId },
        eventType: ctx.eventType,
        channel: "IN_APP",
        selectionReason: "Convocatoria vencida",
        score: 0,
        distanceKm: null,
        city: p.city,
        province: p.province,
        consent: resolveConsentState(p),
        dedup: "NEW",
        eligibility: "CALL_EXPIRED",
        excludeReason: "Convocatoria vencida",
      })),
      scopeLabel: scopeLabel(ctx.scope),
    };
  }

  for (const p of photographers) {
    const base = {
      recipient: { kind: p.kind ?? "PHOTOGRAPHER", userId: p.userId },
      eventType: ctx.eventType,
      city: p.city,
      province: p.province,
      consent: resolveConsentState(p),
    } as const;

    if (!p.active || p.blocked) {
      buckets.blockedOrInactive += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel: "IN_APP",
        selectionReason: p.blocked ? "Usuario bloqueado" : "Perfil inactivo",
        score: 0,
        distanceKm: null,
        dedup: "NEW",
        eligibility: p.blocked ? "BLOCKED" : "INACTIVE",
        excludeReason: p.blocked ? "Bloqueado" : "Inactivo",
      });
      continue;
    }

    const nearbyEnabled = p.nearbyCallsEnabled !== false;
    if (!nearbyEnabled) {
      buckets.prefDisabled += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel: "IN_APP",
        selectionReason: "Preferencia desactivada",
        score: 0,
        distanceKm: null,
        dedup: "NEW",
        eligibility: "PREF_DISABLED",
        excludeReason: "Desactivó convocatorias cercanas",
      });
      continue;
    }

    if (p.alreadyApplied) {
      buckets.alreadyApplied += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel: "IN_APP",
        selectionReason: "Ya postulado",
        score: 0,
        distanceKm: null,
        dedup: "NEW",
        eligibility: "ALREADY_APPLIED",
        excludeReason: "Ya se postuló",
      });
      continue;
    }

    const geo = matchesScope(p, ctx);
    if (!geo.ok) {
      const invalid =
        geo.reason?.includes("ubicación") ||
        geo.reason?.includes("coordenadas") ||
        geo.reason?.includes("ciudad comparable") ||
        geo.reason?.includes("provincia comparable");
      if (invalid) buckets.invalidLocation += 1;
      else buckets.outOfRadius += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel: "IN_APP",
        selectionReason: geo.reason ?? "Fuera de alcance",
        score: 0,
        distanceKm: geo.distanceKm,
        dedup: "NEW",
        eligibility: invalid ? "INVALID_LOCATION" : "OUT_OF_RADIUS",
        excludeReason: geo.reason ?? "Fuera de alcance",
      });
      continue;
    }

    const channel = pickChannel(p, ctx.channels);
    if (!channel) {
      buckets.noChannel += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel: "IN_APP",
        selectionReason: "Sin canal disponible",
        score: 0,
        distanceKm: geo.distanceKm,
        dedup: "NEW",
        eligibility: "NO_CHANNEL",
        excludeReason: "Sin canal disponible",
      });
      continue;
    }

    const dedupeKey = buildDeliveryDedupeKey({
      eventType: ctx.eventType,
      sourceEntityId: ctx.sourceEntityId,
      recipientUserId: p.userId,
      channel,
      campaignCycle: ctx.campaignCycle,
    });

    if (p.existingDedupeKeys?.includes(dedupeKey)) {
      buckets.duplicates += 1;
      buckets.excluded += 1;
      excluded.push({
        ...base,
        channel,
        selectionReason: "Duplicado evitado",
        score: 0,
        distanceKm: geo.distanceKm,
        dedup: "DUPLICATE",
        eligibility: "DUPLICATE",
        excludeReason: "Ya notificado en este ciclo",
      });
      continue;
    }

    if ((p.recentSimilarCount ?? 0) > 0) {
      // El umbral exacto lo aplica policies; aquí marcamos señal para anti-spam posterior.
    }

    const score =
      geo.distanceKm == null
        ? 50
        : Math.max(0, 100 - Math.min(100, geo.distanceKm));

    const cityKey = normalizePlaceToken(p.city ?? "") || "sin_ciudad";
    byCity[cityKey] = (byCity[cityKey] ?? 0) + 1;
    const db = distanceBucket(geo.distanceKm);
    byDistanceKm[db] = (byDistanceKm[db] ?? 0) + 1;

    buckets.eligible += 1;
    eligible.push({
      ...base,
      channel,
      selectionReason: `Dentro de ${scopeLabel(ctx.scope)}`,
      score,
      distanceKm: geo.distanceKm,
      dedup: "NEW",
      eligibility: "ELIGIBLE",
      excludeReason: null,
    });
  }

  // Orden: más cercanos primero (score desc). No es autorización.
  eligible.sort((a, b) => b.score - a.score);

  return {
    buckets,
    byDistanceKm,
    byCity,
    eligible,
    excluded,
    scopeLabel: scopeLabel(ctx.scope),
  };
}

/** Resumen público seguro (sin PII). */
export function audiencePreviewSummary(preview: AudiencePreview): string {
  const b = preview.buckets;
  return [
    `${b.found} fotógrafos encontrados`,
    "",
    `${b.eligible} elegibles`,
    `${b.outOfRadius} fuera del radio`,
    `${b.prefDisabled} desactivaron convocatorias`,
    `${b.noChannel} sin canal disponible`,
    b.duplicates ? `${b.duplicates} duplicados evitados` : null,
    b.alreadyApplied ? `${b.alreadyApplied} ya postulados` : null,
  ]
    .filter((line) => line != null)
    .join("\n");
}
