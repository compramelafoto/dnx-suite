import type { Metadata } from "next";
import Link from "next/link";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import { RedaccionViewTabs } from "@/components/redaccion/redaccion-view-tabs";
import { EventList } from "@/components/redaccion/event-list";
import {
  filterRedaccionEvents,
  getEventEditorialStats,
  listEventsForRedaccion,
} from "@/lib/redaccion-events";
import { hasPendingEventReturn } from "@/lib/editorial/event-adapter";
import {
  parseRedaccionVista,
  REDACCION_VISTAS_EVENTOS,
  type RedaccionVista,
} from "@/lib/redaccion-queues";
import {
  canCreateInfoSpotEvent,
  canManageInfoSpotSettings,
  canPublishInfoSpotEvent,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Agenda — Centro Editorial",
};

type PageProps = {
  searchParams: Promise<{ vista?: string; ok?: string; error?: string; geo?: string }>;
};

export default async function RedaccionEventosPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const vista = parseRedaccionVista(params.vista ?? "en-revision");
  const geoFilter = params.geo === "missing";

  const canPublish = canPublishInfoSpotEvent(access.subject);
  const canCreate = canCreateInfoSpotEvent(access.subject);
  const isDirector = canManageInfoSpotSettings(access.subject);

  const [eventsRaw, stats] = await Promise.all([
    listEventsForRedaccion(),
    getEventEditorialStats(),
  ]);

  const returnedCount = eventsRaw.filter((e) => hasPendingEventReturn(e)).length;
  const draftActive = eventsRaw.filter(
    (e) => e.status === "DRAFT" && !hasPendingEventReturn(e),
  ).length;
  const missingGeoCount = eventsRaw.filter((e) => !e.locationConfirmedAt).length;

  const vistaCounts: Partial<Record<RedaccionVista, number>> = {
    "mi-trabajo": filterRedaccionEvents(eventsRaw, "mi-trabajo", access.user.id).length,
    borradores: draftActive,
    "en-revision": stats.inReview,
    devueltas: returnedCount,
    publicadas: stats.published,
    despublicadas: stats.unpublished,
    archivadas: stats.archived,
  };

  let events = filterRedaccionEvents(eventsRaw, vista, access.user.id);
  if (geoFilter) {
    events = events.filter((e) => !e.locationConfirmedAt);
  }

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: "Centro Editorial", href: "/redaccion" },
          { label: "Agenda" },
        ]}
      />
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
            Agenda
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--is-muted)]">
            Próximos eventos y piezas en preparación. Una acción principal por pantalla.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/redaccion/eventos/nuevo"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            Nuevo evento
          </Link>
        ) : null}
      </header>

      <FlashBanner ok={params.ok} error={params.error} />

      {stats.inReview > 0 ? (
        <div className="mb-6 rounded-[var(--is-radius-md)] border border-[var(--is-orange-200)] bg-[var(--is-orange-50)] px-4 py-3 text-sm text-[var(--is-orange-900)]">
          Hay{" "}
          <Link href="/redaccion/eventos?vista=en-revision" className="font-semibold underline">
            {stats.inReview} evento{stats.inReview === 1 ? "" : "s"} en revisión
          </Link>
          {isDirector ? " (incluye envíos públicos pendientes de moderación)." : "."}
        </div>
      ) : null}

      {missingGeoCount > 0 ? (
        <div className="mb-6 rounded-[var(--is-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {geoFilter ? (
            <>
              Mostrando eventos sin ubicación confirmada.{" "}
              <Link href={`/redaccion/eventos?vista=${vista}`} className="font-semibold underline">
                Quitar filtro
              </Link>
            </>
          ) : (
            <>
              Hay {missingGeoCount} evento{missingGeoCount === 1 ? "" : "s"} sin ubicación
              confirmada.{" "}
              <Link
                href={`/redaccion/eventos?vista=${vista}&geo=missing`}
                className="font-semibold underline"
              >
                Revisar ubicación
              </Link>
            </>
          )}
        </div>
      ) : null}

      <RedaccionViewTabs
        active={vista}
        counts={vistaCounts}
        basePath="/redaccion/eventos"
        vistas={REDACCION_VISTAS_EVENTOS}
      />

      <EventList
        events={events}
        canPublish={canPublish}
        isDirector={isDirector}
        canCreate={canCreate}
      />
    </RedaccionShell>
  );
}
