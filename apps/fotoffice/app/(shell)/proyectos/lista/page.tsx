import { ArmazonProyectos } from "@/components/proyectos/armazon";
import { Listado } from "@/components/listado/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { listadoProyectos } from "@/lib/proyectos/listado";
import { prepararProyectos, requireProyectos } from "@/lib/proyectos/pagina";

export const dynamic = "force-dynamic";

/**
 * Lista de Proyectos (motor de listas 0.2): número, nombre, contacto, flujo, etapa, fecha final,
 * atraso, responsable y estado. Filtros por flujo, etapa, responsable, estado y vencidos; en lote:
 * asignar responsable, suspender y reanudar (con "Gestionar").
 */
export default async function ProyectosListaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireProyectos("ver");
  await prepararProyectos(workspace.id);
  const ctx = await contextoListadoDePagina(user, workspace, PROJECTS_MODULE_KEY);
  return (
    <ArmazonProyectos activa="lista">
      <Listado def={listadoProyectos} ctx={ctx} ruta="/proyectos/lista" searchParams={searchParams} />
    </ArmazonProyectos>
  );
}
