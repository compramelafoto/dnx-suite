import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { cargarInformes } from "@/lib/pedidos/informes-datos";
import { ETIQUETA_TRAMO, TRAMOS, mesAnterior, mesSiguiente, pesosInforme } from "@/lib/pedidos/informes";
import { requirePedidos } from "@/lib/pedidos/pagina";
import { contextoDeInformes } from "@/lib/informes/acceso";

export const dynamic = "force-dynamic";

const SIN_PERMISO = "Sin permiso para ver montos";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function nombreDelMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

function dia(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

function Tarjeta({ titulo, valor, ayuda }: { titulo: string; valor: string; ayuda?: string }) {
  return (
    <div className="rounded-lg border border-[var(--fo-border)] p-3">
      <p className="text-xs text-[var(--fo-muted)]">{titulo}</p>
      <p className="text-lg font-semibold text-[var(--fo-text)]">{valor}</p>
      {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </div>
  );
}

function SinPermiso() {
  return <p className="text-sm text-[var(--fo-muted)]">{SIN_PERMISO}</p>;
}

/**
 * Informes de Pedidos (Entrega B1): a cobrar, cobrado del mes y a pagar. Página de servidor, sin
 * componentes de navegador: los importes no viajan al cliente. Los montos exigen `configurar` o
 * `verDinero`; el resto de las personas con "Ver" ve el aviso "Sin permiso para ver montos".
 */
export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx } = await requirePedidos("ver");
  const sp = await searchParams;
  const datos = await cargarInformes(ctx, sp.mes);
  const { aCobrar, cobrado, aPagar, mes, hoy } = datos;
  const esActual = mes === hoy.slice(0, 7);
  // El enlace a Informes sólo si el módulo está encendido y esta persona puede verlo.
  const verInformes = (await contextoDeInformes()) !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informes"
        description="Lo que hay para cobrar, lo cobrado en el mes y lo que hay para pagar a proveedores."
        actions={
          <>
            {verInformes ? (
              <Link href="/informes/flujo" className="fo-btn fo-btn-secondary text-sm">
                Ver en Informes
              </Link>
            ) : null}
            <Link href="/pedidos" className="fo-btn fo-btn-secondary text-sm">
              Volver a Pedidos
            </Link>
          </>
        }
      />
      {datos.avisos.map((a) => (
        <p key={a} className="fo-card text-sm text-[var(--fo-muted)]">
          {a}
        </p>
      ))}

      <section aria-labelledby="a-cobrar-titulo" className="fo-card space-y-4">
        <div>
          <h2 id="a-cobrar-titulo" className="text-base font-semibold text-[var(--fo-text)]">A cobrar</h2>
          <p className="text-xs text-[var(--fo-muted)]">Saldo de las cuotas de pedidos sin cancelar, al {dia(hoy)}.</p>
        </div>
        {aCobrar ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tarjeta titulo="Vencido" valor={pesosInforme(aCobrar.vencido)} />
              <Tarjeta titulo="Esta semana" valor={pesosInforme(aCobrar.estaSemana)} ayuda={`Vence entre hoy y el domingo ${dia(aCobrar.semana.domingo)}`} />
              <Tarjeta titulo="Total a cobrar" valor={pesosInforme(aCobrar.total)} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-[var(--fo-text)]">Antigüedad de la deuda vencida</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TRAMOS.map((t) => (
                  <Tarjeta key={t} titulo={ETIQUETA_TRAMO[t]} valor={pesosInforme(aCobrar.antiguedad[t])} />
                ))}
              </div>
            </div>
            {aCobrar.clientes.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">No hay saldos para cobrar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-[var(--fo-muted)]">
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 text-right font-medium">Pedidos</th>
                      <th className="py-2 pr-3 text-right font-medium">Vencido</th>
                      <th className="py-2 pr-3 text-right font-medium">0–30</th>
                      <th className="py-2 pr-3 text-right font-medium">31–60</th>
                      <th className="py-2 pr-3 text-right font-medium">Más de 60</th>
                      <th className="py-2 pr-3 text-right font-medium">Esta semana</th>
                      <th className="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aCobrar.clientes.map((c) => (
                      <tr key={c.clienteId} className="border-t border-[var(--fo-border)]">
                        <td className="py-2 pr-3">{c.clienteNombre}</td>
                        <td className="py-2 pr-3 text-right">{c.pedidos}</td>
                        <td className="py-2 pr-3 text-right">{pesosInforme(c.vencido)}</td>
                        <td className="py-2 pr-3 text-right">{pesosInforme(c.porTramo["0-30"])}</td>
                        <td className="py-2 pr-3 text-right">{pesosInforme(c.porTramo["31-60"])}</td>
                        <td className="py-2 pr-3 text-right">{pesosInforme(c.porTramo["60+"])}</td>
                        <td className="py-2 pr-3 text-right">{pesosInforme(c.estaSemana)}</td>
                        <td className="py-2 text-right font-medium">{pesosInforme(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <SinPermisoOAviso permitido={cobrado !== null || aPagar !== null} />
        )}
      </section>

      <section aria-labelledby="cobrado-titulo" className="fo-card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cobrado-titulo" className="text-base font-semibold text-[var(--fo-text)]">Cobrado en {nombreDelMes(mes)}</h2>
            <p className="text-xs text-[var(--fo-muted)]">Cobros vigentes (sin anular) según su fecha de pago, por medio.</p>
          </div>
          <nav aria-label="Elegir mes" className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/pedidos/informes?mes=${mesAnterior(mes)}`} className="fo-btn fo-btn-secondary text-sm">
              Mes anterior
            </Link>
            {esActual ? null : (
              <Link href={`/pedidos/informes?mes=${mesSiguiente(mes)}`} className="fo-btn fo-btn-secondary text-sm">
                Mes siguiente
              </Link>
            )}
            <form method="get" action="/pedidos/informes" className="flex items-center gap-2">
              <label className="sr-only" htmlFor="mes-informe">Mes</label>
              <input id="mes-informe" type="month" name="mes" defaultValue={mes} max={hoy.slice(0, 7)} className="fo-input text-sm" />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">Ver</button>
            </form>
          </nav>
        </div>
        {cobrado ? (
          <>
            <Tarjeta titulo="Total cobrado" valor={pesosInforme(cobrado.total)} ayuda={`${cobrado.cantidad} ${cobrado.cantidad === 1 ? "cobro" : "cobros"}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {cobrado.porMedio.map((m) => (
                <Tarjeta key={m.medio} titulo={m.etiqueta} valor={pesosInforme(m.total)} ayuda={`${m.cantidad} ${m.cantidad === 1 ? "cobro" : "cobros"}`} />
              ))}
            </div>
          </>
        ) : (
          <SinPermisoOAviso permitido={aCobrar !== null || aPagar !== null} />
        )}
      </section>

      <section aria-labelledby="a-pagar-titulo" className="fo-card space-y-4">
        <div>
          <h2 id="a-pagar-titulo" className="text-base font-semibold text-[var(--fo-text)]">A pagar</h2>
          <p className="text-xs text-[var(--fo-muted)]">Cuentas a proveedores sin pagar: vencidas y las que vencen hasta el {aPagar ? dia(aPagar.hasta) : "día 30"}.</p>
        </div>
        {aPagar ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tarjeta titulo="Vencidas" valor={pesosInforme(aPagar.vencido)} />
              <Tarjeta titulo="Próximos 30 días" valor={pesosInforme(aPagar.proximos)} />
              <Tarjeta titulo="Total" valor={pesosInforme(aPagar.total)} />
            </div>
            {aPagar.proveedores.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">No hay cuentas vencidas ni por vencer en los próximos 30 días.</p>
            ) : (
              <TablaProveedores filas={aPagar.proveedores} />
            )}
            {aPagar.sinVencimiento.cuentas > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--fo-text)]">
                  Sin vencimiento: {pesosInforme(aPagar.sinVencimiento.total)} en {aPagar.sinVencimiento.cuentas} {aPagar.sinVencimiento.cuentas === 1 ? "cuenta" : "cuentas"}
                </h3>
                <TablaProveedores filas={aPagar.sinVencimiento.proveedores} sinVencimiento />
              </div>
            ) : null}
            <p className="text-xs text-[var(--fo-muted)]">
              <Link href="/pedidos/a-pagar" className="underline">Ver el listado de cuentas a pagar</Link>
            </p>
          </>
        ) : (
          <SinPermisoOAviso permitido={aCobrar !== null || cobrado !== null} />
        )}
      </section>
    </div>
  );
}

/** Si faltan los datos por un tope se avisa arriba; si faltan por permisos, el aviso de siempre. */
function SinPermisoOAviso({ permitido }: { permitido: boolean }) {
  return permitido ? <p className="text-sm text-[var(--fo-muted)]">No se pudo armar este informe. Probá filtrando desde el listado.</p> : <SinPermiso />;
}

function TablaProveedores({ filas, sinVencimiento = false }: { filas: { proveedorId: string | null; proveedorNombre: string; vencido: number; proximos: number; total: number; cuentas: number }[]; sinVencimiento?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-[var(--fo-muted)]">
            <th className="py-2 pr-3 font-medium">Proveedor</th>
            <th className="py-2 pr-3 text-right font-medium">Cuentas</th>
            {sinVencimiento ? null : <th className="py-2 pr-3 text-right font-medium">Vencidas</th>}
            {sinVencimiento ? null : <th className="py-2 pr-3 text-right font-medium">Próximos 30 días</th>}
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.proveedorId ?? "sin-proveedor"} className="border-t border-[var(--fo-border)]">
              <td className="py-2 pr-3">{f.proveedorNombre}</td>
              <td className="py-2 pr-3 text-right">{f.cuentas}</td>
              {sinVencimiento ? null : <td className="py-2 pr-3 text-right">{pesosInforme(f.vencido)}</td>}
              {sinVencimiento ? null : <td className="py-2 pr-3 text-right">{pesosInforme(f.proximos)}</td>}
              <td className="py-2 text-right font-medium">{pesosInforme(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
