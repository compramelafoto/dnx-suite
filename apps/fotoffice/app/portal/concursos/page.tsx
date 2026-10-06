import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadShowcase } from "@/lib/contests/load";
import type { ShowcasePhase } from "@/lib/contests/showcase";
import { ContestCard } from "@/components/contests/contest-card";

export const dynamic = "force-dynamic";

const SECCIONES: { phase: ShowcasePhase; titulo: string; vacio: string }[] = [
  { phase: "open", titulo: "Abiertos", vacio: "Ahora no hay concursos con la inscripción abierta." },
  { phase: "upcoming", titulo: "Próximamente", vacio: "" },
  { phase: "in_progress", titulo: "En evaluación o en curso", vacio: "" },
  { phase: "results", titulo: "Resultados recientes", vacio: "" },
];

export default async function ConcursosPage() {
  const user = await requireAuth();
  const ctx = await loadPortalContext(user.id);
  if (!ctx) redirect("/portal");
  const [items, branding] = await Promise.all([
    loadShowcase(ctx.workspace.id),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: ctx.workspace.id }, select: { commercialName: true } }),
  ]);
  const institucion = branding?.commercialName?.trim() || ctx.workspace.name;
  const ahora = new Date();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Concursos</h1>
        <p className="max-w-2xl text-sm text-[var(--fo-muted)]">
          Concursos fotográficos de FotoRank y maratones de Clickatón. Los que organiza {institucion} van primero.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Por ahora no hay concursos para mostrar. Cuando se abra uno, va a aparecer acá y en tu campanita.</p>
      ) : (
        SECCIONES.map((s) => {
          const lista = items.filter((i) => i.phase === s.phase);
          if (lista.length === 0 && !s.vacio) return null;
          return (
            <section key={s.phase} className="space-y-3">
              <h2 className="text-lg font-semibold">{s.titulo}</h2>
              {lista.length === 0 ? (
                <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">{s.vacio}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {lista.map((i) => (
                    <ContestCard key={i.key} item={i} institution={institucion} now={ahora} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
