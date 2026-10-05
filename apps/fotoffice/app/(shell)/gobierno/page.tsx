import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { ProgressBar, ProjectStatusBadge, UrgencyDot } from "@/components/governance/badges";
import { requireGovernanceViewer } from "@/lib/governance/access";
import { listProjects, loadVoting } from "@/lib/governance/repository";
import { isVotingOpen, tallyLabel } from "@/lib/governance/votes";
import { ensureDefaultProjectTypes } from "@/lib/governance/seed";
import { isClosed } from "@/lib/governance/lifecycle";
import { progressOf, sortByPriority, urgencyFor } from "@/lib/governance/urgency";
import { fecha } from "@/lib/governance/labels";

export const dynamic = "force-dynamic";

const FILTROS = [
  { key: "activos", label: "En curso" },
  { key: "cerrados", label: "Cerrados" },
  { key: "todos", label: "Todos" },
] as const;

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; ver?: string }>;
}) {
  const { workspace, canManage } = await requireGovernanceViewer();
  const params = await searchParams;
  await ensureDefaultProjectTypes(workspace.id);
  const ahora = new Date();
  const lista = await listProjects(workspace.id);
  const votacion = await loadVoting(workspace.id, lista.map((p) => p.id));
  const todos = sortByPriority(lista, ahora, (p) => votacion.tallyOf(p.id).percentFor);
  const ver = FILTROS.some((f) => f.key === params.ver) ? params.ver! : "activos";
  const proyectos = todos.filter((p) =>
    ver === "todos" ? true : ver === "cerrados" ? isClosed(p.status) : !isClosed(p.status),
  );
  const propuestas = todos.filter((p) => p.status === "MEMBER_PROPOSAL").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Proyectos"
        description="Cada proyecto de la comisión con sus etapas, tareas, archivos e historial. Ordenados por prioridad: primero lo que vence antes y, dentro de cada color, lo que tiene más apoyo."
        actions={
          canManage ? (
            <Link href="/gobierno/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo proyecto
            </Link>
          ) : null
        }
      />

      <Flash error={params.error} ok={params.ok} />

      {propuestas > 0 ? (
        <p className="fo-alert-warning p-4 text-sm">
          {propuestas === 1 ? "Hay una propuesta de socio esperando respuesta." : `Hay ${propuestas} propuestas de socios esperando respuesta.`}{" "}
          Abrila para aceptarla (pasa al temario de la próxima reunión) o archivarla con el motivo.
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar proyectos">
        {FILTROS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "activos" ? "/gobierno" : `/gobierno?ver=${f.key}`}
            className={`fo-btn text-sm ${ver === f.key ? "fo-btn-secondary" : "fo-btn-ghost"}`}
            aria-current={ver === f.key ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {proyectos.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <FolderKanban className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">
              {todos.length === 0 ? "Todavía no hay ningún proyecto" : "No hay proyectos en esta lista"}
            </p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Un proyecto se arma desde un tipo (muestra, evento, curso, compra) que ya trae sus etapas y
              tareas. Los que ya estaban en marcha se pueden cargar directamente como aprobados.
            </p>
          </div>
          {canManage && todos.length === 0 ? (
            <Link href="/gobierno/nuevo" className="fo-btn fo-btn-primary text-sm">
              Cargar el primero
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-left text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha límite</th>
                <th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 font-medium">Apoyo</th>
                <th className="px-4 py-3 font-medium">Avance</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => {
                const avance = progressOf(p.tasks);
                return (
                  <tr key={p.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/gobierno/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                      <p className="text-xs text-[var(--fo-muted)]">
                        {p.type?.name ?? "Sin tipo"}
                        {p.visibleToMembers ? " · visible para socios" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className="text-[var(--fo-text-secondary)]">{fecha(p.deadlineAt)}</span>
                        {isClosed(p.status) ? null : <UrgencyDot urgency={urgencyFor(p.deadlineAt, ahora)} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--fo-text-secondary)]">{p.responsibleName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fo-muted)]">
                      {isVotingOpen(p.status) ? tallyLabel(votacion.tallyOf(p.id)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {avance.total > 0 ? <ProgressBar {...avance} /> : <span className="text-xs text-[var(--fo-muted)]">Sin tareas</span>}
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
