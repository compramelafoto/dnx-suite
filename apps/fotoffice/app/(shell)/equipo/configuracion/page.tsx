import { PageHeader } from "@/components/page-header";
import { requireEquipo } from "@/lib/equipo/acceso";
import { leerTolerancia } from "@/lib/equipo/repositorio";
import { guardarAjustesAction } from "../actions";

export const dynamic = "force-dynamic";

/** Configuración de Equipo: la tolerancia para llegar tarde, irse antes o quedarse de más. */
export default async function ConfiguracionEquipoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const ctx = await requireEquipo();
  const sp = await searchParams;
  const tolerancia = await leerTolerancia(ctx.workspaceId);
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configuración de Equipo" description="Cuánto margen se da antes de marcar una llegada tarde, una salida temprana o tiempo de más." />
      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      <form action={guardarAjustesAction} className="fo-card flex flex-wrap items-end gap-3 p-5">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="toleranciaMinutos">
            Tolerancia (minutos)
          </label>
          <input
            id="toleranciaMinutos"
            name="toleranciaMinutos"
            type="number"
            min={0}
            max={60}
            step={1}
            defaultValue={tolerancia}
            className="fo-input w-32"
          />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Guardar
        </button>
      </form>
    </div>
  );
}
