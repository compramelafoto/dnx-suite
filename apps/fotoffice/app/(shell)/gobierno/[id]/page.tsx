import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Flash, MemberSelect } from "@/components/governance/member-select";
import { ProgressBar, ProjectStatusBadge, TaskStatusBadge, UrgencyDot } from "@/components/governance/badges";
import { ProjectFileUploader } from "@/components/governance/project-file-uploader";
import { requireGovernanceViewer, canWorkOnTask } from "@/lib/governance/access";
import { getProject, listMemberOptions, loadVoting } from "@/lib/governance/repository";
import { isVotingOpen, tallyLabel } from "@/lib/governance/votes";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { castVoteAction } from "../reuniones/actions";
import {
  canCloseTasks,
  canEditStructure,
  isClosed,
  isCommissionDecision,
  nextStatuses,
  requiresReason,
} from "@/lib/governance/lifecycle";
import { isTaskOverdue, progressOf, urgencyFor } from "@/lib/governance/urgency";
import { describeEvent, fecha, fechaHora, projectActionLabel, tamanioArchivo } from "@/lib/governance/labels";
import { toDateInputValue } from "@/lib/governance/forms";
import type { ProjectStatus } from "@/lib/governance/constants";
import {
  addProjectNoteAction,
  addStageAction,
  addTaskAction,
  changeProjectStatusAction,
  moveStageAction,
  removeStageAction,
  renameStageAction,
  setFileVisibilityAction,
  setTaskStatusAction,
  updateProjectAction,
} from "../actions";

export const dynamic = "force-dynamic";

const ORIGEN: Record<string, string> = {
  COMMISSION: "La comisión",
  MEMBER_PROPOSAL: "Propuesta de un socio",
};

export default async function ProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requireGovernanceViewer();
  const { workspace, canManage } = ctx;
  const { id } = await params;
  const avisos = await searchParams;
  const proyecto = await getProject(workspace.id, id);
  if (!proyecto) notFound();
  const [socios, votacion] = await Promise.all([
    canManage ? listMemberOptions(workspace.id) : Promise.resolve({ commission: [], others: [] }),
    loadVoting(workspace.id, [proyecto.id]),
  ]);
  const recuento = votacion.tallyOf(proyecto.id);
  const votos = votacion.votesOf(proyecto.id);
  const miVoto = votos.find((v) => v.voterUserId === ctx.user.id)?.value ?? null;
  const puedoVotar = votacion.roll.userIds.has(ctx.user.id) && isVotingOpen(proyecto.status);
  const nombrePorUsuario = new Map<number, string>();
  for (const h of votacion.holders) {
    if (h.userId !== null && h.votes && !nombrePorUsuario.has(h.userId)) nombrePorUsuario.set(h.userId, `${h.displayName} (${h.officeName})`);
  }

  const ahora = new Date();
  const editable = canManage && canEditStructure(proyecto.status);
  const todasLasTareas = proyecto.stages.flatMap((s) => s.tasks);
  const avance = progressOf(todasLasTareas);
  const archivosDelProyecto = proyecto.attachments.filter((a) => a.taskUpdateId === null);
  const archivosDeAvances = proyecto.attachments.filter((a) => a.taskUpdateId !== null);
  const aqui = `/gobierno/${proyecto.id}`;
  const responsableActual = proyecto.responsible
    ? { id: proyecto.responsible.id, label: `${proyecto.responsible.lastName}, ${proyecto.responsible.firstName}` }
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/gobierno" className="text-sm text-[var(--fo-muted)] hover:underline">
          ← Proyectos
        </Link>
        <PageHeader title={proyecto.title} description={proyecto.description ?? undefined} />
        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusBadge status={proyecto.status} />
          {isClosed(proyecto.status) ? null : <UrgencyDot urgency={urgencyFor(proyecto.deadlineAt, ahora)} />}
          {avance.total > 0 ? <ProgressBar {...avance} /> : null}
        </div>
      </div>

      <Flash error={avisos.error} ok={avisos.ok} />

      <section className="fo-card grid gap-4 p-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Dato rotulo="Tipo" valor={proyecto.type?.name ?? "Sin tipo"} />
        <Dato
          rotulo="Responsable general"
          valor={proyecto.responsible ? `${proyecto.responsible.firstName} ${proyecto.responsible.lastName}` : "—"}
        />
        <Dato rotulo="Fecha límite" valor={fecha(proyecto.deadlineAt)} />
        <Dato
          rotulo="Origen"
          valor={
            proyecto.proposedBy
              ? `Propuesto por ${proyecto.proposedBy.firstName} ${proyecto.proposedBy.lastName}`
              : (ORIGEN[proyecto.origin] ?? proyecto.origin)
          }
        />
        <Dato rotulo="Socios" valor={proyecto.visibleToMembers ? "Visible para socios" : "Interno de la comisión"} />
        <Dato rotulo="Creado" valor={fecha(proyecto.createdAt)} />
        {proyecto.manualNeededArs ? (
          <Dato rotulo="Costo aproximado" valor={formatMinorArs(decimalArsToMinor(proyecto.manualNeededArs))} />
        ) : null}
        {proyecto.statusReason && isClosed(proyecto.status) ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Dato rotulo="Motivo" valor={proyecto.statusReason} />
          </div>
        ) : null}
      </section>

      {canManage ? (
        <details className="fo-card p-6">
          <summary className="cursor-pointer text-sm font-medium">Editar datos del proyecto</summary>
          <form action={updateProjectAction} className="mt-6 max-w-2xl space-y-5">
            <input type="hidden" name="projectId" value={proyecto.id} />
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="edit-title">
                Título
              </label>
              <input id="edit-title" name="title" className="fo-input" required maxLength={160} defaultValue={proyecto.title} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="edit-description">
                Descripción
              </label>
              <textarea id="edit-description" name="description" className="fo-input" rows={4} defaultValue={proyecto.description ?? ""} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="edit-responsible">
                  Responsable general
                </label>
                <MemberSelect
                  id="edit-responsible"
                  name="responsibleMemberId"
                  options={socios}
                  defaultValue={proyecto.responsibleMemberId}
                  current={responsableActual}
                  emptyLabel="Todavía nadie"
                />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="edit-deadline">
                  Fecha límite
                </label>
                <input id="edit-deadline" name="deadlineAt" type="date" className="fo-input" defaultValue={toDateInputValue(proyecto.deadlineAt)} />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="visibleToMembers" defaultChecked={proyecto.visibleToMembers} />
              Visible para socios
            </label>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Guardar cambios
            </button>
          </form>
        </details>
      ) : null}

      {canManage && nextStatuses(proyecto.status).length > 0 ? (
        <section className="fo-card space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Estado</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              {proyecto.status === "MEMBER_PROPOSAL"
                ? "Es una propuesta de un socio. Aceptala para que entre al temario de la próxima reunión, o archivala con el motivo (el socio lo ve)."
                : "Lo habitual es resolverlo en una reunión (Comisión → Reuniones), que lo deja en el acta. Si se decidió fuera del sistema, anotalo acá con la fecha."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {nextStatuses(proyecto.status).map((to) => (
              <CambioDeEstado key={to} projectId={proyecto.id} to={to} />
            ))}
          </div>
        </section>
      ) : null}

      {votos.length > 0 || isVotingOpen(proyecto.status) ? (
        <section id="votacion" className="fo-card space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Votación de la comisión</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Mide el apoyo y ordena las prioridades. La aprobación formal se registra en una reunión.
              {isVotingOpen(proyecto.status) ? "" : " La votación está cerrada."}
            </p>
          </div>
          <p className="text-sm">
            <span className="font-medium">{tallyLabel(recuento)}</span>
            {recuento.eligible > 0 ? ` · ${recuento.against} en contra · ${recuento.notVoted} sin votar` : ""}
          </p>
          {puedoVotar ? (
            <div className="flex flex-wrap items-center gap-2">
              {(["FOR", "AGAINST"] as const).map((v) => (
                <form key={v} action={castVoteAction}>
                  <input type="hidden" name="projectId" value={proyecto.id} />
                  <input type="hidden" name="value" value={v} />
                  <button
                    type="submit"
                    className={`fo-btn text-sm ${miVoto === v ? "fo-btn-primary" : "fo-btn-secondary"}`}
                    aria-pressed={miVoto === v}
                  >
                    {v === "FOR" ? "A favor" : "En contra"}
                  </button>
                </form>
              ))}
              <span className="text-xs text-[var(--fo-muted)]">
                {miVoto ? "Tu voto está marcado; lo podés cambiar." : "Todavía no votaste."}
              </span>
            </div>
          ) : null}
          {votos.length > 0 ? (
            <ul className="space-y-1 text-sm text-[var(--fo-text-secondary)]">
              {votos.map((v) => (
                <li key={v.voterUserId}>
                  {nombrePorUsuario.get(v.voterUserId) ?? "Ex integrante (no cuenta)"}: {v.value === "FOR" ? "a favor" : "en contra"}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section id="etapas" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Etapas y tareas</h2>
          {!canCloseTasks(proyecto.status) && !isClosed(proyecto.status) ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Las tareas se pueden armar y repartir desde ya; se dan por hechas cuando el proyecto esté aprobado.
            </p>
          ) : null}
        </div>

        {proyecto.stages.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no hay etapas.</p>
        ) : null}

        {proyecto.stages.map((etapa, i) => {
          const avanceEtapa = progressOf(etapa.tasks);
          return (
            <div key={etapa.id} id={`etapa-${etapa.id}`} className="fo-card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{etapa.title}</h3>
                  {avanceEtapa.total > 0 ? <ProgressBar {...avanceEtapa} /> : null}
                </div>
                {editable ? (
                  <div className="flex items-center gap-1">
                    <form action={moveStageAction}>
                      <input type="hidden" name="projectId" value={proyecto.id} />
                      <input type="hidden" name="stageId" value={etapa.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className="fo-icon-btn" disabled={i === 0} aria-label="Subir etapa">
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                    </form>
                    <form action={moveStageAction}>
                      <input type="hidden" name="projectId" value={proyecto.id} />
                      <input type="hidden" name="stageId" value={etapa.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className="fo-icon-btn"
                        disabled={i === proyecto.stages.length - 1}
                        aria-label="Bajar etapa"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

              {etapa.tasks.length > 0 ? (
                <ul className="divide-y divide-[var(--fo-border-muted)]">
                  {etapa.tasks.map((t) => {
                    const vencida = isTaskOverdue(t, ahora);
                    const puede = canWorkOnTask(ctx, t) && canCloseTasks(proyecto.status);
                    return (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0 space-y-1">
                          <Link href={`${aqui}/tareas/${t.id}`} className="font-medium hover:underline">
                            {t.title}
                          </Link>
                          <p className="text-xs text-[var(--fo-muted)]">
                            {t.assigneeName ?? "Sin responsable"}
                            {t.dueAt ? (
                              <span className={vencida ? "font-medium text-[var(--fo-danger)]" : ""}>
                                {" · "}
                                {vencida ? "venció el " : "para el "}
                                {fecha(t.dueAt)}
                              </span>
                            ) : null}
                            {t._count.updates > 0 ? ` · ${t._count.updates} avance${t._count.updates > 1 ? "s" : ""}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <TaskStatusBadge status={t.status} />
                          {puede && t.status !== "DONE" && t.status !== "NOT_DONE" ? (
                            <form action={setTaskStatusAction}>
                              <input type="hidden" name="projectId" value={proyecto.id} />
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value="DONE" />
                              <input type="hidden" name="returnTo" value={aqui} />
                              <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                                Marcar hecha
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[var(--fo-muted)]">Sin tareas.</p>
              )}

              {editable ? (
                <div className="flex flex-col gap-3">
                  <details>
                    <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">+ Agregar tarea</summary>
                    <form action={addTaskAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="projectId" value={proyecto.id} />
                      <input type="hidden" name="stageId" value={etapa.id} />
                      <div className="fo-field-stack sm:col-span-2">
                        <label className="fo-label" htmlFor={`t-${etapa.id}`}>
                          Qué hay que hacer
                        </label>
                        <input id={`t-${etapa.id}`} name="title" className="fo-input" required maxLength={160} />
                      </div>
                      <div className="fo-field-stack">
                        <label className="fo-label" htmlFor={`a-${etapa.id}`}>
                          Responsable
                        </label>
                        <MemberSelect id={`a-${etapa.id}`} name="assigneeMemberId" options={socios} />
                      </div>
                      <div className="fo-field-stack">
                        <label className="fo-label" htmlFor={`d-${etapa.id}`}>
                          Para cuándo
                        </label>
                        <input id={`d-${etapa.id}`} name="dueAt" type="date" className="fo-input" />
                      </div>
                      <div className="sm:col-span-2">
                        <button type="submit" className="fo-btn fo-btn-primary text-sm">
                          Agregar tarea
                        </button>
                      </div>
                    </form>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm text-[var(--fo-muted)]">Renombrar o quitar la etapa</summary>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <form action={renameStageAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="projectId" value={proyecto.id} />
                        <input type="hidden" name="stageId" value={etapa.id} />
                        <input name="title" className="fo-input" defaultValue={etapa.title} required maxLength={160} aria-label="Nombre de la etapa" />
                        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                          Renombrar
                        </button>
                      </form>
                      {etapa.tasks.length === 0 ? (
                        <form action={removeStageAction}>
                          <input type="hidden" name="projectId" value={proyecto.id} />
                          <input type="hidden" name="stageId" value={etapa.id} />
                          <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                            Quitar etapa
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
          );
        })}

        {editable ? (
          <form action={addStageAction} className="fo-card flex flex-wrap items-end gap-3 p-5">
            <input type="hidden" name="projectId" value={proyecto.id} />
            <div className="fo-field-stack min-w-[16rem] flex-1">
              <label className="fo-label" htmlFor="new-stage">
                Nueva etapa
              </label>
              <input id="new-stage" name="title" className="fo-input" required maxLength={160} placeholder="Ej.: Buffet" />
            </div>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar etapa
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Archivos</h2>
            <p className="text-sm text-[var(--fo-muted)]">Internos de la comisión salvo los que marques visibles.</p>
          </div>
          {canManage ? <ProjectFileUploader projectId={proyecto.id} /> : null}
        </div>
        {proyecto.attachments.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no hay archivos.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {[...archivosDelProyecto, ...archivosDeAvances].map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <a href={`/api/gobierno/archivos/${a.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                    <Download className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{a.filename}</span>
                  </a>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {tamanioArchivo(a.sizeBytes)} · {fechaHora(a.createdAt)}
                    {a.taskUpdateId ? " · en un avance de tarea" : ""}
                  </p>
                </div>
                {canManage ? (
                  <form action={setFileVisibilityAction}>
                    <input type="hidden" name="projectId" value={proyecto.id} />
                    <input type="hidden" name="attachmentId" value={a.id} />
                    <input type="hidden" name="visible" value={a.visibleToMembers ? "0" : "1"} />
                    <input type="hidden" name="returnTo" value={aqui} />
                    <button type="submit" className="fo-btn fo-btn-ghost text-xs" title="Cambiar quién lo ve">
                      {a.visibleToMembers ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                      {a.visibleToMembers ? "Visible para socios" : "Interno"}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-[var(--fo-muted)]">{a.visibleToMembers ? "Visible para socios" : "Interno"}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Historial</h2>
        {canManage ? (
          <form action={addProjectNoteAction} className="fo-card space-y-3 p-5">
            <input type="hidden" name="projectId" value={proyecto.id} />
            <label className="fo-label" htmlFor="note">
              Agregar una nota
            </label>
            <textarea id="note" name="body" className="fo-input" rows={2} placeholder="Una aclaración, una corrección, algo que se habló." />
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar al historial
            </button>
          </form>
        ) : null}
        <ol className="fo-card divide-y divide-[var(--fo-border-muted)]">
          {proyecto.events.map((e) => {
            const data = (e.data ?? null) as Record<string, unknown> | null;
            const extra = [
              typeof data?.decidedOn === "string" ? `Reunión del ${fecha(new Date(`${data.decidedOn}T12:00:00-03:00`))}` : null,
              typeof data?.decision === "string" ? data.decision : null,
              typeof data?.reason === "string" ? `Motivo: ${data.reason}` : null,
              typeof data?.text === "string" ? data.text : null,
            ].filter(Boolean) as string[];
            return (
              <li key={e.id} className="space-y-1 px-5 py-3 text-sm">
                <p>
                  <span className="font-medium">{e.actorLabel}</span> · {describeEvent(e.type, data)}
                </p>
                {extra.map((x, k) => (
                  <p key={k} className="whitespace-pre-line text-[var(--fo-text-secondary)]">
                    {x}
                  </p>
                ))}
                <p className="text-xs text-[var(--fo-muted)]">{fechaHora(e.createdAt)}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">{rotulo}</p>
      <p className="whitespace-pre-line text-[var(--fo-text)]">{valor}</p>
    </div>
  );
}

/** Un botón por cada estado posible; los que piden datos se despliegan con su formulario. */
function CambioDeEstado({ projectId, to }: { projectId: string; to: ProjectStatus }) {
  const decision = isCommissionDecision(to);
  const motivo = requiresReason(to);
  const peligroso = to === "CANCELLED" || to === "REJECTED" || to === "ARCHIVED";
  const boton = (
    <button type="submit" className={`fo-btn text-sm ${peligroso ? "fo-btn-danger-outline" : "fo-btn-secondary"}`}>
      {projectActionLabel(to)}
    </button>
  );
  if (!decision && !motivo) {
    return (
      <form action={changeProjectStatusAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value={to} />
        {boton}
      </form>
    );
  }
  return (
    <details className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
      <summary className="cursor-pointer text-sm font-medium">{projectActionLabel(to)}…</summary>
      <form action={changeProjectStatusAction} className="mt-4 max-w-xl space-y-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value={to} />
        {decision ? (
          <>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`decidedOn-${to}`}>
                Fecha de la reunión de comisión
              </label>
              <input id={`decidedOn-${to}`} name="decidedOn" type="date" className="fo-input" required />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`decision-${to}`}>
                Qué se decidió
              </label>
              <textarea id={`decision-${to}`} name="decision" className="fo-input" rows={2} placeholder="Ej.: Se aprueba con un tope de $300.000 para impresión." />
            </div>
          </>
        ) : null}
        {motivo ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`reason-${to}`}>
              Motivo
            </label>
            <textarea id={`reason-${to}`} name="reason" className="fo-input" rows={2} required />
          </div>
        ) : null}
        {boton}
      </form>
    </details>
  );
}
