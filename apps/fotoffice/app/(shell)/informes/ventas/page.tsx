import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { FiltroPeriodo } from "@/components/informes/filtro-periodo";
import { MatrizVentasTabla } from "@/components/informes/matriz-ventas";
import { requireInformes } from "@/lib/informes/acceso";
import { primero, valorDePeriodo } from "@/lib/informes/url";
import { AGRUPAMIENTOS_VENTAS, ETIQUETAS_AGRUPAMIENTO } from "@/lib/informes/ventas";
import { cargarVentas } from "@/lib/informes/ventas-datos";

export const dynamic = "force-dynamic";

/**
 * Ventas por grupo y mes: pedidos no cancelados por su fecha de confirmación, agrupados por producto,
 * cliente, vendedor, categoría u origen. Cada importe abre el desglose de su celda.
 */
export default async function VentasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const r = await cargarVentas(ctx, { periodo: valorDePeriodo(sp), agrupar: primero(sp.agrupar) });
  if (!r) return null;
  const csv = `/api/informes/ventas/csv?${new URLSearchParams({ agrupar: r.agrupar, periodo: r.periodo.valor }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Lo vendido en pedidos, por la fecha en que se confirmaron. Los cancelados no cuentan."
        actions={
          r.matriz ? (
            <a href={csv} className="fo-btn fo-btn-secondary text-sm" download>
              Descargar CSV
            </a>
          ) : null
        }
      />

      <nav aria-label="Agrupar por" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--fo-muted)]">Agrupar por</span>
        {AGRUPAMIENTOS_VENTAS.map((a) => (
          <Link
            key={a}
            href={`/informes/ventas?${new URLSearchParams({ agrupar: a, periodo: r.periodo.valor }).toString()}`}
            className={`fo-btn min-h-9 text-sm ${r.agrupar === a ? "fo-btn-primary" : "fo-btn-ghost"}`}
            aria-current={r.agrupar === a ? "true" : undefined}
          >
            {ETIQUETAS_AGRUPAMIENTO[a]}
          </Link>
        ))}
      </nav>

      <FiltroPeriodo accion="/informes/ventas" periodo={r.periodo} extra={{ agrupar: r.agrupar }} />
      <AvisosInforme avisos={r.avisos} />

      {r.matriz && r.cantidadPedidos === 0 ? <SinDatos>Todavía no hay pedidos confirmados en este período.</SinDatos> : null}
      {r.matriz && r.cantidadPedidos > 0 ? (
        r.matriz.filas.length === 0 ? (
          <SinDatos>Los pedidos de este período no tienen ítems para mostrar por producto.</SinDatos>
        ) : (
          <MatrizVentasTabla matriz={r.matriz} periodo={r.periodo.valor} />
        )
      ) : null}
    </div>
  );
}
