import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { FiltroPeriodo } from "@/components/informes/filtro-periodo";
import { TablaEmbudoConsultas } from "@/components/informes/tabla-embudo";
import { requireInformes } from "@/lib/informes/acceso";
import { AGRUPAMIENTOS_EMBUDO, ETIQUETAS_AGRUPAMIENTO_EMBUDO } from "@/lib/informes/embudo";
import { cargarEmbudo } from "@/lib/informes/embudo-datos";
import { primero, valorDePeriodo } from "@/lib/informes/url";

export const dynamic = "force-dynamic";

/**
 * Embudo de consultas: las que entraron en el período (por su fecha de alta), agrupadas por categoría u
 * origen, con cuántas se ganaron, se perdieron o siguen abiertas, la conversión y lo vendido.
 */
export default async function EmbudoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const r = await cargarEmbudo(ctx, { periodo: valorDePeriodo(sp), agrupar: primero(sp.agrupar) });
  if (!r) return null;
  const csv = `/api/informes/embudo/csv?${new URLSearchParams({ agrupar: r.agrupar, periodo: r.periodo.valor }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Embudo de consultas"
        description="Las consultas que entraron en el período y cómo terminaron. Ganada y perdida son las de la lista de Consultas; lo vendido son los pedidos no cancelados de esas consultas."
        actions={
          r.tabla && r.tabla.total.entraron > 0 ? (
            <a href={csv} className="fo-btn fo-btn-secondary text-sm" download>
              Descargar CSV
            </a>
          ) : null
        }
      />

      <nav aria-label="Agrupar por" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--fo-muted)]">Agrupar por</span>
        {AGRUPAMIENTOS_EMBUDO.map((a) => (
          <Link
            key={a}
            href={`/informes/embudo?${new URLSearchParams({ agrupar: a, periodo: r.periodo.valor }).toString()}`}
            className={`fo-btn min-h-9 text-sm ${r.agrupar === a ? "fo-btn-primary" : "fo-btn-ghost"}`}
            aria-current={r.agrupar === a ? "true" : undefined}
          >
            {ETIQUETAS_AGRUPAMIENTO_EMBUDO[a]}
          </Link>
        ))}
      </nav>

      <FiltroPeriodo accion="/informes/embudo" periodo={r.periodo} extra={{ agrupar: r.agrupar }} />
      <AvisosInforme avisos={r.avisos} />

      {r.tabla && r.tabla.total.entraron === 0 ? <SinDatos>No entró ninguna consulta en este período.</SinDatos> : null}
      {r.tabla && r.tabla.total.entraron > 0 ? <TablaEmbudoConsultas tabla={r.tabla} desde={r.periodo.desde} hasta={r.periodo.hasta} /> : null}
    </div>
  );
}
