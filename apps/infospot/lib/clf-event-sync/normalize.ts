/**
 * Normalización CLF Event → snapshot operativo + campos iniciales Info Spot.
 */

import { getR2PublicUrl } from "../r2-public-url";
import {
  availablePhotographerSlots,
  hasUsableCoordinates,
  isClfEventPublicPhotographerCall,
} from "./import-rules";
import { mapClfEventTypeToInfoSpotCategorySlug } from "./category-map";
import { buildClfPublicEventUrl } from "./urls";
import type { ClfEventForSync, SyncWarning } from "./types";

export type NormalizedClfEvent = {
  clfEventId: number;
  title: string;
  description: string;
  summary: string | null;
  startAt: Date;
  endAt: Date | null;
  city: string;
  province: string;
  venueName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  registrationUrl: string | null;
  sourceUrl: string | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string | null;
  organizerWebsite: string | null;
  categorySlug: string;
  categoryMapReason: string;
  categoryUsedFallback: boolean;
  missingGeoref: boolean;
  publicPhotographerCall: boolean;
  operationalPayload: Record<string, unknown>;
  sourceUpdatedAt: Date;
  warnings: SyncWarning[];
};

function safeCoverUrl(key: string | null): string | null {
  if (!key?.trim()) return null;
  try {
    return getR2PublicUrl(key.replace(/^\//, ""));
  } catch {
    return null;
  }
}

function deriveSummary(description: string | null, title: string): string | null {
  const text = (description || title).replace(/\s+/g, " ").trim();
  if (text.length < 10) return null;
  if (text.length <= 180) return text;
  return `${text.slice(0, 177).trim()}…`;
}

export function normalizeClfEvent(event: ClfEventForSync): NormalizedClfEvent {
  const warnings: SyncWarning[] = [];
  const category = mapClfEventTypeToInfoSpotCategorySlug(event.type);
  if (category.usedFallback) {
    warnings.push({
      code: "category_fallback",
      message: `Tipo CLF «${event.type}» sin mapeo directo; se usa categoría «${category.slug}» (${category.reason}).`,
    });
  }

  const coordsOk = hasUsableCoordinates(event.latitude, event.longitude);
  if (!coordsOk) {
    warnings.push({
      code: "missing_georef",
      message: "Este evento todavía no está georreferenciado.",
    });
  }

  const publicUrl = buildClfPublicEventUrl(event.shareSlug);
  if (!publicUrl) {
    warnings.push({
      code: "missing_public_url",
      message: "Sin shareSlug: no hay URL pública de inscripción.",
    });
  }

  const slots = availablePhotographerSlots(event);
  const publicCall = isClfEventPublicPhotographerCall(event);
  const coverImageUrl = safeCoverUrl(event.coverImageKey);

  const organizerName =
    event.creator.companyName?.trim() ||
    event.creator.name?.trim() ||
    event.creator.email.split("@")[0] ||
    "Organizador CLF";

  const province =
    event.creator.province?.trim() ||
    "A confirmar";

  if (province === "A confirmar") {
    warnings.push({
      code: "province_placeholder",
      message: "Provincia no disponible en CLF; se usó «A confirmar».",
    });
  }

  const description =
    event.description?.trim() ||
    `Evento importado desde ComprameLaFoto: ${event.title.trim()}.`;

  const operationalPayload: Record<string, unknown> = {
    clfEventId: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    city: event.city,
    locationName: event.locationName,
    latitude: event.latitude,
    longitude: event.longitude,
    visibility: event.visibility,
    joinPolicy: event.joinPolicy,
    maxPhotographers: event.maxPhotographers,
    activePhotographerCount: event.activePhotographerCount ?? null,
    availableSlots: slots,
    status: event.status,
    archivedAt: event.archivedAt?.toISOString() ?? null,
    shareSlug: event.shareSlug,
    coverImageKey: event.coverImageKey,
    publicUrl,
    publicPhotographerCall: publicCall,
    creatorId: event.creator.id,
    creatorEmail: event.creator.email,
    categorySlug: category.slug,
    missingGeoref: !coordsOk,
    sourceUpdatedAt: event.updatedAt.toISOString(),
  };

  return {
    clfEventId: event.id,
    title: event.title.trim(),
    description,
    summary: deriveSummary(event.description, event.title),
    startAt: event.startsAt,
    endAt: event.endsAt,
    city: event.city?.trim() || "A confirmar",
    province,
    venueName: event.locationName?.trim() || null,
    address: event.locationName?.trim() || null,
    latitude: coordsOk ? event.latitude : null,
    longitude: coordsOk ? event.longitude : null,
    coverImageKey: event.coverImageKey,
    coverImageUrl,
    registrationUrl: publicUrl,
    sourceUrl: publicUrl,
    organizerName,
    organizerEmail: event.creator.email,
    organizerPhone: event.creator.phone,
    organizerWebsite: event.creator.website,
    categorySlug: category.slug,
    categoryMapReason: category.reason,
    categoryUsedFallback: category.usedFallback,
    missingGeoref: !coordsOk,
    publicPhotographerCall: publicCall,
    operationalPayload,
    sourceUpdatedAt: event.updatedAt,
    warnings,
  };
}
