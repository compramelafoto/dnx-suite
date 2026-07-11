import Link from "next/link";
import type { Metadata } from "next";
import { duplicateArticleDraftAction } from "@/app/actions/articles";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { StatusBadge } from "@/components/redaccion/status-badge";
import { ArticleStatusActions } from "@/components/redaccion/article-status-actions";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import {
  authorDisplayName,
  getEditorialDashboardStats,
  listArticlesForRedaccion,
} from "@/lib/articles";
import { formatDateEs } from "@/lib/dates";
import { CONTENT_TAG_LABELS } from "@/lib/launch-content";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import type { ArticleStatus } from "@/lib/article-status";

export const metadata: Metadata = {
  title: "Redacción",
};

type QueueFilter =
  | "ALL"
  | "DRAFT"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "ARCHIVED"
  | "pending"
  | "review"
  | "ready"
  | "published";

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string; status?: string; queue?: string }>;
};

function isIncompleteDraft(article: {
  title: string;
  excerpt: string | null;
  content: string;
  sourceName?: string | null;
  factCheckedAt?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}): boolean {
  return (
    article.title.includes("[PENDIENTE]") ||
    article.title.includes("[Título editorial pendiente]") ||
    article.content.includes("[COMPLETAR POR REDACCIÓN]") ||
    !article.excerpt?.trim() ||
    !article.sourceName?.trim()
  );
}

function isReadyToPublish(article: {
  status: string;
  contentTag: string;
  title: string;
  excerpt: string | null;
  content: string;
  categoryId: string | null;
  sourceName?: string | null;
  factCheckedAt?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}): boolean {
  return (
    article.status === "DRAFT" &&
    article.contentTag === "REAL" &&
    !isIncompleteDraft(article) &&
    Boolean(article.categoryId) &&
    Boolean(article.seoTitle?.trim()) &&
    Boolean(article.seoDescription?.trim()) &&
    Boolean(article.factCheckedAt)
  );
}

export default async function RedaccionPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const queue = (params.queue || params.status || "ALL") as QueueFilter;
  const statusFilter =
    queue === "DRAFT" ||
    queue === "PUBLISHED" ||
    queue === "UNPUBLISHED" ||
    queue === "ARCHIVED"
      ? queue
      : undefined;

  const [stats, articlesRaw] = await Promise.all([
    getEditorialDashboardStats(),
    listArticlesForRedaccion(statusFilter),
  ]);
  const canPublish = canPublishInfoSpotArticle(access.subject);
  const isDirector = canManageInfoSpotSettings(access.subject);

  const articles = articlesRaw.filter((article) => {
    if (queue === "pending") {
      return article.status === "DRAFT" && isIncompleteDraft(article);
    }
    if (queue === "review") {
      return (
        article.status === "DRAFT" &&
        article.contentTag === "REAL" &&
        !isIncompleteDraft(article) &&
        !article.factCheckedAt
      );
    }
    if (queue === "ready") {
      return isReadyToPublish(article);
    }
    if (queue === "published") {
      return article.status === "PUBLISHED";
    }
    return true;
  });

  return (
    <RedaccionShell
      title="Panel de redacción"
      description="Cola editorial de lanzamiento. Solo contenido REAL aparece en el sitio público."
      actions={
        <div className="flex flex-wrap gap-2">
          {isDirector ? (
            <Link
              href="/redaccion/desde-clf"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
            >
              Crear borrador desde evento CLF
            </Link>
          ) : null}
          <Link
            href="/redaccion/nueva"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
          >
            Nueva noticia
          </Link>
        </div>
      }
    >
      <FlashBanner ok={params.ok} error={params.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Borradores", value: stats.draft },
          { label: "Publicadas", value: stats.published },
          { label: "Despublicadas", value: stats.unpublished },
          { label: "Total", value: stats.total },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--is-muted)]">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "Todas"],
            ["pending", "Pendientes de completar"],
            ["review", "Listas para revisar"],
            ["ready", "Listas para publicar"],
            ["published", "Publicadas"],
            ["DRAFT", "Borradores"],
            ["ARCHIVED", "Archivadas"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "ALL" ? "/redaccion" : `/redaccion?queue=${value}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
              queue === value
                ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)] text-[var(--is-accent-hover)]"
                : "border-[var(--is-border)] bg-white text-[var(--is-text-secondary)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--is-border)] bg-[var(--is-bg-elevated)] text-xs uppercase tracking-wide text-[var(--is-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Título</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Tag</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Fuente</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--is-muted)]">
                  No hay noticias en este filtro.
                </td>
              </tr>
            ) : (
              articles.map((article) => (
                <tr key={article.id} className="border-t border-[var(--is-border)] align-top">
                  <td className="px-4 py-4 font-medium text-[var(--is-text)]">
                    <div>{article.title}</div>
                    <p className="mt-1 text-xs text-[var(--is-muted)]">
                      {authorDisplayName(article.author)} · /{article.slug}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {article.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                      {CONTENT_TAG_LABELS[article.contentTag]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={article.status as ArticleStatus} />
                    <p className="mt-1 text-xs text-[var(--is-muted)]">
                      {formatDateEs(article.publishedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-[var(--is-muted)]">
                    {article.sourceName || "—"}
                    {article.factCheckedAt ? (
                      <span className="mt-1 block text-emerald-700">Fact-check OK</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[12rem] flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/redaccion/noticias/${article.id}/editar`}
                          className="inline-flex min-h-11 items-center text-[var(--is-accent)] underline-offset-2 hover:underline"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/redaccion/noticias/${article.id}/preview`}
                          className="inline-flex min-h-11 items-center text-[var(--is-text-secondary)] underline-offset-2 hover:underline"
                        >
                          Preview
                        </Link>
                        <form action={duplicateArticleDraftAction.bind(null, article.id)}>
                          <button
                            type="submit"
                            className="inline-flex min-h-11 items-center text-[var(--is-text-secondary)] underline-offset-2 hover:underline"
                          >
                            Duplicar
                          </button>
                        </form>
                      </div>
                      <ArticleStatusActions
                        articleId={article.id}
                        status={article.status as ArticleStatus}
                        canPublish={canPublish}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </RedaccionShell>
  );
}
