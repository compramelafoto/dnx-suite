import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import {
  archiveEventAndRedirect,
  publishEventAndRedirect,
  rejectEventAndRedirect,
  updateAdminEventAndRedirect,
} from "@/app/actions/events";
import { PageShell } from "@/components/page-shell";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { toDatetimeLocalValue } from "@/lib/dates";
import {
  canModerateInfoSpotEvents,
  requireInfoSpotEventsPanelAccess,
} from "@/lib/infospot-access";
import { buildEventPublishChecklist } from "@/lib/launch-content";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.infoSpotEvent.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: event ? `${event.title} — Admin` : "Evento — Admin" };
}

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

const OK_MESSAGES: Record<string, string> = {
  published: "Evento publicado.",
  rejected: "Evento rechazado.",
  archived: "Evento archivado.",
  saved: "Cambios guardados.",
};

export default async function AdminEventoDetailPage({ params, searchParams }: Props) {
  const access = await requireInfoSpotEventsPanelAccess();
  const canModerate = canModerateInfoSpotEvents(access.subject);
  const { id } = await params;
  const q = await searchParams;

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id },
    include: {
      category: true,
      submission: true,
    },
  });
  if (!event) notFound();

  if (!canModerate && event.status !== "PUBLISHED") {
    notFound();
  }

  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const updateAction = updateAdminEventAndRedirect.bind(null, event.id);
  const publishAction = publishEventAndRedirect.bind(null, event.id);
  const rejectAction = rejectEventAndRedirect.bind(null, event.id);
  const archiveAction = archiveEventAndRedirect.bind(null, event.id);
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
    contentTag: event.contentTag,
  });

  return (
    <PageShell
      title={event.title}
      description={`Estado: ${event.status}${event.publishedAt ? ` · Publicado ${event.publishedAt.toISOString().slice(0, 10)}` : ""}`}
    >
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/eventos" className="text-[var(--is-accent)] hover:underline">
          ← Volver al listado
        </Link>
        {event.status === "PUBLISHED" ? (
          <Link
            href={`/eventos/${event.slug}`}
            className="text-[var(--is-accent)] hover:underline"
            target="_blank"
          >
            Ver ficha pública
          </Link>
        ) : null}
      </div>

      <FlashBanner
        ok={q.ok ? OK_MESSAGES[q.ok] ?? q.ok : null}
        error={q.error}
      />

      {canModerate ? <PublishChecklist items={checklist} title="Checklist antes de publicar" /> : null}

      {canModerate ? (
        <div className="mb-8 flex flex-wrap gap-3">
          {event.status !== "PUBLISHED" && event.status !== "ARCHIVED" ? (
            <form action={publishAction}>
              <button
                type="submit"
                className="inline-flex h-11 items-center bg-[var(--is-accent)] px-5 text-sm font-semibold text-white"
              >
                Aprobar y publicar
              </button>
            </form>
          ) : null}
          {event.status !== "REJECTED" && event.status !== "ARCHIVED" ? (
            <form action={rejectAction} className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="sr-only">Motivo interno</span>
                <input
                  name="internalNotes"
                  placeholder="Observación al rechazar"
                  className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center px-4 text-sm font-medium ring-1 ring-[var(--is-border)]"
              >
                Rechazar
              </button>
            </form>
          ) : null}
          {event.status !== "ARCHIVED" ? (
            <form action={archiveAction}>
              <button
                type="submit"
                className="inline-flex h-11 items-center px-4 text-sm text-[var(--is-muted)] ring-1 ring-[var(--is-border)]"
              >
                Archivar
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="mb-8 text-sm text-[var(--is-text-secondary)]">
          Vista de consulta. Solo el Director puede aprobar o rechazar envíos.
        </p>
      )}

      {canModerate ? (
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
            <legend className="is-eyebrow">Agenda y lugar</legend>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  defaultValue={toDatetimeLocalValue(event.endAt)}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Venue</span>
              <input name="venueName" defaultValue={event.venueName ?? ""} className={fieldClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Ciudad</span>
                <input name="city" required defaultValue={event.city} className={fieldClass} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Provincia</span>
                <input
                  name="province"
                  required
                  defaultValue={event.province}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Dirección</span>
              <input name="address" defaultValue={event.address ?? ""} className={fieldClass} />
            </label>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="is-eyebrow">Organizador (privado)</legend>
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
              <span className="text-sm font-medium">Inscripción</span>
              <input
                name="registrationUrl"
                defaultValue={event.registrationUrl ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fuente</span>
              <input
                name="sourceUrl"
                defaultValue={event.sourceUrl ?? ""}
                className={fieldClass}
              />
            </label>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="is-eyebrow">Portada</legend>
            {event.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverImageUrl}
                alt=""
                className="mb-3 aspect-video max-w-md object-cover"
              />
            ) : null}
            <label className="block">
              <span className="text-sm font-medium">URL de portada</span>
              <input
                name="coverImageUrl"
                defaultValue={event.coverImageUrl ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Subir nueva portada</span>
              <input
                type="file"
                name="coverImage"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full text-sm"
              />
            </label>
          </fieldset>

          <label className="block">
            <span className="text-sm font-medium">Observaciones internas</span>
            <textarea
              name="internalNotes"
              rows={4}
              defaultValue={event.internalNotes ?? ""}
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Etiqueta interna</span>
            <select
              name="contentTag"
              defaultValue={event.contentTag}
              className={fieldClass}
            >
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
              <option value="DEMO">DEMO</option>
              <option value="REAL">REAL</option>
            </select>
          </label>

          {event.submission ? (
            <p className="text-xs text-[var(--is-muted)]">
              Envío {event.submission.createdAt.toISOString()} · ipHash{" "}
              {event.submission.ipHash?.slice(0, 12) ?? "—"}…
            </p>
          ) : null}

          <button
            type="submit"
            className="is-btn is-btn-solid h-11 px-6 text-sm"
          >
            Guardar cambios
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-sm text-[var(--is-text-secondary)]">
          <p>{event.summary}</p>
          <p className="whitespace-pre-wrap">{event.description}</p>
          <p>
            {event.city}, {event.province} · Organiza {event.organizerName}
          </p>
          <p className="text-xs text-[var(--is-muted)]">
            Email y teléfono del organizador no se muestran a redactores en este MVP
            de consulta pública; pedí acceso al Director si necesitás contactar.
          </p>
        </div>
      )}
    </PageShell>
  );
}
