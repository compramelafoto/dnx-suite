import Link from "next/link";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { loadMemberProjects, loadVoting } from "@/lib/governance/repository";
import { proposalStateForMember } from "@/lib/governance/proposals";
import { progressOf } from "@/lib/governance/urgency";
import { fecha, projectStatusLabel } from "@/lib/governance/labels";
import { isVotingOpen, tallyLabel } from "@/lib/governance/votes";
import { ProgressBar } from "@/components/governance/badges";
import { isMemberPollOpen } from "@/lib/governance/member-pulse";
import type { ProjectStatus } from "@/lib/governance/constants";

export const dynamic = "force-dynamic";

const TONO: Record<string, string> = {
  warning: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  success: "bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
  danger: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
  info: "bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]",
};

/** Quien llegó por un enlace de WhatsApp a algo que es sólo de la comisión. */
const AVISO_ENLACE: Record<string, string> = {
  interno: "Ese proyecto es interno de la comisión directiva. Cuando la comisión lo haga visible para los socios, lo vas a ver acá.",
  reunion: "Las reuniones son de la comisión directiva. Lo que se decide en cada proyecto visible lo vas a ver acá.",
};

export default async function MisProyectosPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { workspace, member } = await requirePortalGovernance();
  const { aviso } = await searchParams;
  const { propias, visibles } = await loadMemberProjects(workspace.id, member.id);
  const votacion = await loadVoting(workspace.id, visibles.map((p) => p.id));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Mis proyectos</h1>
          <p className="max-w-2xl text-sm text-[var(--fo-muted)]">
            ¿Tenés una idea para la institución? Presentala a la comisión directiva: la trata en la próxima reunión y
            acá vas a ver en qué quedó.
          </p>
        </div>
        <Link href="/portal/proyectos/proponer" className="fo-btn fo-btn-primary text-sm">
          Proponer un proyecto
        </Link>
      </header>

      {aviso && AVISO_ENLACE[aviso] ? <p className="fo-alert-warning p-4 text-sm">{AVISO_ENLACE[aviso]}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mis propuestas</h2>
        {propias.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no presentaste ninguna propuesta.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {propias.map((p) => {
              const estado = proposalStateForMember(p.status);
              return (
                <li key={p.id} className="space-y-1 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/portal/proyectos/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONO[estado.tone]}`}>{estado.label}</span>
                  </div>
                  <p className="text-xs text-[var(--fo-muted)]">Presentada el {fecha(p.createdAt)}</p>
                  {(p.status === "ARCHIVED" || p.status === "REJECTED") && p.statusReason ? (
                    <p className="text-[var(--fo-text-secondary)]">Motivo: {p.statusReason}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Proyectos de la institución</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Entrá a cada uno para decir si lo apoyás y dejarle tu opinión a la comisión. Tu voto es privado.
          </p>
        </div>
        {visibles.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">La comisión todavía no compartió proyectos con los socios.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {visibles.map((p) => {
              const avance = progressOf(p.tasks.map((t) => ({ status: t.status as "PENDING" })));
              return (
                <li key={p.id} className="fo-card space-y-2 p-5 text-sm">
                  <Link href={`/portal/proyectos/${p.id}`} className="font-semibold hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {projectStatusLabel(p.status)}
                    {p.deadlineAt ? ` · para el ${fecha(p.deadlineAt)}` : ""}
                    {isVotingOpen(p.status as ProjectStatus) ? ` · ${tallyLabel(votacion.tallyOf(p.id))}` : ""}
                  </p>
                  {avance.total > 0 ? <ProgressBar {...avance} /> : null}
                  {isMemberPollOpen({ status: p.status, visibleToMembers: true }) ? (
                    <Link href={`/portal/proyectos/${p.id}#opinar`} className="inline-block text-xs text-[var(--fo-accent)] hover:underline">
                      👍 👎 Votá y opiná →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
