import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { FiltroPeriodo } from "@/components/informes/filtro-periodo";
import { MatrizResultadosTabla } from "@/components/informes/matriz-resultados";
import { requireInformes } from "@/lib/informes/acceso";
import { cargarResultados, ETIQUETAS_BASE, type BaseResultados } from "@/lib/informes/resultados-datos";
import { primero, valorDePeriodo } from "@/lib/informes/url";

export const dynamic = "force-dynamic";

const BASES: BaseResultados[] = ["caja", "devengado"];

/**
 * Resultados por rubro y mes, con dos vistas: lo cobrado y pagado (Caja) o lo vendido y comprometido
 * (pedidos y cuentas a pagar). Cada importe abre el desglose de su celda.
 */
export default async function ResultadosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const r = await cargarResultados(ctx, { periodo: valorDePeriodo(sp), base: primero(sp.base) });
  if (!r) return null;
  const csv = `/api/informes/resultados/csv?${new URLSearchParams({ base: r.base, periodo: r.periodo.valor }).toString()}`;
  const vacia = r.matriz !== null && r.cantidadAsientos === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados"
        description="Ingresos, costos y gastos por rubro y por mes."
        actions={
          r.matriz ? (
            <a href={csv} className="fo-btn fo-btn-secondary text-sm" download>
              Descargar CSV
            </a>
          ) : null
        }
      />

      <nav aria-label="Vista" className="flex flex-wrap gap-2">
        {BASES.map((b) => (
          <Link
            key={b}
            href={`/informes/resultados?${new URLSearchParams({ base: b, periodo: r.periodo.valor }).toString()}`}
            className={`fo-btn min-h-9 text-sm ${r.base === b ? "fo-btn-primary" : "fo-btn-ghost"}`}
            aria-current={r.base === b ? "true" : undefined}
          >
            {ETIQUETAS_BASE[b]}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-[var(--fo-muted)]">
        {r.base === "caja"
          ? "Lo que entró y salió de Caja en cada mes, sin los pases entre cuentas. Una anulación resta en el rubro del movimiento original."
          : "Lo vendido en los pedidos (por la fecha del evento) y lo comprometido en cuentas a pagar (por su vencimiento), más los movimientos de Caja que no vienen de pedidos."}
      </p>

      <FiltroPeriodo accion="/informes/resultados" periodo={r.periodo} extra={{ base: r.base }} />
      <AvisosInforme avisos={r.avisos} />

      {r.matriz && vacia ? (
        <SinDatos>
          {r.base === "caja"
            ? "Todavía no hay movimientos de Caja en este período."
            : "Todavía no hay pedidos, cuentas a pagar ni movimientos de Caja en este período."}
        </SinDatos>
      ) : null}

      {r.matriz && !vacia ? (
        <>
          {r.matriz.haySinClasificar ? (
            <div role="status" className="rounded-[var(--fo-radius)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-4 text-sm text-[var(--fo-text)]">
              Hay importes en <strong>Sin clasificar</strong>: son movimientos sin rubro o con un rubro cuyo código no empieza con 3, 4 o 5.
              Asignales un rubro en <Link href="/caja/configuracion" className="text-[var(--fo-accent)] underline">Caja → Configuración (rubros)</Link>. Si querés separar los
              gastos fijos, creá un grupo con código 5 (por ejemplo 5.1 Alquiler); no se crea solo.
            </div>
          ) : null}
          <MatrizResultadosTabla matriz={r.matriz} base={r.base} periodo={r.periodo.valor} />
        </>
      ) : null}
    </div>
  );
}
