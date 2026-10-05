import Link from "next/link";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { listMemberTasks } from "@/lib/governance/repository";
import { isTaskOverdue } from "@/lib/governance/urgency";
import { fecha } from "@/lib/governance/labels";
import { TaskStatusBadge } from "@/components/governance/badges";

export const dynamic = "force-dynamic";

export default async function MisTareasPage() {
  const { workspace, member } = await requirePortalGovernance();
  const tareas = await listMemberTasks(workspace.id, member.id);
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

      {tareas.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">No tenés tareas asignadas.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pendientes</h2>
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
