import Link from "next/link";
import type { CoverageDashboardMetrics } from "@/lib/coverage";

type CoverageRow = {
  id: string;
  title: string;
  city: string | null;
  eventTitle: string | null;
  photoCount: number;
  commercialStatus: string;
  canShowPurchaseCta: boolean;
  editorialStatus: string;
  discoveryStatus: string;
  syncStatus: string;
  priorityScore: number;
  photographers: Array<{ id: string; displayName: string; role: string }>;
  articles: Array<{
    id: string;
    article: { id: string; title: string; status: string };
  }>;
};

export function CoverageCenterPanel({
  coverages,
  metrics,
}: {
  coverages: CoverageRow[];
  metrics: CoverageDashboardMetrics;
}) {
  return (
    <div className="space-y-10">
      <section
        aria-label="Métricas del centro"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["Total", metrics.total],
          ["Disponibles", metrics.availableCommercial],
          ["Con notas", metrics.withArticles],
          ["Multi-fotógrafo", metrics.multiPhotographer],
          ["Descubiertas", metrics.discovered],
          ["Vinculadas", metrics.linked],
          ["Stale", metrics.stale],
          ["IA lista", metrics.aiReady],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white px-4 py-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {coverages.length === 0 ? (
        <p className="rounded-[var(--is-radius)] border border-dashed border-[var(--is-border)] bg-white p-8 text-sm text-[var(--is-muted)]">
          No hay coberturas aún. Ejecutá «Sincronizar álbumes» para importar álbumes
          públicos de ComprameLaFoto.
        </p>
      ) : (
        <ul className="space-y-4">
          {coverages.map((c) => (
            <li
              key={c.id}
              className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <Link
                    href={`/redaccion/coberturas/${c.id}`}
                    className="text-lg font-semibold text-[var(--is-text)] hover:text-[var(--is-accent)]"
                  >
                    {c.title}
                  </Link>
                  <p className="text-sm text-[var(--is-muted)]">
                    {[c.eventTitle, c.city].filter(Boolean).join(" · ") || "Sin evento / ciudad"}
                    {" · "}
                    {c.photoCount} fotos · prioridad {c.priorityScore}
                  </p>
                  <p className="text-xs text-[var(--is-muted)]">
                    Comercial: {c.commercialStatus}
                    {c.canShowPurchaseCta ? "" : " (sin CTA)"} · Editorial:{" "}
                    {c.editorialStatus} · Sync: {c.syncStatus}
                  </p>
                  <p className="text-xs text-[var(--is-text-secondary)]">
                    Fotógrafos:{" "}
                    {c.photographers.length
                      ? c.photographers.map((p) => p.displayName).join(", ")
                      : "—"}
                  </p>
                  {c.articles.length > 0 ? (
                    <p className="text-xs text-[var(--is-text-secondary)]">
                      Notas:{" "}
                      {c.articles
                        .map((a) => `${a.article.title} (${a.article.status})`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/redaccion/coberturas/${c.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
                >
                  Abrir
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
