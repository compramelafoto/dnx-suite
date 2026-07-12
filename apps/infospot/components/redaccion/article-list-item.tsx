import { ArticleActionsMenu } from "@/components/redaccion/article-actions-menu";
import { StatusBadge } from "@/components/redaccion/status-badge";
import {
  authorDisplayName,
  coverThumbnailUrl,
  type ArticleWithRelations,
} from "@/lib/articles";
import { formatDateTimeEs } from "@/lib/dates";
import { CONTENT_TAG_LABELS } from "@/lib/launch-content";
import {
  expectedActionHint,
  hasPendingReturn,
  type ArticleStatus,
} from "@/lib/article-status";
import { summarizeChecklist } from "@/lib/redaccion-queues";
import type { InfoSpotContentTag } from "@repo/db";

type Props = {
  article: ArticleWithRelations;
  canPublish: boolean;
  isDirector?: boolean;
};

const tagStyles: Record<InfoSpotContentTag, string> = {
  REAL: "bg-[var(--is-success-50)] text-[var(--is-success-800)]",
  DEMO: "bg-[var(--is-warning-50)] text-[var(--is-warning-800)]",
  NEEDS_REVIEW: "bg-[var(--is-orange-50)] text-[var(--is-orange-800)]",
};

export function ArticleListItem({ article, canPublish, isDirector }: Props) {
  const coverUrl = coverThumbnailUrl(article);
  const checklist = summarizeChecklist(article);
  const tag = article.contentTag as InfoSpotContentTag;
  const pendingReturn = hasPendingReturn(article);
  const latestReturn = article.observations?.[0];
  const hint = expectedActionHint(article.status as ArticleStatus, {
    pendingReturn,
    isDirector,
  });

  return (
    <article className="overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] transition-colors hover:border-[var(--is-border-strong)]">
      <div className="flex flex-col gap-0 md:flex-row">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[var(--is-bg-secondary)] md:aspect-auto md:w-40 lg:w-44">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URLs editoriales R2 / locales
            <img
              src={coverUrl}
              alt=""
              className="h-full min-h-[9rem] w-full object-cover md:absolute md:inset-0 md:min-h-full"
            />
          ) : (
            <div className="flex h-full min-h-[9rem] items-center justify-center px-3 text-center text-xs text-[var(--is-muted)] md:min-h-full">
              Sin portada
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:gap-5 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={article.status as ArticleStatus}
                  pendingReturn={pendingReturn}
                />
                <span
                  className={`inline-flex rounded-[var(--is-radius-sm)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagStyles[tag] ?? tagStyles.NEEDS_REVIEW}`}
                  title="Etiqueta interna (no pública)"
                >
                  {CONTENT_TAG_LABELS[tag] ?? tag}
                </span>
                {article.category?.name ? (
                  <span className="text-xs text-[var(--is-muted)]">{article.category.name}</span>
                ) : (
                  <span className="text-xs text-[var(--is-muted)]">Sin categoría</span>
                )}
              </div>
              <h3 className="font-[family-name:var(--font-source-serif)] text-xl font-semibold leading-snug tracking-tight text-[var(--is-text)] sm:text-2xl">
                <a
                  href={`/redaccion/noticias/${article.id}/editar`}
                  className="hover:text-[var(--is-accent)]"
                >
                  {article.title}
                </a>
              </h3>
              <p className="text-sm text-[var(--is-text-secondary)]">
                {authorDisplayName(article.author)}
                <span className="mx-2 text-[var(--is-border-strong)]">·</span>
                Actualizada {formatDateTimeEs(article.updatedAt)}
              </p>
              <p className="text-sm text-[var(--is-muted)]">Acción esperada: {hint}</p>
            </div>

            <ArticleActionsMenu
              articleId={article.id}
              status={article.status as ArticleStatus}
              canPublish={canPublish}
            />
          </div>

          {latestReturn && pendingReturn ? (
            <div className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="font-semibold">Observación: </span>
              {latestReturn.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--is-border)] pt-3 text-xs text-[var(--is-muted)]">
            <p>
              Checklist{" "}
              <span className="font-semibold tabular-nums text-[var(--is-text-secondary)]">
                {checklist.done}/{checklist.total}
              </span>
            </p>
            {checklist.missing.length > 0 ? (
              <p className="text-[var(--is-text-secondary)]">
                Falta: {checklist.missing.join(" · ")}
              </p>
            ) : (
              <p className="text-[var(--is-success-700)]">Checklist completo</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
