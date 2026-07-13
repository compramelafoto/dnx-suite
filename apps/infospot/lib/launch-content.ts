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
    { id: "cover", label: "Imagen de portada", ok: Boolean(input.coverImageId), required: false },
    { id: "credit", label: "Crédito fotográfico", ok: input.creditOk !== false, required: false },
    { id: "author", label: "Autor", ok: Boolean(input.authorId), required: true },
    { id: "slug", label: "URL pública", ok: Boolean(input.slug?.trim()), required: true },
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
  latitude?: number | null;
  longitude?: number | null;
  locationConfirmedAt?: Date | string | null;
  geocodingStatus?: string | null;
}): PublishChecklistItem[] {
  const hasGeo =
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    !(input.latitude === 0 && input.longitude === 0) &&
    (input.latitude < -90 || input.latitude > 90 ? false : true) &&
    (input.longitude < -180 || input.longitude > 180 ? false : true);
  const geoConfirmed = Boolean(input.locationConfirmedAt) && hasGeo;
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
    {
      id: "georef",
      label: "Georreferenciación confirmada",
      ok: geoConfirmed,
      required: true,
    },
    { id: "slug", label: "Slug", ok: Boolean(input.slug?.trim()), required: true },
    // ETAPA 15: se eliminó el ítem "Contenido REAL" — contentTag no bloquea publicación
  ];
}

export function checklistWarnings(items: PublishChecklistItem[]): string[] {
  return items.filter((i) => i.required && !i.ok).map((i) => i.label);
}
