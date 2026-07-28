import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import {
  activateTimelineAction,
  ensureDraftTimelineAction,
  pauseTimelineAction,
  shiftFutureEventsAction,
  updateTimelineEventAction,
} from "@/lib/timeline/admin-actions";
import { getEditionTemporalState } from "@/lib/timeline/prisma-timeline";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionTimelineAdminPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, timezone: true, slug: true },
  });
  if (!edition) notFound();

  const timelines = await prisma.clickatonEditionTimeline.findMany({
    where: { editionId },
    include: {
      events: { orderBy: { sequence: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { version: "desc" },
  });

  const draft = timelines.find((t) => t.status === "DRAFT") ?? null;
  const active = timelines.find((t) => t.status === "ACTIVE") ?? null;
  const temporal = await getEditionTemporalState(editionId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Cronograma · ${edition.name}`}
        description={`Timezone: ${edition.timezone ?? "America/Argentina/Cordoba"}. ACTIVE es inmutable; cambios = nueva versión DRAFT.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Cronograma" },
        ]}
        actions={
          <>
            <form action={ensureDraftTimelineAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary">
                Asegurar DRAFT
              </Button>
            </form>
            <Button href={`${adminRoutes.editions}/${editionId}/consignas`} variant="outline">
              Consignas
            </Button>
          </>
        }
      />

      <Card variant="outlined" className="space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ck-yellow">
          Estado temporal (servidor)
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">serverNow</dt>
            <dd className="font-mono text-xs">{temporal.serverNow}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Timeline</dt>
            <dd>
              {temporal.timelineStatus ?? "sin ACTIVE"} · v{temporal.timelineVersion ?? "—"}
              {temporal.paused ? " · PAUSADO" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Próximo evento</dt>
            <dd>
              {temporal.nextEvent
                ? `${temporal.nextEvent.name} (${temporal.nextEvent.startsAt ?? "horario a confirmar"})`
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {draft ? (
        <Card variant="outlined" className="space-y-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              DRAFT v{draft.version} · {draft.timezone}
            </h2>
            <div className="flex flex-wrap gap-2">
              <form action={activateTimelineAction.bind(null, editionId, draft.id)}>
                <Button type="submit" variant="primary">
                  Activar versión
                </Button>
              </form>
              <form action={pauseTimelineAction.bind(null, editionId, draft.id)} className="flex gap-2">
                <input
                  name="reason"
                  placeholder="Motivo pausa"
                  className="rounded border border-ck-border bg-transparent px-2 text-sm"
                  aria-label="Motivo de pausa"
                />
                <Button type="submit" variant="outline" size="sm">
                  Contingencia / pausa
                </Button>
              </form>
            </div>
          </div>
          <p className="text-sm text-ck-text-secondary">
            No inventar horarios: dejar vacío = “Horario a confirmar”.
          </p>
          <ul className="space-y-4">
            {draft.events.map((ev) => (
              <li key={ev.id} className="rounded border border-ck-border p-4">
                <form
                  action={updateTimelineEventAction.bind(null, editionId)}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <input type="hidden" name="eventId" value={ev.id} />
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase text-ck-text-muted">{ev.eventType}</p>
                    <label className="mt-2 block text-sm">
                      Nombre
                      <input
                        name="name"
                        defaultValue={ev.name}
                        className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    Inicio (ISO / datetime-local)
                    <input
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={
                        ev.startsAt
                          ? new Date(ev.startsAt.getTime() - ev.startsAt.getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    Fin (opcional)
                    <input
                      name="endsAt"
                      type="datetime-local"
                      defaultValue={
                        ev.endsAt
                          ? new Date(ev.endsAt.getTime() - ev.endsAt.getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit" size="sm" variant="secondary">
                      Guardar evento
                    </Button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="text-sm text-ck-text-muted">No hay DRAFT. Usá “Asegurar DRAFT”.</p>
      )}

      {active ? (
        <Card variant="outlined" className="space-y-4 p-5">
          <h2 className="font-semibold">ACTIVE v{active.version} (inmutable)</h2>
          <ul className="space-y-2 text-sm">
            {active.events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap justify-between gap-2 border-b border-ck-border py-2">
                <span>
                  {ev.sequence}. {ev.name}{" "}
                  <span className="text-ck-text-muted">({ev.eventType})</span>
                </span>
                <span className="font-mono text-xs text-ck-text-secondary">
                  {ev.startsAt
                    ? formatAdminDateTime(ev.startsAt, active.timezone)
                    : "Horario a confirmar"}
                </span>
              </li>
            ))}
          </ul>
          <form
            action={shiftFutureEventsAction.bind(null, editionId)}
            className="flex flex-wrap items-end gap-3 border-t border-ck-border pt-4"
          >
            <label className="text-sm">
              Minutos
              <input
                name="minutes"
                type="number"
                defaultValue={20}
                className="mt-1 block w-28 rounded border border-ck-border bg-transparent px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Motivo
              <input
                name="reason"
                required
                placeholder="lluvia / demora / técnico"
                className="mt-1 block w-64 rounded border border-ck-border bg-transparent px-3 py-2"
              />
            </label>
            <Button type="submit" variant="primary">
              Desplazar futuros → nueva DRAFT
            </Button>
          </form>
          <p className="text-xs text-ck-text-muted">
            No modifica ACTIVE in-place. Eventos ya ejecutados y consignas liberadas no se mueven.
          </p>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 p-5">
        <h2 className="font-semibold">Auditoría reciente</h2>
        <ul className="space-y-2 text-sm">
          {(draft?.audits ?? active?.audits ?? []).map((a) => (
            <li key={a.id} className="font-mono text-xs text-ck-text-secondary">
              {a.createdAt.toISOString()} · {a.action}
            </li>
          ))}
          {(draft?.audits ?? active?.audits ?? []).length === 0 ? (
            <li className="text-ck-text-muted">Sin entradas.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
