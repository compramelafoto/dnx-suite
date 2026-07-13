import Link from "next/link";
import type { Metadata } from "next";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import { RedaccionViewTabs } from "@/components/redaccion/redaccion-view-tabs";
import { ArticleList } from "@/components/redaccion/article-list";
import {
  getEditorialDashboardStats,
  listArticlesForRedaccion,
} from "@/lib/articles";
import { hasPendingReturn } from "@/lib/article-status";
import {
  filterArticlesByVista,
  parseRedaccionVista,
  type RedaccionVista,
} from "@/lib/redaccion-queues";
import { NEWSROOM_COPY } from "@/lib/redaccion-ia";
import {
  canCreateInfoSpotArticle,
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Bandeja — Centro Editorial",
};

type PageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    vista?: string;
    queue?: string;
    status?: string;
  }>;
};

/**
 * Bandeja de trabajo: Inbox → preparación → revisión → publicados.
 * Reutiliza las colas existentes; solo cambia la presentación.
 */
export default async function BandejaPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const vista = parseRedaccionVista(params.vista || params.queue || params.status);

  const canPublish = canPublishInfoSpotArticle(access.subject);
  const canCreate = canCreateInfoSpotArticle(access.subject);
  const isDirector = canManageInfoSpotSettings(access.subject);

  const [stats, articlesRaw] = await Promise.all([
    getEditorialDashboardStats(),
    listArticlesForRedaccion(),
  ]);

  const returnedCount = articlesRaw.filter((a) => hasPendingReturn(a)).length;
  const draftActive = articlesRaw.filter(
    (a) => a.status === "DRAFT" && !hasPendingReturn(a),
  ).length;

  const vistaCounts: Partial<Record<RedaccionVista, number>> = {
    "mi-trabajo": filterArticlesByVista(articlesRaw, "mi-trabajo", access.user.id).length,
    borradores: draftActive,
    "en-revision": stats.inReview,
    devueltas: returnedCount,
    publicadas: stats.published,
    despublicadas: stats.unpublished,
    archivadas: stats.archived,
  };

  const articles = filterArticlesByVista(articlesRaw, vista, access.user.id);

  const primaryCta =
    vista === "publicadas"
      ? null
      : canCreate
        ? { href: "/redaccion/nueva", label: NEWSROOM_COPY.createNote }
        : null;

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: NEWSROOM_COPY.newsroom, href: "/redaccion" },
          { label: NEWSROOM_COPY.inbox },
        ]}
      />
      <FlashBanner ok={params.ok} error={params.error} />

      <header className="mb-8 max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
          Bandeja
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--is-muted)]">
          Todo lo que está en marcha: inbox, preparación, revisión y publicados.
        </p>
        {primaryCta ? (
          <Link
            href={primaryCta.href}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
          >
            {primaryCta.label}
          </Link>
        ) : null}
      </header>

      <section className="space-y-6" aria-label="Colas de la bandeja">
        <RedaccionViewTabs
          active={vista}
          counts={vistaCounts}
          basePath="/redaccion/bandeja"
        />

        <ArticleList
          articles={articles}
          vista={vista}
          canPublish={canPublish}
          canCreate={canCreate}
          isDirector={isDirector}
        />
      </section>

      {canCreate ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--is-border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link
            href="/redaccion/nueva"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
          >
            {NEWSROOM_COPY.createNote}
          </Link>
        </div>
      ) : null}
    </RedaccionShell>
  );
}
