import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import {
  canModerateInfoSpotEvents,
  requireInfoSpotEventsPanelAccess,
} from "@/lib/infospot-access";
import { formatDateEs } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Eventos — Admin",
};

type Props = {
  searchParams: Promise<{ status?: string; ok?: string; error?: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "En revisión",
  PUBLISHED: "Publicados",
  REJECTED: "Rechazados",
  ARCHIVED: "Archivados",
  DRAFT: "Borradores",
};

export default async function AdminEventosPage({ searchParams }: Props) {
  const access = await requireInfoSpotEventsPanelAccess();
  const canModerate = canModerateInfoSpotEvents(access.subject);
  const params = await searchParams;

  const statusFilter = canModerate
    ? params.status || "PENDING_REVIEW"
    : "PUBLISHED";

  const events = await prisma.infoSpotEvent.findMany({
    where: { status: statusFilter as "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED" | "DRAFT" },
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    take: 80,
    include: {
      category: { select: { name: true } },
      submission: { select: { createdAt: true, ipHash: true } },
    },
  });

  const filters = canModerate
    ? (["PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED", "DRAFT"] as const)
    : (["PUBLISHED"] as const);

  return (
    <PageShell
      title="Eventos"
      description={
        canModerate
          ? "Revisá envíos públicos, publicá o rechazá. Los datos de contacto del organizador son internos."
          : "Consultá eventos publicados para vincularlos a noticias (próximamente)."
      }
    >
      <div className="mb-4">
        <Link
          href="/eventos"
          className="text-sm text-[var(--is-accent)] hover:underline"
        >
          Ver portal público
        </Link>
      </div>
      <FlashBanner ok={params.ok} error={params.error} />

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((value) => (
          <Link
            key={value}
            href={`/admin/eventos?status=${value}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
              statusFilter === value
                ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)] text-[var(--is-accent-hover)]"
                : "border-[var(--is-border)] bg-white text-[var(--is-text-secondary)]"
            }`}
          >
            {STATUS_LABELS[value] ?? value}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--is-border)] bg-[var(--is-bg-elevated)] text-xs uppercase tracking-wide text-[var(--is-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Evento</th>
              <th className="px-4 py-3 font-semibold">Cuándo</th>
              <th className="px-4 py-3 font-semibold">Lugar</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Organizador</th>
              <th className="px-4 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--is-muted)]">
                  No hay eventos en este filtro.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-t border-[var(--is-border)] align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--is-text)]">{event.title}</p>
                    <p className="mt-1 text-xs text-[var(--is-muted)]">
                      {event.category?.name ?? "Sin categoría"} · {event.slug}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {formatDateEs(event.startAt)}
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {event.city}, {event.province}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-[var(--is-bg-elevated)] px-2 py-1 text-xs">
                      {STATUS_LABELS[event.status] ?? event.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {canModerate ? (
                      <>
                        <p>{event.organizerName}</p>
                        <p className="text-xs">{event.organizerEmail}</p>
                      </>
                    ) : (
                      <p>{event.organizerName}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/eventos/${event.id}`}
                      className="text-[var(--is-accent)] hover:underline"
                    >
                      {canModerate ? "Revisar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
