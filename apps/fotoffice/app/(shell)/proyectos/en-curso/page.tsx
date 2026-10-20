import { prisma } from "@repo/db";
import { ArmazonProyectos } from "@/components/proyectos/armazon";
import { TableroEnCurso } from "@/components/proyectos/en-curso/tablero-en-curso";
import { puedeEnContexto } from "@/lib/access/policy";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { cargarTrabajosEnCurso } from "@/lib/proyectos/en-curso";
import { prepararProyectos, requireProyectos } from "@/lib/proyectos/pagina";

export const dynamic = "force-dynamic";

/**
 * Trabajos en curso: todos los recorridos juntos, en cinco columnas (Recibido, En proceso, En el
 * proveedor, Listo para retirar, Entregado), con lo necesario para operar sin abrir cada ficha.
 */
export default async function TrabajosEnCursoPage() {
  const { workspace, ctx } = await requireProyectos("ver");
  await prepararProyectos(workspace.id);
  const ahora = new Date();
  const [tarjetas, branding] = await Promise.all([
    cargarTrabajosEnCurso(ctx, ahora),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { commercialName: true } }),
  ]);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);

  return (
    <ArmazonProyectos activa="en-curso">
      <TableroEnCurso
        tarjetas={tarjetas}
        hoy={hoy}
        estudio={branding?.commercialName?.trim() || workspace.name}
        puedeOperar={puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY)}
      />
    </ArmazonProyectos>
  );
}
