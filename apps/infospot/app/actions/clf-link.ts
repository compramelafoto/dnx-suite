"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  canEditInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { importClfPhotoToArticle, type ImportUsage } from "@/lib/clf-import";
import { getClfAlbumDetail, getClfEventSummary } from "@/lib/clf-queries";

export type ClfActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function revalidateArticle(articleId: string, slug?: string | null) {
  revalidatePath("/redaccion");
  revalidatePath(`/redaccion/noticias/${articleId}/editar`);
  if (slug) {
    revalidatePath(`/noticias/${slug}`);
    revalidatePath("/");
  }
}

export async function linkClfEventAction(
  articleId: string,
  eventId: number | null,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };

  if (eventId != null) {
    const event = await getClfEventSummary(eventId);
    if (!event) return { ok: false, error: "Evento no encontrado" };
  }

  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      eventId,
      clfAlbumId: eventId == null ? null : undefined,
      eventLinkedByUserId: access.user.id,
      eventLinkedAt: new Date(),
    },
  });

  revalidateArticle(articleId, article.slug);
  return {
    ok: true,
    message: eventId == null ? "Evento desvinculado" : "Evento vinculado",
  };
}

export async function linkClfAlbumAction(
  articleId: string,
  albumId: number | null,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, eventId: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };

  if (albumId != null) {
    const album = await getClfAlbumDetail(albumId);
    if (!album) return { ok: false, error: "Álbum no encontrado" };
    if (article.eventId != null && album.eventId !== article.eventId) {
      return { ok: false, error: "El álbum no pertenece al evento vinculado" };
    }
    if (article.eventId == null && album.eventId != null) {
      await prisma.infoSpotArticle.update({
        where: { id: articleId },
        data: {
          eventId: album.eventId,
          clfAlbumId: albumId,
          eventLinkedByUserId: access.user.id,
          eventLinkedAt: new Date(),
        },
      });
      revalidateArticle(articleId, article.slug);
      return { ok: true, message: "Álbum y evento vinculados" };
    }
  }

  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      clfAlbumId: albumId,
      eventLinkedByUserId: access.user.id,
      eventLinkedAt: new Date(),
    },
  });

  revalidateArticle(articleId, article.slug);
  return {
    ok: true,
    message: albumId == null ? "Álbum desvinculado" : "Álbum vinculado",
  };
}

export async function importClfPhotosAction(input: {
  articleId: string;
  albumId: number;
  photoIds: number[];
  usageType: ImportUsage;
  captions?: Record<number, string>;
}): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: input.articleId },
    select: { id: true, slug: true, eventId: true, clfAlbumId: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };
  if (article.clfAlbumId && article.clfAlbumId !== input.albumId) {
    return { ok: false, error: "Primero vinculá este álbum a la noticia" };
  }

  if (!input.photoIds.length) {
    return { ok: false, error: "Seleccioná al menos una fotografía" };
  }

  const isDirector =
    access.subject.isSuperAdmin || access.subject.role === "INFOSPOT_DIRECTOR";

  try {
    let order = 0;
    for (const photoId of input.photoIds) {
      await importClfPhotoToArticle({
        articleId: input.articleId,
        photoId,
        expectedAlbumId: input.albumId,
        expectedEventId: article.eventId,
        usageType: input.usageType,
        sortOrder: order++,
        captionOverride: input.captions?.[photoId] ?? null,
        selectedByUserId: access.user.id,
        allowMissingPhotographer: isDirector,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al importar",
    };
  }

  revalidateArticle(input.articleId, article.slug);
  return {
    ok: true,
    message:
      input.usageType === "COVER"
        ? "Portada editorial guardada (copia permanente)"
        : "Fotografías editoriales importadas",
  };
}

export async function removeArticleAssetLinkAction(
  articleId: string,
  linkId: string,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const link = await prisma.infoSpotArticleAsset.findFirst({
    where: { id: linkId, articleId },
    select: { id: true, usageType: true, assetId: true, article: { select: { slug: true, coverImageId: true } } },
  });
  if (!link) return { ok: false, error: "Relación no encontrada" };

  await prisma.infoSpotArticleAsset.delete({ where: { id: link.id } });
  if (link.usageType === "COVER" && link.article.coverImageId === link.assetId) {
    await prisma.infoSpotArticle.update({
      where: { id: articleId },
      data: { coverImageId: null },
    });
  }

  revalidateArticle(articleId, link.article.slug);
  return { ok: true, message: "Imagen quitada de la noticia" };
}

export async function reorderArticleAssetsAction(
  articleId: string,
  orderedLinkIds: string[],
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const links = await prisma.infoSpotArticleAsset.findMany({
    where: { articleId, id: { in: orderedLinkIds } },
    select: { id: true },
  });
  if (links.length !== orderedLinkIds.length) {
    return { ok: false, error: "IDs inválidos" };
  }

  await prisma.$transaction(
    orderedLinkIds.map((id, index) =>
      prisma.infoSpotArticleAsset.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { slug: true },
  });
  revalidateArticle(articleId, article?.slug);
  return { ok: true, message: "Orden actualizado" };
}
