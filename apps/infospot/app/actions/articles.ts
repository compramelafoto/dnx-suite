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
import { encodeGeohash } from "@/lib/geolocation/geohash";
import { isGeographicScope } from "@/lib/editorial/article-location";

export type ActionResult =
  | { ok: true; id?: string; message: string; updatedAt?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type LocationWriteInput = {
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const LOCATION_RAW_KEYS = [
  "geographicScope",
  "countryCode",
  "countryName",
  "province",
  "city",
  "placeName",
  "address",
  "formattedAddress",
  "latitude",
  "longitude",
] as const;

function articleLocationWriteData(
  data: LocationWriteInput,
  /** Si se pasa, solo escribe claves presentes (autosave no pisa alcance con null por omisión). */
  presentKeys?: ReadonlySet<string>,
) {
  const lat = data.latitude ?? null;
  const lng = data.longitude ?? null;
  const usable =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const include = (key: string) => !presentKeys || presentKeys.has(key);

  const scopeRaw = data.geographicScope;
  const scopeTrimmed = typeof scopeRaw === "string" ? scopeRaw.trim() : "";
  const scope = isGeographicScope(scopeTrimmed) ? scopeTrimmed : null;

  return {
    ...(include("geographicScope") ? { geographicScope: scope } : {}),
    ...(include("countryCode") ? { countryCode: data.countryCode ?? null } : {}),
    ...(include("countryName") ? { countryName: data.countryName ?? null } : {}),
    ...(include("province") ? { province: data.province ?? null } : {}),
    ...(include("city") ? { city: data.city ?? null } : {}),
    ...(include("placeName") ? { placeName: data.placeName ?? null } : {}),
    ...(include("address") ? { address: data.address ?? null } : {}),
    ...(include("formattedAddress")
      ? { formattedAddress: data.formattedAddress ?? null }
      : {}),
    ...(include("latitude") || include("longitude")
      ? {
          latitude: usable ? lat : null,
          longitude: usable ? lng : null,
          geohash: usable && lat != null && lng != null ? encodeGeohash(lat, lng) : null,
        }
      : {}),
  };
}

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

/** Persiste crédito y pie de foto de la portada en el asset (+ override COVER si existe). */
async function persistCoverAssetMeta(
  coverImageId: string,
  articleId: string,
  meta: { credit?: string | null; caption?: string | null },
) {
  const credit =
    typeof meta.credit === "string" ? meta.credit.trim() || null : undefined;
  const caption =
    typeof meta.caption === "string" ? meta.caption.trim() || null : undefined;

  await prisma.infoSpotEditorialAsset.update({
    where: { id: coverImageId },
    data: {
      isPermanentEditorialAsset: true,
      ...(credit !== undefined ? { credit } : {}),
      ...(caption !== undefined ? { caption } : {}),
    },
  });

  if (caption !== undefined) {
    await prisma.infoSpotArticleAsset.updateMany({
      where: { articleId, assetId: coverImageId, usageType: "COVER" },
      data: { captionOverride: caption },
    });
  }
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
      coverOverridden: Boolean(data.coverImageId),
      ...articleLocationWriteData(data),
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: "REAL",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: "DRAFT",
      publishedAt,
      authorId: access.user.id,
    },
  });

  if (data.coverImageId) {
    await persistCoverAssetMeta(data.coverImageId, article.id, {
      credit:
        typeof formData.get("coverCredit") === "string"
          ? String(formData.get("coverCredit"))
          : data.coverCredit,
      caption:
        typeof formData.get("coverCaption") === "string"
          ? String(formData.get("coverCaption"))
          : data.coverCaption,
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
      coverOverridden: true,
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
  const coverChanged = data.coverImageId !== existing.coverImageId;

  const article = await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || "",
      categoryId: data.categoryId,
      coverImageId: data.coverImageId,
      ...(coverChanged
        ? { coverOverridden: Boolean(data.coverImageId) || existing.coverOverridden }
        : {}),
      ...articleLocationWriteData(data),
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: "REAL",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: nextStatus,
      publishedAt,
    },
  });

  if (data.coverImageId) {
    await persistCoverAssetMeta(data.coverImageId, articleId, {
      credit: data.coverCredit,
      caption: data.coverCaption,
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
 * Acepta FormData (submit clásico) o un payload plano desde el editor React.
 */
export type AutosaveDraftPayload = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  categoryId?: string | null;
  coverImageId?: string | null;
  coverCredit?: string;
  coverCaption?: string;
  seoTitle?: string;
  seoDescription?: string;
  sourceName?: string;
  sourceUrl?: string;
  expectedUpdatedAt?: string;
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** "1" = el redactor limpió ubicación a propósito (permite geographicScope null). */
  locationCleared?: string | null;
};

function normalizeAutosaveRaw(
  input: FormData | AutosaveDraftPayload,
): Record<string, string> {
  if (input instanceof FormData) {
    const raw = Object.fromEntries(input.entries());
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = typeof v === "string" ? v : String(v);
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    // Conservar "" (p. ej. limpiar alcance). Solo omitir null/undefined.
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

function locationKeysPresentInRaw(raw: Record<string, string>): Set<string> {
  const present = new Set<string>();
  for (const key of LOCATION_RAW_KEYS) {
    if (key in raw) present.add(key);
  }
  return present;
}

export async function autosaveArticleDraftAction(
  articleId: string,
  input: FormData | AutosaveDraftPayload,
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
      coverOverridden: true,
      updatedAt: true,
      title: true,
      geographicScope: true,
      categoryId: true,
    },
  });
  if (!existing) return { ok: false, error: "Noticia no encontrada." };

  const denied = await assertCanMutateArticle(access, existing);
  if (denied) return denied;

  const raw = normalizeAutosaveRaw(input);
  // Autosave no debe fallar por título vacío: el redactor puede escribir el cuerpo primero.
  const title =
    (typeof raw.title === "string" && raw.title.trim()) ||
    existing.title?.trim() ||
    "Sin título";
  const slugSeed =
    (typeof raw.slug === "string" && raw.slug.trim()) ||
    slugifyTitle(title) ||
    existing.slug ||
    "sin-titulo";

  const parsed = articleDraftSchema.safeParse({
    ...raw,
    title,
    slug: slugSeed,
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
  const coverChanged = data.coverImageId !== existing.coverImageId;
  const locationPresent = locationKeysPresentInRaw(raw);
  const locationCleared = raw.locationCleared === "1";

  // No borrar un alcance ya guardado con un autosave stale que manda "".
  if (
    locationPresent.has("geographicScope") &&
    !isGeographicScope(raw.geographicScope) &&
    !locationCleared &&
    existing.geographicScope
  ) {
    locationPresent.delete("geographicScope");
  }

  // Un autosave stale con categoryId vacío no debe borrar la categoría ya elegida.
  const nextCategoryId =
    data.categoryId || existing.categoryId || null;

  const article = await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || "",
      categoryId: nextCategoryId,
      coverImageId: data.coverImageId,
      ...(coverChanged
        ? { coverOverridden: Boolean(data.coverImageId) || existing.coverOverridden }
        : {}),
      ...articleLocationWriteData(data, locationPresent),
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      contentTag: "REAL",
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: nextStatus,
    },
  });

  if (data.coverImageId && ("coverCredit" in raw || "coverCaption" in raw)) {
    await persistCoverAssetMeta(data.coverImageId, articleId, {
      credit: "coverCredit" in raw ? (raw.coverCredit ?? "") : data.coverCredit,
      caption: "coverCaption" in raw ? (raw.coverCaption ?? "") : data.coverCaption,
    });
  }

  // No revalidatePath acá: el refresh RSC remonta el editor y puede mostrar
  // alcance vacío si un save concurrente aún no persistió el valor nuevo.

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

/** Duplica una noticia como borrador. */
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
      contentTag: "REAL",
      status: "DRAFT",
      publishedAt: null,
      authorId: access.user.id,
    },
  });

  revalidatePath("/redaccion");
  redirect(`/redaccion/noticias/${copy.id}/editar?ok=${encodeURIComponent("Borrador duplicado")}`);
}
