"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@repo/db";
import {
  canManageInfoSpotDistribution,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

const placementSchema = z.object({
  placementType: z.enum(["HERO", "FEATURED_EVENT"]),
  articleId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  customTitle: z.string().trim().max(200).optional().nullable(),
  customSubtitle: z.string().trim().max(400).optional().nullable(),
  customImageUrl: z.string().trim().max(800).optional().nullable(),
});

function revalidateHome() {
  revalidatePath("/");
  revalidatePath("/redaccion/distribucion");
  revalidateTag("infospot-home", "max");
  revalidateTag("infospot-home-core", "max");
  revalidateTag("infospot-home-calls", "max");
}

export async function upsertHomepagePlacementAction(
  input: z.infer<typeof placementSchema> & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotDistribution(access.subject)) {
    return { ok: false, error: "Sin permiso para administrar la portada." };
  }

  const parsed = placementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const articleId = parsed.data.articleId || null;
  const eventId = parsed.data.eventId || null;
  if ((articleId && eventId) || (!articleId && !eventId)) {
    return { ok: false, error: "Elegí exactamente un artículo o un evento." };
  }

  if (articleId) {
    const a = await prisma.infoSpotArticle.findUnique({
      where: { id: articleId },
      select: { status: true, contentTag: true },
    });
    if (!a || a.status !== "PUBLISHED") {
      return { ok: false, error: "El artículo debe estar PUBLISHED + REAL." };
    }
  }
  if (eventId) {
    const e = await prisma.infoSpotEvent.findUnique({
      where: { id: eventId },
      select: { status: true, contentTag: true },
    });
    if (!e || e.status !== "PUBLISHED") {
      return { ok: false, error: "El evento debe estar PUBLISHED + REAL." };
    }
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

  const data = {
    placementType: parsed.data.placementType,
    articleId,
    eventId,
    sortOrder: parsed.data.sortOrder,
    priority: parsed.data.priority,
    startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
    isActive: parsed.data.isActive,
    customTitle: parsed.data.customTitle || null,
    customSubtitle: parsed.data.customSubtitle || null,
    customImageUrl: parsed.data.customImageUrl || null,
    updatedByUserId: access.user.id,
  };

  const row = input.id
    ? await prisma.infoSpotHomepagePlacement.update({
        where: { id: input.id },
        data,
      })
    : await prisma.infoSpotHomepagePlacement.create({
        data: {
          ...data,
          createdByUserId: access.user.id,
        },
      });

  revalidateHome();
  return { ok: true, id: row.id };
}

export async function deactivateHomepagePlacementAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotDistribution(access.subject)) {
    return { ok: false, error: "Sin permiso." };
  }
  await prisma.infoSpotHomepagePlacement.update({
    where: { id },
    data: { isActive: false, updatedByUserId: access.user.id },
  });
  revalidateHome();
  return { ok: true };
}

export async function updateEventDistributionFlagsAction(input: {
  eventId: string;
  editorialPriority?: number;
  excludeFromHomepage?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotDistribution(access.subject)) {
    return { ok: false, error: "Sin permiso." };
  }
  const priority = input.editorialPriority;
  if (priority != null && (priority < 0 || priority > 100)) {
    return { ok: false, error: "Prioridad debe estar entre 0 y 100." };
  }
  await prisma.infoSpotEvent.update({
    where: { id: input.eventId },
    data: {
      ...(priority != null ? { editorialPriority: Math.trunc(priority) } : {}),
      ...(input.excludeFromHomepage != null
        ? { excludeFromHomepage: input.excludeFromHomepage }
        : {}),
    },
  });
  revalidateHome();
  return { ok: true };
}
