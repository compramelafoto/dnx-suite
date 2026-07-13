"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  canEditInfoSpotArticle,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { validateForPublish } from "@/lib/article-validation";
import {
  articlePrismaDataFromPlan,
  planArticleEditorialPersist,
  STATUS_LABELS,
  type ArticleStatus,
  type EditorialAction,
} from "@/lib/editorial/article-adapter";
import { emitEditorialNotification } from "@/lib/editorial-notifications";

export type WorkflowResult =
  | { ok: true; message: string; status: ArticleStatus }
  | { ok: false; error: string };

function revalidateArticle(slug?: string, articleId?: string) {
  revalidatePath("/redaccion");
  revalidatePath("/admin/aprobaciones");
  revalidatePath("/");
  revalidatePath("/noticias");
  if (slug) revalidatePath(`/noticias/${slug}`);
  if (articleId) {
    revalidatePath(`/redaccion/noticias/${articleId}/editar`);
    revalidatePath(`/redaccion/noticias/${articleId}/preview`);
  }
}

async function loadArticle(articleId: string) {
  return prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      authorId: true,
      status: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      categoryId: true,
      coverImageId: true,
      contentTag: true,
      sourceName: true,
      sourceUrl: true,
      seoTitle: true,
      seoDescription: true,
      factCheckedAt: true,
      publishedAt: true,
      returnedAt: true,
      submittedForReviewAt: true,
      coverImage: { select: { credit: true } },
    },
  });
}

async function assertPublishChecklist(
  article: NonNullable<Awaited<ReturnType<typeof loadArticle>>>,
): Promise<string | null> {
  const errors = validateForPublish({
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    content: article.content,
    categoryId: article.categoryId,
    coverImageId: article.coverImageId,
    contentTag: article.contentTag ?? "REAL",
    sourceName: article.sourceName ?? undefined,
    sourceUrl: article.sourceUrl ?? undefined,
    seoTitle: article.seoTitle ?? undefined,
    seoDescription: article.seoDescription ?? undefined,
    status: "PUBLISHED",
  });
  if (article.coverImageId) {
    const credit = article.coverImage?.credit?.trim();
    if (!credit) {
      errors.push("La portada necesita crédito fotográfico antes de publicar.");
    }
  }

  const { assertEditorialPhotosPublishable } = await import("@/lib/editorial-photos/checklist");
  const usages = await prisma.infoSpotEditorialPhotoUsage.findMany({
    where: { articleId: article.id },
    include: {
      photo: {
        include: { variants: { take: 1 } },
      },
    },
  });
  if (usages.length > 0) {
    const photoCheck = assertEditorialPhotosPublishable(
      usages.map((u) => ({
        processStatus: u.photo.processStatus,
        photographerName: u.photo.photographerName,
        credit: u.photo.credit,
        editorialLicenseStatus: u.photo.editorialLicenseStatus,
        hasDerivative: Boolean(u.photo.editorialMasterKey || u.photo.variants.length > 0),
        commercialStatus: u.photo.commercialStatus,
        usageType: u.usageType,
        altText: u.altText,
      })),
    );
    if (!photoCheck.ok) errors.push(photoCheck.error);
  }

  return errors.length ? errors.join(" ") : null;
}

/**
 * Transición editorial explícita. El cliente envía `action`, nunca un status arbitrario.
 * Reglas de transición: núcleo genérico vía adaptador Article.
 * Persistencia / observaciones / notificaciones: específicas de Article.
 */
export async function runEditorialAction(
  articleId: string,
  action: EditorialAction,
  options?: { observation?: string },
): Promise<WorkflowResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "No tenés permiso para editar noticias." };
  }

  const article = await loadArticle(articleId);
  if (!article) return { ok: false, error: "Noticia no encontrada." };

  const from = article.status as ArticleStatus;
  const planned = planArticleEditorialPersist(access.subject, from, action, article);
  if (!planned.ok) return { ok: false, error: planned.reason };

  const now = new Date();
  const userId = access.user.id;
  const { plan } = planned;

  if (plan.kind === "return") {
    const message = (options?.observation || "").trim();
    if (message.length < 8) {
      return {
        ok: false,
        error: "Escribí una observación clara (mínimo 8 caracteres) para devolver la nota.",
      };
    }
    await prisma.$transaction(async (tx) => {
      await tx.infoSpotArticleObservation.create({
        data: {
          articleId,
          message,
          authorUserId: userId,
          type: "RETURN",
        },
      });
      await tx.infoSpotArticle.update({
        where: { id: articleId },
        data: {
          status: "DRAFT",
          returnedAt: now,
          returnedByUserId: userId,
        },
      });
    });
    revalidateArticle(article.slug, articleId);
    emitEditorialNotification({
      type: "ARTICLE_RETURNED",
      articleId,
      actorUserId: userId,
      targetUserId: article.authorId,
      message,
    });
    return {
      ok: true,
      message: "Nota devuelta con observación.",
      status: "DRAFT",
    };
  }

  if (plan.kind === "submit_via_publish") {
    // Quien no puede publicar: "Publicar" = enviar a aprobación del Director.
    if (from !== "DRAFT") {
      return {
        ok: false,
        error: "Solo podés pedir publicación desde un borrador.",
      };
    }
    const data = articlePrismaDataFromPlan(plan, { now, userId });
    const updated = await prisma.infoSpotArticle.update({
      where: { id: articleId },
      data,
      select: { status: true, slug: true },
    });
    revalidateArticle(updated.slug, articleId);
    emitEditorialNotification({
      type: "ARTICLE_SUBMITTED_FOR_REVIEW",
      articleId,
      actorUserId: userId,
      targetUserId: null,
    });
    return {
      ok: true,
      message: "Enviada a aprobación del Director. Quedó pendiente de publicación.",
      status: "IN_REVIEW",
    };
  }

  // APPROVE / PUBLISH directo: checklist de publicación.
  if (action === "APPROVE" || action === "PUBLISH") {
    const checklistError = await assertPublishChecklist(article);
    if (checklistError) {
      return {
        ok: false,
        error: `No podés publicar todavía: ${checklistError}`,
      };
    }
  }

  if (
    (action === "PUBLISH" || action === "APPROVE") &&
    !canPublishInfoSpotArticle(access.subject)
  ) {
    return { ok: false, error: "No tenés permiso para publicar." };
  }

  const data = articlePrismaDataFromPlan(plan, {
    now,
    userId,
    publishedAt: article.publishedAt,
  });

  const updated = await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data,
    select: { status: true, slug: true },
  });

  revalidateArticle(updated.slug, articleId);

  if (action === "SUBMIT_REVIEW") {
    emitEditorialNotification({
      type: "ARTICLE_SUBMITTED_FOR_REVIEW",
      articleId,
      actorUserId: userId,
      targetUserId: null,
    });
  } else if (action === "APPROVE") {
    emitEditorialNotification({
      type: "ARTICLE_APPROVED",
      articleId,
      actorUserId: userId,
      targetUserId: article.authorId,
    });
  } else if (action === "PUBLISH") {
    emitEditorialNotification({
      type: "ARTICLE_PUBLISHED",
      articleId,
      actorUserId: userId,
      targetUserId: article.authorId,
    });
  } else if (action === "UNPUBLISH") {
    emitEditorialNotification({
      type: "ARTICLE_UNPUBLISHED",
      articleId,
      actorUserId: userId,
      targetUserId: article.authorId,
    });
  }

  return {
    ok: true,
    message: `Estado: ${STATUS_LABELS[updated.status as ArticleStatus]}.`,
    status: updated.status as ArticleStatus,
  };
}

/** Compat: publicar/despublicar/archivar desde menú legacy mapeado a acciones. */
export async function transitionArticleStatusAction(
  articleId: string,
  toStatus: ArticleStatus,
): Promise<WorkflowResult> {
  const map: Partial<Record<ArticleStatus, EditorialAction>> = {
    PUBLISHED: "PUBLISH",
    UNPUBLISHED: "UNPUBLISH",
    ARCHIVED: "ARCHIVE",
    IN_REVIEW: "SUBMIT_REVIEW",
    READY_TO_PUBLISH: "APPROVE",
    DRAFT: "RETURN",
  };
  const action = map[toStatus];
  if (!action) {
    return { ok: false, error: "Transición no permitida desde el cliente." };
  }
  if (action === "RETURN") {
    return {
      ok: false,
      error: "Para devolver una nota usá la acción con observación.",
    };
  }
  return runEditorialAction(articleId, action);
}

export async function submitArticleForReviewAction(articleId: string): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "SUBMIT_REVIEW");
}

export async function approveArticleAction(articleId: string): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "APPROVE");
}

export async function returnArticleWithObservationAction(
  articleId: string,
  observation: string,
): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "RETURN", { observation });
}

export async function publishArticleAction(articleId: string): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "PUBLISH");
}

export async function unpublishArticleAction(articleId: string): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "UNPUBLISH");
}

export async function archiveArticleAction(articleId: string): Promise<WorkflowResult> {
  return runEditorialAction(articleId, "ARCHIVE");
}
