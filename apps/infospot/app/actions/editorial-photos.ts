"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  removeEditorialPhotoUsage,
  reorderGalleryUsages,
  retryEditorialPhotoDerivative,
  selectEditorialPhoto,
} from "@/lib/editorial-photos";
import { invalidatePublicCoverageCache } from "@/lib/public-coverage/invalidate";

async function revalidateArticle(articleId?: string | null, coverageId?: string | null) {
  revalidatePath("/redaccion");
  if (articleId) {
    revalidatePath(`/redaccion/noticias/${articleId}/editar`);
    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: articleId },
      select: { slug: true },
    });
    if (article?.slug) {
      invalidatePublicCoverageCache({ articleSlug: article.slug });
    }
  }
  if (coverageId) {
    revalidatePath(`/redaccion/coberturas/${coverageId}`);
  }
  revalidatePath("/redaccion/coberturas");
}

export async function selectEditorialPhotoAction(input: {
  clfPhotoId: number;
  articleId?: string;
  coverageId?: string;
  usageType: "COVER" | "INLINE" | "GALLERY" | "FEATURED";
  sortOrder?: number;
  caption?: string;
  altText?: string;
}) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }

  const parsed = z
    .object({
      clfPhotoId: z.number().int().positive(),
      articleId: z.string().optional(),
      coverageId: z.string().optional(),
      usageType: z.enum(["COVER", "INLINE", "GALLERY", "FEATURED"]),
      sortOrder: z.number().int().min(0).max(999).optional(),
      caption: z.string().max(500).optional(),
      altText: z.string().max(300).optional(),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false as const, error: "Datos inválidos." };

  const result = await selectEditorialPhoto({
    ...parsed.data,
    selectedByUserId: access.user.id,
    processNow: true,
  });

  if (result.ok) {
    revalidateArticle(parsed.data.articleId, parsed.data.coverageId);
  }
  return result;
}

export async function removeEditorialPhotoUsageAction(usageId: string) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
    where: { id: usageId },
    select: { articleId: true, photo: { select: { coverageId: true } } },
  });
  const result = await removeEditorialPhotoUsage({ usageId });
  if (result.ok && usage) {
    revalidateArticle(usage.articleId, usage.photo.coverageId);
  }
  return result;
}

export async function retryEditorialDerivativeAction(photoId: string) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  const result = await retryEditorialPhotoDerivative(photoId);
  const photo = await prisma.infoSpotEditorialPhoto.findUnique({
    where: { id: photoId },
    select: { coverageId: true, usages: { select: { articleId: true }, take: 5 } },
  });
  if (photo) {
    for (const u of photo.usages) revalidateArticle(u.articleId, photo.coverageId);
  }
  return result;
}

export async function reorderGalleryAction(input: {
  articleId: string;
  orderedUsageIds: string[];
}) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  await reorderGalleryUsages(input);
  revalidateArticle(input.articleId, null);
  return { ok: true as const };
}

export async function reconcileEditorialCommercialAction() {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  const { reconcilePublicCoverageCommercial } = await import(
    "@/lib/public-coverage/invalidate"
  );
  const result = await reconcilePublicCoverageCommercial({ take: 80 });
  revalidatePath("/redaccion/coberturas");
  return {
    ok: result.ok,
    updated: result.photosUpdated,
    error: result.error,
  };
}

export async function authorizeEditorialPhotoLicenseAction(photoId: string) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  // Solo Director puede autorizar licencia (política conservadora).
  const { canManageInfoSpotSettings } = await import("@/lib/infospot-access");
  if (!canManageInfoSpotSettings(access.subject)) {
    return { ok: false as const, error: "Solo Dirección puede autorizar licencia editorial." };
  }
  await prisma.infoSpotEditorialPhoto.update({
    where: { id: photoId },
    data: { editorialLicenseStatus: "AUTHORIZED" },
  });
  return { ok: true as const };
}

export async function updateEditorialCoverFocalAction(input: {
  usageId: string;
  focalX: number;
  focalY: number;
}) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  const parsed = z
    .object({
      usageId: z.string().min(1),
      focalX: z.number().min(0).max(1),
      focalY: z.number().min(0).max(1),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos." };

  const { updateEditorialCoverFocal } = await import("@/lib/editorial-photos");
  const result = await updateEditorialCoverFocal(parsed.data);
  if (result.ok) {
    const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
      where: { id: parsed.data.usageId },
      select: { articleId: true, photo: { select: { coverageId: true } } },
    });
    if (usage) {
      await revalidateArticle(usage.articleId, usage.photo.coverageId);
    }
  }
  return result;
}

export async function updateEditorialPhotoUsageMetaAction(input: {
  usageId: string;
  altText?: string;
  caption?: string;
}) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false as const, error: "Sin permiso." };
  }
  const parsed = z
    .object({
      usageId: z.string().min(1),
      altText: z.string().max(300).optional(),
      caption: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos." };

  const { updateEditorialPhotoUsageMeta } = await import("@/lib/editorial-photos");
  const result = await updateEditorialPhotoUsageMeta(parsed.data);
  if (result.ok) {
    const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
      where: { id: parsed.data.usageId },
      select: { articleId: true, photo: { select: { coverageId: true } } },
    });
    if (usage) {
      await revalidateArticle(usage.articleId, usage.photo.coverageId);
    }
  }
  return result;
}

export async function retryEditorialDerivativeFormAction(formData: FormData) {
  const photoId = String(formData.get("photoId") || "");
  if (!photoId) return;
  await retryEditorialDerivativeAction(photoId);
}

export async function removeEditorialPhotoUsageFormAction(formData: FormData) {
  const usageId = String(formData.get("usageId") || "");
  if (!usageId) return;
  await removeEditorialPhotoUsageAction(usageId);
}
