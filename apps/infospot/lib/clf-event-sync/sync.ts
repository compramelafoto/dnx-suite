/**
 * Sync idempotente: CLF Event → InfoSpotEvent DRAFT + ContentOrigin INBOUND.
 * Nunca publica ni cambia status editorial.
 */

import { prisma } from "@repo/db";
import { slugifyTitle } from "../slug";
import {
  linkEventToOrigin,
  markOriginFailed,
  markOriginStale,
  markOriginSynced,
} from "../content-origin";
import { isClfEventImportable } from "./import-rules";
import { normalizeClfEvent, type NormalizedClfEvent } from "./normalize";
import { getPublicClfEventForSync } from "./queries";
import type { ClfEventForSync, SyncChange, SyncClfEventResult, SyncWarning } from "./types";
import { applyInboundGeolocation, encodeGeohash } from "../geolocation";

async function ensureUniqueEventSlug(base: string, excludeId?: string): Promise<string> {
  const slug = slugifyTitle(base) || "evento";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.infoSpotEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return candidate;
    n += 1;
    if (n > 50) return `${slug}-${Date.now()}`;
  }
}

function payloadFingerprint(payload: Record<string, unknown>): string {
  const keys = [
    "startsAt",
    "endsAt",
    "city",
    "locationName",
    "latitude",
    "longitude",
    "visibility",
    "joinPolicy",
    "maxPhotographers",
    "status",
    "archivedAt",
    "shareSlug",
    "coverImageKey",
    "publicUrl",
    "activePhotographerCount",
    "availableSlots",
  ];
  const slice: Record<string, unknown> = {};
  for (const k of keys) slice[k] = payload[k] ?? null;
  return JSON.stringify(slice);
}

function detectOperationalChanges(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): SyncChange[] {
  if (!prev) return ["initial_sync"];
  const fields = [
    "startsAt",
    "endsAt",
    "city",
    "locationName",
    "latitude",
    "longitude",
    "visibility",
    "joinPolicy",
    "maxPhotographers",
    "status",
    "archivedAt",
    "shareSlug",
    "coverImageKey",
    "publicUrl",
    "activePhotographerCount",
  ] as const;
  const changes: SyncChange[] = [];
  for (const field of fields) {
    const a = prev[field] ?? null;
    const b = next[field] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push(`${field} changed`);
    }
  }
  return changes;
}

async function resolveCategoryId(
  slug: string,
  warnings: SyncWarning[],
): Promise<string | null> {
  const found = await prisma.infoSpotCategory.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (found) return found.id;

  const fallback = await prisma.infoSpotCategory.findUnique({
    where: { slug: "eventos" },
    select: { id: true },
  });
  warnings.push({
    code: "category_missing_in_db",
    message: `Categoría «${slug}» no existe en Info Spot; se usa fallback «eventos».`,
  });
  return fallback?.id ?? null;
}

type ExistingEvent = {
  id: string;
  status: string;
  title: string;
  description: string;
  summary: string | null;
  categoryId: string | null;
  coverImageUrl: string | null;
  coverImageKey: string | null;
  titleOverridden: boolean;
  descriptionOverridden: boolean;
  summaryOverridden: boolean;
  categoryOverridden: boolean;
  coverOverridden: boolean;
  locationOverridden: boolean;
  coordinatesOverridden: boolean;
  geocodingStatus: string;
  locationConfirmedAt: Date | null;
  startAt: Date;
  endAt: Date | null;
  city: string;
  province: string;
  venueName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  registrationUrl: string | null;
  sourceUrl: string | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string | null;
  organizerWebsite: string | null;
};

function buildUpdateData(
  existing: ExistingEvent,
  normalized: NormalizedClfEvent,
  categoryId: string | null,
  opts: { withdrawPublicUrl: boolean },
): { data: Record<string, unknown>; applied: SyncChange[] } {
  const data: Record<string, unknown> = {};
  const applied: SyncChange[] = [];

  // Operativos (SOURCE) — siempre actualizables salvo overrides de ubicación
  const operational: Array<[keyof ExistingEvent, unknown, string]> = [
    ["startAt", normalized.startAt, "startsAt changed"],
    ["endAt", normalized.endAt, "endsAt changed"],
    ["organizerName", normalized.organizerName, "organizerName changed"],
    ["organizerEmail", normalized.organizerEmail, "organizerEmail changed"],
    ["organizerPhone", normalized.organizerPhone, "organizerPhone changed"],
    ["organizerWebsite", normalized.organizerWebsite, "organizerWebsite changed"],
  ];

  for (const [field, next, label] of operational) {
    const prev = existing[field];
    const same =
      prev instanceof Date && next instanceof Date
        ? prev.getTime() === next.getTime()
        : prev === next;
    if (!same) {
      data[field] = next;
      applied.push(label);
    }
  }

  const geo = applyInboundGeolocation(
    {
      locationOverridden: existing.locationOverridden,
      coordinatesOverridden: existing.coordinatesOverridden,
      city: existing.city,
      province: existing.province,
      address: existing.address,
      venueName: existing.venueName,
      latitude: existing.latitude,
      longitude: existing.longitude,
      geocodingStatus: existing.geocodingStatus,
      locationConfirmedAt: existing.locationConfirmedAt,
    },
    {
      city: normalized.city,
      province: normalized.province,
      address: normalized.address,
      venueName: normalized.venueName,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      missingGeoref: normalized.missingGeoref,
    },
  );
  Object.assign(data, geo.data);
  applied.push(...geo.applied);
  for (const s of geo.skipped) {
    if (s === "clf_coords_diverged_alert") {
      applied.push("clf location diverged (override preserved)");
    }
  }

  const regUrl = opts.withdrawPublicUrl ? null : normalized.registrationUrl;
  const srcUrl = opts.withdrawPublicUrl ? null : normalized.sourceUrl;
  if (existing.registrationUrl !== regUrl) {
    data.registrationUrl = regUrl;
    applied.push(opts.withdrawPublicUrl ? "registrationUrl withdrawn" : "registrationUrl changed");
  }
  if (existing.sourceUrl !== srcUrl) {
    data.sourceUrl = srcUrl;
    applied.push(opts.withdrawPublicUrl ? "sourceUrl withdrawn" : "sourceUrl changed");
  }

  // Editoriales protegidos por flags
  if (!existing.titleOverridden && existing.title !== normalized.title) {
    data.title = normalized.title;
    applied.push("title synced (not overridden)");
  }
  if (!existing.descriptionOverridden && existing.description !== normalized.description) {
    data.description = normalized.description;
    applied.push("description synced (not overridden)");
  }
  if (!existing.summaryOverridden && existing.summary !== normalized.summary) {
    data.summary = normalized.summary;
    applied.push("summary synced (not overridden)");
  }
  if (!existing.categoryOverridden && categoryId && existing.categoryId !== categoryId) {
    data.categoryId = categoryId;
    applied.push("category synced (not overridden)");
  }
  if (!existing.coverOverridden) {
    if (existing.coverImageKey !== normalized.coverImageKey) {
      data.coverImageKey = normalized.coverImageKey;
      applied.push("coverImageKey synced (not overridden)");
    }
    if (existing.coverImageUrl !== normalized.coverImageUrl) {
      data.coverImageUrl = normalized.coverImageUrl;
      applied.push("coverImageUrl synced (not overridden)");
    }
  }

  // Nunca tocar: status, contentTag, slug, originKind, overrides
  return { data, applied };
}

async function findLinkedInfoSpotEvent(clfEventId: number): Promise<{
  originId: string;
  event: ExistingEvent | null;
  originPayload: Record<string, unknown> | null;
  syncStatus: string;
  sourceUpdatedAt: Date | null;
} | null> {
  const origin = await prisma.infoSpotContentOrigin.findFirst({
    where: {
      contentType: "EVENT",
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: String(clfEventId),
      eventId: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!origin?.eventId) return null;

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: origin.eventId },
    select: {
      id: true,
      status: true,
      title: true,
      description: true,
      summary: true,
      categoryId: true,
      coverImageUrl: true,
      coverImageKey: true,
      titleOverridden: true,
      descriptionOverridden: true,
      summaryOverridden: true,
      categoryOverridden: true,
      coverOverridden: true,
      locationOverridden: true,
      coordinatesOverridden: true,
      geocodingStatus: true,
      locationConfirmedAt: true,
      startAt: true,
      endAt: true,
      city: true,
      province: true,
      venueName: true,
      address: true,
      latitude: true,
      longitude: true,
      registrationUrl: true,
      sourceUrl: true,
      organizerName: true,
      organizerEmail: true,
      organizerPhone: true,
      organizerWebsite: true,
    },
  });

  return {
    originId: origin.id,
    event,
    originPayload: (origin.operationalPayload as Record<string, unknown> | null) ?? null,
    syncStatus: origin.syncStatus,
    sourceUpdatedAt: origin.sourceUpdatedAt,
  };
}

export async function syncClfEventToInfoSpot(
  clfEvent: ClfEventForSync,
  options?: { dryRun?: boolean },
): Promise<SyncClfEventResult> {
  const dryRun = options?.dryRun === true;
  const warnings: SyncWarning[] = [];
  const importCheck = isClfEventImportable(clfEvent);
  const linked = await findLinkedInfoSpotEvent(clfEvent.id);

  // Archivado: no crear; si existe → STALE
  if (clfEvent.archivedAt != null) {
    if (!linked?.event) {
      return {
        ok: true,
        action: "skipped",
        clfEventId: clfEvent.id,
        infoSpotEventId: null,
        originId: null,
        changes: [],
        warnings,
        dryRun,
        message: "Evento archivado en CLF; no se importa.",
      };
    }
    const normalized = normalizeClfEvent(clfEvent);
    warnings.push(...normalized.warnings);
    if (!dryRun) {
      await prisma.infoSpotEvent.update({
        where: { id: linked.event.id },
        data: {
          registrationUrl: null,
          // status editorial intacto
        },
      });
      await markOriginStale(linked.originId, "Evento archivado en ComprameLaFoto");
      await prisma.infoSpotContentOrigin.update({
        where: { id: linked.originId },
        data: {
          operationalPayload: {
            ...normalized.operationalPayload,
            recentChanges: ["archivedAt set", "origin marked STALE"],
            editorialStatusPreserved: linked.event.status,
          },
          externalUrl: null,
          sourceUpdatedAt: normalized.sourceUpdatedAt,
        },
      });
    }
    return {
      ok: true,
      action: "stale",
      clfEventId: clfEvent.id,
      infoSpotEventId: linked.event.id,
      originId: linked.originId,
      changes: ["archivedAt set", "origin marked STALE"],
      warnings,
      dryRun,
      message: "Origen marcado STALE; ficha editorial conservada.",
    };
  }

  // No público: no crear; si existe → retirar URL, sync payload
  if (!importCheck.importable) {
    if (!linked?.event) {
      return {
        ok: true,
        action: "skipped",
        clfEventId: clfEvent.id,
        infoSpotEventId: null,
        originId: null,
        changes: [],
        warnings,
        dryRun,
        message: `Omitido: ${importCheck.reason}`,
      };
    }
    const normalized = normalizeClfEvent(clfEvent);
    warnings.push(...normalized.warnings);
    const changes = detectOperationalChanges(linked.originPayload, normalized.operationalPayload);
    changes.push("public availability withdrawn");
    if (!dryRun) {
      await prisma.infoSpotEvent.update({
        where: { id: linked.event.id },
        data: {
          registrationUrl: null,
          sourceUrl: null,
        },
      });
      await markOriginSynced(linked.originId, {
        operationalPayload: {
          ...normalized.operationalPayload,
          recentChanges: changes,
          notPubliclyAvailable: true,
          editorialStatusPreserved: linked.event.status,
        },
        sourceUpdatedAt: normalized.sourceUpdatedAt,
      });
      await prisma.infoSpotContentOrigin.update({
        where: { id: linked.originId },
        data: { externalUrl: null },
      });
    }
    return {
      ok: true,
      action: "updated",
      clfEventId: clfEvent.id,
      infoSpotEventId: linked.event.id,
      originId: linked.originId,
      changes,
      warnings,
      dryRun,
      message: `Ya no es importable (${importCheck.reason}); CTA retirado; editorial intacto.`,
    };
  }

  const normalized = normalizeClfEvent(clfEvent);
  warnings.push(...normalized.warnings);

  try {
    const categoryId = await resolveCategoryId(normalized.categorySlug, warnings);

    // UPDATE path
    if (linked?.event) {
      // Prevención de loops: eco de escritura outbound reciente → solo confirmar
      const prevPayload = linked.originPayload ?? {};
      if (
        prevPayload.echoGuard === true &&
        typeof prevPayload.lastOutboundAt === "string" &&
        prevPayload.lastOutboundActor === "INFOSPOT"
      ) {
        const outboundAt = Date.parse(prevPayload.lastOutboundAt);
        if (Number.isFinite(outboundAt) && Date.now() - outboundAt < 5 * 60 * 1000) {
          if (!dryRun) {
            await markOriginSynced(linked.originId, {
              operationalPayload: {
                ...normalized.operationalPayload,
                ...prevPayload,
                recentChanges: ["outbound_echo_confirmed"],
                lastInboundConfirmAt: new Date().toISOString(),
              },
              sourceUpdatedAt: normalized.sourceUpdatedAt,
            });
          }
          return {
            ok: true,
            action: "unchanged",
            clfEventId: clfEvent.id,
            infoSpotEventId: linked.event.id,
            originId: linked.originId,
            changes: ["outbound_echo_confirmed"],
            warnings,
            dryRun,
            message: "Eco outbound confirmado; sin reaplicación.",
          };
        }
      }

      const prevFp = payloadFingerprint(linked.originPayload ?? {});
      const nextFp = payloadFingerprint(normalized.operationalPayload);
      const changes = detectOperationalChanges(
        linked.originPayload,
        normalized.operationalPayload,
      );
      const { data, applied } = buildUpdateData(linked.event, normalized, categoryId, {
        withdrawPublicUrl: false,
      });

      if (prevFp === nextFp && applied.length === 0 && linked.syncStatus === "SYNCED") {
        if (!dryRun) {
          await markOriginSynced(linked.originId, {
            operationalPayload: {
              ...normalized.operationalPayload,
              recentChanges: [],
            },
            sourceUpdatedAt: normalized.sourceUpdatedAt,
          });
        }
        return {
          ok: true,
          action: "unchanged",
          clfEventId: clfEvent.id,
          infoSpotEventId: linked.event.id,
          originId: linked.originId,
          changes: [],
          warnings,
          dryRun,
          message: "Sin cambios operativos.",
        };
      }

      if (!dryRun) {
        if (Object.keys(data).length > 0) {
          await prisma.infoSpotEvent.update({
            where: { id: linked.event.id },
            data,
          });
        }
        // Re-fetch status to prove we never changed it
        const after = await prisma.infoSpotEvent.findUnique({
          where: { id: linked.event.id },
          select: { status: true },
        });
        if (after && after.status !== linked.event.status) {
          throw new Error("BUG: sync alteró status editorial");
        }

        const link = await linkEventToOrigin(linked.event.id, {
          sourceType: "COMPRAMELAFOTO",
          externalEntityType: "EVENT",
          externalId: clfEvent.id,
          direction: "INBOUND",
          syncStatus: "SYNCED",
          externalUrl: normalized.registrationUrl,
          operationalPayload: {
            ...normalized.operationalPayload,
            recentChanges: [...changes, ...applied],
            warnings,
          },
          sourceUpdatedAt: normalized.sourceUpdatedAt,
        });
        if (!link.ok) throw new Error(link.error);
        await markOriginSynced(link.origin.id, {
          operationalPayload: {
            ...normalized.operationalPayload,
            recentChanges: [...changes, ...applied],
            warnings,
          },
          sourceUpdatedAt: normalized.sourceUpdatedAt,
        });
      }

      return {
        ok: true,
        action: "updated",
        clfEventId: clfEvent.id,
        infoSpotEventId: linked.event.id,
        originId: linked.originId,
        changes: [...changes, ...applied],
        warnings,
        dryRun,
        message: dryRun ? "Dry-run: actualizaría evento." : "Evento actualizado (operativo).",
      };
    }

    // CREATE path
    if (dryRun) {
      return {
        ok: true,
        action: "created",
        clfEventId: clfEvent.id,
        infoSpotEventId: null,
        originId: null,
        changes: ["would_create"],
        warnings,
        dryRun,
        message: "Dry-run: crearía InfoSpotEvent DRAFT.",
      };
    }

    const slug = await ensureUniqueEventSlug(slugifyTitle(normalized.title) || `clf-${clfEvent.id}`);
    const status = "DRAFT" as const;

    const created = await prisma.infoSpotEvent.create({
      data: {
        title: normalized.title,
        slug,
        summary: normalized.summary,
        description: normalized.description,
        categoryId,
        organizerName: normalized.organizerName,
        organizerEmail: normalized.organizerEmail,
        organizerPhone: normalized.organizerPhone,
        organizerWebsite: normalized.organizerWebsite,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        venueName: normalized.venueName,
        city: normalized.city,
        province: normalized.province,
        address: normalized.address,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        coverImageUrl: normalized.coverImageUrl,
        coverImageKey: normalized.coverImageKey,
        registrationUrl: normalized.registrationUrl,
        sourceUrl: normalized.sourceUrl,
        status,
        originKind: "IMPORTED",
        contentTag: "NEEDS_REVIEW",
        geocodingStatus: normalized.missingGeoref ? "NEEDS_REVIEW" : "GEOCODED",
        geocodedAt: normalized.missingGeoref ? null : new Date(),
        locationPrecision: normalized.missingGeoref ? null : "COORDINATE",
        geocodingProvider: normalized.missingGeoref ? null : "compramelafoto",
        geohash:
          !normalized.missingGeoref &&
          normalized.latitude != null &&
          normalized.longitude != null
            ? encodeGeohash(normalized.latitude, normalized.longitude)
            : null,
      },
    });

    const link = await linkEventToOrigin(created.id, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: clfEvent.id,
      direction: "INBOUND",
      syncStatus: "SYNCED",
      externalUrl: normalized.registrationUrl,
      operationalPayload: {
        ...normalized.operationalPayload,
        recentChanges: ["created"],
        warnings,
      },
      sourceUpdatedAt: normalized.sourceUpdatedAt,
    });
    if (!link.ok) {
      throw new Error(link.error);
    }
    await markOriginSynced(link.origin.id, {
      operationalPayload: {
        ...normalized.operationalPayload,
        recentChanges: ["created"],
        warnings,
      },
      sourceUpdatedAt: normalized.sourceUpdatedAt,
    });

    return {
      ok: true,
      action: "created",
      clfEventId: clfEvent.id,
      infoSpotEventId: created.id,
      originId: link.origin.id,
      changes: ["created"],
      warnings,
      dryRun,
      message: "InfoSpotEvent DRAFT creado y vinculado.",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (linked?.originId && !dryRun) {
      await markOriginFailed(linked.originId, error).catch(() => undefined);
    }
    return {
      ok: false,
      action: "failed",
      clfEventId: clfEvent.id,
      infoSpotEventId: linked?.event?.id ?? null,
      originId: linked?.originId ?? null,
      changes: [],
      warnings,
      dryRun,
      error,
    };
  }
}

export async function syncClfEventById(
  eventId: number,
  options?: { dryRun?: boolean },
): Promise<SyncClfEventResult> {
  const clfEvent = await getPublicClfEventForSync(eventId);
  if (!clfEvent) {
    return {
      ok: false,
      action: "failed",
      clfEventId: eventId,
      infoSpotEventId: null,
      originId: null,
      changes: [],
      warnings: [],
      dryRun: options?.dryRun === true,
      error: `Evento CLF ${eventId} no encontrado`,
    };
  }
  return syncClfEventToInfoSpot(clfEvent, options);
}
