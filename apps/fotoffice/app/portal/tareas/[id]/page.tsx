import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { getMemberTask } from "@/lib/governance/repository";
import { allowedTaskStatuses } from "@/lib/governance/lifecycle";
import { isTaskOverdue } from "@/lib/governance/urgency";
import { fecha, fechaHora, tamanioArchivo } from "@/lib/governance/labels";
import { TaskStatusBadge } from "@/components/governance/badges";
import { TaskProgressForm } from "@/components/governance/task-progress-form";
import { memberSetTaskStatusAction, memberTaskProgressAction } from "../../proyectos/actions";

export const dynamic = "force-dynamic";

export default async function MiTareaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, member } = await requirePortalGovernance();
  const { id } = await params;
  const avisos = await searchParams;
  const t = await getMemberTask(workspace.id, member.id, id);
  if (!t) notFound();
  const estados = allowedTaskStatuses(t.project.status).filter((s) => s !== t.status);
  const vencida = isTaskOverdue(t, new Date());
  const abierta = t.status !== "DONE" && t.status !== "NOT_DONE";

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/portal/tareas" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Mis tareas
      </Link>
      <header className="space-y-2">
        <p className="text-xs text-[var(--fo-muted)]">
          {t.project.title} · {t.stage.title}
        </p>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <TaskStatusBadge status={t.status} />
          {t.dueAt ? (
            <span className={vencida ? "font-medium text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}>
              {vencida ? "Venció el " : "Para el "}
              {fecha(t.dueAt)}
            </span>
          ) : null}
        </div>
        {t.description ? <p className="whitespace-pre-line text-sm">{t.description}</p> : null}
      </header>

      {avisos.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {avisos.error}
        </p>
      ) : null}
      {avisos.ok === "ofrecida" ? (
        <p className="fo-alert-success p-4 text-sm">¡Gracias! La tarea quedó a tu nombre. Acá podés ir contando cómo va.</p>
      ) : avisos.ok ? (
        <p className="fo-alert-success p-4 text-sm">Listo, quedó registrado.</p>
      ) : null}

      {abierta && estados.length > 0 ? (
        <section className="fo-card space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {estados.includes("DONE") ? (
              <form action={memberSetTaskStatusAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <input type="hidden" name="status" value="DONE" />
                <button type="submit" className="fo-btn fo-btn-primary text-sm">
                  Ya la hice
                </button>
              </form>
            ) : null}
            {estados.includes("IN_PROGRESS") ? (
              <form action={memberSetTaskStatusAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <input type="hidden" name="status" value="IN_PROGRESS" />
                <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                  La estoy haciendo
                </button>
              </form>
            ) : null}
          </div>
          {estados.includes("NOT_DONE") ? (
            <details>
              <summary className="cursor-pointer text-sm text-[var(--fo-muted)]">No la voy a poder hacer…</summary>
              <form action={memberSetTaskStatusAction} className="mt-3 space-y-3">
                <input type="hidden" name="taskId" value={t.id} />
                <input type="hidden" name="status" value="NOT_DONE" />
                <textarea name="reason" className="fo-input" rows={2} required aria-label="Por qué" placeholder="Contale a la comisión por qué, así la reasigna." />
                <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                  Avisar que no se hace
                </button>
              </form>
            </details>
          ) : null}
          {!estados.includes("DONE") ? (
            <p className="text-xs text-[var(--fo-muted)]">
              El proyecto todavía no está aprobado: podés ir contando avances; se da por hecha cuando se apruebe.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Avances</h2>
        <div className="fo-card p-5">
          <TaskProgressForm
            projectId={t.project.id}
            taskId={t.id}
            submit={memberTaskProgressAction}
            uploadEndpoint="/api/portal/gobierno/upload-url"
          />
        </div>
        {t.updates.length > 0 ? (
          <ol className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {t.updates.map((u) => (
              <li key={u.id} className="space-y-2 px-5 py-4 text-sm">
                <p className="text-xs text-[var(--fo-muted)]">
                  <span className="font-medium text-[var(--fo-text)]">{u.authorLabel}</span> · {fechaHora(u.createdAt)}
                </p>
                <p className="whitespace-pre-line">{u.body}</p>
                {u.attachments.map((a) => (
                  <a key={a.id} href={`/api/portal/gobierno/archivos/${a.id}`} className="block hover:underline">
                    {a.filename} <span className="text-xs text-[var(--fo-muted)]">({tamanioArchivo(a.sizeBytes)})</span>
                  </a>
                ))}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
