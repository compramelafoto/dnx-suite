import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { EditorPropuestaModelo } from "@/components/presupuestos/editor-propuesta-modelo";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { catalogoParaEditor } from "@/lib/presupuestos/editor-datos";
import { leerPropuestaModelo, plantillasParaPropuesta } from "@/lib/presupuestos/propuestas-modelo";
import { PestanasPresupuestos } from "../../pestanas";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Editor de la propuesta modelo de una categoría: productos del catálogo a precio de lista (con el
 * mismo buscador que el editor de presupuestos), condiciones, plantilla de correo y el interruptor
 * "Enviar sola al llegar una consulta web". Permiso: `configurar`, antes de cualquier lectura. La
 * categoría se busca dentro del workspace de la sesión.
 */
export default async function PropuestaModeloPage({ params }: { params: Promise<{ categoriaId: string }> }) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Presupuestos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los presupuestos.</p>
      </div>
    );
  }
  const { categoriaId } = await params;
  if (!ID_VALIDO.test(categoriaId)) notFound();
  const categoria = await prisma.fotofficeConsultaCategoria.findFirst({
    where: { id: categoriaId, workspaceId: workspace.id, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!categoria) notFound();

  const [propuesta, catalogo, plantillas] = await Promise.all([
    leerPropuestaModelo(workspace.id, categoria.id),
    catalogoParaEditor(workspace.id),
    plantillasParaPropuesta(workspace.id),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`Propuesta modelo · ${categoria.name}`} description="Productos del catálogo a precio de lista, condiciones y cómo se envía." />
      <PestanasPresupuestos activa="propuestas" />
      <p className="text-sm">
        <Link href="/workspace/configuracion/presupuestos/propuestas" className="text-[var(--fo-accent)] hover:underline">
          ← Todas las categorías
        </Link>
      </p>
      <EditorPropuestaModelo
        key={propuesta?.actualizadaEn.getTime() ?? "nueva"}
        categoriaId={categoria.id}
        existe={propuesta !== null}
        items={propuesta?.items ?? []}
        condiciones={propuesta?.condiciones ?? null}
        enviarSola={propuesta?.enviarSola ?? false}
        plantillaId={propuesta?.plantillaId ?? null}
        catalogo={catalogo}
        plantillas={plantillas}
      />
    </div>
  );
}
