import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Flash, MemberSelect } from "@/components/governance/member-select";
import { ProjectStatusBadge, TaskStatusBadge } from "@/components/governance/badges";
import { TaskProgressForm } from "@/components/governance/task-progress-form";
import { canEditProject, canWorkOnTask, requireGovernanceViewer } from "@/lib/governance/access";
import { getTask, listMemberOptions } from "@/lib/governance/repository";
import { allowedTaskStatuses, canEditStructure } from "@/lib/governance/lifecycle";
import { isTaskOverdue } from "@/lib/governance/urgency";
import { fecha, fechaHora, tamanioArchivo, taskStatusLabel } from "@/lib/governance/labels";
import { toDateInputValue } from "@/lib/governance/forms";
import { removeTaskAction, setTaskStatusAction, updateTaskAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function TareaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requireGovernanceViewer();
  const { workspace, canManage } = ctx;
  const { id, taskId } = await params;
  const avisos = await searchParams;
  const t = await getTask(workspace.id, id, taskId);
  if (!t) notFound();

  const puedeTrabajar = canWorkOnTask(ctx, t);
  const editable = canManage && canEditStructure(t.project.status);
  // Editar y reasignar la tarea es de todo el que gestiona; quitarla, de quien edita el proyecto.
  const puedeQuitar = editable && canEditProject(ctx, t.project);
  const estados = puedeTrabajar ? allowedTaskStatuses(t.project.status).filter((s) => s !== t.status) : [];
  const socios = editable ? await listMemberOptions(workspace.id) : { commission: [], others: [] };
  const vencida = isTaskOverdue(t, new Date());
  const aqui = `/gobierno/${t.project.id}/tareas/${t.id}`;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href={`/gobierno/${t.project.id}#etapa-${t.stage.id}`} className="text-sm text-[var(--fo-muted)] hover:underline">
          ← {t.project.title} · {t.stage.title}
        </Link>
        <PageHeader title={t.title} description={t.description ?? undefined} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <TaskStatusBadge status={t.status} />
          <span className="text-[var(--fo-muted)]">Proyecto:</span>
          <ProjectStatusBadge status={t.project.status} />
        </div>
      </div>

      <Flash error={avisos.error} ok={avisos.ok} />

      <section className="fo-card grid gap-4 p-6 text-sm sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Responsable</p>
          <p>{t.assigneeName ?? "Sin responsable"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Para cuándo</p>
          <p className={vencida ? "font-medium text-[var(--fo-danger)]" : ""}>
            {t.dueAt ? `${vencida ? "Venció el " : ""}${fecha(t.dueAt)}` : "Sin fecha"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Cerrada</p>
          <p>{t.closedAt ? fechaHora(t.closedAt) : "—"}</p>
        </div>
        {t.status === "NOT_DONE" && t.notDoneReason ? (
          <div className="space-y-1 sm:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Por qué no se hizo</p>
            <p className="whitespace-pre-line">{t.notDoneReason}</p>
          </div>
        ) : null}
      </section>

      {estados.length > 0 ? (
        <section className="fo-card space-y-4 p-6">
          <h2 className="text-base font-semibold">Cambiar el estado</h2>
          <div className="flex flex-wrap gap-2">
            {estados
              .filter((s) => s !== "NOT_DONE")
              .map((s) => (
                <form key={s} action={setTaskStatusAction}>
                  <input type="hidden" name="projectId" value={t.project.id} />
                  <input type="hidden" name="taskId" value={t.id} />
                  <input type="hidden" name="status" value={s} />
                  <input type="hidden" name="returnTo" value={aqui} />
                  <button type="submit" className={`fo-btn text-sm ${s === "DONE" ? "fo-btn-primary" : "fo-btn-secondary"}`}>
                    {s === "DONE" ? "Marcar hecha" : s === "IN_PROGRESS" ? "Marcar en curso" : `Volver a ${taskStatusLabel(s).toLowerCase()}`}
                  </button>
                </form>
              ))}
          </div>
          {estados.includes("NOT_DONE") ? (
            <details>
              <summary className="cursor-pointer text-sm text-[var(--fo-muted)]">No se hizo…</summary>
              <form action={setTaskStatusAction} className="mt-3 max-w-xl space-y-3">
                <input type="hidden" name="projectId" value={t.project.id} />
                <input type="hidden" name="taskId" value={t.id} />
                <input type="hidden" name="status" value="NOT_DONE" />
                <input type="hidden" name="returnTo" value={aqui} />
                <label className="fo-label" htmlFor="reason">
                  Por qué no se hizo
                </label>
                <textarea id="reason" name="reason" className="fo-input" rows={2} required />
                <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                  Marcar «No se hizo»
                </button>
              </form>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Avances</h2>
        {puedeTrabajar ? (
          <div className="fo-card p-5">
            <TaskProgressForm projectId={t.project.id} taskId={t.id} />
          </div>
        ) : null}
        {t.updates.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía nadie contó avances.</p>
        ) : (
          <ol className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {t.updates.map((u) => (
              <li key={u.id} className="space-y-2 px-5 py-4 text-sm">
                <p className="text-xs text-[var(--fo-muted)]">
                  <span className="font-medium text-[var(--fo-text)]">{u.authorLabel}</span> · {fechaHora(u.createdAt)}
                </p>
                <p className="whitespace-pre-line">{u.body}</p>
                {u.attachments.length > 0 ? (
                  <ul className="space-y-1">
                    {u.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={`/api/gobierno/archivos/${a.id}`} className="inline-flex items-center gap-2 hover:underline">
                          <Download className="size-4" aria-hidden />
                          {a.filename}
                          <span className="text-xs text-[var(--fo-muted)]">({tamanioArchivo(a.sizeBytes)})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {editable ? (
        <details className="fo-card p-6">
          <summary className="cursor-pointer text-sm font-medium">Editar la tarea</summary>
          <form action={updateTaskAction} className="mt-6 max-w-2xl space-y-5">
            <input type="hidden" name="projectId" value={t.project.id} />
            <input type="hidden" name="taskId" value={t.id} />
            <input type="hidden" name="returnTo" value={aqui} />
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="title">
                Qué hay que hacer
              </label>
              <input id="title" name="title" className="fo-input" required maxLength={160} defaultValue={t.title} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="description">
                Detalle
              </label>
              <textarea id="description" name="description" className="fo-input" rows={3} defaultValue={t.description ?? ""} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="assignee">
                  Responsable
                </label>
                <MemberSelect
                  id="assignee"
                  name="assigneeMemberId"
                  options={socios}
                  defaultValue={t.assigneeMemberId}
                  current={t.assignee ? { id: t.assignee.id, label: `${t.assignee.lastName}, ${t.assignee.firstName}` } : null}
                />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="dueAt">
                  Para cuándo
                </label>
                <input id="dueAt" name="dueAt" type="date" className="fo-input" defaultValue={toDateInputValue(t.dueAt)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Guardar
              </button>
            </div>
          </form>
          {puedeQuitar && t.updates.length === 0 && t.status !== "DONE" ? (
            <form action={removeTaskAction} className="mt-6 border-t border-[var(--fo-border-muted)] pt-4">
              <input type="hidden" name="projectId" value={t.project.id} />
              <input type="hidden" name="taskId" value={t.id} />
              <p className="mb-3 text-sm text-[var(--fo-muted)]">
                Se puede quitar mientras no tenga avances. Queda anotado en el historial.
              </p>
              <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                Quitar la tarea
              </button>
            </form>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
