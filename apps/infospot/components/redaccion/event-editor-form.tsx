import Link from "next/link";
import { updateRedaccionEventAndRedirect } from "@/app/actions/events";
import { EventEditorialActionsPanel } from "@/components/redaccion/editorial-actions-panel";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { StatusBadge } from "@/components/redaccion/status-badge";
import {
  PhotographerCallPanel,
  type PhotographerCallShape,
} from "@/components/redaccion/photographer-call-panel";
import {
  EventLocationFormFields,
  defaultLocationValue,
} from "@/components/geolocation/event-location-form-fields";
import { toDatetimeLocalValue } from "@/lib/dates";
import {
  EVENT_STATUS_LABELS,
  hasPendingEventReturn,
  type EventStatus,
} from "@/lib/editorial/event-adapter";
import { buildEventPublishChecklist, checklistWarnings } from "@/lib/launch-content";
import type { InfoSpotPermissionSubject } from "@repo/db";

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

type Category = { id: string; name: string };

type EventShape = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string;
  categoryId: string | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string | null;
  organizerWebsite: string | null;
  startAt: Date;
  endAt: Date | null;
  venueName: string | null;
  city: string;
  province: string;
  address: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodingStatus?: string | null;
  locationConfirmedAt?: Date | null;
  locationVisibility?: string | null;
  geocodingPlaceId?: string | null;
  geocodingProvider?: string | null;
  registrationUrl: string | null;
  sourceUrl: string | null;
  coverImageUrl: string | null;
  internalNotes: string | null;
  contentTag: string;
  status: string;
  originKind: string;
  returnedAt: Date | null;
  submittedForReviewAt: Date | null;
  contentOrigins?: Array<{
    syncStatus: string;
    lastSyncedAt: Date | null;
    externalUrl: string | null;
    syncError: string | null;
    operationalPayload: unknown;
  }>;
  observations: Array<{
    message: string;
    createdAt: Date;
    author: { name: string | null };
  }>;
};

type Props = {
  event: EventShape;
  categories: Category[];
  subject: InfoSpotPermissionSubject;
  canPublish: boolean;
  isDirector: boolean;
  canProvisionCall: boolean;
  photographerCall: PhotographerCallShape | null;
  suggestedClfEventType: string;
  ok?: string;
  error?: string;
};

export function EventEditorForm({
  event,
  categories,
  subject,
  canPublish,
  isDirector,
  canProvisionCall,
  photographerCall,
  suggestedClfEventType,
  ok,
  error,
}: Props) {
  const updateAction = updateRedaccionEventAndRedirect.bind(null, event.id);
  const pendingReturn = hasPendingEventReturn(event);
  const checklist = buildEventPublishChecklist({
    title: event.title,
    summary: event.summary,
    description: event.description,
    categoryId: event.categoryId,
    coverImageUrl: event.coverImageUrl,
    organizerName: event.organizerName,
    startAt: event.startAt,
    city: event.city,
    province: event.province,
    slug: event.slug,
    contentTag: event.contentTag as "DEMO" | "REAL" | "NEEDS_REVIEW",
    latitude: event.latitude,
    longitude: event.longitude,
    locationConfirmedAt: event.locationConfirmedAt,
    geocodingStatus: event.geocodingStatus,
  });
  const latestReturn = event.observations[0]
    ? {
        message: event.observations[0].message,
        createdAt: event.observations[0].createdAt,
        authorName: event.observations[0].author.name || "Director",
      }
    : null;

  const clfOrigin = event.contentOrigins?.[0];
  const recentChanges = Array.isArray(
    (clfOrigin?.operationalPayload as { recentChanges?: unknown } | null)?.recentChanges,
  )
    ? ((clfOrigin?.operationalPayload as { recentChanges: string[] }).recentChanges ?? [])
    : [];
  const missingGeoref = !event.locationConfirmedAt;

  const syncStatusLabel =
    clfOrigin?.syncStatus === "SYNCED"
      ? "Sincronizado"
      : clfOrigin?.syncStatus === "FAILED"
        ? "Con error"
        : clfOrigin?.syncStatus === "STALE"
          ? "Desactualizado"
          : clfOrigin?.syncStatus ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/redaccion/eventos" className="text-sm text-[var(--is-accent)] hover:underline">
            ← Eventos
          </Link>
          <StatusBadge
            status={event.status}
            pendingReturn={pendingReturn}
            labels={EVENT_STATUS_LABELS}
            pendingReturnLabel="Devuelto"
          />
        </div>

        <FlashBanner ok={ok} error={error} />

        {clfOrigin || event.originKind === "IMPORTED" ? (
          <div className="rounded-[var(--is-radius-md)] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="font-semibold">Origen: ComprameLaFoto</p>
            {syncStatusLabel ? (
              <p className="mt-1">Estado: {syncStatusLabel}</p>
            ) : null}
            {clfOrigin?.lastSyncedAt ? (
              <p className="mt-1">
                Última sincronización:{" "}
                {new Date(clfOrigin.lastSyncedAt).toLocaleString("es-AR")}
              </p>
            ) : null}
            {clfOrigin?.externalUrl ? (
              <p className="mt-1">
                <a
                  href={clfOrigin.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--is-accent)] hover:underline"
                >
                  Abrir evento en CLF
                </a>
              </p>
            ) : null}
            {clfOrigin?.syncError ? (
              <p className="mt-2 text-red-800">Error: {clfOrigin.syncError}</p>
            ) : null}
            {recentChanges.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Este evento fue actualizado desde ComprameLaFoto.</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {recentChanges.slice(0, 8).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {missingGeoref ? (
          <div className="rounded-[var(--is-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Este evento todavía no está georreferenciado.
          </div>
        ) : null}

        <form action={updateAction} encType="multipart/form-data" className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="is-eyebrow">Contenido</legend>
            <label className="block">
              <span className="text-sm font-medium">Título</span>
              <input name="title" required defaultValue={event.title} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Slug</span>
              <input name="slug" required defaultValue={event.slug} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Resumen</span>
              <input name="summary" defaultValue={event.summary ?? ""} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Descripción</span>
              <textarea
                name="description"
                required
                rows={8}
                defaultValue={event.description}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Categoría</span>
              <select
                name="categoryId"
                defaultValue={event.categoryId ?? ""}
                className={fieldClass}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="is-eyebrow">Cuándo y dónde</legend>
            <label className="block">
              <span className="text-sm font-medium">Inicio</span>
              <input
                type="datetime-local"
                name="startAt"
                required
                defaultValue={toDatetimeLocalValue(event.startAt)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fin</span>
              <input
                type="datetime-local"
                name="endAt"
                defaultValue={event.endAt ? toDatetimeLocalValue(event.endAt) : ""}
                className={fieldClass}
              />
            </label>
          </fieldset>

          <EventLocationFormFields
            eventId={event.id}
            mode="redaccion"
            initial={defaultLocationValue({
              city: event.city,
              province: event.province,
              address: event.address,
              venueName: event.venueName,
              postalCode: event.postalCode,
              countryCode: event.countryCode,
              countryName: event.countryName,
              latitude: event.latitude,
              longitude: event.longitude,
              locationVisibility: event.locationVisibility,
              geocodingStatus: event.geocodingStatus,
              locationConfirmedAt: event.locationConfirmedAt,
              geocodingPlaceId: event.geocodingPlaceId,
              geocodingProvider: event.geocodingProvider,
            })}
          />

          <PhotographerCallPanel
            eventId={event.id}
            call={photographerCall}
            defaultOrganizerEmail={event.organizerEmail}
            defaultClfEventType={suggestedClfEventType}
            missingGeoref={missingGeoref}
            canProvision={canProvisionCall}
          />

          <fieldset className="space-y-4">
            <legend className="is-eyebrow">Organizador (interno)</legend>
            <label className="block">
              <span className="text-sm font-medium">Nombre</span>
              <input
                name="organizerName"
                required
                defaultValue={event.organizerName}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                name="organizerEmail"
                type="email"
                required
                defaultValue={event.organizerEmail}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Teléfono</span>
              <input
                name="organizerPhone"
                defaultValue={event.organizerPhone ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Web</span>
              <input
                name="organizerWebsite"
                defaultValue={event.organizerWebsite ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">URL de inscripción</span>
              <input
                name="registrationUrl"
                defaultValue={event.registrationUrl ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fuente</span>
              <input name="sourceUrl" defaultValue={event.sourceUrl ?? ""} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Portada (URL)</span>
              <input
                name="coverImageUrl"
                defaultValue={event.coverImageUrl ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Nueva imagen de portada</span>
              <input type="file" name="coverImage" accept="image/*" className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Notas internas</span>
              <textarea
                name="internalNotes"
                rows={3}
                defaultValue={event.internalNotes ?? ""}
                className={fieldClass}
              />
            </label>
          </fieldset>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white"
          >
            Guardar cambios
          </button>
        </form>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
        <PublishChecklist items={checklist} title="Checklist antes de publicar" />
        <EventEditorialActionsPanel
          eventId={event.id}
          status={event.status as EventStatus}
          subject={subject}
          returnedAt={event.returnedAt}
          submittedForReviewAt={event.submittedForReviewAt}
          latestReturn={latestReturn}
          checklistMissing={checklistWarnings(checklist)}
          canPublish={canPublish}
          isDirector={isDirector}
        />
      </aside>
    </div>
  );
}
