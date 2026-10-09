import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { requireInformes } from "@/lib/informes/acceso";
import { fechaLarga } from "@/lib/informes/detalle";
import { sumarDias } from "@/lib/informes/fechas";
import { AGRUPACIONES_FLUJO, cargarFlujo, ETIQUETAS_HORIZONTE, HORIZONTES_FLUJO } from "@/lib/informes/flujo-datos";
import { primero } from "@/lib/informes/url";
import { formatMinorArs } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

const ETIQUETAS_AGRUPACION = { dia: "Por día", semana: "Por semana", mes: "Por mes" } as const;

function Importe({ valor, href, negritaNegativa = true }: { valor: number; href?: string; negritaNegativa?: boolean }) {
  const clase = valor < 0 && negritaNegativa ? "text-[var(--fo-danger)]" : "";
  if (valor === 0) return <span className="text-[var(--fo-muted-soft)]">–</span>;
  return href ? (
    <Link href={href} className={`hover:underline ${clase}`}>
      {formatMinorArs(valor)}
    </Link>
  ) : (
    <span className={clase}>{formatMinorArs(valor)}</span>
  );
}

/**
 * Flujo de caja proyectado: el saldo de hoy más lo que se cobra y se paga, por día, semana o mes. La
 * fila que queda por debajo del saldo mínimo (Ajustes) se pinta en rojo.
 */
export default async function FlujoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireInformes();
  const sp = await searchParams;
  const f = await cargarFlujo(ctx, { agrupar: primero(sp.agrupar), horizonte: primero(sp.horizonte) });
  if (!f) return null;
  const csv = `/api/informes/flujo/csv?${new URLSearchParams({ agrupar: f.agrupar, horizonte: f.horizonte }).toString()}`;
  const enlace = (tipo: "cobrar" | "pagar", desde: string | null, hasta: string) => {
    const p = new URLSearchParams({ tipo, hasta });
    if (desde) p.set("desde", desde);
    return `/informes/flujo/detalle?${p.toString()}`;
  };
  const flujo = f.flujo;
  const sinNada =
    flujo !== null &&
    flujo.hoy.saldoCaja === 0 &&
    flujo.hoy.vencidoCobrar === 0 &&
    flujo.hoy.vencidoPagar === 0 &&
    flujo.sinFecha.cantidad === 0 &&
    flujo.filas.every((x) => x.porCobrar === 0 && x.porPagar === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flujo de caja"
        description={`Cuánto dinero va a haber en Caja hasta el ${fechaLarga(f.hasta)}, según lo que se cobra y se paga.`}
        actions={
          flujo ? (
            <a href={csv} className="fo-btn fo-btn-secondary text-sm" download>
              Descargar CSV
            </a>
          ) : null
        }
      />

      <form method="GET" className="fo-card grid gap-4 !p-4 sm:grid-cols-3">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="flujo-agrupar">Agrupar</label>
          <select id="flujo-agrupar" name="agrupar" className="fo-input" defaultValue={f.agrupar}>
            {AGRUPACIONES_FLUJO.map((a) => (
              <option key={a} value={a}>{ETIQUETAS_AGRUPACION[a]}</option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="flujo-horizonte">Hasta dentro de</label>
          <select id="flujo-horizonte" name="horizonte" className="fo-input" defaultValue={f.horizonte}>
            {HORIZONTES_FLUJO.map((h) => (
              <option key={h} value={h}>{ETIQUETAS_HORIZONTE[h]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">Ver</button>
        </div>
      </form>

      <AvisosInforme avisos={f.avisos} />
      {f.saldoMinimo !== null ? (
        <p className="text-sm text-[var(--fo-muted)]">Saldo mínimo de alerta: {formatMinorArs(f.saldoMinimo)}. Las filas por debajo se marcan en rojo.</p>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">
          No hay un saldo mínimo cargado. Si querés que te marquemos cuándo el dinero baja de un monto, cargalo en{" "}
          <Link href="/informes/ajustes" className="text-[var(--fo-accent)] hover:underline">Ajustes</Link>.
        </p>
      )}

      {flujo && sinNada ? <SinDatos>Todavía no hay saldo en Caja, cuotas por cobrar ni cuentas a pagar para proyectar.</SinDatos> : null}

      {flujo && !sinNada ? (
        <>
          <section aria-labelledby="flujo-hoy" className="fo-card space-y-3">
            <h2 id="flujo-hoy" className="text-base font-semibold">Punto de partida: hoy</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">Saldo de Caja</p><p className="text-lg font-semibold">{formatMinorArs(flujo.hoy.saldoCaja)}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">+ Por cobrar vencido</p><p className="text-lg font-semibold">{formatMinorArs(flujo.hoy.vencidoCobrar)}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">− Por pagar vencido</p><p className="text-lg font-semibold">{formatMinorArs(flujo.hoy.vencidoPagar)}</p></div>
              <div className="rounded-lg border border-[var(--fo-border)] p-3"><p className="text-xs text-[var(--fo-muted)]">= Disponible proyectado</p><p className={`text-lg font-semibold ${flujo.hoy.bajoMinimo ? "text-[var(--fo-danger)]" : ""}`}>{formatMinorArs(flujo.hoy.acumulado)}</p></div>
            </div>
          </section>

          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Período</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Por cobrar</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Por pagar</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Neto</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                <tr className={flujo.hoy.bajoMinimo ? "bg-[var(--fo-danger-soft)]" : "bg-[var(--fo-surface-muted)]"}>
                  <th scope="row" className="px-3 py-2 text-left font-semibold">Hoy ({fechaLarga(f.hoy)})</th>
                  <td className="px-3 py-2 text-right tabular-nums"><Importe valor={flujo.hoy.vencidoCobrar} href={enlace("cobrar", null, sumarDias(f.hoy, -1))} /></td>
                  <td className="px-3 py-2 text-right tabular-nums"><Importe valor={flujo.hoy.vencidoPagar} href={enlace("pagar", null, sumarDias(f.hoy, -1))} /></td>
                  <td className="px-3 py-2 text-right tabular-nums"><Importe valor={flujo.hoy.vencidoCobrar - flujo.hoy.vencidoPagar} /></td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${flujo.hoy.acumulado < 0 || flujo.hoy.bajoMinimo ? "text-[var(--fo-danger)]" : ""}`}>
                    {formatMinorArs(flujo.hoy.acumulado)}
                    <span className="block text-xs font-normal text-[var(--fo-muted)]">con {formatMinorArs(flujo.hoy.saldoCaja)} en Caja y lo vencido</span>
                  </td>
                </tr>
                {flujo.filas.map((x) => (
                  <tr key={x.desde} className={x.bajoMinimo ? "bg-[var(--fo-danger-soft)]" : ""}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {x.etiqueta}
                      {f.agrupar !== "dia" ? <span className="block text-xs font-normal text-[var(--fo-muted)]">{fechaLarga(x.desde)} a {fechaLarga(x.hasta)}</span> : null}
                      {x.bajoMinimo ? <span className="block text-xs font-semibold text-[var(--fo-danger)]">Por debajo del mínimo</span> : null}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums"><Importe valor={x.porCobrar} href={enlace("cobrar", x.desde, x.hasta)} /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><Importe valor={x.porPagar} href={enlace("pagar", x.desde, x.hasta)} /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><Importe valor={x.neto} /></td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${x.acumulado < 0 || x.bajoMinimo ? "text-[var(--fo-danger)]" : ""}`}>{formatMinorArs(x.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)]">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Sin fecha
                    <span className="block text-xs font-normal text-[var(--fo-muted)]">
                      {flujo.sinFecha.cantidad === 0 ? "No hay cuentas a pagar sin vencimiento." : `${flujo.sinFecha.cantidad} cuenta${flujo.sinFecha.cantidad === 1 ? "" : "s"} sin vencimiento; no suman al saldo acumulado.`}
                    </span>
                  </th>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums"><Importe valor={flujo.sinFecha.porPagar} href="/informes/flujo/detalle?tipo=sinfecha" /></td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
