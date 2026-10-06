import Link from "next/link";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { listMemberTasks, listOpenTasksForVolunteers } from "@/lib/governance/repository";
import { volunteerForTaskAction } from "../proyectos/actions";
import { isTaskOverdue } from "@/lib/governance/urgency";
import { fecha } from "@/lib/governance/labels";
import { TaskStatusBadge } from "@/components/governance/badges";

export const dynamic = "force-dynamic";

export default async function MisTareasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace, member } = await requirePortalGovernance();
  const params = await searchParams;
  const [tareas, libres] = await Promise.all([
    listMemberTasks(workspace.id, member.id),
    listOpenTasksForVolunteers(workspace.id),
  ]);
  const ahora = new Date();
  const abiertas = tareas.filter((t) => t.status !== "DONE" && t.status !== "NOT_DONE");
  const cerradas = tareas.filter((t) => t.status === "DONE" || t.status === "NOT_DONE");

  const fila = (t: (typeof tareas)[number]) => {
    const vencida = isTaskOverdue(t, ahora);
    return (
      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
        <div className="min-w-0 space-y-1">
          <Link href={`/portal/tareas/${t.id}`} className="font-medium hover:underline">
            {t.title}
          </Link>
          <p className="text-xs text-[var(--fo-muted)]">
            {t.project.title} · {t.stage.title}
            {t.dueAt ? (
              <span className={vencida ? "font-medium text-[var(--fo-danger)]" : ""}>
                {" · "}
                {vencida ? "venció el " : "para el "}
                {fecha(t.dueAt)}
              </span>
            ) : null}
          </p>
        </div>
        <TaskStatusBadge status={t.status} />
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Mis tareas</h1>
        <p className="max-w-2xl text-sm text-[var(--fo-muted)]">
          Lo que te encargó la comisión en algún proyecto. Entrá a cada una para contar cómo va o darla por hecha.
        </p>
      </header>

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}

      <section id="ayudar" className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Tareas a realizar: ¡necesitamos tu ayuda!</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no tienen a nadie a cargo. Si podés con alguna, tocá «Me ofrezco» y queda a tu nombre; la comisión lo ve al instante.
          </p>
        </div>
        {libres.tasks.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Por ahora todas las tareas tienen responsable. ¡Gracias!</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {libres.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    <Link href={`/portal/proyectos/${t.project.id}`} className="hover:underline">
                      {t.project.title}
                    </Link>{" "}
                    · {t.stage.title}
                    {t.dueAt ? ` · para el ${fecha(t.dueAt)}` : ""}
                  </p>
                  {t.description ? <p className="text-xs text-[var(--fo-text-secondary)]">{t.description}</p> : null}
                </div>
                <form action={volunteerForTaskAction}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <button type="submit" className="fo-btn fo-btn-primary text-sm">
                    Me ofrezco
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tareas.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no tenés tareas a tu nombre.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Mis tareas pendientes</h2>
            {abiertas.length === 0 ? (
              <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">¡Nada pendiente!</p>
            ) : (
              <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">{abiertas.map(fila)}</ul>
            )}
          </section>
          {cerradas.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Cerradas</h2>
              <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">{cerradas.map(fila)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
