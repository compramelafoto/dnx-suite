"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import { ZONA_ARGENTINA } from "@/lib/fecha-ar";
import {
  CAPABILITY_MANAGE_TIMELINE,
  CAPABILITY_RELEASE_PROMPTS,
  hasEditionCapability,
} from "./permissions";
import {
  activateTimeline,
  ensureDraftTimeline,
  pauseTimeline,
  releaseAllPromptsForEdition,
  shiftFutureEventsAsNewVersion,
} from "./prisma-timeline";

/**
 * Zona de la edición para leer las horas que llegan de los formularios.
 *
 * Los campos `datetime-local` no llevan zona: lo que se escribe es hora de
 * pared del evento. Sin esto, el runtime de Vercel las tomaba como UTC y el
 * cronograma quedaba grabado 3 horas antes de lo cargado.
 */
async function zonaDeLaEdicion(editionId: string): Promise<string> {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { timezone: true },
  });
  return edition?.timezone ?? ZONA_ARGENTINA;
}

async function requireCapability(
  editionId: string,
  capability: string,
) {
  const user = await requireClickatonAdmin();
  const ok = await hasEditionCapability({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    editionId,
    capability,
  });
  if (!ok) throw new Error("FORBIDDEN");
  return user;
}

export async function ensureDraftTimelineAction(editionId: string) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  await ensureDraftTimeline(editionId, user.id);
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

export async function activateTimelineAction(editionId: string, timelineId: string) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  await activateTimeline(timelineId, user.id);
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

export async function updateTimelineEventAction(editionId: string, formData: FormData) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  const eventId = String(formData.get("eventId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const zona = await zonaDeLaEdicion(editionId);
  const event = await prisma.clickatonTimelineEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { timeline: true },
  });
  if (event.timeline.status !== "DRAFT") throw new Error("TIMELINE_IMMUTABLE");
  if (event.timeline.editionId !== editionId) throw new Error("EDITION_MISMATCH");

  await prisma.clickatonTimelineEvent.update({
    where: { id: eventId },
    data: {
      startsAt: parseDateTimeInput(startsAtRaw, zona),
      endsAt: parseDateTimeInput(endsAtRaw, zona),
      name: String(formData.get("name") ?? event.name),
    },
  });
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId: event.timelineId,
      actorUserId: user.id,
      action: "UPDATE_EVENT",
      payload: { eventId, startsAtRaw, endsAtRaw },
    },
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

/**
 * Guarda un tramo completo del cronograma: la barra que se arrastró.
 *
 * Una barra son dos eventos del cronograma (apertura y cierre), así que mover
 * la barra escribe los dos de una sola vez. Solo se puede sobre un cronograma
 * en borrador: el activo es inmutable, como el resto del motor.
 */
export async function updateTimelineRangeAction(editionId: string, formData: FormData) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);

  const pares: Array<{ eventId: string; startsAt: string }> = [];
  for (const [clave, valor] of formData.entries()) {
    const m = /^evento:(.+)$/.exec(clave);
    if (m?.[1]) pares.push({ eventId: m[1], startsAt: String(valor).trim() });
  }
  if (pares.length === 0) return;

  const zona = await zonaDeLaEdicion(editionId);
  const eventos = await prisma.clickatonTimelineEvent.findMany({
    where: { id: { in: pares.map((p) => p.eventId) } },
    include: { timeline: true },
  });

  for (const evento of eventos) {
    if (evento.timeline.status !== "DRAFT") throw new Error("TIMELINE_IMMUTABLE");
    if (evento.timeline.editionId !== editionId) throw new Error("EDITION_MISMATCH");
  }

  await prisma.$transaction(
    pares.map((par) =>
      prisma.clickatonTimelineEvent.update({
        where: { id: par.eventId },
        data: { startsAt: parseDateTimeInput(par.startsAt, zona) },
      }),
    ),
  );

  const timelineId = eventos[0]?.timelineId;
  if (timelineId) {
    await prisma.clickatonTimelineAudit.create({
      data: {
        timelineId,
        actorUserId: user.id,
        action: "UPDATE_RANGE",
        payload: { pares },
      },
    });
  }

  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

export async function shiftFutureEventsAction(editionId: string, formData: FormData) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  const minutes = Number(formData.get("minutes") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim() || "ajuste operativo";
  const fromEventId = String(formData.get("fromEventId") ?? "") || undefined;
  if (!Number.isFinite(minutes) || minutes === 0) throw new Error("INVALID_MINUTES");
  await shiftFutureEventsAsNewVersion({
    editionId,
    minutes,
    actorUserId: user.id,
    fromEventId,
    reason,
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

export async function pauseTimelineAction(editionId: string, timelineId: string, formData: FormData) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  await pauseTimeline(timelineId, user.id, String(formData.get("reason") ?? "pausa"));
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

/**
 * Apertura conjunta: publicar es un único acto para toda la edición.
 * No existe la publicación de una consigna suelta — se habilitan todas juntas.
 * `promptId` queda solo como referencia de auditoría (desde qué tarjeta se pulsó).
 */
export async function releasePromptAction(editionId: string, promptId: string) {
  const user = await requireCapability(editionId, CAPABILITY_RELEASE_PROMPTS);
  const releasedAt = new Date();
  const released = await releaseAllPromptsForEdition({
    editionId,
    releasedAt,
    actorUserId: user.id,
  });
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId:
        (
          await prisma.clickatonEditionTimeline.findFirst({
            where: { editionId, status: { in: ["ACTIVE", "DRAFT"] } },
            orderBy: { version: "desc" },
            select: { id: true },
          })
        )?.id ??
        (
          await ensureDraftTimeline(editionId, user.id)
        ).id,
      actorUserId: user.id,
      action: "RELEASE_ALL_PROMPTS",
      payload: { promptId, released, releasedAt: releasedAt.toISOString() },
    },
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/consignas`);
}

export async function upsertPromptAction(editionId: string, formData: FormData) {
  const user = await requireCapability(editionId, CAPABILITY_MANAGE_TIMELINE);
  const id = String(formData.get("promptId") ?? "").trim();
  const sequence = Number(formData.get("sequence") ?? 1);
  const internalName = String(formData.get("internalName") ?? "").trim() || `prompt-${sequence}`;
  const data = {
    sequence,
    internalName,
    title: String(formData.get("title") ?? "").trim() || null,
    instructions: String(formData.get("instructions") ?? "").trim() || null,
    status: (String(formData.get("status") ?? "DRAFT") as "DRAFT" | "READY" | "LOCKED") || "DRAFT",
    // Sorpresa extra: sólo el valor explícito "false" saca la consigna del puntaje.
    countsForScoring: String(formData.get("countsForScoring") ?? "true") !== "false",
    createdByUserId: user.id,
  };
  if (id) {
    await prisma.clickatonPrompt.update({ where: { id }, data });
  } else {
    await prisma.clickatonPrompt.create({
      data: { editionId, ...data, releaseMode: "SCHEDULED" },
    });
  }
  revalidatePath(`${adminRoutes.editions}/${editionId}/consignas`);
}
