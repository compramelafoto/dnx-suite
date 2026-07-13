import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { DistributionAdminPanel } from "@/components/distribution/distribution-admin-panel";
import {
  canManageInfoSpotDistribution,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Distribución de portada — Redacción",
};

export default async function DistribucionPage() {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotDistribution(access.subject)) {
    redirect("/redaccion?error=Sin%20permiso%20para%20distribuci%C3%B3n");
  }

  const [placements, articles, events, eventFlags] = await Promise.all([
    prisma.infoSpotHomepagePlacement.findMany({
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
      take: 40,
      include: {
        article: { select: { id: true, title: true, slug: true } },
        event: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.infoSpotArticle.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 40,
      select: { id: true, title: true },
    }),
    prisma.infoSpotEvent.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startAt: "asc" },
      take: 40,
      select: { id: true, title: true },
    }),
    prisma.infoSpotEvent.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ editorialPriority: "desc" }, { startAt: "asc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        editorialPriority: true,
        excludeFromHomepage: true,
      },
    }),
  ]);

  const publishedOptions = [
    ...events.map((e) => ({ id: e.id, title: e.title, kind: "event" as const })),
    ...articles.map((a) => ({ id: a.id, title: a.title, kind: "article" as const })),
  ];

  return (
    <RedaccionShell
      header={
        <header className="rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-white px-5 py-8 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
            Redacción
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
            Distribución de portada
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--is-muted)]">
            Banner manual, prioridad editorial y exclusión de home. Las
            convocatorias de fotógrafos son automáticas.
          </p>
        </header>
      }
    >
      <DistributionAdminPanel
        placements={placements.map((p) => ({
          id: p.id,
          placementType: p.placementType,
          isActive: p.isActive,
          priority: p.priority,
          sortOrder: p.sortOrder,
          startsAt: p.startsAt?.toISOString() ?? null,
          endsAt: p.endsAt?.toISOString() ?? null,
          customTitle: p.customTitle,
          article: p.article,
          event: p.event,
        }))}
        publishedOptions={publishedOptions}
        events={eventFlags}
      />
    </RedaccionShell>
  );
}
