import type { InfoSpotContentTag } from "@repo/db";
import {
  buildArticlePublishChecklist,
  checklistWarnings,
} from "@/lib/launch-content";
import {
  hasPendingReturn,
  type ArticleStatus,
} from "@/lib/article-status";

export type RedaccionVista =
  | "mi-trabajo"
  | "borradores"
  | "en-revision"
  | "devueltas"
  | "listas-publicar"
  | "publicadas"
  | "archivadas";

export const REDACCION_VISTAS: ReadonlyArray<{
  id: RedaccionVista;
  label: string;
}> = [
  { id: "mi-trabajo", label: "Mi trabajo" },
  { id: "borradores", label: "Borradores" },
  { id: "en-revision", label: "En revisión" },
  { id: "devueltas", label: "Devueltas" },
  { id: "listas-publicar", label: "Listas para publicar" },
  { id: "publicadas", label: "Publicadas" },
  { id: "archivadas", label: "Archivadas" },
];

export type QueueArticleShape = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  status: string;
  contentTag: InfoSpotContentTag | string;
  categoryId: string | null;
  authorId: number;
  coverImageId: string | null;
  sourceName?: string | null;
  factCheckedAt?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  slug?: string | null;
  publishedAt?: Date | null;
  returnedAt?: Date | null;
  submittedForReviewAt?: Date | null;
};

export function isIncompleteDraft(article: QueueArticleShape): boolean {
  return (
    article.title.includes("[PENDIENTE]") ||
    article.title.includes("[Título editorial pendiente]") ||
    article.content.includes("[COMPLETAR POR REDACCIÓN]") ||
    !article.excerpt?.trim() ||
    !article.sourceName?.trim()
  );
}

export function parseRedaccionVista(raw?: string | null): RedaccionVista {
  const value = (raw || "mi-trabajo") as RedaccionVista;
  if (REDACCION_VISTAS.some((v) => v.id === value)) return value;
  switch (raw) {
    case "ALL":
    case "todos":
    case "DRAFT":
    case "pendientes":
      return "borradores";
    case "pending":
      return "borradores";
    case "review":
    case "revisar":
    case "IN_REVIEW":
      return "en-revision";
    case "ready":
    case "READY_TO_PUBLISH":
      return "listas-publicar";
    case "published":
    case "PUBLISHED":
    case "publicadas":
      return "publicadas";
    case "ARCHIVED":
    case "archivadas":
      return "archivadas";
    case "devueltas":
      return "devueltas";
    default:
      return "mi-trabajo";
  }
}

export function filterArticlesByVista<T extends QueueArticleShape>(
  articles: T[],
  vista: RedaccionVista,
  userId: number,
): T[] {
  switch (vista) {
    case "mi-trabajo":
      return articles.filter((a) => a.authorId === userId && a.status !== "ARCHIVED");
    case "borradores":
      return articles.filter(
        (a) => a.status === "DRAFT" && !hasPendingReturn(a),
      );
    case "en-revision":
      return articles.filter((a) => a.status === "IN_REVIEW");
    case "devueltas":
      return articles.filter((a) => hasPendingReturn(a));
    case "listas-publicar":
      return articles.filter((a) => a.status === "READY_TO_PUBLISH");
    case "publicadas":
      return articles.filter((a) => a.status === "PUBLISHED");
    case "archivadas":
      return articles.filter((a) => a.status === "ARCHIVED");
    default:
      return articles;
  }
}

export function summarizeChecklist(article: QueueArticleShape): {
  done: number;
  total: number;
  missing: string[];
} {
  const items = buildArticlePublishChecklist({
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    categoryId: article.categoryId,
    coverImageId: article.coverImageId,
    authorId: article.authorId,
    publishedAt: article.publishedAt,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    slug: article.slug,
    contentTag: article.contentTag as InfoSpotContentTag,
    sourceName: article.sourceName,
  });
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.ok).length;
  return {
    done,
    total: required.length,
    missing: checklistWarnings(items).slice(0, 3),
  };
}

export function statusDbFilterForVista(vista: RedaccionVista): ArticleStatus | undefined {
  if (vista === "publicadas") return "PUBLISHED";
  if (vista === "archivadas") return "ARCHIVED";
  if (vista === "en-revision") return "IN_REVIEW";
  if (vista === "listas-publicar") return "READY_TO_PUBLISH";
  if (vista === "borradores") return "DRAFT";
  return undefined;
}
