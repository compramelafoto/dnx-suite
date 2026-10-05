import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { getVisibleProject, loadVoting } from "@/lib/governance/repository";
import { proposalStateForMember } from "@/lib/governance/proposals";
import { progressOf } from "@/lib/governance/urgency";
import { fecha, projectStatusLabel, tamanioArchivo, taskStatusLabel } from "@/lib/governance/labels";
import { isVotingOpen, tallyLabel } from "@/lib/governance/votes";
import { ProgressBar } from "@/components/governance/badges";
import type { ProjectStatus } from "@/lib/governance/constants";

export const dynamic = "force-dynamic";

export default async function ProyectoPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { workspace, member } = await requirePortalGovernance();
  const { id } = await params;
  const avisos = await searchParams;
  const p = await getVisibleProject(workspace.id, id, member.id);
  if (!p) notFound();

  const esMia = p.proposedByMemberId === member.id;
  // De una propuesta propia ve todo lo que adjuntó; de un proyecto visible, sólo lo marcado visible.
  const archivos = p.attachments.filter((a) => (esMia && a.taskUpdateId === null) || a.visibleToMembers);
  const verDetalle = p.visibleToMembers && p.status !== "MEMBER_PROPOSAL" && p.status !== "ARCHIVED";
  const votacion = verDetalle ? await loadVoting(workspace.id, [p.id]) : null;
  const avance = progressOf(p.stages.flatMap((s) => s.tasks.map((t) => ({ status: t.status as "PENDING" }))));

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/portal/proyectos" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Mis proyectos
      </Link>
      {avisos.ok === "propuesta" ? (
        <p className="fo-alert-success p-4 text-sm">¡Listo! Tu propuesta llegó a la comisión. Acá vas a ver la respuesta.</p>
      ) : null}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          {esMia ? proposalStateForMember(p.status).label : projectStatusLabel(p.status)}
          {p.deadlineAt ? ` · para el ${fecha(p.deadlineAt)}` : ""}
          {votacion && isVotingOpen(p.status as ProjectStatus) ? ` · ${tallyLabel(votacion.tallyOf(p.id))}` : ""}
        </p>
        {(p.status === "ARCHIVED" || p.status === "REJECTED") && p.statusReason ? (
          <p className="fo-alert-warning p-3 text-sm">Motivo: {p.statusReason}</p>
        ) : null}
      </header>

      {p.description ? <p className="whitespace-pre-line text-sm leading-relaxed">{p.description}</p> : null}

      {verDetalle && p.stages.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Avance</h2>
            {avance.total > 0 ? <ProgressBar {...avance} /> : null}
          </div>
          {p.stages.map((s) => (
            <div key={s.id} className="fo-card space-y-2 p-4 text-sm">
              <p className="font-medium">{s.title}</p>
              <ul className="space-y-1 text-[var(--fo-text-secondary)]">
                {s.tasks.map((t) => (
                  <li key={t.id}>
                    {t.title} <span className="text-xs text-[var(--fo-muted)]">— {taskStatusLabel(t.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {archivos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Archivos</h2>
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)] text-sm">
            {archivos.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <a href={`/api/portal/gobierno/archivos/${a.id}`} className="font-medium hover:underline">
                  {a.filename}
                </a>{" "}
                <span className="text-xs text-[var(--fo-muted)]">({tamanioArchivo(a.sizeBytes)})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
