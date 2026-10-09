import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { EditorPropuestaModelo } from "@/components/presupuestos/editor-propuesta-modelo";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { categoriasConBorradorAuto } from "@/lib/presupuestos/borrador-automatico";
import { catalogoParaEditor } from "@/lib/presupuestos/editor-datos";
import { leerPropuestaModelo, plantillasParaPropuesta } from "@/lib/presupuestos/propuestas-modelo";
import { PestanasPresupuestos } from "../../pestanas";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Editor de la propuesta modelo de una categoría: productos del catálogo a precio de lista (con el
 * mismo buscador que el editor de presupuestos), conceptos calculados con ¿Cuánto Cobro?, condiciones, plantilla de correo y el interruptor
 * "Enviar sola al llegar una consulta web". Permiso: `configurar`, antes de cualquier lectura. La
 * categoría se busca dentro del workspace de la sesión.
 */
export default async function PropuestaModeloPage({ params }: { params: Promise<{ categoriaId: string }> }) {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
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

  // El perfil sólo se lee acá, dentro del bloque con `configurar`: llega al navegador para mostrar el precio de hoy.
  const [propuesta, catalogo, plantillas, perfil, conBorrador] = await Promise.all([
    leerPropuestaModelo(workspace.id, categoria.id),
    catalogoParaEditor(workspace.id),
    plantillasParaPropuesta(workspace.id),
    leerPerfilPrecios({ workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role }),
    categoriasConBorradorAuto(workspace.id),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`Propuesta modelo · ${categoria.name}`} description="Productos del catálogo a precio de lista y conceptos calculados con ¿Cuánto Cobro?, condiciones y cómo se envía." />
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
        borradorAuto={conBorrador?.has(categoria.id) ?? false}
        sqlPendiente={conBorrador === null}
        plantillaId={propuesta?.plantillaId ?? null}
        catalogo={catalogo}
        plantillas={plantillas}
        perfilDelWorkspace={perfil?.perfil ?? null}
      />
    </div>
  );
}
