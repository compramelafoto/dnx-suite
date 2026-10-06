import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Flash, MemberSelect } from "@/components/governance/member-select";
import { requireGovernanceManager } from "@/lib/governance/access";
import { listMemberOptions, listProjectTypes } from "@/lib/governance/repository";
import { ensureDefaultProjectTypes } from "@/lib/governance/seed";
import { createProjectAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NuevoProyectoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace, canCoordinate } = await requireGovernanceManager();
  const params = await searchParams;
  await ensureDefaultProjectTypes(workspace.id);
  const [tipos, socios] = await Promise.all([listProjectTypes(workspace.id), listMemberOptions(workspace.id)]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nuevo proyecto"
        description="El tipo trae sus etapas y tareas armadas; después se ajustan a mano. Nada de esto lo ven los socios salvo que lo marques."
      />

      <Flash error={params.error} />

      <form action={createProjectAction} className="fo-card max-w-2xl space-y-6 p-6">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="title">
            Título
          </label>
          <input id="title" name="title" className="fo-input" required maxLength={160} placeholder="Muestra Día de la Fotografía" />
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="typeId">
            Tipo de proyecto
          </label>
          <select id="typeId" name="typeId" className="fo-input" defaultValue={tipos[0]?.id ?? ""}>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.stages.length > 0 ? ` — ${t.stages.map((s) => s.title).join(", ")}` : ""}
              </option>
            ))}
            <option value="">Sin tipo (en blanco)</option>
          </select>
          <p className="fo-helper">
            Las etapas y tareas se copian al proyecto.
            {canCoordinate ? (
              <>
                {" "}
                Los tipos se editan en{" "}
                <Link href="/gobierno/tipos" className="underline">
                  Tipos de proyecto
                </Link>
                .
              </>
            ) : (
              " Los tipos los administra quien coordina los proyectos."
            )}
          </p>
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea id="description" name="description" className="fo-input" rows={4} placeholder="Qué es, para qué sirve, a quién está dirigido." />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="responsibleMemberId">
              Responsable general
            </label>
            <MemberSelect id="responsibleMemberId" name="responsibleMemberId" options={socios} emptyLabel="Todavía nadie" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="deadlineAt">
              Fecha límite
            </label>
            <input id="deadlineAt" name="deadlineAt" type="date" className="fo-input" />
            <p className="fo-helper">Opcional. Ordena la lista por urgencia.</p>
          </div>
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="initialStatus">
            ¿En qué estado está?
          </label>
          <select id="initialStatus" name="initialStatus" className="fo-input" defaultValue="PROPOSED">
            <option value="PROPOSED">Es una propuesta nueva: la comisión todavía tiene que tratarla</option>
            <option value="APPROVED">Ya estaba aprobado antes de usar el sistema</option>
            <option value="IN_PROGRESS">Ya estaba en ejecución antes de usar el sistema</option>
          </select>
          <p className="fo-helper">Para cargar los proyectos que ya venían en marcha sin hacerlos votar de nuevo.</p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="visibleToMembers" className="mt-1" />
          <span>
            <span className="font-medium">Visible para socios</span>
            <span className="block text-[var(--fo-muted)]">
              Por ahora sólo lo marca: los socios lo van a ver en su portal cuando esté habilitada esa parte.
            </span>
          </span>
        </label>

        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Crear proyecto
          </button>
          <Link href="/gobierno" className="fo-btn fo-btn-ghost text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
