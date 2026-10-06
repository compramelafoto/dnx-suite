import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { requireGovernanceCoordinator } from "@/lib/governance/access";
import { listProjectTypes } from "@/lib/governance/repository";
import { ensureDefaultProjectTypes } from "@/lib/governance/seed";
import { archiveProjectTypeAction, saveProjectTypeAction } from "../actions";

export const dynamic = "force-dynamic";

const EJEMPLO = "Difusión\n- Diseñar el flyer\n- Publicar en redes\nImpresión de obras\n- Pedir cotizaciones";

export default async function TiposPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireGovernanceCoordinator();
  const params = await searchParams;
  await ensureDefaultProjectTypes(workspace.id);
  const tipos = await listProjectTypes(workspace.id, { includeArchived: true });
  const activos = tipos.filter((t) => !t.archivedAt);
  const archivados = tipos.filter((t) => t.archivedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tipos de proyecto"
        description="Cada tipo trae sus etapas y tareas armadas. Al crear un proyecto se copian, así que cambiar un tipo no toca los proyectos que ya existen."
      />

      <Flash error={params.error} ok={params.ok} />

      <div className="grid gap-4 md:grid-cols-2">
        {activos.map((t) => (
          <div key={t.id} className="fo-card space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t.name}</h2>
                {t.description ? <p className="text-sm text-[var(--fo-muted)]">{t.description}</p> : null}
              </div>
              <Link href={`/gobierno/tipos/${t.id}`} className="fo-btn fo-btn-ghost text-sm">
                Editar
              </Link>
            </div>
            {t.stages.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--fo-text-secondary)]">
                {t.stages.map((s) => (
                  <li key={s.id}>
                    {s.title}
                    {s.tasks.length > 0 ? (
                      <span className="text-[var(--fo-muted)]"> — {s.tasks.length} tarea{s.tasks.length > 1 ? "s" : ""}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">Sin etapas.</p>
            )}
            <p className="text-xs text-[var(--fo-muted)]">
              {t._count.projects === 0 ? "Ningún proyecto lo usa todavía." : `Lo usan ${t._count.projects} proyecto${t._count.projects > 1 ? "s" : ""}.`}
            </p>
          </div>
        ))}
      </div>

      <details className="fo-card p-6">
        <summary className="cursor-pointer text-sm font-medium">+ Nuevo tipo de proyecto</summary>
        <form action={saveProjectTypeAction} className="mt-6 max-w-2xl space-y-5">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="name">
              Nombre
            </label>
            <input id="name" name="name" className="fo-input" required maxLength={120} placeholder="Ej.: Salida fotográfica" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="description">
              Para qué sirve
            </label>
            <input id="description" name="description" className="fo-input" maxLength={300} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="stagesText">
              Etapas y tareas
            </label>
            <textarea id="stagesText" name="stagesText" className="fo-input font-mono text-sm" rows={10} placeholder={EJEMPLO} />
            <p className="fo-helper">
              Una etapa por renglón y, debajo, sus tareas empezando con un guion (-). Se reordena cortando y pegando.
            </p>
          </div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Crear tipo
          </button>
        </form>
      </details>

      {archivados.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Archivados</h2>
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {archivados.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>{t.name}</span>
                <form action={archiveProjectTypeAction}>
                  <input type="hidden" name="typeId" value={t.id} />
                  <input type="hidden" name="archive" value="0" />
                  <button type="submit" className="fo-btn fo-btn-ghost text-sm">
                    Restaurar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
