import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  Download,
  Eye,
  EyeOff,
  Handshake,
  History,
  Lightbulb,
  ListChecks,
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Flash, MemberSelect } from "@/components/governance/member-select";
import { ProgressBar, ProjectStatusBadge, STATUS_ICON, TaskStatusBadge, UrgencyDot } from "@/components/governance/badges";
import { ProjectFileUploader } from "@/components/governance/project-file-uploader";
import { requireGovernanceViewer, canWorkOnTask } from "@/lib/governance/access";
import { getProject, listComments, listMemberOptions, loadMemberPulse, loadVoting, nextPlannedMeeting } from "@/lib/governance/repository";
import { isMemberPollOpen, memberPulseLabel } from "@/lib/governance/member-pulse";
import { ShareButtons } from "@/components/governance/share-buttons";
import { buildSharedUrl, loadShareBase } from "@/lib/governance/share-server";
import { memberShareMessage, projectShareMessage } from "@/lib/governance/share";
import { canWithdrawComment, MAX_COMMENT } from "@/lib/governance/comments";
import { addCommentAction, withdrawCommentAction } from "../comentarios-actions";
import { isVotingOpen, voterRoster } from "@/lib/governance/votes";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { castVoteAction } from "../reuniones/actions";
import { ProjectMoneySection } from "@/components/governance/project-money";
import { canHandleProjectMoney, isCashOn, loadProjectMoney } from "@/lib/governance/money-server";
import { listAccounts, listCategories } from "@/lib/cash/repository";
import {
  canCloseTasks,
  canEditStructure,
  isClosed,
  isCommissionDecision,
  nextStatuses,
  requiresReason,
} from "@/lib/governance/lifecycle";
import { isTaskOverdue, progressOf, urgencyFor } from "@/lib/governance/urgency";
import { describeEvent, diaYHora, fecha, fechaHora, projectActionLabel, tamanioArchivo } from "@/lib/governance/labels";
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
  const [money, cashOn, puedePlata] = await Promise.all([
    loadProjectMoney(workspace.id, proyecto.id),
    isCashOn(workspace.id),
    canHandleProjectMoney(ctx.user.id, workspace.id),
  ]);
  const [todosLosComentarios, shareBase, proximaReunion, pulsoDe] = await Promise.all([
    listComments(workspace.id, proyecto.id),
    loadShareBase(workspace.id),
    nextPlannedMeeting(workspace.id),
    loadMemberPulse(workspace.id, [proyecto.id]),
  ]);
  const comentarios = todosLosComentarios.filter((c) => c.authorMemberId === null);
  const deSocios = todosLosComentarios.filter((c) => c.authorMemberId !== null && c.withdrawnAt === null);
  const pulso = pulsoDe(proyecto.id);
  const encuestaAbierta = isMemberPollOpen(proyecto);
  const enlace = shareBase ? buildSharedUrl("proyecto", proyecto.id, shareBase) : null;
  const [cuentas, categorias] =
    cashOn && puedePlata ? await Promise.all([listAccounts(workspace.id), listCategories(workspace.id)]) : [[], []];
  const recuento = votacion.tallyOf(proyecto.id);
  const votos = votacion.votesOf(proyecto.id);
  const miVoto = votos.find((v) => v.voterUserId === ctx.user.id)?.value ?? null;
  const puedoVotar = votacion.roll.userIds.has(ctx.user.id) && isVotingOpen(proyecto.status);

  const ahora = new Date();
  const editable = canManage && canEditStructure(proyecto.status);
  const todasLasTareas = proyecto.stages.flatMap((s) => s.tasks);
  const avance = progressOf(todasLasTareas);
  // Los archivos de cotizaciones se ven en su cotización, no acá: nunca se hacen visibles.
  const archivosDelProyecto = proyecto.attachments.filter((a) => a.taskUpdateId === null && a.quoteId === null);
  const archivosDeAvances = proyecto.attachments.filter((a) => a.taskUpdateId !== null);
  const aqui = `/gobierno/${proyecto.id}`;
  const responsableActual = proyecto.responsible
    ? { id: proyecto.responsible.id, label: `${proyecto.responsible.lastName}, ${proyecto.responsible.firstName}` }
    : null;

  const roster = voterRoster(votacion.holders, votos);
  const decisiones = canManage ? nextStatuses(proyecto.status) : [];
  const urgencia = urgencyFor(proyecto.deadlineAt, ahora);
  const descripcionLarga = (proyecto.description ?? "").length > 320;
  const costo = proyecto.manualNeededArs ? formatMinorArs(decimalArsToMinor(proyecto.manualNeededArs)) : null;
  const hayPropuesta = Boolean(costo || proyecto.fundingIdea || proyecto.proposerCommitment);

  return (
    <div className="space-y-6">
      <Link href="/gobierno" className="inline-flex items-center gap-1 text-sm text-[var(--fo-muted)] hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Proyectos
      </Link>

      <header className="fo-card space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={proyecto.status} size="lg" />
          {isClosed(proyecto.status) ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] px-3 py-1 text-xs text-[var(--fo-text-secondary)]">
              <CalendarDays className="size-3.5" aria-hidden />
              {proyecto.deadlineAt ? `Para el ${fecha(proyecto.deadlineAt)}` : "Sin fecha límite"}
              {proyecto.deadlineAt ? <UrgencyDot urgency={urgencia} /> : null}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] px-3 py-1 text-xs text-[var(--fo-text-secondary)]">
            {proyecto.visibleToMembers ? <Eye className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
            {proyecto.visibleToMembers ? "Lo ven los socios" : "Interno de la comisión"}
          </span>
          {avance.total > 0 ? <ProgressBar {...avance} /> : null}
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-[var(--fo-text)] sm:text-3xl">{proyecto.title}</h1>
        {proyecto.description ? (
          descripcionLarga ? (
            <details className="group max-w-3xl text-[15px] leading-relaxed text-[var(--fo-text-secondary)]">
              <summary className="cursor-pointer list-none">
                <p className="line-clamp-3 whitespace-pre-line group-open:hidden">{proyecto.description}</p>
                <span className="mt-1 inline-block text-sm text-[var(--fo-accent)] group-open:hidden">Leer todo</span>
              </summary>
              <p className="whitespace-pre-line">{proyecto.description}</p>
            </details>
          ) : (
            <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-[var(--fo-text-secondary)]">
              {proyecto.description}
            </p>
          )
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fo-border-muted)] pt-4 text-sm text-[var(--fo-muted)]">
          <span>
            {proyecto.proposedBy
              ? `Lo propuso ${proyecto.proposedBy.firstName} ${proyecto.proposedBy.lastName}`
              : (ORIGEN[proyecto.origin] ?? proyecto.origin)}{" "}
            el {fecha(proyecto.createdAt)}
          </span>
          {enlace ? (
            <ShareButtons
              url={enlace}
              message={projectShareMessage({
                title: proyecto.title,
                url: enlace,
                votingOpen: isVotingOpen(proyecto.status),
                nextMeeting: proximaReunion ? diaYHora(proximaReunion.scheduledAt, false) : null,
              })}
              members={
                encuestaAbierta ? memberShareMessage({ title: proyecto.title, institution: workspace.name, url: enlace }) : null
              }
            />
          ) : null}
        </div>
      </header>

      <Flash error={avisos.error} ok={avisos.ok} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {votos.length > 0 || isVotingOpen(proyecto.status) ? (
            <section id="votacion" className="fo-card space-y-5 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Votación de la comisión</h2>
                <span className="text-xs text-[var(--fo-muted)]">
                  {isVotingOpen(proyecto.status) ? "Mide el apoyo; se aprueba en reunión" : "Cerrada"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <Cifra icono={Check} valor={recuento.for} rotulo="a favor" tono="success" />
                <Cifra icono={X} valor={recuento.against} rotulo="en contra" tono="danger" />
                <Cifra icono={CircleDashed} valor={recuento.notVoted} rotulo="sin votar" tono="neutral" />
              </div>
              {recuento.eligible > 0 ? (
                <div
                  className="flex h-2.5 overflow-hidden rounded-full bg-[var(--fo-surface-muted)]"
                  role="img"
                  aria-label={`${recuento.for} a favor, ${recuento.against} en contra, ${recuento.notVoted} sin votar`}
                >
                  <div className="bg-[var(--fo-success)]" style={{ width: `${(recuento.for / recuento.eligible) * 100}%` }} />
                  <div className="bg-[var(--fo-danger)]" style={{ width: `${(recuento.against / recuento.eligible) * 100}%` }} />
                </div>
              ) : null}

              {puedoVotar ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["FOR", "AGAINST"] as const).map((v) => {
                    const marcado = miVoto === v;
                    const aFavor = v === "FOR";
                    const color = aFavor
                      ? marcado
                        ? "border-[var(--fo-success)] bg-[var(--fo-success)] text-white"
                        : "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)] hover:border-[var(--fo-success)]"
                      : marcado
                        ? "border-[var(--fo-danger)] bg-[var(--fo-danger)] text-white"
                        : "border-[var(--fo-danger-border,var(--fo-border))] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)] hover:border-[var(--fo-danger)]";
                    const Icono = aFavor ? Check : X;
                    return (
                      <form key={v} action={castVoteAction}>
                        <input type="hidden" name="projectId" value={proyecto.id} />
                        <input type="hidden" name="value" value={v} />
                        <button
                          type="submit"
                          aria-pressed={marcado}
                          className={`flex w-full items-center justify-center gap-2 rounded-[var(--fo-radius-sm)] border-2 px-4 py-3 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)] ${color}`}
                        >
                          <Icono className="size-5" strokeWidth={3} aria-hidden />
                          {aFavor ? "A favor" : "En contra"}
                        </button>
                      </form>
                    );
                  })}
                  <p className="text-xs text-[var(--fo-muted)] sm:col-span-2">
                    {miVoto ? "Tu voto está marcado. Lo podés cambiar hasta que se trate en reunión." : "Todavía no votaste."}
                  </p>
                </div>
              ) : null}

              {roster.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {roster.map((r) => (
                    <li
                      key={r.key}
                      title={`${r.office}${r.hasAccount ? "" : " · sin cuenta, todavía no puede votar"}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                        r.value === "FOR"
                          ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]"
                          : r.value === "AGAINST"
                            ? "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]"
                            : "border border-dashed border-[var(--fo-border)] text-[var(--fo-muted)]"
                      }`}
                    >
                      {r.value === "FOR" ? (
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      ) : r.value === "AGAINST" ? (
                        <X className="size-3.5" strokeWidth={3} aria-hidden />
                      ) : (
                        <CircleDashed className="size-3.5" aria-hidden />
                      )}
                      {r.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {hayPropuesta ? (
            <section className="fo-card space-y-4 p-6">
              <h2 className="text-lg font-semibold">{proyecto.proposedBy ? "Lo que propone el socio" : "Dinero y compromisos"}</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {costo ? <Renglon icono={Wallet} rotulo="Costo aproximado" valor={costo} destacado /> : null}
                {proyecto.fundingIdea ? (
                  <Renglon icono={Lightbulb} rotulo="Cómo conseguir el dinero para cumplir el proyecto" valor={proyecto.fundingIdea} />
                ) : null}
                {proyecto.proposerCommitment ? (
                  <div className="sm:col-span-2">
                    <Renglon
                      icono={Handshake}
                      rotulo={proyecto.proposedBy ? `${proyecto.proposedBy.firstName} se compromete a` : "Compromiso de quien propone"}
                      valor={proyecto.proposerCommitment}
                    />
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section id="opiniones" className="fo-card space-y-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Opiniones de la comisión</h2>
              <span className="text-xs text-[var(--fo-muted)]">No cuentan como voto · sólo las ve la comisión</span>
            </div>
            {comentarios.length > 0 ? (
              <ul className="space-y-3">
                {comentarios.map((c) => (
                  <li key={c.id} className="flex gap-3 text-sm">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-xs font-semibold text-[var(--fo-accent)]"
                      aria-hidden
                    >
                      {iniciales(c.authorLabel)}
                    </span>
                    <div className="min-w-0 flex-1 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] px-4 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p>
                          <span className="font-medium">{c.authorLabel}</span>{" "}
                          <span className="text-xs text-[var(--fo-muted)]">{fechaHora(c.createdAt)}</span>
                        </p>
                        {canWithdrawComment(c, ctx.user.id) ? (
                          <form action={withdrawCommentAction}>
                            <input type="hidden" name="commentId" value={c.id} />
                            <button type="submit" className="text-xs text-[var(--fo-muted)] hover:underline">
                              Retirar
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {c.withdrawnAt ? (
                        <p className="mt-1 text-xs italic text-[var(--fo-muted)]">Opinión retirada el {fechaHora(c.withdrawnAt)}.</p>
                      ) : (
                        <p className="mt-1 whitespace-pre-line text-[var(--fo-text-secondary)]">{c.body}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">
                Todavía nadie opinó. Contá por qué estás a favor o en contra, o con qué condición, antes de la reunión.
              </p>
            )}
            <form action={addCommentAction} className="space-y-2">
              <input type="hidden" name="projectId" value={proyecto.id} />
              <label className="sr-only" htmlFor="comment-body">
                Tu opinión
              </label>
              <textarea
                id="comment-body"
                name="body"
                className="fo-input"
                rows={2}
                required
                maxLength={MAX_COMMENT}
                placeholder="Escribí tu opinión. Ej.: a favor si conseguimos un segundo presupuesto."
              />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                <MessageSquare className="size-4" aria-hidden />
                Publicar opinión
              </button>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          {decisiones.length > 0 ? (
            <section className="fo-card space-y-3 p-5">
              <h2 className="text-base font-semibold">
                {proyecto.status === "MEMBER_PROPOSAL" ? "Responder la propuesta" : "Decidir"}
              </h2>
              <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
                {proyecto.status === "MEMBER_PROPOSAL"
                  ? "Aceptala para que entre al temario de la próxima reunión, o archivala con el motivo (el socio lo ve)."
                  : "Lo habitual es decidirlo en una reunión, que lo deja en el acta. Si se decidió afuera, anotalo acá con la fecha."}
              </p>
              <div className="flex flex-col gap-2">
                {decisiones.map((to) => (
                  <CambioDeEstado key={to} projectId={proyecto.id} to={to} />
                ))}
              </div>
            </section>
          ) : null}

          {proyecto.visibleToMembers || pulso.total > 0 || deSocios.length > 0 ? (
            <section id="socios" className="fo-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Lo que piensan los socios</h2>
                <Users className="size-4 text-[var(--fo-muted)]" aria-hidden />
              </div>
              {pulso.total > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tabular-nums text-[var(--fo-text)]">{pulso.percentFor} %</span>
                    <span className="text-sm text-[var(--fo-muted)]">lo apoya</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-[var(--fo-danger-soft)]" aria-hidden>
                    <div className="bg-[var(--fo-success)]" style={{ width: `${pulso.percentFor}%` }} />
                  </div>
                  <p className="flex gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-[var(--fo-success)]">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      {pulso.for} lo apoyan
                    </span>
                    <span className="inline-flex items-center gap-1 text-[var(--fo-danger)]">
                      <X className="size-3.5" strokeWidth={3} aria-hidden />
                      {pulso.against} no
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--fo-muted)]">{memberPulseLabel(pulso)}.</p>
              )}
              <p className="text-xs text-[var(--fo-muted)]">
                {encuestaAbierta
                  ? "Encuesta privada en el portal: se ven sólo los totales."
                  : proyecto.visibleToMembers
                    ? "La encuesta está cerrada."
                    : "El proyecto ya no es visible para los socios."}
              </p>
              {deSocios.length > 0 ? (
                <details className="border-t border-[var(--fo-border-muted)] pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--fo-accent)]">
                    {deSocios.length === 1 ? "1 opinión de socio" : `${deSocios.length} opiniones de socios`}
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {deSocios.map((c) => (
                      <li key={c.id} className="space-y-0.5 text-sm">
                        <p className="text-xs">
                          <span className="font-medium text-[var(--fo-text)]">{c.authorLabel}</span>{" "}
                          <span className="text-[var(--fo-muted)]">{fecha(c.createdAt)}</span>
                        </p>
                        <p className="whitespace-pre-line text-[var(--fo-text-secondary)]">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : null}

          <section className="fo-card p-5">
            <dl className="space-y-3 text-sm">
              <Dato rotulo="Responsable" valor={proyecto.responsible ? `${proyecto.responsible.firstName} ${proyecto.responsible.lastName}` : "Sin asignar"} />
              <Dato rotulo="Tipo" valor={proyecto.type?.name ?? "Sin tipo"} />
              {proyecto.statusReason && isClosed(proyecto.status) ? <Dato rotulo="Motivo" valor={proyecto.statusReason} /> : null}
            </dl>
            {canManage ? (
              <details className="mt-4 border-t border-[var(--fo-border-muted)] pt-3">
                <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[var(--fo-accent)]">
                  <Pencil className="size-3.5" aria-hidden />
                  Editar datos del proyecto
                </summary>
                <form action={updateProjectAction} className="mt-4 space-y-4">
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
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="edit-funding">
                      Cómo conseguir el dinero para cumplir el proyecto
                    </label>
                    <textarea id="edit-funding" name="fundingIdea" className="fo-input" rows={2} defaultValue={proyecto.fundingIdea ?? ""} />
                  </div>
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="edit-commitment">
                      Compromiso de quien propone
                    </label>
                    <textarea
                      id="edit-commitment"
                      name="proposerCommitment"
                      className="fo-input"
                      rows={2}
                      defaultValue={proyecto.proposerCommitment ?? ""}
                    />
                  </div>
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
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" name="visibleToMembers" defaultChecked={proyecto.visibleToMembers} />
                    Visible para socios
                  </label>
                  <button type="submit" className="fo-btn fo-btn-primary w-full text-sm">
                    Guardar cambios
                  </button>
                </form>
              </details>
            ) : null}
          </section>
        </aside>
      </div>

      <Desplegable
        id="etapas"
        icono={ListChecks}
        titulo="Etapas y tareas"
        resumen={
          proyecto.stages.length === 0
            ? "Todavía no hay etapas"
            : `${proyecto.stages.length} etapa${proyecto.stages.length === 1 ? "" : "s"} · ${avance.closed}/${avance.total} tareas cerradas`
        }
        abierto={proyecto.status === "APPROVED" || proyecto.status === "IN_PROGRESS"}
      >
        {!canCloseTasks(proyecto.status) && !isClosed(proyecto.status) ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Las tareas se pueden armar y repartir desde ya; se dan por hechas cuando el proyecto esté aprobado.
          </p>
        ) : null}

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
      </Desplegable>

      {money ? (
        <Desplegable
          id="dinero"
          icono={Wallet}
          titulo="Dinero"
          resumen={
            money.numeros.neededMinor > 0
              ? `Necesario ${formatMinorArs(money.numeros.neededMinor)} · gastado ${formatMinorArs(money.numeros.spentMinor)}`
              : "Sin cotizaciones ni costos cargados"
          }
          abierto={proyecto.status === "APPROVED" || proyecto.status === "IN_PROGRESS"}
        >
        <ProjectMoneySection
          bare
          projectId={proyecto.id}
          money={money}
          canManage={canManage}
          canEditQuotes={canManage && canEditStructure(proyecto.status)}
          cashOn={cashOn}
          canHandleMoney={puedePlata}
          acceptsMoney={proyecto.status === "APPROVED" || proyecto.status === "IN_PROGRESS"}
          accounts={cuentas}
          categories={categorias}
        />
        </Desplegable>
      ) : null}

      <Desplegable
        id="archivos"
        icono={Paperclip}
        titulo="Archivos"
        resumen={
          archivosDelProyecto.length + archivosDeAvances.length === 0
            ? "Ninguno"
            : `${archivosDelProyecto.length + archivosDeAvances.length} archivo${archivosDelProyecto.length + archivosDeAvances.length === 1 ? "" : "s"}`
        }
        abierto={archivosDelProyecto.length + archivosDeAvances.length > 0 && archivosDelProyecto.length + archivosDeAvances.length <= 3}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--fo-muted)]">Internos de la comisión salvo los que marques visibles.</p>
          {canManage ? <ProjectFileUploader projectId={proyecto.id} /> : null}
        </div>
        {archivosDelProyecto.length + archivosDeAvances.length === 0 ? (
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
      </Desplegable>

      <Desplegable
        id="historial"
        icono={History}
        titulo="Historial"
        resumen={proyecto.events[0] ? `Último movimiento: ${fechaHora(proyecto.events[0].createdAt)}` : "Sin movimientos"}
      >
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
      </Desplegable>
    </div>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--fo-muted)]">{rotulo}</dt>
      <dd className="text-right font-medium text-[var(--fo-text)]">{valor}</dd>
    </div>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const TONO_CIFRA = {
  success: "text-[var(--fo-success)] bg-[var(--fo-success-soft)]",
  danger: "text-[var(--fo-danger)] bg-[var(--fo-danger-soft)]",
  neutral: "text-[var(--fo-muted)] bg-[var(--fo-surface-muted)]",
} as const;

/** Un número grande del recuento: ✓ a favor, ✗ en contra, ○ sin votar. */
function Cifra({ icono: Icono, valor, rotulo, tono }: { icono: LucideIcon; valor: number; rotulo: string; tono: keyof typeof TONO_CIFRA }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-[var(--fo-radius-sm)] px-2 py-3 ${TONO_CIFRA[tono]}`}>
      <span className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        <Icono className="size-5" strokeWidth={3} aria-hidden />
        {valor}
      </span>
      <span className="text-xs font-medium">{rotulo}</span>
    </div>
  );
}

function Renglon({ icono: Icono, rotulo, valor, destacado }: { icono: LucideIcon; rotulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
        <Icono className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <dt className="text-xs text-[var(--fo-muted)]">{rotulo}</dt>
        <dd className={`whitespace-pre-line ${destacado ? "text-lg font-semibold tabular-nums" : "text-sm"} text-[var(--fo-text)]`}>{valor}</dd>
      </div>
    </div>
  );
}

/** Una sección larga, plegada con su resumen a la vista: se abre sólo lo que se va a usar. */
function Desplegable({
  id,
  icono: Icono,
  titulo,
  resumen,
  abierto,
  children,
}: {
  id: string;
  icono: LucideIcon;
  titulo: string;
  resumen: string;
  abierto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={abierto} className="group space-y-4">
      <summary className="fo-card flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:border-[var(--fo-border-strong)] [&::-webkit-details-marker]:hidden">
        <Icono className="size-5 shrink-0 text-[var(--fo-accent)]" aria-hidden />
        <span className="font-semibold">{titulo}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--fo-muted)]">{resumen}</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--fo-muted)] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4">{children}</div>
    </details>
  );
}

/** Cómo se ve cada decisión: ✓ verde para aprobar, ✗ roja para rechazar, ámbar para postergar. */
const ESTILO_DECISION: Partial<Record<ProjectStatus, string>> = {
  APPROVED: "border-[var(--fo-success)] bg-[var(--fo-success)] text-white hover:opacity-90",
  DONE: "border-[var(--fo-success)] bg-[var(--fo-success)] text-white hover:opacity-90",
  PROPOSED: "border-[var(--fo-success)] bg-[var(--fo-success)] text-white hover:opacity-90",
  REJECTED: "border-[var(--fo-danger)] bg-[var(--fo-danger)] text-white hover:opacity-90",
  POSTPONED: "border-[var(--fo-warning)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)] hover:border-[var(--fo-warning)]",
  CANCELLED: "border-[var(--fo-border)] text-[var(--fo-danger)] hover:border-[var(--fo-danger)]",
  ARCHIVED: "border-[var(--fo-border)] text-[var(--fo-danger)] hover:border-[var(--fo-danger)]",
};
const ESTILO_NEUTRO = "border-[var(--fo-border)] text-[var(--fo-text)] hover:border-[var(--fo-border-strong)]";
const BOTON_DECISION =
  "flex w-full cursor-pointer list-none items-center justify-center gap-2 rounded-[var(--fo-radius-sm)] border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)] [&::-webkit-details-marker]:hidden";

/** Un botón por cada estado posible; los que piden datos se despliegan con su formulario. */
function CambioDeEstado({ projectId, to }: { projectId: string; to: ProjectStatus }) {
  const decision = isCommissionDecision(to);
  const motivo = requiresReason(to);
  const Icono = STATUS_ICON[to];
  const contenido = (
    <>
      {Icono ? <Icono className="size-4" strokeWidth={2.75} aria-hidden /> : null}
      {projectActionLabel(to)}
    </>
  );
  const estilo = `${BOTON_DECISION} ${ESTILO_DECISION[to] ?? ESTILO_NEUTRO}`;
  if (!decision && !motivo) {
    return (
      <form action={changeProjectStatusAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value={to} />
        <button type="submit" className={estilo}>
          {contenido}
        </button>
      </form>
    );
  }
  return (
    <details className="group">
      <summary className={estilo}>{contenido}</summary>
      <form action={changeProjectStatusAction} className="mt-3 space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value={to} />
        {decision ? (
          <>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`decidedOn-${to}`}>
                Fecha de la reunión
              </label>
              <input id={`decidedOn-${to}`} name="decidedOn" type="date" className="fo-input" required />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`decision-${to}`}>
                Qué se decidió
              </label>
              <textarea id={`decision-${to}`} name="decision" className="fo-input" rows={2} placeholder="Ej.: Se aprueba con un tope de $300.000." />
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
        <button type="submit" className="fo-btn fo-btn-primary w-full text-sm">
          Confirmar: {projectActionLabel(to).toLowerCase()}
        </button>
      </form>
    </details>
  );
}
