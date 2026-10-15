import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { TablaDetalle } from "@/components/informes/tabla-detalle";
import { requireInformes } from "@/lib/informes/acceso";
import { cargarDetalleResultados } from "@/lib/informes/detalle-datos";
import { ETIQUETAS_BASE } from "@/lib/informes/resultados-datos";

export const dynamic = "force-dynamic";

/** Desglose de una celda de Resultados: los movimientos, pedidos o cuentas a pagar que la forman. */
export default async function DetalleResultadosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const d = await cargarDetalleResultados(ctx, sp);
  if (!d) notFound();
  const csv = `/api/informes/resultados-detalle/csv?${new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  ).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.titulo}
        description={`Detalle de Resultados · ${ETIQUETAS_BASE[d.base]}`}
        actions={
          <>
            <Link href={d.volver} className="fo-btn fo-btn-secondary text-sm">
              Volver a Resultados
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
      {d.avisos.length === 0 && d.cantidad === 0 ? (
        <SinDatos>No hay renglones en esta celda.</SinDatos>
      ) : d.cantidad > 0 ? (
        <TablaDetalle filas={d.filas} total={d.total} cantidad={d.cantidad} truncado={d.truncado} />
      ) : null}
    </div>
  );
}
