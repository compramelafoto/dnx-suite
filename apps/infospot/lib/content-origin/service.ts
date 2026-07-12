/**
 * Persistencia idempotente de InfoSpotContentOrigin.
 * No publica ni cambia estados editoriales.
 */

import { prisma, type Prisma } from "@repo/db";
import {
  assertOriginTarget,
  normalizeExternalId,
  type ContentOriginRecord,
  type ExternalIdentity,
  type OperationalPayload,
  type OriginDirection,
  type OriginSyncStatus,
  type UpsertContentOriginInput,
} from "./types";

function toRecord(row: {
  id: string;
  contentType: string;
  articleId: string | null;
  eventId: string | null;
  sourceType: string;
  externalEntityType: string;
  externalId: string;
  externalUrl: string | null;
  direction: string;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lastAttemptAt: Date | null;
  syncError: string | null;
  operationalPayload: Prisma.JsonValue | null;
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ContentOriginRecord {
  return {
    id: row.id,
    contentType: row.contentType as ContentOriginRecord["contentType"],
    articleId: row.articleId,
    eventId: row.eventId,
    sourceType: row.sourceType as ContentOriginRecord["sourceType"],
    externalEntityType:
      row.externalEntityType as ContentOriginRecord["externalEntityType"],
    externalId: row.externalId,
    externalUrl: row.externalUrl,
    direction: row.direction as ContentOriginRecord["direction"],
    syncStatus: row.syncStatus as ContentOriginRecord["syncStatus"],
    lastSyncedAt: row.lastSyncedAt,
    lastAttemptAt: row.lastAttemptAt,
    syncError: row.syncError,
    operationalPayload: (row.operationalPayload as OperationalPayload | null) ?? null,
    sourceUpdatedAt: row.sourceUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findOriginByExternalIdentity(
  identity: ExternalIdentity,
  opts?: { articleId?: string; eventId?: string },
): Promise<ContentOriginRecord | null> {
  const externalId = normalizeExternalId(identity.externalId);
  const row = await prisma.infoSpotContentOrigin.findFirst({
    where: {
      sourceType: identity.sourceType,
      externalEntityType: identity.externalEntityType,
      externalId,
      ...(opts?.articleId ? { articleId: opts.articleId } : {}),
      ...(opts?.eventId ? { eventId: opts.eventId } : {}),
    },
  });
  return row ? toRecord(row) : null;
}

export async function upsertContentOrigin(
  input: UpsertContentOriginInput,
): Promise<{ ok: true; origin: ContentOriginRecord; created: boolean } | { ok: false; error: string }> {
  const target = assertOriginTarget(input);
  if (!target.ok) return target;

  const externalId = normalizeExternalId(input.externalId);
  if (!externalId) return { ok: false, error: "externalId vacío." };

  const existing = await prisma.infoSpotContentOrigin.findFirst({
    where: {
      sourceType: input.sourceType,
      externalEntityType: input.externalEntityType,
      externalId,
      ...(target.articleId ? { articleId: target.articleId } : { eventId: target.eventId! }),
    },
  });

  const direction: OriginDirection = input.direction ?? "INBOUND";
  const syncStatus: OriginSyncStatus = input.syncStatus ?? existing?.syncStatus ?? "PENDING";
  const now = new Date();

  if (existing) {
    const updated = await prisma.infoSpotContentOrigin.update({
      where: { id: existing.id },
      data: {
        externalUrl: input.externalUrl ?? existing.externalUrl,
        direction,
        syncStatus,
        lastAttemptAt: now,
        operationalPayload:
          input.operationalPayload === undefined
            ? undefined
            : (input.operationalPayload as Prisma.InputJsonValue),
        sourceUpdatedAt: input.sourceUpdatedAt ?? existing.sourceUpdatedAt,
        // No tocar syncError aquí salvo que el caller lo limpie vía markSynced.
      },
    });
    return { ok: true, origin: toRecord(updated), created: false };
  }

  const created = await prisma.infoSpotContentOrigin.create({
    data: {
      contentType: input.contentType,
      articleId: target.articleId,
      eventId: target.eventId,
      sourceType: input.sourceType,
      externalEntityType: input.externalEntityType,
      externalId,
      externalUrl: input.externalUrl ?? null,
      direction,
      syncStatus,
      lastAttemptAt: now,
      operationalPayload:
        (input.operationalPayload as Prisma.InputJsonValue | undefined) ?? undefined,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    },
  });

  return { ok: true, origin: toRecord(created), created: true };
}

export async function linkArticleToOrigin(
  articleId: string,
  input: Omit<UpsertContentOriginInput, "contentType" | "articleId" | "eventId">,
) {
  return upsertContentOrigin({
    ...input,
    contentType: "ARTICLE",
    articleId,
    eventId: null,
  });
}

export async function linkEventToOrigin(
  eventId: string,
  input: Omit<UpsertContentOriginInput, "contentType" | "articleId" | "eventId">,
) {
  return upsertContentOrigin({
    ...input,
    contentType: "EVENT",
    eventId,
    articleId: null,
  });
}

export async function markOriginSynced(
  originId: string,
  opts?: { operationalPayload?: OperationalPayload | null; sourceUpdatedAt?: Date | null },
): Promise<ContentOriginRecord> {
  const now = new Date();
  const updated = await prisma.infoSpotContentOrigin.update({
    where: { id: originId },
    data: {
      syncStatus: "SYNCED",
      lastSyncedAt: now,
      lastAttemptAt: now,
      syncError: null,
      ...(opts?.operationalPayload !== undefined
        ? { operationalPayload: opts.operationalPayload as Prisma.InputJsonValue }
        : {}),
      ...(opts?.sourceUpdatedAt !== undefined
        ? { sourceUpdatedAt: opts.sourceUpdatedAt }
        : {}),
    },
  });
  return toRecord(updated);
}

export async function markOriginFailed(
  originId: string,
  error: string,
): Promise<ContentOriginRecord> {
  const updated = await prisma.infoSpotContentOrigin.update({
    where: { id: originId },
    data: {
      syncStatus: "FAILED",
      lastAttemptAt: new Date(),
      syncError: error.slice(0, 4000),
    },
  });
  return toRecord(updated);
}

export async function markOriginStale(
  originId: string,
  reason?: string,
): Promise<ContentOriginRecord> {
  const updated = await prisma.infoSpotContentOrigin.update({
    where: { id: originId },
    data: {
      syncStatus: "STALE",
      lastAttemptAt: new Date(),
      syncError: reason?.slice(0, 4000) ?? "Origen obsoleto en la fuente.",
    },
  });
  return toRecord(updated);
}

/** Lista orígenes de un artículo (para UI futura / backfill). */
export async function listOriginsForArticle(articleId: string) {
  const rows = await prisma.infoSpotContentOrigin.findMany({
    where: { articleId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}
