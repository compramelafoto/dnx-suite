import type { Metadata } from "next";
import Link from "next/link";
import {
  createDraftFromClfEventAndRedirect,
  importHighPriorityClfDraftsAction,
  listAlbumPhotosForRedaccionAction,
} from "@/app/actions/clf-draft";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { listClfReadonlyCandidates } from "@/lib/clf-readonly-queries";
import { formatDateEs } from "@/lib/dates";
import {
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Borrador desde evento CLF",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ ok?: string; error?: string; albumId?: string }>;
};

export default async function RedaccionDesdeClfPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;

  if (!canManageInfoSpotSettings(access.subject)) {
    return (
      <RedaccionShell
        title="Desde evento CLF"
        description="Solo el Director puede generar borradores desde ComprameLaFoto."
      >
        <p className="text-sm text-[var(--is-muted)]">Sin permiso.</p>
        <Link href="/redaccion" className="text-[var(--is-accent)] underline">
          Volver
        </Link>
      </RedaccionShell>
    );
  }

  const { connection, candidates } = await listClfReadonlyCandidates(50);
  const high = candidates.filter((c) => c.priority === "PRIORIDAD_ALTA");
  const medium = candidates.filter((c) => c.priority === "PRIORIDAD_MEDIA");

  const albumId = Number(params.albumId || 0);
  const photosResult =
    albumId > 0 ? await listAlbumPhotosForRedaccionAction(albumId) : null;

  return (
    <RedaccionShell
      title="Crear borrador desde evento CLF"
      description="Lee ComprameLaFoto en solo lectura (CLF_READONLY_DATABASE_URL) y escribe borradores REAL en Info Spot. Nunca publica ni modifica CLF."
      actions={
        <Link
          href="/redaccion"
          className="inline-flex min-h-11 items-center text-sm text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          ← Redacción
        </Link>
      }
    >
      <FlashBanner ok={params.ok} error={params.error} />

      <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 text-sm space-y-2">
        <p className="font-semibold">Conexión CLF read-only</p>
        {connection.info.configured ? (
          <p className="text-[var(--is-text-secondary)]">
            Host: <code>{connection.info.hostMasked}</code> · DB:{" "}
            <code>{connection.info.databaseName}</code>
            {connection.counts ? (
              <>
                {" "}
                · eventos {connection.counts.events} · álbumes {connection.counts.albums} ·
                fotos {connection.counts.photos}
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-amber-800">
            {connection.error || connection.info.reason}. Configurá{" "}
            <code>CLF_READONLY_DATABASE_URL</code> en el entorno de Info Spot (no reemplazar{" "}
            <code>DATABASE_URL</code>).
          </p>
        )}
        {!connection.ok && connection.info.configured ? (
          <p className="text-amber-800">{connection.error}</p>
        ) : null}
      </div>

      {connection.ok ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 text-sm">
          <p>
            Prioridad alta: <strong>{high.length}</strong> · media: {medium.length} · total
            candidatos: {candidates.length}
          </p>
          <form action={importHighPriorityClfDraftsAction}>
            <input type="hidden" name="max" value="8" />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
              disabled={high.length === 0}
            >
              Importar 5–8 borradores PRIORIDAD_ALTA
            </button>
          </form>
        </div>
      ) : null}

      {!connection.ok || candidates.length === 0 ? (
        <div className="rounded-[var(--is-radius)] border border-dashed border-[var(--is-border-strong)] px-6 py-10 text-sm text-[var(--is-muted)]">
          Sin candidatos. Verificá la URL read-only y que la DB CLF tenga eventos con fotos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--is-border)] bg-[var(--is-bg-elevated)] text-xs uppercase tracking-wide text-[var(--is-muted)]">
              <tr>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Comercial</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.eventId} className="border-t border-[var(--is-border)] align-top">
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.priority === "PRIORIDAD_ALTA"
                          ? "bg-emerald-50 text-emerald-800"
                          : c.priority === "PRIORIDAD_MEDIA"
                            ? "bg-amber-50 text-amber-900"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.priority}
                    </span>
                    <p className="mt-1 text-xs text-[var(--is-muted)]">
                      {c.priorityReasons.slice(0, 2).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{c.nombre}</p>
                    <p className="mt-1 text-xs text-[var(--is-muted)]">
                      #{c.eventId} · {c.organizador} · {c.tipo}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {formatDateEs(c.fecha)}
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {[c.lugar, c.ciudad].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-4 text-[var(--is-muted)]">
                    {c.photoCount} / {c.albumCount} álbum(es)
                    {c.topAlbumId ? (
                      <Link
                        href={`/redaccion/desde-clf?albumId=${c.topAlbumId}`}
                        className="mt-1 block text-xs text-[var(--is-accent)] underline"
                      >
                        Ver fotos
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-xs text-[var(--is-muted)]">
                    {c.commercialStatus}
                  </td>
                  <td className="px-4 py-4">
                    {c.priority === "DESCARTAR" ? (
                      <span className="text-xs text-[var(--is-muted)]">—</span>
                    ) : (
                      <form action={createDraftFromClfEventAndRedirect}>
                        <input type="hidden" name="eventId" value={c.eventId} />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
                        >
                          Crear borrador REAL
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {photosResult?.ok && photosResult.photos.length > 0 ? (
        <section className="space-y-4">
          <h2 className="is-h3 text-xl">Fotos del álbum (preview / thumb — sin originales)</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photosResult.photos.map((p) => (
              <li
                key={p.photoId}
                className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-3 text-sm"
              >
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="mb-3 aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center bg-[var(--is-bg-elevated)] text-xs text-[var(--is-muted)]">
                    Sin preview URL pública
                  </div>
                )}
                <p className="font-medium">{p.photographerName}</p>
                <p className="text-xs text-[var(--is-muted)]">
                  {p.albumTitle} · {p.commercialStatus}
                  {p.canUseAsCover ? " · apta portada" : " · no apta portada"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </RedaccionShell>
  );
}
