import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { TablaDetalle } from "@/components/informes/tabla-detalle";
import { requireInformes } from "@/lib/informes/acceso";
import { cargarDetalleFlujo } from "@/lib/informes/detalle-datos";

export const dynamic = "force-dynamic";

/** Desglose de una fila del flujo: las cuotas por cobrar o las cuentas a pagar que la forman. */
export default async function DetalleFlujoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const d = await cargarDetalleFlujo(ctx, sp);
  if (!d) notFound();
  const csv = `/api/informes/flujo-detalle/csv?${new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  ).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.titulo}
        description={d.filtro.tipo === "cobrar" ? "Saldo de las cuotas de pedidos confirmados." : "Cuentas a pagar sin pago vigente."}
        actions={
          <>
            <Link href="/informes/flujo" className="fo-btn fo-btn-secondary text-sm">
              Volver al flujo de caja
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
        <SinDatos>No hay renglones para mostrar.</SinDatos>
      ) : d.cantidad > 0 ? (
        <TablaDetalle filas={d.filas} total={d.total} cantidad={d.cantidad} truncado={d.truncado} />
      ) : null}
    </div>
  );
}
