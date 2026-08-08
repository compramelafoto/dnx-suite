"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  CAPABILITY_MANAGE_TIMELINE,
  hasEditionCapability,
} from "@/lib/timeline/permissions";

function parseDt(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Guarda SoT temporal de edición y densormaliza a prompts
 * (mismas ventanas en todas — reveal global).
 */
export async function saveEditionScheduleAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const ok = await hasEditionCapability({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    editionId,
    capability: CAPABILITY_MANAGE_TIMELINE,
  });
  if (!ok) throw new Error("FORBIDDEN");

  const eventRevealAt = parseDt(formData.get("eventRevealAt"));
  const captureWindowStartsAt = parseDt(formData.get("captureWindowStartsAt"));
  const captureWindowEndsAt = parseDt(formData.get("captureWindowEndsAt"));
  const uploadWindowStartsAt = parseDt(formData.get("uploadWindowStartsAt"));
  const uploadWindowEndsAt = parseDt(formData.get("uploadWindowEndsAt"));
  const allowReplacement = String(formData.get("allowReplacement") ?? "1") === "1";
  const globalPromptReveal = String(formData.get("globalPromptReveal") ?? "1") === "1";

  if (
    captureWindowStartsAt &&
    captureWindowEndsAt &&
    captureWindowEndsAt.getTime() <= captureWindowStartsAt.getTime()
  ) {
    throw new Error("CAPTURE_WINDOW_INVALID");
  }
  if (
    uploadWindowStartsAt &&
    uploadWindowEndsAt &&
    uploadWindowEndsAt.getTime() <= uploadWindowStartsAt.getTime()
  ) {
    throw new Error("UPLOAD_WINDOW_INVALID");
  }

  await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId },
    create: {
      editionId,
      uploadsEnabled: false,
      globalPromptReveal,
      eventRevealAt,
      captureWindowStartsAt,
      captureWindowEndsAt,
      uploadWindowStartsAt,
      uploadWindowEndsAt,
      allowReplacement,
    },
    update: {
      globalPromptReveal,
      eventRevealAt,
      captureWindowStartsAt,
      captureWindowEndsAt,
      uploadWindowStartsAt,
      uploadWindowEndsAt,
      allowReplacement,
    },
  });

  // Densormalizar ventanas idénticas a todas las consignas (reveal global).
  await prisma.clickatonPrompt.updateMany({
    where: { editionId, status: { not: "CANCELLED" } },
    data: {
      captureStartsAt: captureWindowStartsAt,
      captureEndsAt: captureWindowEndsAt,
      uploadStartsAt: uploadWindowStartsAt,
      uploadEndsAt: uploadWindowEndsAt,
      allowReplacement,
      replacementDeadline: uploadWindowEndsAt,
    },
  });

  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/consignas`);
}

/** Liberar TODAS las consignas a la vez (reveal global). */
export async function releaseAllPromptsAction(editionId: string) {
  const user = await requireClickatonAdmin();
  const ok = await hasEditionCapability({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    editionId,
    capability: CAPABILITY_MANAGE_TIMELINE,
  });
  if (!ok) throw new Error("FORBIDDEN");

  const now = new Date();
  await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId },
    create: {
      editionId,
      globalPromptReveal: true,
      eventRevealAt: now,
      uploadsEnabled: true,
    },
    update: {
      globalPromptReveal: true,
      eventRevealAt: now,
    },
  });

  await prisma.clickatonPrompt.updateMany({
    where: {
      editionId,
      status: { in: ["DRAFT", "READY", "LOCKED"] },
    },
    data: {
      status: "RELEASED",
      releasedAt: now,
      releasedByUserId: user.id,
    },
  });

  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/consignas`);
}

export type PreEventReadyItem = {
  key: string;
  label: string;
  ok: boolean;
};

export async function getPreEventReadyChecklist(editionId: string): Promise<{
  ready: boolean;
  items: PreEventReadyItem[];
}> {
  const [edition, prompts, config] = await Promise.all([
    prisma.clickatonEdition.findUnique({
      where: { id: editionId },
      select: { fotorankContestId: true, timezone: true },
    }),
    prisma.clickatonPrompt.findMany({
      where: { editionId, status: { not: "CANCELLED" } },
      select: { id: true, title: true, sequence: true },
      orderBy: { sequence: "asc" },
    }),
    prisma.clickatonEditionUploadConfig.findUnique({ where: { editionId } }),
  ]);

  const items: PreEventReadyItem[] = [
    {
      key: "prompts_10",
      label: "10 consignas cargadas",
      ok: prompts.length >= 10 && prompts.every((p) => Boolean(p.title?.trim())),
    },
    {
      key: "reveal",
      label: "Reveal global configurado",
      ok: Boolean(config?.eventRevealAt),
    },
    {
      key: "capture",
      label: "Ventana de captura configurada",
      ok: Boolean(config?.captureWindowStartsAt && config?.captureWindowEndsAt),
    },
    {
      key: "upload",
      label: "Ventana de carga configurada",
      ok: Boolean(config?.uploadWindowStartsAt && config?.uploadWindowEndsAt),
    },
    {
      key: "replacement",
      label: "Política de reemplazo definida",
      ok: config?.allowReplacement != null,
    },
    {
      key: "fotorank",
      label: "FotoRank vinculado",
      ok: Boolean(edition?.fotorankContestId),
    },
    {
      key: "timezone",
      label: "Timezone configurada",
      ok: Boolean(edition?.timezone),
    },
  ];

  return { ready: items.every((i) => i.ok), items };
}
