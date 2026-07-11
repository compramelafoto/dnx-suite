import type { InfoSpotContentTag } from "@repo/db";

export const CONTENT_TAG_LABELS: Record<InfoSpotContentTag, string> = {
  DEMO: "DEMO",
  REAL: "REAL",
  NEEDS_REVIEW: "NEEDS_REVIEW",
};

export const DEMO_ARTICLE_SLUGS = [
  "arranca-info-spot-escena-local",
  "agenda-deportiva-fin-de-semana",
  "cultura-plaza-feria-musica",
  "fotografia-eventos-tips",
  "que-eventos-mirar-esta-semana",
] as const;

export function isDemoEventSlug(slug: string): boolean {
  return slug.startsWith("demo-");
}

export function isDemoArticleSlug(slug: string): boolean {
  return (DEMO_ARTICLE_SLUGS as readonly string[]).includes(slug);
}

export type PublishChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
};

export function buildArticlePublishChecklist(input: {
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  categoryId?: string | null;
  coverImageId?: string | null;
  authorId?: number | null;
  publishedAt?: Date | string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  slug?: string | null;
  contentTag?: InfoSpotContentTag | null;
  sourceName?: string | null;
  factChecked?: boolean;
  creditOk?: boolean;
}): PublishChecklistItem[] {
  const contentLen = (input.content || "").trim().length;
  const title = (input.title || "").trim();
  const content = input.content || "";
  const titleOk =
    title.length >= 3 &&
    !title.includes("[PENDIENTE]") &&
    !title.includes("[Título editorial pendiente]");
  const bodyOk = contentLen >= 40 && !content.includes("[COMPLETAR POR REDACCIÓN]");
  return [
    { id: "title", label: "Título definitivo", ok: titleOk, required: true },
    { id: "excerpt", label: "Bajada / resumen", ok: (input.excerpt || "").trim().length >= 10, required: true },
    { id: "content", label: "Cuerpo completo", ok: bodyOk, required: true },
    { id: "category", label: "Categoría", ok: Boolean(input.categoryId), required: true },
    { id: "cover", label: "Imagen o fallback aprobado", ok: Boolean(input.coverImageId), required: false },
    { id: "credit", label: "Crédito fotográfico", ok: input.creditOk !== false, required: false },
    { id: "author", label: "Autor", ok: Boolean(input.authorId), required: true },
    { id: "date", label: "Fecha de publicación", ok: Boolean(input.publishedAt), required: false },
    { id: "seoTitle", label: "SEO title", ok: Boolean(input.seoTitle?.trim()), required: true },
    { id: "seoDescription", label: "SEO description", ok: Boolean(input.seoDescription?.trim()), required: true },
    { id: "slug", label: "Slug", ok: Boolean(input.slug?.trim()), required: true },
    {
      id: "source",
      label: "Fuente verificada",
      ok: Boolean(input.sourceName?.trim()),
      required: true,
    },
    {
      id: "factcheck",
      label: "Fact-check confirmado",
      ok: Boolean(input.factChecked),
      required: true,
    },
    {
      id: "review",
      label: "Contenido REAL (obligatorio para publicar)",
      ok: input.contentTag === "REAL",
      required: true,
    },
  ];
}

export function buildEventPublishChecklist(input: {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  organizerName?: string | null;
  startAt?: Date | string | null;
  city?: string | null;
  province?: string | null;
  slug?: string | null;
  contentTag?: InfoSpotContentTag | null;
}): PublishChecklistItem[] {
  return [
    { id: "title", label: "Título", ok: (input.title || "").trim().length >= 3, required: true },
    { id: "summary", label: "Resumen", ok: (input.summary || "").trim().length >= 10, required: false },
    { id: "description", label: "Descripción", ok: (input.description || "").trim().length >= 20, required: true },
    { id: "category", label: "Categoría", ok: Boolean(input.categoryId), required: false },
    { id: "cover", label: "Portada", ok: Boolean(input.coverImageUrl), required: false },
    { id: "organizer", label: "Organizador", ok: (input.organizerName || "").trim().length >= 2, required: true },
    { id: "date", label: "Fecha", ok: Boolean(input.startAt), required: true },
    {
      id: "location",
      label: "Ubicación (ciudad/provincia)",
      ok: Boolean(input.city?.trim() && input.province?.trim()),
      required: true,
    },
    { id: "slug", label: "Slug", ok: Boolean(input.slug?.trim()), required: true },
    {
      id: "review",
      label: "Contenido REAL (obligatorio para publicar)",
      ok: input.contentTag === "REAL",
      required: true,
    },
  ];
}

export function checklistWarnings(items: PublishChecklistItem[]): string[] {
  return items.filter((i) => i.required && !i.ok).map((i) => i.label);
}
