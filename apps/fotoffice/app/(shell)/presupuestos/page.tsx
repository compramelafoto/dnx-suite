import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { puedeGestionarPresupuestos, QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { listadoPresupuestos } from "@/lib/presupuestos/listado";
import { requirePresupuestos } from "@/lib/presupuestos/pagina";

export const dynamic = "force-dynamic";

/**
 * Lista de Presupuestos (motor de listas 0.2): número, contacto, consulta, estado, total, vence y
 * responsable; filtros por estado y vencidos; lote "Marcar vencidos" (con "Gestionar"). Nunca
 * muestra costos.
 */
export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requirePresupuestos("ver");
  const ctxListado = await contextoListadoDePagina(user, workspace, QUOTES_MODULE_KEY);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Los presupuestos de las consultas, con su estado y vencimiento."
        actions={
          puedeGestionarPresupuestos(ctx) ? (
            <Link href="/presupuestos/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo presupuesto
            </Link>
          ) : null
        }
      />
      <Listado def={listadoPresupuestos} ctx={ctxListado} ruta="/presupuestos" searchParams={searchParams} />
    </div>
  );
}
