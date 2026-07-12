import Link from "next/link";
import type { Metadata } from "next";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { RedaccionWorkspaceHeader } from "@/components/redaccion/redaccion-workspace-header";
import { RedaccionSummary, type SummaryItem } from "@/components/redaccion/redaccion-summary";
import { RedaccionViewTabs } from "@/components/redaccion/redaccion-view-tabs";
import { ArticleList } from "@/components/redaccion/article-list";
import {
  getEditorialDashboardStats,
  getMyDraftCount,
  listArticlesForRedaccion,
} from "@/lib/articles";
import { listClfReadonlyCandidates } from "@/lib/clf-readonly-queries";
import { editorialFirstName, editorialGreeting } from "@/lib/redaccion-greeting";
import { hasPendingReturn } from "@/lib/article-status";
import {
  filterArticlesByVista,
  parseRedaccionVista,
  type RedaccionVista,
} from "@/lib/redaccion-queues";
import {
  canCreateInfoSpotArticle,
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Sala de redacción",
};

type PageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    status?: string;
    queue?: string;
    vista?: string;
  }>;
};

export default async function RedaccionPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const vista = parseRedaccionVista(params.vista || params.queue || params.status);

  const canPublish = canPublishInfoSpotArticle(access.subject);
  const canCreate = canCreateInfoSpotArticle(access.subject);
  const isDirector = canManageInfoSpotSettings(access.subject);

  const [stats, myDrafts, articlesRaw, clfBundle] = await Promise.all([
    getEditorialDashboardStats(),
    getMyDraftCount(access.user.id),
    listArticlesForRedaccion(),
    isDirector
      ? listClfReadonlyCandidates(50).catch(() => null)
      : Promise.resolve(null),
  ]);

  const returnedCount = articlesRaw.filter((a) => hasPendingReturn(a)).length;
  const draftActive = articlesRaw.filter(
    (a) => a.status === "DRAFT" && !hasPendingReturn(a),
  ).length;

  const clfAvailable =
    clfBundle?.connection.ok
      ? clfBundle.candidates.filter(
          (c) => c.priority === "PRIORIDAD_ALTA" || c.priority === "PRIORIDAD_MEDIA",
        ).length
      : null;

  const summaryItems: SummaryItem[] = [
    {
      label: "Mis borradores",
      value: myDrafts,
      href: "/redaccion?vista=mi-trabajo",
      vista: "mi-trabajo",
    },
    {
      label: "En revisión",
      value: stats.inReview,
      href: "/redaccion?vista=en-revision",
      vista: "en-revision",
    },
    {
      label: "Devueltas",
      value: returnedCount,
      href: "/redaccion?vista=devueltas",
      vista: "devueltas",
    },
    {
      label: "Listas para publicar",
      value: stats.ready,
      href: "/redaccion?vista=listas-publicar",
      vista: "listas-publicar",
    },
    {
      label: "Publicadas",
      value: stats.published,
      href: "/redaccion?vista=publicadas",
      vista: "publicadas",
    },
  ];

  if (isDirector && clfAvailable != null) {
    summaryItems.push({
      label: "Eventos disponibles desde CLF",
      value: clfAvailable,
      href: "/redaccion/desde-clf",
    });
  }

  const vistaCounts: Partial<Record<RedaccionVista, number>> = {
    "mi-trabajo": filterArticlesByVista(articlesRaw, "mi-trabajo", access.user.id).length,
    borradores: draftActive,
    "en-revision": stats.inReview,
    devueltas: returnedCount,
    "listas-publicar": stats.ready,
    publicadas: stats.published,
    archivadas: stats.archived,
  };

  const articles = filterArticlesByVista(articlesRaw, vista, access.user.id);
  const firstName = editorialFirstName(access.user);
  const greeting = editorialGreeting();

  return (
    <RedaccionShell
      header={
        <RedaccionWorkspaceHeader
          greeting={greeting}
          firstName={firstName}
          canCreate={canCreate}
          canCreateFromClf={isDirector}
        />
      }
    >
      <FlashBanner ok={params.ok} error={params.error} />

      {isDirector && stats.inReview > 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-[var(--is-orange-200)] bg-[var(--is-orange-50)] px-4 py-3 text-sm text-[var(--is-orange-900)]">
          Tenés{" "}
          <Link href="/admin/aprobaciones" className="font-semibold underline">
            {stats.inReview} nota{stats.inReview === 1 ? "" : "s"} por aprobar
          </Link>{" "}
          (
          <Link href="/redaccion?vista=en-revision" className="underline">
            ver en redacción
          </Link>
          ).
        </div>
      ) : null}

      {!isDirector && returnedCount > 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Hay{" "}
          <Link href="/redaccion?vista=devueltas" className="font-semibold underline">
            {returnedCount} nota{returnedCount === 1 ? "" : "s"} devuelta
            {returnedCount === 1 ? "" : "s"}
          </Link>{" "}
          con observaciones para corregir.
        </div>
      ) : null}

      <RedaccionSummary items={summaryItems} activeVista={vista} />

      <section className="space-y-4" aria-label="Artículos de la redacción">
        <div>
          <h2 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
            Trabajo editorial
          </h2>
          <p className="mt-1 text-sm text-[var(--is-muted)]">
            Bandejas del flujo: borrador → revisión → aprobación → publicación.
          </p>
        </div>

        <RedaccionViewTabs active={vista} counts={vistaCounts} />

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
            Nueva nota
          </Link>
        </div>
      ) : null}
    </RedaccionShell>
  );
}
