/**
 * Provisioning outbound InfoSpotEvent → Event CLF (idempotente).
 */

import {
  createClfEvent,
  updateClfEvent,
  closeClfEventCall,
  getClfWriteClient,
  getClfWriteConnectionInfo,
  hashOperationalSnapshot,
  prisma,
  type Prisma,
} from "@repo/db";
import { linkEventToOrigin, markOriginSynced, markOriginFailed } from "../content-origin";
import { buildClfPublicEventUrl } from "../clf-event-sync/urls";
import {
  resolveOrganizerIdentity,
  validateEventForClfProvisioning,
} from "./validate";
import { recordPhotographerCallOpenedEvent } from "../notifications/nearby-call-campaign";

export type ProvisionResult =
  | {
      ok: true;
      action: "created" | "updated" | "unchanged" | "closed" | "blocked" | "skipped";
      clfEventId: number | null;
      publicUrl: string | null;
      message: string;
      blockedReasons?: string[];
    }
  | {
      ok: false;
      action: "failed" | "blocked";
      clfEventId: number | null;
      publicUrl: string | null;
      error: string;
      blockedReasons?: string[];
    };

async function findExistingClfLink(infoSpotEventId: string) {
  return prisma.infoSpotContentOrigin.findFirst({
    where: {
      eventId: infoSpotEventId,
      contentType: "EVENT",
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
    },
    orderBy: { createdAt: "asc" },
  });
}

function buildOutboundPayload(input: {
  clfEventId: number;
  shareSlug: string;
  publicUrl: string;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  status: string;
  hash: string;
}) {
  return {
    clfEventId: input.clfEventId,
    shareSlug: input.shareSlug,
    publicUrl: input.publicUrl,
    visibility: input.visibility,
    joinPolicy: input.joinPolicy,
    maxPhotographers: input.maxPhotographers,
    status: input.status,
    initiatedBy: "INFOSPOT",
    lastOutboundAt: new Date().toISOString(),
    lastOutboundActor: "INFOSPOT",
    outboundPayloadHash: input.hash,
    echoGuard: true,
  } satisfies Record<string, unknown>;
}

export async function upsertPhotographerCallDraft(
  eventId: string,
  data: {
    enabled: boolean;
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
    joinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY";
    maxPhotographers: number | null;
    photographerTerms: string | null;
    operationalDescription: string | null;
    clfEventType: string;
    desiredClfStatus: "ACTIVE" | "CLOSED";
    organizerEmail: string | null;
    actorUserId: number;
  },
) {
  const identity = await resolveOrganizerIdentity({
    organizerEmail: data.organizerEmail,
  }).catch(() => ({
    ownershipStatus: "BLOCKED" as const,
    organizerUserId: null,
    organizerEmail: data.organizerEmail,
    provisioningBlockedReason: "No se pudo resolver organizador (escritura CLF no disponible).",
  }));

  const existing = await prisma.infoSpotPhotographerCall.findUnique({
    where: { eventId },
  });

  let provisioningStatus = existing?.provisioningStatus ?? "NOT_REQUESTED";
  if (data.enabled && provisioningStatus === "NOT_REQUESTED") {
    provisioningStatus = "PENDING";
  }
  if (!data.enabled && provisioningStatus === "PROVISIONED") {
    // no auto-close; require explicit close
  } else if (!data.enabled && provisioningStatus !== "PROVISIONED" && provisioningStatus !== "CLOSED") {
    provisioningStatus = "NOT_REQUESTED";
  }
  if (identity.ownershipStatus === "BLOCKED" && data.enabled) {
    provisioningStatus =
      existing?.provisioningStatus === "PROVISIONED" ? "PROVISIONED" : "BLOCKED";
  }

  return prisma.infoSpotPhotographerCall.upsert({
    where: { eventId },
    create: {
      eventId,
      enabled: data.enabled,
      visibility: data.visibility,
      joinPolicy: data.joinPolicy,
      maxPhotographers: data.maxPhotographers,
      photographerTerms: data.photographerTerms,
      operationalDescription: data.operationalDescription,
      clfEventType: data.clfEventType as never,
      desiredClfStatus: data.desiredClfStatus,
      organizerEmail: identity.organizerEmail,
      organizerUserId: identity.organizerUserId,
      ownershipStatus: identity.ownershipStatus,
      provisioningBlockedReason: identity.provisioningBlockedReason,
      provisioningStatus,
      requestedByUserId: data.actorUserId,
      lastModifiedByUserId: data.actorUserId,
    },
    update: {
      enabled: data.enabled,
      visibility: data.visibility,
      joinPolicy: data.joinPolicy,
      maxPhotographers: data.maxPhotographers,
      photographerTerms: data.photographerTerms,
      operationalDescription: data.operationalDescription,
      clfEventType: data.clfEventType as never,
      desiredClfStatus: data.desiredClfStatus,
      organizerEmail: identity.organizerEmail,
      organizerUserId: identity.organizerUserId,
      ownershipStatus: identity.ownershipStatus,
      provisioningBlockedReason: identity.provisioningBlockedReason,
      provisioningStatus,
      lastModifiedByUserId: data.actorUserId,
      ...(data.enabled ? {} : { closeRequested: false }),
    },
  });
}

export async function provisionClfEventFromInfoSpot(
  infoSpotEventId: string,
  actorUserId: number,
): Promise<ProvisionResult> {
  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: infoSpotEventId },
    include: { photographerCall: true, category: { select: { slug: true } } },
  });
  if (!event) return { ok: false, action: "failed", clfEventId: null, publicUrl: null, error: "Evento no encontrado." };
  if (!event.photographerCall?.enabled) {
    return {
      ok: true,
      action: "skipped",
      clfEventId: event.photographerCall?.clfEventId ?? null,
      publicUrl: event.photographerCall?.publicUrl ?? null,
      message: "Convocatoria no configurada.",
    };
  }

  const call = event.photographerCall;
  const identity = await resolveOrganizerIdentity({
    organizerEmail: call.organizerEmail ?? event.organizerEmail,
    preferredUserId: call.organizerUserId,
  });

  await prisma.infoSpotPhotographerCall.update({
    where: { id: call.id },
    data: {
      organizerEmail: identity.organizerEmail,
      organizerUserId: identity.organizerUserId,
      ownershipStatus: identity.ownershipStatus,
      provisioningBlockedReason: identity.provisioningBlockedReason,
      lastProvisionAttemptAt: new Date(),
      requestedByUserId: actorUserId,
    },
  });

  const validation = validateEventForClfProvisioning({
    event,
    call: { ...call, ownershipStatus: identity.ownershipStatus, organizerUserId: identity.organizerUserId },
    identity,
  });

  if (!validation.ok) {
    await prisma.infoSpotPhotographerCall.update({
      where: { id: call.id },
      data: {
        provisioningStatus: "BLOCKED",
        provisioningError: validation.reasons.join(" "),
        provisioningBlockedReason: validation.reasons.join(" "),
      },
    });
    return {
      ok: false,
      action: "blocked",
      clfEventId: call.clfEventId,
      publicUrl: call.publicUrl,
      error: validation.reasons.join(" "),
      blockedReasons: validation.reasons,
    };
  }

  if (!getClfWriteConnectionInfo().configured) {
    return {
      ok: false,
      action: "failed",
      clfEventId: call.clfEventId,
      publicUrl: call.publicUrl,
      error: "Escritura CLF no configurada.",
    };
  }

  const existingLink = await findExistingClfLink(infoSpotEventId);
  const clf = getClfWriteClient();

  await prisma.infoSpotPhotographerCall.update({
    where: { id: call.id },
    data: { provisioningStatus: "PROVISIONING", provisioningError: null },
  });

  try {
    // Caso C: ya importado desde CLF → nunca crear otro
    if (existingLink?.externalId) {
      const clfId = Number(existingLink.externalId);
      if (!Number.isFinite(clfId)) throw new Error("externalId CLF inválido");

      const updated = await updateClfEvent(clf, clfId, {
        title: event.title,
        description: call.operationalDescription || event.description,
        type: call.clfEventType,
        startsAt: event.startAt,
        endsAt: event.endAt,
        latitude: event.latitude!,
        longitude: event.longitude!,
        locationName: event.venueName,
        city: event.city,
        visibility: call.visibility,
        joinPolicy: call.joinPolicy,
        maxPhotographers: call.maxPhotographers,
        photographerTerms: call.photographerTerms,
        coverImageKey: event.coverOverridden ? undefined : event.coverImageKey,
        status: call.desiredClfStatus,
        creatorId: identity.organizerUserId!,
      });

      const publicUrl = buildClfPublicEventUrl(updated.shareSlug)!;
      const hash = hashOperationalSnapshot({
        visibility: updated.visibility,
        joinPolicy: updated.joinPolicy,
        maxPhotographers: updated.maxPhotographers,
        status: updated.status,
        shareSlug: updated.shareSlug,
      });
      const payload = buildOutboundPayload({
        clfEventId: updated.id,
        shareSlug: updated.shareSlug,
        publicUrl,
        visibility: updated.visibility,
        joinPolicy: updated.joinPolicy,
        maxPhotographers: updated.maxPhotographers,
        status: updated.status,
        hash,
      });

      await linkEventToOrigin(infoSpotEventId, {
        sourceType: "COMPRAMELAFOTO",
        externalEntityType: "EVENT",
        externalId: updated.id,
        direction: "BIDIRECTIONAL",
        syncStatus: "SYNCED",
        externalUrl: publicUrl,
        operationalPayload: payload,
        sourceUpdatedAt: updated.updatedAt,
      });
      if (existingLink.direction === "INBOUND") {
        await prisma.infoSpotContentOrigin.update({
          where: { id: existingLink.id },
          data: { direction: "BIDIRECTIONAL" },
        });
      }

      await prisma.infoSpotEvent.update({
        where: { id: infoSpotEventId },
        data: { registrationUrl: publicUrl, sourceUrl: publicUrl },
      });
      await prisma.infoSpotPhotographerCall.update({
        where: { id: call.id },
        data: {
          provisioningStatus: "PROVISIONED",
          provisionedAt: call.provisionedAt ?? new Date(),
          clfEventId: updated.id,
          publicUrl,
          provisioningError: null,
        },
      });

      await recordPhotographerCallOpenedEvent({
        callId: call.id,
        previousProvisioningStatus: call.provisioningStatus,
        nextProvisioningStatus: "PROVISIONED",
        enabled: call.enabled,
        visibility: call.visibility,
        joinPolicy: call.joinPolicy,
        desiredClfStatus: call.desiredClfStatus,
        clfEventId: updated.id,
        maxPhotographers: call.maxPhotographers,
        payload: { publicUrl, infoSpotEventId },
      }).catch(() => undefined);

      return {
        ok: true,
        action: "updated",
        clfEventId: updated.id,
        publicUrl,
        message: "Convocatoria actualizada sobre el Event CLF existente.",
      };
    }

    // Create new
    const created = await createClfEvent(clf, {
      title: event.title,
      description: call.operationalDescription || event.description,
      type: call.clfEventType,
      startsAt: event.startAt,
      endsAt: event.endAt,
      latitude: event.latitude!,
      longitude: event.longitude!,
      locationName: event.venueName,
      city: event.city,
      visibility: call.visibility,
      joinPolicy: call.joinPolicy,
      maxPhotographers: call.maxPhotographers,
      photographerTerms: call.photographerTerms,
      coverImageKey: event.coverImageKey,
      status: call.desiredClfStatus,
      creatorId: identity.organizerUserId!,
    });

    const publicUrl = buildClfPublicEventUrl(created.shareSlug)!;
    const hash = hashOperationalSnapshot({
      visibility: created.visibility,
      joinPolicy: created.joinPolicy,
      maxPhotographers: created.maxPhotographers,
      status: created.status,
      shareSlug: created.shareSlug,
    });
    const payload = buildOutboundPayload({
      clfEventId: created.id,
      shareSlug: created.shareSlug,
      publicUrl,
      visibility: created.visibility,
      joinPolicy: created.joinPolicy,
      maxPhotographers: created.maxPhotographers,
      status: created.status,
      hash,
    });

    const link = await linkEventToOrigin(infoSpotEventId, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: created.id,
      direction: "BIDIRECTIONAL",
      syncStatus: "SYNCED",
      externalUrl: publicUrl,
      operationalPayload: payload,
      sourceUpdatedAt: created.updatedAt,
    });
    if (!link.ok) throw new Error(link.error);
    await markOriginSynced(link.origin.id, {
      operationalPayload: payload as Prisma.InputJsonValue as never,
      sourceUpdatedAt: created.updatedAt,
    });

    await prisma.infoSpotEvent.update({
      where: { id: infoSpotEventId },
      data: { registrationUrl: publicUrl, sourceUrl: publicUrl },
    });
    await prisma.infoSpotPhotographerCall.update({
      where: { id: call.id },
      data: {
        provisioningStatus: "PROVISIONED",
        provisionedAt: new Date(),
        clfEventId: created.id,
        publicUrl,
        provisioningError: null,
      },
    });

    await recordPhotographerCallOpenedEvent({
      callId: call.id,
      previousProvisioningStatus: call.provisioningStatus,
      nextProvisioningStatus: "PROVISIONED",
      enabled: call.enabled,
      visibility: call.visibility,
      joinPolicy: call.joinPolicy,
      desiredClfStatus: call.desiredClfStatus,
      clfEventId: created.id,
      maxPhotographers: call.maxPhotographers,
      payload: { publicUrl, infoSpotEventId },
    }).catch(() => undefined);

    return {
      ok: true,
      action: "created",
      clfEventId: created.id,
      publicUrl,
      message: "Convocatoria creada en ComprameLaFoto.",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.infoSpotPhotographerCall.update({
      where: { id: call.id },
      data: { provisioningStatus: "FAILED", provisioningError: error.slice(0, 4000) },
    });
    const link = await findExistingClfLink(infoSpotEventId);
    if (link) await markOriginFailed(link.id, error).catch(() => undefined);
    return {
      ok: false,
      action: "failed",
      clfEventId: call.clfEventId,
      publicUrl: call.publicUrl,
      error,
    };
  }
}

export async function updateProvisionedClfEvent(
  infoSpotEventId: string,
  actorUserId: number,
): Promise<ProvisionResult> {
  return provisionClfEventFromInfoSpot(infoSpotEventId, actorUserId);
}

export async function closeClfPhotographerCall(
  infoSpotEventId: string,
  actorUserId: number,
): Promise<ProvisionResult> {
  const call = await prisma.infoSpotPhotographerCall.findUnique({
    where: { eventId: infoSpotEventId },
  });
  if (!call?.clfEventId) {
    return {
      ok: false,
      action: "failed",
      clfEventId: null,
      publicUrl: null,
      error: "No hay Event CLF provisionado para cerrar.",
    };
  }
  if (!getClfWriteConnectionInfo().configured) {
    return {
      ok: false,
      action: "failed",
      clfEventId: call.clfEventId,
      publicUrl: call.publicUrl,
      error: "Escritura CLF no configurada.",
    };
  }

  try {
    const clf = getClfWriteClient();
    const closed = await closeClfEventCall(clf, call.clfEventId);
    const publicUrl = buildClfPublicEventUrl(closed.shareSlug);
    const hash = hashOperationalSnapshot({
      status: closed.status,
      shareSlug: closed.shareSlug,
      closed: true,
    });
    const payload = buildOutboundPayload({
      clfEventId: closed.id,
      shareSlug: closed.shareSlug,
      publicUrl: publicUrl ?? call.publicUrl ?? "",
      visibility: closed.visibility,
      joinPolicy: closed.joinPolicy,
      maxPhotographers: closed.maxPhotographers,
      status: closed.status,
      hash,
    });

    await linkEventToOrigin(infoSpotEventId, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: closed.id,
      direction: "BIDIRECTIONAL",
      syncStatus: "SYNCED",
      externalUrl: publicUrl,
      operationalPayload: { ...payload, closedAt: new Date().toISOString() },
      sourceUpdatedAt: closed.updatedAt,
    });

    await prisma.infoSpotPhotographerCall.update({
      where: { id: call.id },
      data: {
        provisioningStatus: "CLOSED",
        closedAt: new Date(),
        closeRequested: true,
        enabled: false,
        desiredClfStatus: "CLOSED",
        lastModifiedByUserId: actorUserId,
        publicUrl,
      },
    });

    return {
      ok: true,
      action: "closed",
      clfEventId: closed.id,
      publicUrl,
      message: "Convocatoria cerrada en CLF (Event conservado).",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.infoSpotPhotographerCall.update({
      where: { id: call.id },
      data: { provisioningStatus: "FAILED", provisioningError: error.slice(0, 4000) },
    });
    return {
      ok: false,
      action: "failed",
      clfEventId: call.clfEventId,
      publicUrl: call.publicUrl,
      error,
    };
  }
}
