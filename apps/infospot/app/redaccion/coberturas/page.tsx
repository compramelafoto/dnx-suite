import type { Metadata } from "next";
import Link from "next/link";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
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
  title: "Material editorial — Centro Editorial",
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
        title="Material editorial"
        description="Coberturas fotográficas disponibles para la redacción."
      >
        <p className="text-sm text-[var(--is-muted)]">Sin permiso para ver material.</p>
        <Link href="/redaccion" className="text-[var(--is-accent)] underline">
          Volver al Centro Editorial
        </Link>
      </RedaccionShell>
    );
  }

  const [coverages, metrics] = await Promise.all([
    listCoveragesForCenter({ take: 80 }),
    getCoverageDashboardMetrics(),
  ]);

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: "Centro Editorial", href: "/redaccion" },
          { label: "Material" },
        ]}
      />
      <header className="mb-8 max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
          Material editorial
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--is-muted)]">
          Coberturas fotográficas disponibles para escribir. Una acción principal:
          sincronizar o abrir una cobertura.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/redaccion/asistente?intent=coverage"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            Crear historia
          </Link>
          <form action={syncCoveragesFormAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
            >
              Actualizar material
            </button>
          </form>
        </div>
      </header>
      <FlashBanner ok={params.ok} error={params.error} />
      <CoverageCenterPanel coverages={coverages} metrics={metrics} />
    </RedaccionShell>
  );
}
