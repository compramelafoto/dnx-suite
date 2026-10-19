import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevels } from "@/lib/permissions/module-access";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { INSTRUCTIVOS } from "@/lib/instructivos/catalogo";
import { agruparPorSeccion, instructivosVisibles } from "@/lib/instructivos/visibles";
import { IndiceInstructivos } from "./indice-instructivos";

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
        description="Guías paso a paso, con capturas, para las tareas de todos los días: qué tocar y qué hace el sistema solo. Cada una se puede imprimir o guardar en PDF."
      />

      <IndiceInstructivos
        grupos={grupos.map(({ seccion, guias }) => ({
          seccion,
          guias: guias.map((g) => ({
            slug: g.slug,
            titulo: g.titulo,
            resumen: g.resumen,
            pasos: g.pasos.length,
            minutos: g.minutos,
            textoBuscable: g.pasos.map((p) => p.titulo).join(" "),
          })),
        }))}
      />
    </div>
  );
}
