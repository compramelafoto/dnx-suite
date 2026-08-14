import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { ClfEditorialPhotoSelector } from "@/components/editorial-photos/clf-editorial-photo-selector";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { buildCoverageSummaryStub, getCoverageById } from "@/lib/coverage";
import {
  createArticleFromCoverageFormAction,
  dismissCoverageFormAction,
} from "@/app/actions/coverage";
import {
  retryEditorialDerivativeFormAction,
  removeEditorialPhotoUsageFormAction,
} from "@/app/actions/editorial-photos";

export const metadata: Metadata = {
  title: "Cobertura — Redacción",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
};

export default async function CoberturaDetailPage({ params, searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    notFound();
  }

  const { id } = await params;
  const q = await searchParams;
  const coverage = await getCoverageById(id);
  if (!coverage) notFound();

  const summary = buildCoverageSummaryStub({
    title: coverage.title,
    city: coverage.city,
    eventTitle: coverage.eventTitle,
    photoCount: coverage.photoCount,
    photographerNames: coverage.photographers.map((p) => p.displayName),
  });

  const primaryArticleId = coverage.articles[0]?.article.id;
  const selected = coverage.editorialPhotos ?? [];
  const processing = selected.filter((p) =>
    ["PENDING", "PROCESSING"].includes(p.processStatus),
  );
  const unavailable = selected.filter(
    (p) =>
      ["FAILED", "UNAVAILABLE"].includes(p.processStatus) ||
      p.commercialStatus === "DELETED",
  );
  const cover = selected.find((p) => p.usages.some((u) => u.usageType === "COVER"));
  const gallery = selected.filter((p) => p.usages.some((u) => u.usageType === "GALLERY"));

  return (
    <RedaccionShell
      title={coverage.title}
      description="Cobertura fotográfica disponible para redactar."
      actions={
        <Link
          href="/redaccion/coberturas"
          className="text-sm text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          ← Coberturas
        </Link>
      }
    >
      <FlashBanner ok={q.ok} error={q.error} />

      <div className="space-y-8">
        <section className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--is-muted)]">
            Estado del material
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--is-muted)]">Redacción</dt>
              <dd className="font-semibold">
                {coverage.editorialStatus === "UNASSIGNED"
                  ? "Sin asignar"
                  : coverage.editorialStatus === "DRAFTING"
                    ? "En redacción"
                    : coverage.editorialStatus === "PUBLISHED"
                      ? "Con nota publicada"
                      : coverage.editorialStatus === "STALE"
                        ? "Desactualizado"
                        : coverage.editorialStatus}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--is-muted)]">Disponibilidad</dt>
              <dd className="font-semibold">
                {coverage.commercialStatus === "AVAILABLE"
                  ? "Disponible"
                  : coverage.commercialStatus === "REACTIVATABLE"
                    ? "Reactivable"
                    : coverage.commercialStatus === "UNAVAILABLE"
                      ? "No disponible"
                      : "Por confirmar"}
                {coverage.canShowPurchaseCta ? " · compra pública" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--is-muted)]">Actualización</dt>
              <dd className="font-semibold">
                {coverage.syncStatus === "SYNCED"
                  ? "Al día"
                  : coverage.syncStatus === "PENDING"
                    ? "Pendiente"
                    : coverage.syncStatus === "FAILED"
                      ? "Con error"
                      : coverage.syncStatus === "STALE"
                        ? "Desactualizado"
                        : coverage.syncStatus}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--is-muted)]">En bandeja</dt>
              <dd className="font-semibold">
                {coverage.discoveryStatus === "DISMISSED"
                  ? "Descartada"
                  : coverage.discoveryStatus === "LINKED"
                    ? "Vinculada a una historia"
                    : "Disponible"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {coverage.publicUrl && coverage.canShowPurchaseCta ? (
              <a
                href={coverage.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
              >
                Abrir en ComprameLaFoto
              </a>
            ) : (
              <span className="text-sm text-[var(--is-muted)]">Sin enlace público de compra</span>
            )}
            <form action={createArticleFromCoverageFormAction}>
              <input type="hidden" name="coverageId" value={coverage.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
              >
                Crear nota desde esta galería
              </button>
            </form>
            <Link
              href={`/redaccion/asistente?intent=coverage&coverageId=${coverage.id}`}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
            >
              Abrir asistente
            </Link>
            <form action={dismissCoverageFormAction}>
              <input type="hidden" name="coverageId" value={coverage.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm"
              >
                Descartar
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Seleccionar fotografías</h2>
          <ClfEditorialPhotoSelector
            albumId={coverage.clfAlbumId}
            coverageId={coverage.id}
            articleId={primaryArticleId}
            defaultUsage="GALLERY"
          />
        </section>

        <section className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold">Fotos seleccionadas</h2>
          {selected.length === 0 ? (
            <p className="text-sm text-[var(--is-muted)]">Todavía no hay fotos seleccionadas.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {selected.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--is-border)] pb-3"
                >
                  <div>
                    <p className="font-medium">{p.photographerName}</p>
                    <p className="text-xs text-[var(--is-muted)]">
                      {p.processStatus} · {p.commercialStatus} · {p.editorialLicenseStatus}
                    </p>
                    <p className="text-xs text-[var(--is-muted)]">{p.credit}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.processStatus === "FAILED" ? (
                      <form action={retryEditorialDerivativeFormAction}>
                        <input type="hidden" name="photoId" value={p.id} />
                        <button type="submit" className="rounded border px-3 py-2 text-xs">
                          Reintentar
                        </button>
                      </form>
                    ) : null}
                    {p.usages[0] ? (
                      <form action={removeEditorialPhotoUsageFormAction}>
                        <input type="hidden" name="usageId" value={p.usages[0].id} />
                        <button type="submit" className="rounded border px-3 py-2 text-xs">
                          Retirar de nota
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-4 text-sm">
            <p className="font-semibold">Portada elegida</p>
            <p className="mt-2 text-[var(--is-muted)]">
              {cover ? cover.photographerName : "Sin portada todavía"}
            </p>
          </div>
          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-4 text-sm">
            <p className="font-semibold">Galería</p>
            <p className="mt-2 text-[var(--is-muted)]">{gallery.length} fotos</p>
          </div>
          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-4 text-sm">
            <p className="font-semibold">En proceso / no disponibles</p>
            <p className="mt-2 text-[var(--is-muted)]">
              {processing.length} procesando · {unavailable.length} no disponibles
            </p>
          </div>
        </section>

        <section className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold">Resumen sugerido</h2>
          <p className="text-sm leading-relaxed text-[var(--is-text-secondary)]">{summary}</p>
        </section>

        <section className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold">Artículos vinculados</h2>
          {coverage.articles.length === 0 ? (
            <p className="text-sm text-[var(--is-muted)]">Todavía no hay notas.</p>
          ) : (
            <ul className="space-y-2">
              {coverage.articles.map((link) => (
                <li key={link.id}>
                  <Link
                    href={`/redaccion/noticias/${link.article.id}/editar`}
                    className="text-sm font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
                  >
                    {link.article.title}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--is-muted)]">
                    {link.article.status} · {link.linkRole}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </RedaccionShell>
  );
}
