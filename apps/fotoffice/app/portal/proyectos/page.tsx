import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleDashed,
  FolderOpen,
  Lightbulb,
  ListChecks,
  Paperclip,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Wallet,
} from "lucide-react";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { listMyMemberVotes, loadMemberProjects } from "@/lib/governance/repository";
import { proposalJourney, proposalStateForMember } from "@/lib/governance/proposals";
import { progressOf, urgencyFor } from "@/lib/governance/urgency";
import { fecha } from "@/lib/governance/labels";
import { ProjectStatusBadge, STATUS_ICON, UrgencyDot } from "@/components/governance/badges";
import { ProposalJourney } from "@/components/governance/proposal-journey";
import { isMemberPollOpen } from "@/lib/governance/member-pulse";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";

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

const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] px-2.5 py-0.5 text-xs text-[var(--fo-text-secondary)]";

export default async function MisProyectosPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { workspace, member } = await requirePortalGovernance();
  const { aviso } = await searchParams;
  const { propias, visibles } = await loadMemberProjects(workspace.id, member.id);
  const misVotos = await listMyMemberVotes(member.id, visibles.map((p) => p.id));
  const ahora = new Date();

  return (
    <div className="space-y-10">
      <header className="fo-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]">
          <Lightbulb className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">Mis proyectos</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
            ¿Tenés una idea para la institución? Presentala a la comisión directiva: la trata en una reunión y acá vas a ver
            en qué paso está.
          </p>
        </div>
        <Link href="/portal/proyectos/proponer" className="fo-btn fo-btn-primary shrink-0 text-sm">
          <Plus className="size-4" aria-hidden />
          Proponer un proyecto
        </Link>
      </header>

      {aviso && AVISO_ENLACE[aviso] ? <p className="fo-alert-warning p-4 text-sm">{AVISO_ENLACE[aviso]}</p> : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Mis propuestas</h2>
          {propias.length > 0 ? (
            <span className="text-sm text-[var(--fo-muted)]">
              {propias.length === 1 ? "1 propuesta" : `${propias.length} propuestas`}
            </span>
          ) : null}
        </div>
        {propias.length === 0 ? (
          <div className="fo-card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <Lightbulb className="size-8 text-[var(--fo-muted-soft)]" aria-hidden />
            <p className="text-sm text-[var(--fo-muted)]">Todavía no presentaste ninguna propuesta.</p>
            <Link href="/portal/proyectos/proponer" className="fo-btn fo-btn-secondary text-sm">
              Presentar la primera
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {propias.map((p) => {
              const estado = proposalStateForMember(p.status);
              const Icono = STATUS_ICON[p.status] ?? CircleDashed;
              const cortada = p.status === "ARCHIVED" || p.status === "REJECTED" || p.status === "CANCELLED";
              const costo = p.manualNeededArs ? formatMinorArs(decimalArsToMinor(p.manualNeededArs)) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/portal/proyectos/${p.id}`}
                    className="fo-card group block space-y-5 p-5 transition-colors hover:border-[var(--fo-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
                  >
                    <div className="flex items-start gap-4">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TONO[estado.tone]}`}>
                        <Icono className="size-5" strokeWidth={2.5} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold leading-snug text-[var(--fo-text)] group-hover:underline">{p.title}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONO[estado.tone]}`}>
                            {estado.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={chip}>
                            <CalendarDays className="size-3.5" aria-hidden />
                            Presentada el {fecha(p.createdAt)}
                          </span>
                          {costo ? (
                            <span className={chip}>
                              <Wallet className="size-3.5" aria-hidden />
                              {costo}
                            </span>
                          ) : null}
                          {p.attachments.length > 0 ? (
                            <span className={chip}>
                              <Paperclip className="size-3.5" aria-hidden />
                              {p.attachments.length === 1 ? "1 archivo" : `${p.attachments.length} archivos`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight className="mt-3 hidden size-5 shrink-0 text-[var(--fo-muted-soft)] sm:block" aria-hidden />
                    </div>
                    <ProposalJourney steps={proposalJourney(p.status)} />
                    {cortada && p.statusReason ? (
                      <p className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-danger-soft)] px-3 py-2 text-sm text-[var(--fo-text-secondary)]">
                        <span className="font-medium text-[var(--fo-danger)]">Motivo de la comisión:</span> {p.statusReason}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Proyectos de la institución</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Entrá a cada uno para decir si lo apoyás y dejarle tu opinión a la comisión. Tu voto es privado.
          </p>
        </div>
        {visibles.length === 0 ? (
          <div className="fo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <FolderOpen className="size-7" aria-hidden />
            </span>
            <p className="font-medium">Todavía no hay proyectos para votar</p>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fo-muted)]">
              Cuando la comisión comparta un proyecto con los socios, va a aparecer acá para que digas si lo apoyás y dejes
              tu opinión.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {visibles.map((p) => {
              const avance = progressOf(p.tasks.map((t) => ({ status: t.status as "PENDING" })));
              const pct = avance.total === 0 ? 0 : Math.round((avance.closed / avance.total) * 100);
              const encuesta = isMemberPollOpen({ status: p.status, visibleToMembers: true });
              const miVoto = misVotos.get(p.id) ?? null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/portal/proyectos/${p.id}${encuesta && !miVoto ? "#opinar" : ""}`}
                    className="fo-card group flex h-full flex-col gap-4 p-5 transition-colors hover:border-[var(--fo-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ProjectStatusBadge status={p.status} />
                      {p.deadlineAt ? (
                        <span className={chip}>
                          <CalendarDays className="size-3.5" aria-hidden />
                          Para el {fecha(p.deadlineAt)}
                          <UrgencyDot urgency={urgencyFor(p.deadlineAt, ahora)} />
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold leading-snug group-hover:underline">{p.title}</p>
                      {p.description ? (
                        <p className="line-clamp-2 text-sm leading-relaxed text-[var(--fo-muted)]">{p.description}</p>
                      ) : null}
                    </div>
                    {avance.total > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-[var(--fo-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <ListChecks className="size-3.5" aria-hidden />
                            Avance
                          </span>
                          <span className="tabular-nums">
                            {avance.closed} de {avance.total} tareas
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--fo-surface-muted)]">
                          <div className="h-full rounded-full bg-[var(--fo-success)]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-auto border-t border-[var(--fo-border-muted)] pt-3">
                      {miVoto === "FOR" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fo-success-soft)] px-3 py-1 text-sm font-medium text-[var(--fo-success)]">
                          <ThumbsUp className="size-4" aria-hidden />
                          Lo apoyás
                        </span>
                      ) : miVoto === "AGAINST" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fo-danger-soft)] px-3 py-1 text-sm font-medium text-[var(--fo-danger)]">
                          <ThumbsDown className="size-4" aria-hidden />
                          No lo apoyás
                        </span>
                      ) : encuesta ? (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--fo-accent)]">
                          <span className="inline-flex -space-x-1" aria-hidden>
                            <ThumbsUp className="size-4" />
                            <ThumbsDown className="size-4" />
                          </span>
                          Votá y opiná
                          <ChevronRight className="size-4" aria-hidden />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-[var(--fo-muted)]">
                          Ver el proyecto
                          <ChevronRight className="size-4" aria-hidden />
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
