import Link from "next/link";
import { StatusBadge } from "@/components/redaccion/status-badge";
import {
  EVENT_STATUS_LABELS,
  expectedEventActionHint,
  hasPendingEventReturn,
  type EventStatus,
} from "@/lib/editorial/event-adapter";
import { formatDateEs } from "@/lib/dates";
import { summarizeEventChecklist } from "@/lib/redaccion-events";

type ClfOrigin = {
  syncStatus: string;
  lastSyncedAt: Date | null;
  externalUrl: string | null;
  syncError: string | null;
  operationalPayload: unknown;
};

type EventRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  originKind: string;
  startAt: Date;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  geocodingStatus?: string | null;
  locationConfirmedAt?: Date | null;
  locationVisibility?: string | null;
  authorId: number | null;
  returnedAt: Date | null;
  submittedForReviewAt: Date | null;
  summary: string | null;
  description: string;
  categoryId: string | null;
  coverImageUrl: string | null;
  organizerName: string;
  contentTag: string;
  category: { name: string } | null;
  contentOrigins: ClfOrigin[];
  observations: Array<{
    message: string;
    createdAt: Date;
    author: { name: string | null };
  }>;
};

type Props = {
  events: EventRow[];
  canPublish: boolean;
  isDirector: boolean;
  canCreate: boolean;
};

const SYNC_LABELS: Record<string, string> = {
  PENDING: "Sync pendiente",
  SYNCED: "Sincronizado",
  FAILED: "Error de sync",
  STALE: "Desactualizado",
  DISABLED: "Sync deshabilitado",
};

function geoBadge(event: EventRow): { label: string; className: string } {
  if (event.locationConfirmedAt) {
    return {
      label:
        event.locationVisibility === "APPROXIMATE"
          ? "Ubicación aproximada"
          : "Geo confirmada",
      className: "bg-emerald-50 text-emerald-800",
    };
  }
  if (event.geocodingStatus === "NEEDS_REVIEW") {
    return { label: "Requiere revisión", className: "bg-amber-50 text-amber-900" };
  }
  if (
    event.latitude == null ||
    event.longitude == null ||
    (event.latitude === 0 && event.longitude === 0)
  ) {
    return { label: "Falta ubicación", className: "bg-red-50 text-red-800" };
  }
  return { label: "Geo pendiente de confirmar", className: "bg-amber-50 text-amber-900" };
}

function missingHints(event: EventRow): string[] {
  const missing: string[] = [];
  if (!event.coverImageUrl) missing.push("portada");
  if (!event.locationConfirmedAt) missing.push("georreferenciación");
  if (!event.categoryId) missing.push("categoría");
  if ((event.description || "").trim().length < 20) missing.push("descripción");
  return missing;
}

export function EventList({ events, canPublish, isDirector, canCreate }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border-strong)] bg-white px-6 py-12 text-center">
        <p className="text-sm text-[var(--is-muted)]">No hay eventos en esta bandeja.</p>
        {canCreate ? (
          <Link
            href="/redaccion/eventos/nuevo"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            Nuevo evento
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {events.map((event) => {
        const pendingReturn = hasPendingEventReturn(event);
        const checklist = summarizeEventChecklist({
          ...event,
          latitude: event.latitude,
          longitude: event.longitude,
          locationConfirmedAt: event.locationConfirmedAt,
          geocodingStatus: event.geocodingStatus,
        });
        const hint = expectedEventActionHint(event.status as EventStatus, {
          pendingReturn,
          isDirector,
          canPublish,
        });
        const origin = event.contentOrigins[0];
        const gaps = missingHints(event);
        const geo = geoBadge(event);
        return (
          <li key={event.id}>
            <article className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 transition-colors hover:border-[var(--is-border-strong)]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={event.status}
                  pendingReturn={pendingReturn}
                  labels={EVENT_STATUS_LABELS}
                  pendingReturnLabel="Devuelto"
                />
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${geo.className}`}>
                  {geo.label}
                </span>
                <span className="text-xs text-[var(--is-muted)]">
                  {event.category?.name ?? "Sin categoría"}
                </span>
                {event.originKind === "IMPORTED" || origin ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                    ComprameLaFoto
                  </span>
                ) : null}
                {origin ? (
                  <span className="rounded-full border border-[var(--is-border)] bg-white px-2 py-0.5 text-xs text-[var(--is-muted)]">
                    {SYNC_LABELS[origin.syncStatus] ?? origin.syncStatus}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight">
                <Link
                  href={`/redaccion/eventos/${event.id}/editar`}
                  className="hover:text-[var(--is-accent)]"
                >
                  {event.title}
                </Link>
              </h3>
              <p className="mt-2 text-sm text-[var(--is-muted)]">
                {formatDateEs(event.startAt)} · {event.city}, {event.province}
              </p>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">{hint}</p>
              {origin?.lastSyncedAt ? (
                <p className="mt-1 text-xs text-[var(--is-muted)]">
                  Última sync: {formatDateEs(origin.lastSyncedAt)}
                  {origin.externalUrl ? (
                    <>
                      {" · "}
                      <a
                        href={origin.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--is-accent)] hover:underline"
                      >
                        Ver en CLF
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {gaps.length > 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  Falta: {gaps.join(", ")}
                </p>
              ) : null}
              {checklist.missing.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--is-muted)]">
                  Checklist: {checklist.done}/{checklist.total} · Falta{" "}
                  {checklist.missing.join(", ")}
                </p>
              ) : null}
              {pendingReturn && event.observations[0] ? (
                <p className="mt-3 line-clamp-2 rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {event.observations[0].message}
                </p>
              ) : null}
              <div className="mt-4">
                <Link
                  href={`/redaccion/eventos/${event.id}/editar`}
                  className="text-sm font-medium text-[var(--is-accent)] hover:underline"
                >
                  Editar
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
