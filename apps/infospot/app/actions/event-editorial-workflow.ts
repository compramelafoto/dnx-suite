"use server";

import { prisma } from "@repo/db";
import {
  canEditInfoSpotEvent,
  canPublishInfoSpotEvent,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  eventPrismaDataFromPlan,
  planEventEditorialPersist,
  validateEventForPublish,
  EVENT_STATUS_LABELS,
  type EditorialAction,
  type EventStatus,
} from "@/lib/editorial/event-adapter";
import { emitEditorialNotification } from "@/lib/editorial-notifications";
import { revalidateEventPaths } from "@/lib/event-revalidate";

export type EventWorkflowResult =
  | { ok: true; message: string; status: EventStatus }
  | { ok: false; error: string };

async function loadEvent(eventId: string) {
  return prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      authorId: true,
      status: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      categoryId: true,
      coverImageUrl: true,
      organizerName: true,
      startAt: true,
      city: true,
      province: true,
      latitude: true,
      longitude: true,
      locationConfirmedAt: true,
      geocodingStatus: true,
      contentTag: true,
      publishedAt: true,
      returnedAt: true,
      submittedForReviewAt: true,
      submission: { select: { id: true, status: true } },
    },
  });
}

/**
 * Transición editorial de eventos. Reutiliza el núcleo genérico vía event-adapter.
 */
export async function runEventEditorialAction(
  eventId: string,
  action: EditorialAction,
  options?: { observation?: string },
): Promise<EventWorkflowResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotEvent(access.subject)) {
    return { ok: false, error: "No tenés permiso para editar eventos." };
  }

  const event = await loadEvent(eventId);
  if (!event) return { ok: false, error: "Evento no encontrado." };

  const from = event.status as EventStatus;
  const planned = planEventEditorialPersist(access.subject, from, action, event);
  if (!planned.ok) return { ok: false, error: planned.reason };

  const now = new Date();
  const userId = access.user.id;
  const { plan } = planned;

  if (plan.kind === "return") {
    const message = (options?.observation || "").trim();
    if (message.length < 8) {
      return {
        ok: false,
        error: "Escribí una observación clara (mínimo 8 caracteres) para devolver el evento.",
      };
    }
    await prisma.$transaction(async (tx) => {
      await tx.infoSpotEventObservation.create({
        data: {
          eventId,
          message,
          authorUserId: userId,
          type: "RETURN",
        },
      });
      await tx.infoSpotEvent.update({
        where: { id: eventId },
        data: {
          status: "DRAFT",
          returnedAt: now,
          returnedByUserId: userId,
          reviewedByUserId: userId,
          internalNotes: message,
        },
      });
      if (event.submission) {
        await tx.infoSpotEventSubmission.update({
          where: { id: event.submission.id },
          data: { status: "REJECTED", reviewedAt: now },
        });
      }
    });
    revalidateEventPaths(event.slug, eventId);
    emitEditorialNotification({
      type: "EVENT_RETURNED",
      eventId,
      actorUserId: userId,
      targetUserId: event.authorId,
      message,
    });
    return {
      ok: true,
      message: "Evento devuelto con observación.",
      status: "DRAFT",
    };
  }

  if (plan.kind === "submit_via_publish") {
    if (from !== "DRAFT") {
      return {
        ok: false,
        error: "Solo podés pedir publicación desde un borrador.",
      };
    }
    const data = eventPrismaDataFromPlan(plan, { now, userId });
    const updated = await prisma.infoSpotEvent.update({
      where: { id: eventId },
      data,
      select: { status: true, slug: true },
    });
    if (event.submission) {
      await prisma.infoSpotEventSubmission.update({
        where: { id: event.submission.id },
        data: { status: "PENDING_REVIEW", reviewedAt: null },
      });
    }
    revalidateEventPaths(updated.slug, eventId);
    emitEditorialNotification({
      type: "EVENT_SUBMITTED_FOR_REVIEW",
      eventId,
      actorUserId: userId,
      targetUserId: null,
    });
    return {
      ok: true,
      message: "Enviado a aprobación del Director. Quedó pendiente de publicación.",
      status: "IN_REVIEW",
    };
  }

  if (action === "APPROVE" || action === "PUBLISH") {
    const checklistError = validateEventForPublish(event);
    if (checklistError) {
      return {
        ok: false,
        error: `No podés ${action === "APPROVE" ? "aprobar" : "publicar"} todavía: ${checklistError}`,
      };
    }
  }

  if (action === "PUBLISH" && !canPublishInfoSpotEvent(access.subject)) {
    return { ok: false, error: "No tenés permiso para publicar." };
  }

  const data = eventPrismaDataFromPlan(plan, {
    now,
    userId,
    publishedAt: event.publishedAt,
  });

  const updated = await prisma.infoSpotEvent.update({
    where: { id: eventId },
    data,
    select: { status: true, slug: true },
  });

  if (event.submission && (action === "PUBLISH" || action === "APPROVE" || action === "SUBMIT_REVIEW")) {
    if (action === "PUBLISH") {
      await prisma.infoSpotEventSubmission.update({
        where: { id: event.submission.id },
        data: { status: "APPROVED", reviewedAt: now },
      });
    } else if (action === "SUBMIT_REVIEW") {
      await prisma.infoSpotEventSubmission.update({
        where: { id: event.submission.id },
        data: { status: "PENDING_REVIEW", reviewedAt: null },
      });
    }
  }

  revalidateEventPaths(updated.slug, eventId);

  if (action === "SUBMIT_REVIEW") {
    emitEditorialNotification({
      type: "EVENT_SUBMITTED_FOR_REVIEW",
      eventId,
      actorUserId: userId,
      targetUserId: null,
    });
  } else if (action === "APPROVE") {
    emitEditorialNotification({
      type: "EVENT_APPROVED",
      eventId,
      actorUserId: userId,
      targetUserId: event.authorId,
    });
  } else if (action === "PUBLISH") {
    emitEditorialNotification({
      type: "EVENT_PUBLISHED",
      eventId,
      actorUserId: userId,
      targetUserId: event.authorId,
    });
  } else if (action === "UNPUBLISH") {
    emitEditorialNotification({
      type: "EVENT_UNPUBLISHED",
      eventId,
      actorUserId: userId,
      targetUserId: event.authorId,
    });
  } else if (action === "ARCHIVE") {
    emitEditorialNotification({
      type: "EVENT_ARCHIVED",
      eventId,
      actorUserId: userId,
      targetUserId: event.authorId,
    });
  }

  return {
    ok: true,
    message: `Estado: ${EVENT_STATUS_LABELS[updated.status as EventStatus]}.`,
    status: updated.status as EventStatus,
  };
}

export async function submitEventForReviewAction(eventId: string) {
  return runEventEditorialAction(eventId, "SUBMIT_REVIEW");
}

export async function approveEventAction(eventId: string) {
  return runEventEditorialAction(eventId, "APPROVE");
}

export async function returnEventWithObservationAction(
  eventId: string,
  observation: string,
) {
  return runEventEditorialAction(eventId, "RETURN", { observation });
}

export async function publishEventEditorialAction(eventId: string) {
  return runEventEditorialAction(eventId, "PUBLISH");
}

export async function unpublishEventAction(eventId: string) {
  return runEventEditorialAction(eventId, "UNPUBLISH");
}

export async function archiveEventEditorialAction(eventId: string) {
  return runEventEditorialAction(eventId, "ARCHIVE");
}
