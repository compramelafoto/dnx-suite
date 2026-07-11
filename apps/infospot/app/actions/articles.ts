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
  | { ok: true; id?: string; message: string }
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
  if (data.status === "PUBLISHED") {
    if (!canPublishInfoSpotArticle(access.subject)) {
      return { ok: false, error: "No tenés permiso para publicar." };
    }
    const publishErrors = validateForPublish(data);
    if (publishErrors.length) {
      return { ok: false, error: publishErrors.join(" ") };
    }
  } else if (data.status !== "DRAFT") {
    return { ok: false, error: "Al crear, el estado debe ser borrador o publicada." };
  }

  const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title));
  const publishedAt =
    data.status === "PUBLISHED"
      ? parsePublishedAt(data.publishedAt) ?? new Date()
      : parsePublishedAt(data.publishedAt);

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
      status: data.status,
      publishedAt,
      authorId: access.user.id,
      ...(data.status === "PUBLISHED" && data.markFactChecked
        ? { factCheckedAt: new Date(), factCheckedByUserId: access.user.id }
        : {}),
    },
  });

  if (data.coverImageId) {
    await prisma.infoSpotEditorialAsset.update({
      where: { id: data.coverImageId },
      data: { isPermanentEditorialAsset: true },
    });
  }

  revalidatePublic(article.slug);
  return {
    ok: true,
    id: article.id,
    message: data.status === "PUBLISHED" ? "Noticia publicada" : "Borrador guardado",
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
  const nextStatus = data.status as ArticleStatus;
  const currentStatus = existing.status as ArticleStatus;

  if (nextStatus !== currentStatus && !canTransitionStatus(currentStatus, nextStatus)) {
    return {
      ok: false,
      error: `No se puede pasar de ${currentStatus} a ${nextStatus} desde el formulario. Usá las acciones de estado.`,
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
      data: { isPermanentEditorialAsset: true },
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
  };
}

export async function transitionArticleStatusAction(
  articleId: string,
  toStatus: ArticleStatus,
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
      title: true,
      excerpt: true,
      content: true,
      categoryId: true,
      contentTag: true,
      sourceName: true,
      sourceUrl: true,
      factCheckedAt: true,
    },
  });
  if (!existing) return { ok: false, error: "Noticia no encontrada." };

  const denied = await assertCanMutateArticle(access, existing);
  if (denied) return denied;

  const from = existing.status as ArticleStatus;
  if (!canTransitionStatus(from, toStatus)) {
    return { ok: false, error: `Transición no permitida: ${from} → ${toStatus}` };
  }

  if (toStatus === "PUBLISHED" || toStatus === "UNPUBLISHED") {
    if (!canPublishInfoSpotArticle(access.subject)) {
      return { ok: false, error: "No tenés permiso para publicar/despublicar." };
    }
  }

  if (toStatus === "PUBLISHED") {
    const publishErrors = validateForPublish({
      title: existing.title,
      slug: existing.slug,
      excerpt: existing.excerpt ?? "",
      content: existing.content,
      categoryId: existing.categoryId,
      coverImageId: null,
      contentTag: existing.contentTag,
      sourceName: existing.sourceName ?? undefined,
      sourceUrl: existing.sourceUrl ?? undefined,
      markFactChecked: Boolean(existing.factCheckedAt),
      status: "PUBLISHED",
    });
    if (publishErrors.length) {
      return { ok: false, error: publishErrors.join(" ") };
    }
  }

  const publishedAt =
    toStatus === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt;

  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: { status: toStatus, publishedAt },
  });

  revalidatePublic(existing.slug);

  const messages: Record<ArticleStatus, string> = {
    DRAFT: "Borrador guardado",
    PUBLISHED: "Noticia publicada",
    UNPUBLISHED: "Noticia despublicada",
    ARCHIVED: "Noticia archivada",
  };

  return { ok: true, id: articleId, message: messages[toStatus] };
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
