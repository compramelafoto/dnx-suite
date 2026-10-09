import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { Semaforo } from "@/components/informes/semaforo";
import { puedeConfigurarInformes, requireInformes } from "@/lib/informes/acceso";
import { cargarMonotributo } from "@/lib/informes/monotributo-datos";
import { etiquetaMes } from "@/lib/informes/periodos";
import { formatMinorArs } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

const COLOR_BARRA = {
  SIN_CONFIGURAR: "bg-[var(--fo-accent)]",
  VERDE: "bg-[var(--fo-success)]",
  AMARILLO: "bg-[var(--fo-warning)]",
  ROJO: "bg-[var(--fo-danger)]",
} as const;

/** Control de monotributo: lo cobrado en los últimos 12 meses contra el tope cargado a mano. */
export default async function MonotributoPage() {
  const { ctx } = await requireInformes();
  const m = await cargarMonotributo(ctx);
  if (!m) return null;
  const r = m.resultado;
  const maximo = r ? Math.max(1, ...r.meses.map((x) => Math.max(0, x.centavos))) : 1;
  const sinCobros = r !== null && r.total === 0 && r.meses.every((x) => x.centavos === 0);
  const ancho = r && r.porcentaje !== null ? Math.min(100, Math.floor(r.porcentaje)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monotributo"
        description="Lo cobrado en Caja en los últimos 12 meses, contra el tope de tu categoría."
        actions={
          r ? (
            <a href="/api/informes/monotributo/csv" className="fo-btn fo-btn-secondary text-sm" download>
              Descargar CSV
            </a>
          ) : null
        }
      />
      <AvisosInforme avisos={m.avisos} />
      <p className="fo-card text-sm text-[var(--fo-muted)]">{m.leyenda}</p>

      {r && r.estado === "SIN_CONFIGURAR" ? (
        <div className="fo-card space-y-2 text-sm">
          <p className="font-semibold">Todavía no cargaste el tope anual.</p>
          <p className="text-[var(--fo-muted)]">
            Con el tope de tu categoría te mostramos el porcentaje usado y un semáforo.{" "}
            {puedeConfigurarInformes(ctx) ? (
              <Link href="/informes/ajustes" className="text-[var(--fo-accent)] hover:underline">Cargar el tope en Ajustes</Link>
            ) : (
              "Pedile al dueño o a un administrador que lo cargue en Informes → Ajustes."
            )}
          </p>
        </div>
      ) : null}

      {r && sinCobros ? <SinDatos>Todavía no hay ingresos de Caja en los últimos 12 meses.</SinDatos> : null}

      {r ? (
        <>
          <section aria-labelledby="mono-total" className="fo-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="mono-total" className="text-base font-semibold">Cobrado en 12 meses</h2>
              <Semaforo estado={r.estado} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">Cobrado</p><p className="text-lg font-semibold">{formatMinorArs(r.total)}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">Tope anual{m.categoria ? ` (categoría ${m.categoria})` : ""}</p><p className="text-lg font-semibold">{m.tope !== null ? formatMinorArs(m.tope) : "Sin cargar"}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">Porcentaje usado</p><p className="text-lg font-semibold">{r.porcentaje !== null ? `${String(r.porcentaje).replace(".", ",")} %` : "–"}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">Falta para el tope</p><p className="text-lg font-semibold">{r.falta !== null ? formatMinorArs(r.falta) : "–"}</p></div>
            </div>
            {r.porcentaje !== null ? (
              <div
                role="progressbar"
                aria-label="Porcentaje del tope usado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ancho}
                className="h-3 w-full overflow-hidden rounded-full bg-[var(--fo-surface-muted)]"
              >
                <div className={`h-full ${COLOR_BARRA[r.estado]}`} style={{ width: `${ancho}%` }} />
              </div>
            ) : null}
            {r.porcentaje !== null ? <p className="text-xs text-[var(--fo-muted)]">El aviso amarillo empieza en el {m.avisoPct} % del tope.</p> : null}
          </section>

          <section aria-labelledby="mono-meses" className="fo-card space-y-3">
            <h2 id="mono-meses" className="text-base font-semibold">Mes a mes</h2>
            <ul className="space-y-2">
              {r.meses.map((x) => (
                <li key={x.mes} className="grid grid-cols-[4.5rem_1fr_7.5rem] items-center gap-3 text-sm">
                  <span className="text-[var(--fo-muted)]">{etiquetaMes(x.mes)}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--fo-surface-muted)]">
                    <div className="h-full bg-[var(--fo-accent)]" style={{ width: `${Math.max(0, Math.round((x.centavos / maximo) * 100))}%` }} />
                  </div>
                  <span className={`text-right tabular-nums ${x.centavos < 0 ? "text-[var(--fo-danger)]" : ""}`}>{formatMinorArs(x.centavos)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
