/**
 * Solicitudes durables de notificación ligadas al timeline.
 * No envía canales reales en esta etapa; permite cancelar/reprogramar al desplazar.
 */

import { prisma } from "@/lib/admin/db";

export type TimelineNotifyKind =
  | "ACCREDITATION_SOON"
  | "MARATHON_START_SOON"
  | "PROMPT_RELEASED"
  | "CAPTURE_CLOSING"
  | "UPLOAD_CLOSING"
  | "RESULTS_RELEASED";

const PENDING = "PENDING";
const CANCELLED = "CANCELLED";
const SCHEDULED = "SCHEDULED";

/**
 * Upsert de solicitud durable en metadata de audit (sin canal nuevo).
 * Si no hay tabla dedicada aún, usamos ClickatonTimelineAudit como cola de intención.
 */
export async function upsertTimelineNotificationIntent(input: {
  timelineId: string;
  kind: TimelineNotifyKind;
  scheduledFor: Date | null;
  eventId?: string;
  actorUserId?: number;
}) {
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId: input.timelineId,
      actorUserId: input.actorUserId ?? null,
      action: "NOTIFY_INTENT_UPSERT",
      payload: {
        kind: input.kind,
        status: input.scheduledFor ? SCHEDULED : PENDING,
        scheduledFor: input.scheduledFor?.toISOString() ?? null,
        eventId: input.eventId ?? null,
        channel: "NONE",
        liveSend: false,
      },
    },
  });
}

/** Cancela intents futuros al desplazar (no duplicar envíos). */
export async function cancelFutureNotificationIntents(input: {
  timelineId: string;
  actorUserId: number;
  reason: string;
}) {
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId: input.timelineId,
      actorUserId: input.actorUserId,
      action: "NOTIFY_INTENT_CANCEL_FUTURE",
      payload: {
        status: CANCELLED,
        reason: input.reason,
        liveSend: false,
      },
    },
  });
}

export async function reprogramNotificationsAfterShift(input: {
  sourceTimelineId: string;
  draftTimelineId: string;
  actorUserId: number;
  minutes: number;
  reason: string;
}) {
  await cancelFutureNotificationIntents({
    timelineId: input.sourceTimelineId,
    actorUserId: input.actorUserId,
    reason: `shift:${input.minutes}:${input.reason}`,
  });
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId: input.draftTimelineId,
      actorUserId: input.actorUserId,
      action: "NOTIFY_INTENT_REPROGRAM",
      payload: {
        fromTimelineId: input.sourceTimelineId,
        minutes: input.minutes,
        reason: input.reason,
        liveSend: false,
      },
    },
  });
}
