"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  CAPABILITY_MANAGE_TIMELINE,
  CAPABILITY_RELEASE_PROMPTS,
  hasEditionCapability,
} from "./permissions";
import {
  activateTimeline,
  ensureDraftTimeline,
  pauseTimeline,
  releasePromptManual,
  shiftFutureEventsAsNewVersion,
} from "./prisma-timeline";

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
  const event = await prisma.clickatonTimelineEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { timeline: true },
  });
  if (event.timeline.status !== "DRAFT") throw new Error("TIMELINE_IMMUTABLE");
  if (event.timeline.editionId !== editionId) throw new Error("EDITION_MISMATCH");

  await prisma.clickatonTimelineEvent.update({
    where: { id: eventId },
    data: {
      startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
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

export async function releasePromptAction(editionId: string, promptId: string) {
  const user = await requireCapability(editionId, CAPABILITY_RELEASE_PROMPTS);
  await releasePromptManual({ promptId, actorUserId: user.id });
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
      action: "RELEASE_PROMPT",
      payload: { promptId },
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
