import Link from "next/link";
import { ListTodo } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { TaskStatusBadge } from "@/components/governance/badges";
import { requireGovernanceViewer } from "@/lib/governance/access";
import { listBoardTasks } from "@/lib/governance/repository";
import { isTaskOverdue } from "@/lib/governance/urgency";
import { fecha } from "@/lib/governance/labels";

export const dynamic = "force-dynamic";

const QUIEN = [
  { key: "todas", label: "Todas" },
  { key: "mias", label: "Las mías" },
  { key: "sin-asignar", label: "Sin responsable" },
] as const;

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ quien?: string; cerradas?: string; error?: string; ok?: string }>;
}) {
  const { workspace, viewerMemberId } = await requireGovernanceViewer();
  const params = await searchParams;
  const quien = QUIEN.some((q) => q.key === params.quien) ? params.quien! : "todas";
  const verCerradas = params.cerradas === "1";
  const ahora = new Date();

  const tareas = (await listBoardTasks(workspace.id)).filter((t) => {
    if (!verCerradas && (t.status === "DONE" || t.status === "NOT_DONE")) return false;
    if (quien === "mias") return viewerMemberId !== null && t.assigneeMemberId === viewerMemberId;
    if (quien === "sin-asignar") return t.assigneeMemberId === null;
    return true;
  });
  const vencidas = tareas.filter((t) => isTaskOverdue(t, ahora)).length;

  const enlace = (cambios: { quien?: string; cerradas?: boolean }) => {
    const q = new URLSearchParams();
    const nq = cambios.quien ?? quien;
    const nc = cambios.cerradas ?? verCerradas;
    if (nq !== "todas") q.set("quien", nq);
    if (nc) q.set("cerradas", "1");
    const s = q.toString();
    return s ? `/gobierno/tareas?${s}` : "/gobierno/tareas";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tareas"
        description="Todo lo que está repartido entre la comisión y los socios: quién tiene qué y para cuándo. Primero lo que vence antes."
      />

      <Flash error={params.error} ok={params.ok} />

      <div className="flex flex-wrap items-center gap-2">
        {QUIEN.map((q) => (
          <Link
            key={q.key}
            href={enlace({ quien: q.key })}
            className={`fo-btn text-sm ${quien === q.key ? "fo-btn-secondary" : "fo-btn-ghost"}`}
            aria-current={quien === q.key ? "page" : undefined}
          >
            {q.label}
          </Link>
        ))}
        <Link href={enlace({ cerradas: !verCerradas })} className="fo-btn fo-btn-ghost text-sm">
          {verCerradas ? "Ocultar las cerradas" : "Ver también las cerradas"}
        </Link>
      </div>

      {vencidas > 0 ? (
        <p className="fo-alert-warning p-4 text-sm">
          {vencidas === 1 ? "Hay una tarea vencida." : `Hay ${vencidas} tareas vencidas.`}
        </p>
      ) : null}

      {quien === "mias" && viewerMemberId === null ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          Tu usuario no está vinculado a una ficha de socio de esta institución, así que no tiene tareas propias.
        </p>
      ) : tareas.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <ListTodo className="size-7" aria-hidden />
          </div>
          <p className="text-base font-semibold">No hay tareas en esta lista</p>
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-left text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-3 font-medium">Tarea</th>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 font-medium">Para cuándo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((t) => {
                const vencida = isTaskOverdue(t, ahora);
                return (
                  <tr key={t.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/gobierno/${t.project.id}/tareas/${t.id}`} className="font-medium hover:underline">
                        {t.title}
                      </Link>
                      <p className="text-xs text-[var(--fo-muted)]">{t.stage.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/gobierno/${t.project.id}`} className="text-[var(--fo-text-secondary)] hover:underline">
                        {t.project.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--fo-text-secondary)]">{t.assigneeName ?? "—"}</td>
                    <td className={`px-4 py-3 ${vencida ? "font-medium text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
                      {t.dueAt ? `${vencida ? "Venció el " : ""}${fecha(t.dueAt)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <TaskStatusBadge status={t.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
