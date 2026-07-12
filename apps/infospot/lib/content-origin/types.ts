/**
 * Tipos de dominio para orígenes de contenido (sin Prisma en la API pública).
 */

export const ORIGIN_CONTENT_TYPES = ["ARTICLE", "EVENT"] as const;
export type OriginContentType = (typeof ORIGIN_CONTENT_TYPES)[number];

export const ORIGIN_SOURCE_TYPES = [
  "INFOSPOT",
  "COMPRAMELAFOTO",
  "CSV",
  "AI",
  "RSS",
  "INSTAGRAM",
  "FACEBOOK",
  "API",
  "MANUAL",
] as const;
export type OriginSourceType = (typeof ORIGIN_SOURCE_TYPES)[number];

export const ORIGIN_EXTERNAL_ENTITY_TYPES = [
  "EVENT",
  "ALBUM",
  "PHOTO",
  "POST",
  "FEED_ITEM",
  "UNKNOWN",
] as const;
export type OriginExternalEntityType = (typeof ORIGIN_EXTERNAL_ENTITY_TYPES)[number];

export const ORIGIN_DIRECTIONS = ["INBOUND", "OUTBOUND", "BIDIRECTIONAL"] as const;
export type OriginDirection = (typeof ORIGIN_DIRECTIONS)[number];

export const ORIGIN_SYNC_STATUSES = [
  "PENDING",
  "SYNCED",
  "FAILED",
  "STALE",
  "DISABLED",
] as const;
export type OriginSyncStatus = (typeof ORIGIN_SYNC_STATUSES)[number];

export const EVENT_ORIGIN_KINDS = [
  "REDACCION",
  "PUBLIC_INTAKE",
  "IMPORTED",
  "AUTO_CREATED",
  "SYNCED_EXTERNAL",
] as const;
export type EventOriginKind = (typeof EVENT_ORIGIN_KINDS)[number];

export type ExternalIdentity = {
  sourceType: OriginSourceType;
  externalEntityType: OriginExternalEntityType;
  externalId: string;
};

export type OperationalPayload = Record<string, unknown>;

export type ContentOriginRecord = {
  id: string;
  contentType: OriginContentType;
  articleId: string | null;
  eventId: string | null;
  sourceType: OriginSourceType;
  externalEntityType: OriginExternalEntityType;
  externalId: string;
  externalUrl: string | null;
  direction: OriginDirection;
  syncStatus: OriginSyncStatus;
  lastSyncedAt: Date | null;
  lastAttemptAt: Date | null;
  syncError: string | null;
  operationalPayload: OperationalPayload | null;
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertContentOriginInput = {
  contentType: OriginContentType;
  articleId?: string | null;
  eventId?: string | null;
  sourceType: OriginSourceType;
  externalEntityType: OriginExternalEntityType;
  externalId: string | number;
  externalUrl?: string | null;
  direction?: OriginDirection;
  syncStatus?: OriginSyncStatus;
  operationalPayload?: OperationalPayload | null;
  sourceUpdatedAt?: Date | null;
};

export function normalizeExternalId(value: string | number): string {
  return String(value).trim();
}

/** Valida XOR article/event + contentType coherente. */
export function assertOriginTarget(input: {
  contentType: OriginContentType;
  articleId?: string | null;
  eventId?: string | null;
}): { ok: true; articleId: string | null; eventId: string | null } | { ok: false; error: string } {
  const articleId = input.articleId?.trim() || null;
  const eventId = input.eventId?.trim() || null;

  if (articleId && eventId) {
    return { ok: false, error: "Un origen no puede vincular Article y Event a la vez." };
  }
  if (!articleId && !eventId) {
    return { ok: false, error: "Un origen requiere Article o Event." };
  }
  if (input.contentType === "ARTICLE" && !articleId) {
    return { ok: false, error: "contentType ARTICLE requiere articleId." };
  }
  if (input.contentType === "EVENT" && !eventId) {
    return { ok: false, error: "contentType EVENT requiere eventId." };
  }
  return { ok: true, articleId, eventId };
}
