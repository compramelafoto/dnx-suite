import Link from "next/link";
import { ATAJOS_INFORME, ETIQUETAS_ATAJO_INFORME, type PeriodoInforme } from "@/lib/informes/periodos";

/**
 * Selector de período de Resultados: atajos como enlaces y "Otro rango" como formulario GET con dos
 * meses (`desde` y `hasta`). No calcula nada: la pantalla lee los parámetros.
 */
export function FiltroPeriodo({
  accion,
  periodo,
  extra = {},
}: {
  /** Ruta que recibe el formulario, p. ej. "/informes/resultados". */
  accion: string;
  periodo: PeriodoInforme;
  /** Otros parámetros que se conservan (p. ej. `base`). */
  extra?: Record<string, string>;
}) {
  const enlace = (valor: string) => `${accion}?${new URLSearchParams({ ...extra, periodo: valor }).toString()}`;
  return (
    <div className="fo-card space-y-4 !p-4">
      <div className="flex flex-wrap gap-2">
        {ATAJOS_INFORME.map((a) => {
          const activo = periodo.valor === a;
          return (
            <Link key={a} href={enlace(a)} className={`fo-btn min-h-9 text-sm ${activo ? "fo-btn-primary" : "fo-btn-ghost"}`} aria-current={activo ? "true" : undefined}>
              {ETIQUETAS_ATAJO_INFORME[a]}
            </Link>
          );
        })}
      </div>
      <form method="GET" action={accion} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="inf-desde">Desde (mes)</label>
          <input id="inf-desde" name="desde" type="month" className="fo-input" defaultValue={periodo.desde} required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="inf-hasta">Hasta (mes)</label>
          <input id="inf-hasta" name="hasta" type="month" className="fo-input" defaultValue={periodo.hasta} required />
        </div>
        <div className="flex items-end">
          <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">Ver este rango</button>
        </div>
      </form>
      <p className="text-xs text-[var(--fo-muted-soft)]">Mostrando {periodo.etiqueta}. Se pueden elegir hasta 24 meses.</p>
    </div>
  );
}
