import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { NewsroomDesk } from "@/components/redaccion/newsroom-desk";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import {
  getEditorialDashboardStats,
  getMyDraftCount,
  listArticlesForRedaccion,
} from "@/lib/articles";
import { listClfReadonlyCandidates } from "@/lib/clf-readonly-queries";
import { editorialFirstName, editorialGreeting } from "@/lib/redaccion-greeting";
import { getEventEditorialStats, listEventsForRedaccion } from "@/lib/redaccion-events";
import { getCoverageDashboardMetrics } from "@/lib/coverage";
import { NEWSROOM_COPY } from "@/lib/redaccion-ia";
import {
  canCreateInfoSpotArticle,
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Centro Editorial",
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

/**
 * Mesa de trabajo del Centro Editorial.
 * Las bandejas viven en /redaccion/bandeja (aliases de las vistas existentes).
 */
export default async function RedaccionPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;

  // Compat: ?vista=… redirige a la Bandeja (misma lógica de colas).
  if (params.vista || params.queue || params.status) {
    const q = new URLSearchParams();
    if (params.vista) q.set("vista", params.vista);
    else if (params.queue) q.set("vista", params.queue);
    else if (params.status) q.set("vista", params.status);
    if (params.ok) q.set("ok", params.ok);
    if (params.error) q.set("error", params.error);
    redirect(`/redaccion/bandeja?${q.toString()}`);
  }

  const canCreate = canCreateInfoSpotArticle(access.subject);
  const isDirector = canManageInfoSpotSettings(access.subject);

  const [stats, myDrafts, articlesRaw, eventStats, eventsRaw, coverageMetrics, clfBundle] =
    await Promise.all([
      getEditorialDashboardStats(),
      getMyDraftCount(access.user.id),
      listArticlesForRedaccion(),
      getEventEditorialStats(),
      listEventsForRedaccion(),
      getCoverageDashboardMetrics().catch(() => ({
        total: 0,
        discovered: 0,
        linked: 0,
        dismissed: 0,
        stale: 0,
        availableCommercial: 0,
        withArticles: 0,
        multiPhotographer: 0,
        aiReady: 0,
        selectorReady: 0,
        creditsReady: 0,
      })),
      isDirector
        ? listClfReadonlyCandidates(50).catch(() => null)
        : Promise.resolve(null),
    ]);

  const now = Date.now();
  const eventsUpcoming = eventsRaw.filter((e) => {
    if (e.status === "ARCHIVED") return false;
    const t = e.startAt ? new Date(e.startAt).getTime() : 0;
    return t >= now - 86400000;
  }).length;

  const clfAvailable =
    clfBundle?.connection.ok
      ? clfBundle.candidates.filter(
          (c) => c.priority === "PRIORIDAD_ALTA" || c.priority === "PRIORIDAD_MEDIA",
        ).length
      : null;

  const myLatestDraft = articlesRaw.find(
    (a) => a.authorId === access.user.id && a.status === "DRAFT",
  );

  const quickActions = [
    ...(canCreate
      ? [{ label: NEWSROOM_COPY.createNote, href: "/redaccion/nueva", primary: true }]
      : []),
    { label: NEWSROOM_COPY.createCoverage, href: "/redaccion/coberturas" },
    ...(isDirector
      ? [{ label: NEWSROOM_COPY.clfImport, href: "/redaccion/desde-clf" }]
      : []),
    { label: "Abrir bandeja", href: "/redaccion/bandeja" },
  ];

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs items={[{ label: NEWSROOM_COPY.newsroom }]} />
      <FlashBanner ok={params.ok} error={params.error} />

      {isDirector && stats.inReview > 0 ? (
        <div className="mb-8 rounded-[var(--is-radius-md)] border border-[var(--is-orange-200)] bg-[var(--is-orange-50)] px-4 py-3 text-sm text-[var(--is-orange-900)]">
          Hay{" "}
          <Link href="/redaccion/bandeja?vista=en-revision" className="font-semibold underline">
            {stats.inReview} pieza{stats.inReview === 1 ? "" : "s"} en revisión
          </Link>
          .
        </div>
      ) : null}

      <NewsroomDesk
        greeting={editorialGreeting()}
        firstName={editorialFirstName(access.user)}
        stats={{
          eventsUpcoming: eventsUpcoming || eventStats.published + eventStats.inReview + eventStats.draft,
          coveragesAvailable: coverageMetrics.availableCommercial || coverageMetrics.total,
          drafts: stats.draft,
          inReview: stats.inReview,
          published: stats.published,
          clfCandidates: clfAvailable,
          myDrafts,
        }}
        quickActions={quickActions}
        continueDraftHref={
          myLatestDraft ? `/redaccion/noticias/${myLatestDraft.id}/editar` : null
        }
      />
    </RedaccionShell>
  );
}
