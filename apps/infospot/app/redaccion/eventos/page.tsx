import type { Metadata } from "next";
import Link from "next/link";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
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
  title: "Eventos — Redacción",
};

type PageProps = {
  searchParams: Promise<{ vista?: string; ok?: string; error?: string; geo?: string }>;
};

export default async function RedaccionEventosPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const vista = parseRedaccionVista(params.vista);
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
    <RedaccionShell
      header={
        <header className="rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-white px-5 py-8 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
            Redacción · Eventos
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
                Agenda editorial
              </h1>
              <p className="mt-2 text-sm text-[var(--is-muted)]">
                Mismo flujo que las noticias: borrador → revisión → publicación.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/redaccion"
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
              >
                Noticias
              </Link>
              {canCreate ? (
                <Link
                  href="/redaccion/eventos/nuevo"
                  className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
                >
                  Nuevo evento
                </Link>
              ) : null}
            </div>
          </div>
        </header>
      }
    >
      <FlashBanner ok={params.ok} error={params.error} />

      {isDirector && stats.inReview > 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-[var(--is-orange-200)] bg-[var(--is-orange-50)] px-4 py-3 text-sm text-[var(--is-orange-900)]">
          Hay{" "}
          <Link href="/redaccion/eventos?vista=en-revision" className="font-semibold underline">
            {stats.inReview} evento{stats.inReview === 1 ? "" : "s"} en revisión
          </Link>
          .
        </div>
      ) : null}

      {missingGeoCount > 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {geoFilter ? (
            <>
              Mostrando eventos sin georreferenciación confirmada.{" "}
              <Link href={`/redaccion/eventos?vista=${vista}`} className="font-semibold underline">
                Quitar filtro
              </Link>
            </>
          ) : (
            <>
              Hay {missingGeoCount} evento{missingGeoCount === 1 ? "" : "s"} sin geo confirmada.{" "}
              <Link
                href={`/redaccion/eventos?vista=${vista}&geo=missing`}
                className="font-semibold underline"
              >
                Falta georreferenciar
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
