import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { NuevaGaleria } from "@/components/galerias/nueva-galeria";
import { puedeEnContexto } from "@/lib/access/policy";
import { GALLERY_MODULE_KEY, puedeGestionarGalerias } from "@/lib/galerias/acceso";
import { listadoGalerias } from "@/lib/galerias/listado";
import { requireGalerias } from "@/lib/galerias/requerir";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";

export const dynamic = "force-dynamic";

/**
 * Lista de Galerías (motor de listas 0.2): número, galería, proyecto, cliente, estado, fotos y clientes
 * (con los que esperan revisión resaltados); filtros por estado y por "esperando revisión". Las galerías
 * se crean acá (eligiendo el proyecto) o desde la ficha del proyecto.
 */
export default async function GaleriasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requireGalerias("ver");
  const listado = await contextoListadoDePagina(user, workspace, GALLERY_MODULE_KEY);
  const puedeCrear = puedeGestionarGalerias(ctx) && puedeEnContexto(ctx, "ver", PROJECTS_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader title="Galerías" description="Las fotos de cada proyecto para que los clientes elijan: subirlas, compartir el enlace y revisar lo que eligieron." />
      {puedeCrear ? <NuevaGaleria /> : null}
      <Listado def={listadoGalerias} ctx={listado} ruta="/galerias" searchParams={searchParams} />
    </div>
  );
}
