import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { TablaDetalleVentas } from "@/components/informes/tabla-detalle-ventas";
import { requireInformes } from "@/lib/informes/acceso";
import { ETIQUETAS_AGRUPAMIENTO } from "@/lib/informes/ventas";
import { cargarDetalleVentas } from "@/lib/informes/ventas-datos";

export const dynamic = "force-dynamic";

/** Desglose de una celda de Ventas: los pedidos que la forman. */
export default async function DetalleVentasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const d = await cargarDetalleVentas(ctx, sp);
  if (!d) notFound();
  const csv = `/api/informes/ventas-detalle/csv?${new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  ).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.titulo}
        description={`Detalle de Ventas por ${ETIQUETAS_AGRUPAMIENTO[d.filtro.agrupar].toLowerCase()}`}
        actions={
          <>
            <Link href={d.volver} className="fo-btn fo-btn-secondary text-sm">
              Volver a Ventas
            </Link>
            {d.cantidad > 0 ? (
              <a href={csv} className="fo-btn fo-btn-secondary text-sm" download>
                Descargar CSV
              </a>
            ) : null}
          </>
        }
      />
      <AvisosInforme avisos={d.avisos} />
      {d.nota && d.cantidad > 0 ? <p className="text-sm text-[var(--fo-muted)]">{d.nota}</p> : null}
      {d.avisos.length === 0 && d.cantidad === 0 ? (
        <SinDatos>No hay pedidos en esta celda.</SinDatos>
      ) : d.cantidad > 0 ? (
        <TablaDetalleVentas filas={d.filas} total={d.total} cantidad={d.cantidad} truncado={d.truncado} />
      ) : null}
    </div>
  );
}
