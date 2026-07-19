"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { createArticleFromCoverage } from "@/lib/coverage";
import { ensureUniqueSlug } from "@/lib/articles";
import { slugifyTitle } from "@/lib/slug";
import { selectEditorialPhoto } from "@/lib/editorial-photos";
import { linkClfAlbumAction, linkClfEventAction } from "@/app/actions/clf-link";
import {
  buildDraftContentStub,
  storyTypeLabel,
  type PhotoRole,
  type StoryType,
} from "@/lib/editorial-assistant";

export type CommitAssistantResult =
  | { ok: true; articleId: string; message: string }
  | { ok: false; error: string };

type CommitPhoto = {
  clfPhotoId: number;
  albumId: number;
  coverageId?: string;
  role: PhotoRole;
  altText?: string;
};

type CommitInput = {
  intent: "event" | "coverage" | "independent" | "gallery";
  title: string;
  excerpt?: string;
  authorByline?: string;
  storyType?: StoryType | null;
  eventId?: number | null;
  coverageIds?: string[];
  photos?: CommitPhoto[];
  /** Solo selector sobre artículo existente. */
  existingArticleId?: string | null;
};

function revalidateAssistant(articleId: string) {
  revalidatePath("/redaccion");
  revalidatePath("/redaccion/asistente");
  revalidatePath(`/redaccion/noticias/${articleId}/editar`);
}

/**
 * Materializa el trabajo del asistente en un borrador real.
 * No publica ni cambia el workflow.
 */
export async function commitEditorialAssistantAction(
  input: CommitInput,
): Promise<CommitAssistantResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false, error: "No tenés permiso para crear historias." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Necesitamos un título para abrir el editor." };
  }

  const photos = input.photos ?? [];
  const coverageIds = input.coverageIds ?? [];
  const storyLabel = storyTypeLabel(input.storyType ?? null);

  // Modo: agregar material a historia existente
  if (input.existingArticleId) {
    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: input.existingArticleId },
      select: { id: true },
    });
    if (!article) return { ok: false, error: "No encontramos esa historia." };

    for (const [index, photo] of photos.entries()) {
      await selectEditorialPhoto({
        clfPhotoId: photo.clfPhotoId,
        articleId: article.id,
        coverageId: photo.coverageId,
        usageType: photo.role,
        sortOrder: index,
        altText: photo.altText?.trim() || null,
        selectedByUserId: access.user.id,
        processNow: true,
      });
    }
    revalidateAssistant(article.id);
    return {
      ok: true,
      articleId: article.id,
      message: "Material agregado a la historia",
    };
  }

  let articleId: string | null = null;

  if (coverageIds.length > 0) {
    const primaryCoverageId = coverageIds[0]!;
    const created = await createArticleFromCoverage({
      coverageId: primaryCoverageId,
      authorId: access.user.id,
    });
    if (!created.ok) return { ok: false, error: created.error };
    articleId = created.articleId;

    // Vincular coberturas adicionales
    for (const coverageId of coverageIds.slice(1)) {
      const exists = await prisma.infoSpotCoverageArticle.findUnique({
        where: {
          coverageId_articleId: { coverageId, articleId },
        },
      });
      if (!exists) {
        await prisma.infoSpotCoverageArticle.create({
          data: {
            coverageId,
            articleId,
            linkRole: "FOLLOW_UP",
            linkedByUserId: access.user.id,
          },
        });
      }
    }
  } else {
    const slug = await ensureUniqueSlug(slugifyTitle(title));
    const coveragesMeta = coverageIds.length
      ? await prisma.infoSpotCoverage.findMany({
          where: { id: { in: coverageIds } },
          select: { title: true, photographers: { select: { displayName: true } } },
        })
      : [];

    const content = buildDraftContentStub({
      storyTypeLabel: storyLabel,
      eventTitle: null,
      coverageTitles: coveragesMeta.map((c) => c.title),
      photographerNames: [
        ...new Set(coveragesMeta.flatMap((c) => c.photographers.map((p) => p.displayName))),
      ],
    });

    const article = await prisma.infoSpotArticle.create({
      data: {
        title,
        slug,
        excerpt: input.excerpt?.trim() || null,
        content,
        status: "DRAFT",
        contentTag: "REAL",
        authorId: access.user.id,
        sourceName: input.authorByline?.trim() || null,
      },
      select: { id: true },
    });
    articleId = article.id;

    if (input.eventId) {
      await linkClfEventAction(articleId, input.eventId);
    }
  }

  if (!articleId) {
    return { ok: false, error: "No se pudo crear el borrador." };
  }

  // Actualizar título / bajada / autor / contenido preparado
  const coverageRows =
    coverageIds.length > 0
      ? await prisma.infoSpotCoverage.findMany({
          where: { id: { in: coverageIds } },
          select: {
            title: true,
            eventTitle: true,
            photographers: { select: { displayName: true } },
          },
        })
      : [];

  const eventTitle =
    coverageRows.find((c) => c.eventTitle)?.eventTitle ??
    coverageRows[0]?.title ??
    null;

  const content = buildDraftContentStub({
    storyTypeLabel: storyLabel,
    eventTitle,
    coverageTitles: coverageRows.map((c) => c.title),
    photographerNames: [
      ...new Set(coverageRows.flatMap((c) => c.photographers.map((p) => p.displayName))),
    ],
  });

  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      title,
      excerpt: input.excerpt?.trim() || null,
      sourceName: input.authorByline?.trim() || null,
      content,
    },
  });

  // Álbum primario = primera cobertura
  if (coverageIds.length > 0) {
    const primary = await prisma.infoSpotCoverage.findUnique({
      where: { id: coverageIds[0]! },
      select: { clfAlbumId: true, clfEventId: true },
    });
    if (primary?.clfAlbumId) {
      await linkClfAlbumAction(articleId, primary.clfAlbumId);
    }
    if (primary?.clfEventId && !input.eventId) {
      await linkClfEventAction(articleId, primary.clfEventId);
    }
  }

  if (input.eventId) {
    await linkClfEventAction(articleId, input.eventId);
  }

  for (const [index, photo] of photos.entries()) {
    await selectEditorialPhoto({
      clfPhotoId: photo.clfPhotoId,
      articleId,
      coverageId: photo.coverageId,
      usageType: photo.role,
      sortOrder: index,
      altText: photo.altText?.trim() || null,
      selectedByUserId: access.user.id,
      processNow: true,
    });
  }

  revalidateAssistant(articleId);
  return {
    ok: true,
    articleId,
    message: "Tu historia está lista para escribir",
  };
}
