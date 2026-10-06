import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { getMyMemberVote, getVisibleProject, listMyComments, loadVoting } from "@/lib/governance/repository";
import { isMemberPollOpen } from "@/lib/governance/member-pulse";
import { MAX_COMMENT } from "@/lib/governance/comments";
import { memberCommentAction, memberVoteAction, memberWithdrawCommentAction } from "../opinion-actions";
import { proposalStateForMember } from "@/lib/governance/proposals";
import { progressOf } from "@/lib/governance/urgency";
import { fecha, fechaHora, projectStatusLabel, tamanioArchivo, taskStatusLabel } from "@/lib/governance/labels";
import { isVotingOpen, tallyLabel } from "@/lib/governance/votes";
import { ProgressBar } from "@/components/governance/badges";
import type { ProjectStatus } from "@/lib/governance/constants";
import { isCashOn, loadProjectMoney } from "@/lib/governance/money-server";
import { formatMinorArs } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

export default async function ProyectoPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
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
  const plata = verDetalle && (await isCashOn(workspace.id)) ? await loadProjectMoney(workspace.id, p.id) : null;
  const encuesta = isMemberPollOpen(p);
  const [miVoto, misOpiniones] = encuesta
    ? await Promise.all([getMyMemberVote(p.id, member.id), listMyComments(p.id, member.id)])
    : [null, []];
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

      {plata && (plata.numeros.neededMinor > 0 || plata.numeros.assignedMinor > 0) ? (
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Necesario", plata.numeros.neededMinor],
            ["Asignado", plata.numeros.assignedMinor],
            ["Gastado", plata.numeros.spentMinor],
            ["Restante", plata.numeros.remainingMinor],
          ].map(([rotulo, valor]) => (
            <div key={rotulo as string} className="fo-card space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">{rotulo}</p>
              <p className="text-lg font-semibold tabular-nums">{formatMinorArs(valor as number)}</p>
            </div>
          ))}
        </section>
      ) : null}

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

      {encuesta ? (
        <section id="opinar" className="fo-card space-y-5 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">¿Qué te parece?</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Ayudá a la comisión a saber qué es importante para los socios.
            </p>
          </div>
          {avisos.ok === "voto" ? <p className="fo-alert-success p-3 text-sm">¡Gracias! Tu voto quedó registrado.</p> : null}
          {avisos.ok === "opinion" ? (
            <p className="fo-alert-success p-3 text-sm">¡Gracias! Tu opinión le llegó a la comisión.</p>
          ) : null}
          {avisos.error ? (
            <p className="fo-alert-error p-3 text-sm" role="alert">
              {avisos.error}
            </p>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(["FOR", "AGAINST"] as const).map((v) => (
                <form key={v} action={memberVoteAction}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <input type="hidden" name="value" value={v} />
                  <button
                    type="submit"
                    className={`fo-btn text-sm ${miVoto === v ? "fo-btn-primary" : "fo-btn-secondary"}`}
                    aria-pressed={miVoto === v}
                  >
                    {v === "FOR" ? "👍 Lo apoyo" : "👎 No lo apoyo"}
                  </button>
                </form>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
              🔒 Tu voto es privado: nadie, ni siquiera la comisión, ve qué votaste. Sólo se cuentan los totales.
              {miVoto ? " Lo podés cambiar cuando quieras." : ""}
            </p>
          </div>

          <form action={memberCommentAction} className="space-y-3">
            <input type="hidden" name="projectId" value={p.id} />
            <label className="fo-label" htmlFor="member-comment">
              Tu opinión (opcional)
            </label>
            <textarea
              id="member-comment"
              name="body"
              className="fo-input"
              rows={3}
              required
              maxLength={MAX_COMMENT}
              placeholder="¿Qué te gustaría que tenga en cuenta la comisión?"
            />
            <p className="text-xs text-[var(--fo-muted)]">
              La lee sólo la comisión directiva, con tu nombre, por si te quiere responder. Los demás socios no la ven.
            </p>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Enviar a la comisión
            </button>
          </form>

          {misOpiniones.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Lo que ya le dijiste a la comisión</h3>
              <ul className="space-y-2">
                {misOpiniones.map((o) => (
                  <li key={o.id} className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs text-[var(--fo-muted)]">{fechaHora(o.createdAt)}</span>
                      {o.withdrawnAt ? null : (
                        <form action={memberWithdrawCommentAction}>
                          <input type="hidden" name="commentId" value={o.id} />
                          <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                            Retirar
                          </button>
                        </form>
                      )}
                    </div>
                    {o.withdrawnAt ? (
                      <p className="mt-1 text-xs italic text-[var(--fo-muted)]">La retiraste el {fechaHora(o.withdrawnAt)}.</p>
                    ) : (
                      <p className="mt-1 whitespace-pre-line text-[var(--fo-text-secondary)]">{o.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
