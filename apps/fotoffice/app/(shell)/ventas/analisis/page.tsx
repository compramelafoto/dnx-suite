import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireSalesAdmin } from "@/lib/sales/access";
import { DIAS_SEMANA, escalon, type Celda, type Fila } from "@/lib/sales/analisis";
import { analisisDeVentas } from "@/lib/sales/analisis-servidor";

export const dynamic = "force-dynamic";

const pesos = (minor: number) => formatMinorArs(minor).replace(/,00$/, "");

/** Escala de un solo tono (azul), de casi nada a mucho; 0 = sin ventas. */
const AZULES = ["transparent", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab"];

const ATAJOS = [
  { clave: "30", nombre: "Últimos 30 días", dias: 30 },
  { clave: "90", nombre: "Últimos 90 días", dias: 90 },
  { clave: "365", nombre: "Último año", dias: 365 },
] as const;

const DIA_MS = 86_400_000;

function hoyEnArgentina(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** "aaaa-mm-dd" de Argentina → el instante en que empieza (o termina) ese día. */
function inicioAr(ymd: string): Date {
  return new Date(`${ymd}T03:00:00.000Z`);
}

function Tile({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="fo-card p-4">
      <p className="fo-helper">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      {nota ? <p className="fo-helper">{nota}</p> : null}
    </div>
  );
}

function Barras({ filas }: { filas: { nombre: string; celda: Celda }[] }) {
  const max = Math.max(1, ...filas.map((f) => f.celda.importeMinor));
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.nombre} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm" title={`${f.nombre}: ${f.celda.cantidad} ventas, ${pesos(f.celda.importeMinor)}`}>
          <span className="text-[var(--fo-muted)]">{f.nombre}</span>
          <span className="h-3 rounded-r-[4px] bg-[#2a78d6]" style={{ width: `${(100 * f.celda.importeMinor) / max}%`, minWidth: f.celda.importeMinor > 0 ? 2 : 0 }} />
          <span className="tabular-nums">
            {pesos(f.celda.importeMinor)} <span className="text-xs text-[var(--fo-muted)]">· {f.celda.cantidad}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function TablaFilas({ titulo, filas, total }: { titulo: string; filas: Fila[]; total: number }) {
  return (
    <section className="fo-card space-y-2 p-4">
      <h2 className="font-semibold">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="fo-helper">Sin ventas en el período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--fo-muted)]">
              <tr>
                <th className="py-1 pr-3 font-semibold">Nombre</th>
                <th className="py-1 pr-3 text-right font-semibold">Unidades</th>
                <th className="py-1 pr-3 text-right font-semibold">Vendido</th>
                <th className="py-1 text-right font-semibold">Del total</th>
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, 25).map((f) => (
                <tr key={f.clave} className="border-t border-[var(--fo-border)]">
                  <td className="py-1 pr-3">{f.nombre}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{f.unidades}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{pesos(f.importeMinor)}</td>
                  <td className="py-1 text-right tabular-nums">{total > 0 ? `${Math.round((100 * f.importeMinor) / total)} %` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Análisis de ventas del negocio: cuánto, cuándo (horas pico y días), qué (productos y
 * categorías) y quién vendió. Mostrador y pedidos juntos, en hora de Argentina.
 */
export default async function AnalisisVentasPage({ searchParams }: { searchParams: Promise<{ dias?: string; desde?: string; hasta?: string }> }) {
  const { workspace } = await requireSalesAdmin();
  const sp = await searchParams;
  const hoy = hoyEnArgentina();
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const atajo = ATAJOS.find((a) => a.clave === sp.dias) ?? (sp.desde || sp.hasta ? null : ATAJOS[0]);
  const hasta = atajo ? hoy : fecha.test(sp.hasta ?? "") ? sp.hasta! : hoy;
  const desde = atajo
    ? new Date(inicioAr(hoy).getTime() - (atajo.dias - 1) * DIA_MS).toISOString().slice(0, 10)
    : fecha.test(sp.desde ?? "") ? sp.desde! : hoy;
  const a = await analisisDeVentas(workspace.id, inicioAr(desde), new Date(inicioAr(hasta).getTime() + DIA_MS - 1));

  const horasConVentas = a.porHora.map((c, h) => (c.cantidad > 0 ? h : -1)).filter((h) => h >= 0);
  const desdeHora = Math.min(8, ...horasConVentas);
  const hastaHora = Math.max(20, ...horasConVentas);
  const horas = Array.from({ length: hastaHora - desdeHora + 1 }, (_, i) => desdeHora + i);
  const maxCelda = Math.max(0, ...a.mapa.flat().map((c) => c.importeMinor));
  const horaPico = a.porHora.reduce((m, c, h) => (c.importeMinor > a.porHora[m]!.importeMinor ? h : m), 0);
  const diaPico = a.porDia.reduce((m, c, d) => (c.importeMinor > a.porDia[m]!.importeMinor ? d : m), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Análisis de ventas" description="Mostrador y pedidos juntos, en hora de Argentina: cuándo se vende, qué y quién." />

      <div className="fo-card flex flex-wrap items-end gap-3 p-4">
        {ATAJOS.map((x) => (
          <a key={x.clave} href={`/ventas/analisis?dias=${x.clave}`} className={`fo-btn min-h-9 text-sm ${atajo?.clave === x.clave ? "fo-btn-primary" : "fo-btn-ghost"}`}>
            {x.nombre}
          </a>
        ))}
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="fo-field-stack">
            <span className="fo-label">Desde</span>
            <input type="date" name="desde" defaultValue={desde} className="fo-input" required />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Hasta</span>
            <input type="date" name="hasta" defaultValue={hasta} className="fo-input" required />
          </label>
          <button type="submit" className="fo-btn fo-btn-secondary min-h-9 text-sm">
            Ver
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile titulo="Vendido" valor={pesos(a.totalMinor)} nota={`${desde.split("-").reverse().join("/")} al ${hasta.split("-").reverse().join("/")}`} />
        <Tile titulo="Ventas" valor={String(a.ventas)} />
        <Tile titulo="Ticket promedio" valor={pesos(a.ticketPromedioMinor)} />
        <Tile titulo="Momento pico" valor={a.ventas ? `${DIAS_SEMANA[diaPico]} · ${horaPico} h` : "—"} nota="El día y la hora que más venden" />
      </div>

      <section className="fo-card space-y-3 p-4">
        <div>
          <h2 className="font-semibold">Horas pico</h2>
          <p className="fo-helper">Cuánto se vende cada día de la semana en cada hora. Más oscuro, más vendido. Pasá el mouse por un cuadro para ver el detalle.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-xs">
            <thead>
              <tr>
                <th />
                {horas.map((h) => (
                  <th key={h} className="px-0.5 font-normal tabular-nums text-[var(--fo-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS_SEMANA.map((dia, d) => (
                <tr key={dia}>
                  <th className="pr-2 text-left font-normal text-[var(--fo-muted)]">{dia.slice(0, 3)}</th>
                  {horas.map((h) => {
                    const c = a.mapa[d]![h]!;
                    return (
                      <td
                        key={h}
                        title={`${dia} ${h} h: ${c.cantidad} ${c.cantidad === 1 ? "venta" : "ventas"}, ${pesos(c.importeMinor)}`}
                        className="h-7 w-7 min-w-7 rounded-[4px] border border-[var(--fo-border)]"
                        style={{ background: AZULES[escalon(c.importeMinor, maxCelda)] }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--fo-muted)]">
          Menos
          {AZULES.slice(1).map((c) => (
            <span key={c} className="inline-block size-4 rounded-[4px]" style={{ background: c }} />
          ))}
          Más
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="fo-card space-y-3 p-4">
          <h2 className="font-semibold">Por día de la semana</h2>
          <Barras filas={DIAS_SEMANA.map((nombre, d) => ({ nombre, celda: a.porDia[d]! }))} />
        </section>
        <section className="fo-card space-y-3 p-4">
          <h2 className="font-semibold">Mejores fechas</h2>
          {a.mejoresFechas.length === 0 ? (
            <p className="fo-helper">Sin ventas en el período.</p>
          ) : (
            <Barras filas={a.mejoresFechas.map((f) => ({ nombre: f.fecha.split("-").reverse().join("/"), celda: { cantidad: f.cantidad, importeMinor: f.importeMinor } }))} />
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TablaFilas titulo="Productos más vendidos" filas={a.productos} total={a.totalMinor} />
        <TablaFilas titulo="Por categoría" filas={a.categorias} total={a.totalMinor} />
      </div>

      <section className="fo-card space-y-2 p-4">
        <h2 className="font-semibold">Quién vendió</h2>
        {a.vendedores.length === 0 ? (
          <p className="fo-helper">Sin ventas en el período.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--fo-muted)]">
              <tr>
                <th className="py-1 pr-3 font-semibold">Persona</th>
                <th className="py-1 pr-3 text-right font-semibold">Ventas</th>
                <th className="py-1 pr-3 text-right font-semibold">Vendido</th>
                <th className="py-1 text-right font-semibold">Ticket promedio</th>
              </tr>
            </thead>
            <tbody>
              {a.vendedores.map((v) => (
                <tr key={String(v.vendedorId)} className="border-t border-[var(--fo-border)]">
                  <td className="py-1 pr-3">{v.vendedorId !== null ? (a.nombres[v.vendedorId] ?? `Usuario ${v.vendedorId}`) : "Sin dato"}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{v.ventas}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{pesos(v.importeMinor)}</td>
                  <td className="py-1 text-right tabular-nums">{pesos(Math.round(v.importeMinor / Math.max(1, v.ventas)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
