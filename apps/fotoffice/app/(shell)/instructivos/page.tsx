import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevels } from "@/lib/permissions/module-access";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { INSTRUCTIVOS } from "@/lib/instructivos/catalogo";
import { agruparPorSeccion, instructivosVisibles } from "@/lib/instructivos/visibles";

export const dynamic = "force-dynamic";

/**
 * Índice de instructivos: las guías paso a paso de las pantallas que esta persona puede usar.
 * Cada guía se lee online y se puede guardar en PDF desde el navegador.
 */
export default async function InstructivosPage() {
  const { user, workspace } = await requireActiveWorkspace();
  const [levels, rol] = workspace
    ? await Promise.all([
        getModuleLevels(user.id, workspace.id),
        resolveWorkspaceRole(user.id, workspace.id),
      ])
    : [{}, null];
  const grupos = agruparPorSeccion(
    instructivosVisibles(INSTRUCTIVOS, levels, isFullAccessRole(rol)),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Instructivos"
        description="Guías paso a paso, con capturas, para las tareas de todos los días. Cada una se puede imprimir o guardar en PDF."
      />

      {grupos.map(({ seccion, guias }) => (
        <section key={seccion} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
            {seccion}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {guias.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/instructivos/${g.slug}`}
                  className="fo-card block h-full p-4 transition-colors hover:border-[var(--fo-accent)]"
                >
                  <p className="text-sm font-medium text-[var(--fo-text)]">{g.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--fo-muted)]">{g.resumen}</p>
                  <p className="mt-2 text-[11px] text-[var(--fo-muted-soft)]">
                    {g.pasos.length} pasos · {g.minutos} min
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
