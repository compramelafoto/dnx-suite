import type { Metadata } from "next";
import Link from "next/link";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { CoverageCenterPanel } from "@/components/coverage/coverage-center-panel";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  getCoverageDashboardMetrics,
  listCoveragesForCenter,
} from "@/lib/coverage";
import { syncCoveragesFormAction } from "@/app/actions/coverage";

export const metadata: Metadata = {
  title: "Centro Editorial de Coberturas — Redacción",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function CoberturasPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;

  if (!canCreateInfoSpotArticle(access.subject)) {
    return (
      <RedaccionShell
        title="Coberturas"
        description="Centro editorial de álbumes públicos de ComprameLaFoto."
      >
        <p className="text-sm text-[var(--is-muted)]">Sin permiso para coberturas.</p>
        <Link href="/redaccion" className="text-[var(--is-accent)] underline">
          Volver
        </Link>
      </RedaccionShell>
    );
  }

  const [coverages, metrics] = await Promise.all([
    listCoveragesForCenter({ take: 80 }),
    getCoverageDashboardMetrics(),
  ]);

  return (
    <RedaccionShell
      header={
        <header className="rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-white px-5 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
                Redacción
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
                Centro Editorial de Coberturas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--is-muted)]">
                Álbumes públicos de ComprameLaFoto sincronizados de forma idempotente.
                Estado comercial, editorial, fotógrafos y preparación para IA / selector /
                créditos.
              </p>
            </div>
            <form action={syncCoveragesFormAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
              >
                Sincronizar álbumes
              </button>
            </form>
          </div>
        </header>
      }
    >
      <FlashBanner ok={params.ok} error={params.error} />
      <CoverageCenterPanel coverages={coverages} metrics={metrics} />
    </RedaccionShell>
  );
}
