import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { requireGovernanceManager } from "@/lib/governance/access";
import { stagesToText } from "@/lib/governance/templates";
import { archiveProjectTypeAction, saveProjectTypeAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditarTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ typeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireGovernanceManager();
  const { typeId } = await params;
  const avisos = await searchParams;
  const tipo = await prisma.govProjectType.findFirst({
    where: { id: typeId, workspaceId: workspace.id },
    include: { stages: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } } },
  });
  if (!tipo) notFound();
  const texto = stagesToText(tipo.stages.map((s) => ({ title: s.title, tasks: s.tasks.map((t) => t.title) })));

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/gobierno/tipos" className="text-sm text-[var(--fo-muted)] hover:underline">
          ← Tipos de proyecto
        </Link>
        <PageHeader title={tipo.name} description="Los cambios valen para los proyectos que se creen de acá en adelante." />
      </div>

      <Flash error={avisos.error} />

      <form action={saveProjectTypeAction} className="fo-card max-w-2xl space-y-5 p-6">
        <input type="hidden" name="typeId" value={tipo.id} />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" className="fo-input" required maxLength={120} defaultValue={tipo.name} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Para qué sirve
          </label>
          <input id="description" name="description" className="fo-input" maxLength={300} defaultValue={tipo.description ?? ""} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="stagesText">
            Etapas y tareas
          </label>
          <textarea id="stagesText" name="stagesText" className="fo-input font-mono text-sm" rows={16} defaultValue={texto} />
          <p className="fo-helper">Una etapa por renglón y, debajo, sus tareas empezando con un guion (-).</p>
        </div>
        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Guardar
          </button>
          <Link href="/gobierno/tipos" className="fo-btn fo-btn-ghost text-sm">
            Cancelar
          </Link>
        </div>
      </form>

      {tipo.archivedAt ? null : (
        <form action={archiveProjectTypeAction} className="max-w-2xl">
          <input type="hidden" name="typeId" value={tipo.id} />
          <input type="hidden" name="archive" value="1" />
          <p className="mb-3 text-sm text-[var(--fo-muted)]">
            Archivarlo lo saca de la lista al crear proyectos. Los proyectos que ya lo usan no cambian.
          </p>
          <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
            Archivar este tipo
          </button>
        </form>
      )}
    </div>
  );
}
