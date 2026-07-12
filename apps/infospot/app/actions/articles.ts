"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  canEditInfoSpotArticle,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
  type InfoSpotAccessContext,
} from "@/lib/infospot-access";
import { articleDraftSchema, formatFieldErrors, validateForPublish } from "@/lib/article-validation";
import { canTransitionStatus, type ArticleStatus } from "@/lib/article-status";
import { ensureUniqueSlug } from "@/lib/articles";
import { slugifyTitle } from "@/lib/slug";

export type ActionResult =
  | { ok: true; id?: string; message: string; updatedAt?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function revalidatePublic(slug?: string) {
  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath("/redaccion");
  if (slug) revalidatePath(`/noticias/${slug}`);
  revalidatePath("/categorias", "layout");
}

async function assertCanMutateArticle(
  access: InfoSpotAccessContext,
  article: { authorId: number } | null,
): Promise<ActionResult | null> {
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "No tenés permiso para editar noticias." };
  }
  // Política actual (@repo/db): DIRECTOR y REDACTOR pueden editar todas las noticias.
  // No se restringe por authorId. Documentado en README.
  void article;
  return null;
}

function parsePublishedAt(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createArticleAction(formData: FormData): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    return { ok: false, error: "No tenés permiso para crear noticias." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = articleDraftSchema.safeParse({
    ...raw,
    status: raw.status || "DRAFT",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos del formulario.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  // Crear solo como borrador; publicar/revisar es vía flujo editorial.
  if (data.status !== "DRAFT") {
    return {
      ok: false,
      error: "Al crear, guardá como borrador. Después usá el flujo editorial para revisar o publicar.",
    };
  }

  const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title));
  const publishedAt = parsePublishedAt(data.publishedAt);

  const article = await prisma.infoSpotArticle.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || "",
      categoryId: data.categoryId,
      coverImageId: data.coverImageId,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: "DRAFT",
      publishedAt,
      authorId: access.user.id,
    },
  });

  if (data.coverImageId) {
    await prisma.infoSpotEditorialAsset.update({
      where: { id: data.coverImageId },
      data: {
        isPermanentEditorialAsset: true,
        ...(typeof formData.get("coverCredit") === "string" &&
        String(formData.get("coverCredit")).trim()
          ? { credit: String(formData.get("coverCredit")).trim() }
          : {}),
      },
    });
  }

  revalidatePublic(article.slug);
  return {
    ok: true,
    id: article.id,
    message: "Borrador guardado",
  };
}

export async function updateArticleAction(
  articleId: string,
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  const existing = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      authorId: true,
      status: true,
      slug: true,
      publishedAt: true,
      coverImageId: true,
    },
  });
  if (!existing) return { ok: false, error: "Noticia no encontrada." };

  const denied = await assertCanMutateArticle(access, existing);
  if (denied) return denied;

  const raw = Object.fromEntries(formData.entries());
  const parsed = articleDraftSchema.safeParse({
    ...raw,
    status: raw.status || existing.status,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos del formulario.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const requestedStatus = data.status as ArticleStatus;
  const currentStatus = existing.status as ArticleStatus;

  // El formulario no puede saltar a IN_REVIEW / READY_TO_PUBLISH (solo acciones editoriales).
  if (
    requestedStatus !== currentStatus &&
    (requestedStatus === "IN_REVIEW" || requestedStatus === "READY_TO_PUBLISH")
  ) {
    return {
      ok: false,
      error: "Usá las acciones editoriales para enviar a revisión o aprobar.",
    };
  }

  // Conservar estado de workflow al guardar contenido.
  let nextStatus = requestedStatus;
  if (
    (currentStatus === "IN_REVIEW" ||
      currentStatus === "READY_TO_PUBLISH" ||
      currentStatus === "PUBLISHED" ||
      currentStatus === "UNPUBLISHED" ||
      currentStatus === "ARCHIVED") &&
    requestedStatus === "DRAFT"
  ) {
    nextStatus = currentStatus;
  }

  if (nextStatus !== currentStatus && !canTransitionStatus(currentStatus, nextStatus)) {
    return {
      ok: false,
      error: `No se puede pasar de ${currentStatus} a ${nextStatus} desde el formulario. Usá las acciones editoriales.`,
    };
  }

  if (nextStatus === "PUBLISHED") {
    if (!canPublishInfoSpotArticle(access.subject)) {
      return { ok: false, error: "No tenés permiso para publicar." };
    }
    const publishErrors = validateForPublish(data);
    if (publishErrors.length) {
      return { ok: false, error: publishErrors.join(" ") };
    }
    if (data.coverImageId) {
      const cover = await prisma.infoSpotEditorialAsset.findUnique({
        where: { id: data.coverImageId },
        select: { credit: true },
      });
      const credit = data.coverCredit?.trim() || cover?.credit?.trim();
      if (!credit) {
        return {
          ok: false,
          error: "La portada necesita crédito fotográfico antes de publicar.",
        };
      }
    }
  }

  const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title), articleId);
  let publishedAt = parsePublishedAt(data.publishedAt) ?? existing.publishedAt;
  if (nextStatus === "PUBLISHED" && !publishedAt) {
    publishedAt = new Date();
  }
  // Al despublicar se conserva publishedAt histórico.

  const article = await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || "",
      categoryId: data.categoryId,
      coverImageId: data.coverImageId,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: nextStatus,
      publishedAt,
      ...(nextStatus === "PUBLISHED" && data.markFactChecked
        ? { factCheckedAt: new Date(), factCheckedByUserId: access.user.id }
        : {}),
    },
  });

  if (data.coverImageId) {
    await prisma.infoSpotEditorialAsset.update({
      where: { id: data.coverImageId },
      data: {
        isPermanentEditorialAsset: true,
        ...(data.coverCredit?.trim() ? { credit: data.coverCredit.trim() } : {}),
      },
    });
  }

  revalidatePublic(article.slug);
  if (existing.slug !== article.slug) revalidatePublic(existing.slug);

  return {
    ok: true,
    id: article.id,
    message:
      nextStatus === "PUBLISHED"
        ? "Noticia publicada"
        : nextStatus === "UNPUBLISHED"
          ? "Noticia despublicada"
          : "Borrador guardado",
    updatedAt: article.updatedAt.toISOString(),
  };
}

/**
 * Autosave de borrador: no publica, respeta expectedUpdatedAt para evitar
 * sobrescribir una versión más nueva.
 */
export async function autosaveArticleDraftAction(
  articleId: string,
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  const existing = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      authorId: true,
      status: true,
      slug: true,
      publishedAt: true,
      coverImageId: true,
      updatedAt: true,
    },
  });
  if (!existing) return { ok: false, error: "Noticia no encontrada." };

  const denied = await assertCanMutateArticle(access, existing);
  if (denied) return denied;

  const raw = Object.fromEntries(formData.entries());
  const parsed = articleDraftSchema.safeParse({
    ...raw,
    // Nunca publicar desde autosave
    status: existing.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos del formulario.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  if (data.expectedUpdatedAt) {
    const expected = new Date(data.expectedUpdatedAt).getTime();
    const current = existing.updatedAt.getTime();
    if (!Number.isNaN(expected) && current > expected + 500) {
      return {
        ok: false,
        error: "Hay una versión más nueva. Recargá la página antes de seguir editando.",
      };
    }
  }

  // Si la nota está publicada, el autosave solo actualiza campos sin cambiar status.
  const keepPublished = existing.status === "PUBLISHED" || existing.status === "UNPUBLISHED";
  const nextStatus = keepPublished
    ? (existing.status as ArticleStatus)
    : existing.status === "ARCHIVED"
      ? "ARCHIVED"
      : "DRAFT";

  const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title), articleId);

  const article = await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || "",
      categoryId: data.categoryId,
      coverImageId: data.coverImageId,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: nextStatus,
      ...(data.coverImageId && data.coverCredit?.trim()
        ? {}
        : {}),
    },
  });

  if (data.coverImageId && data.coverCredit?.trim()) {
    await prisma.infoSpotEditorialAsset.update({
      where: { id: data.coverImageId },
      data: {
        credit: data.coverCredit.trim(),
        isPermanentEditorialAsset: true,
      },
    });
  }

  revalidatePath("/redaccion");
  revalidatePath(`/redaccion/noticias/${articleId}/editar`);

  return {
    ok: true,
    id: article.id,
    message: "Guardado",
    updatedAt: article.updatedAt.toISOString(),
  };
}

export async function createArticleAndRedirect(formData: FormData) {
  const result = await createArticleAction(formData);
  if (!result.ok || !result.id) {
    redirect(`/redaccion/nueva?error=${encodeURIComponent(result.ok ? "Error" : result.error)}`);
  }
  redirect(`/redaccion/noticias/${result.id}/editar?ok=${encodeURIComponent(result.message)}`);
}

export async function updateArticleAndRedirect(articleId: string, formData: FormData) {
  const result = await updateArticleAction(articleId, formData);
  if (!result.ok) {
    redirect(
      `/redaccion/noticias/${articleId}/editar?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/redaccion/noticias/${articleId}/editar?ok=${encodeURIComponent(result.message)}`);
}

/** Duplica una noticia como borrador REAL-ready (etiqueta NEEDS_REVIEW). */
export async function duplicateArticleDraftAction(articleId: string): Promise<void> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    redirect(`/redaccion?error=${encodeURIComponent("Sin permiso para duplicar.")}`);
  }

  const source = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: {
      title: true,
      excerpt: true,
      content: true,
      categoryId: true,
      coverImageId: true,
      seoTitle: true,
      seoDescription: true,
      slug: true,
    },
  });
  if (!source) {
    redirect(`/redaccion?error=${encodeURIComponent("Noticia no encontrada.")}`);
  }

  const slug = await ensureUniqueSlug(`${source.slug}-copia`);
  const copy = await prisma.infoSpotArticle.create({
    data: {
      title: `${source.title} (copia)`,
      slug,
      excerpt: source.excerpt,
      content: source.content,
      categoryId: source.categoryId,
      coverImageId: source.coverImageId,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      contentTag: "NEEDS_REVIEW",
      status: "DRAFT",
      publishedAt: null,
      authorId: access.user.id,
    },
  });

  revalidatePath("/redaccion");
  redirect(`/redaccion/noticias/${copy.id}/editar?ok=${encodeURIComponent("Borrador duplicado")}`);
}
