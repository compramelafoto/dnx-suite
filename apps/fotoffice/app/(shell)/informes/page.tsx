import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AvisosInforme, SinDatos } from "@/components/informes/avisos";
import { Semaforo } from "@/components/informes/semaforo";
import { requireInformes } from "@/lib/informes/acceso";
import { fechaLarga } from "@/lib/informes/detalle";
import { cargarTablero, type EnVencimientos } from "@/lib/informes/tablero-datos";
import { nombreDeMes } from "@/lib/informes/url";
import { formatMinorArs } from "@/lib/membership/money";
import { sumarDias } from "@/lib/informes/fechas";

export const dynamic = "force-dynamic";

function Tarjeta({ titulo, valor, ayuda, href, tono }: { titulo: string; valor: string; ayuda?: string; href?: string; tono?: "peligro" }) {
  const cuerpo = (
    <>
      <p className="text-xs text-[var(--fo-muted)]">{titulo}</p>
      <p className={`text-lg font-semibold ${tono === "peligro" ? "text-[var(--fo-danger)]" : "text-[var(--fo-text)]"}`}>{valor}</p>
      {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </>
  );
  const clase = "block rounded-lg border border-[var(--fo-border)] p-3";
  return href ? (
    <Link href={href} className={`${clase} hover:bg-[var(--fo-surface-hover)]`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

const hayAlgo = (v: EnVencimientos & { sinFecha?: number }) => v.vencido + v.en7 + v.en30 + (v.sinFecha ?? 0) !== 0;

/**
 * Tablero de Informes: por cobrar y por pagar, saldo de Caja, resultado del mes y monotributo. Cada
 * número enlaza al informe que lo explica. Página de servidor: los importes no viajan al navegador.
 */
export default async function InformesTableroPage() {
  const { ctx } = await requireInformes();
  const t = await cargarTablero(ctx);
  if (!t) return null;
  const ayer = sumarDias(t.hoy, -1);
  const en7 = sumarDias(t.hoy, 7);
  const en30 = sumarDias(t.hoy, 30);
  const detalle = (tipo: "cobrar" | "pagar", desde: string | null, hasta: string) => {
    const p = new URLSearchParams({ tipo, hasta });
    if (desde) p.set("desde", desde);
    return `/informes/flujo/detalle?${p.toString()}`;
  };
  const mesActual = t.resultadoMes;
  const mesAnterior = t.resultadoMesAnterior;
  const sinMovimientos =
    mesActual !== null && mesAnterior !== null && [mesActual.ingresos, mesActual.egresos, mesAnterior.ingresos, mesAnterior.egresos].every((v) => v === 0);
  const diferencia = mesActual && mesAnterior ? mesActual.resultado - mesAnterior.resultado : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Informes" description={`Lo que importa de un vistazo, al ${fechaLarga(t.hoy)}. Tocá un número para ver qué lo forma.`} />
      <AvisosInforme avisos={t.avisos} />

      {t.primeraFechaBajoMinimo && t.saldoMinimo !== null ? (
        <div role="alert" className="rounded-[var(--fo-radius)] border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] p-4 text-sm text-[var(--fo-danger)]">
          Según lo proyectado, desde el {fechaLarga(t.primeraFechaBajoMinimo)} el saldo de Caja queda por debajo del mínimo de {formatMinorArs(t.saldoMinimo)}.{" "}
          <Link href="/informes/flujo" className="font-semibold underline">Ver el flujo de caja</Link>
        </div>
      ) : null}

      <section aria-labelledby="inf-cobrar" className="fo-card space-y-3">
        <h2 id="inf-cobrar" className="text-base font-semibold">Por cobrar</h2>
        {t.porCobrar === null ? null : !hayAlgo(t.porCobrar) ? (
          <p className="text-sm text-[var(--fo-muted)]">No hay cuotas por cobrar de pedidos confirmados.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tarjeta titulo="Vencido" valor={formatMinorArs(t.porCobrar.vencido)} href={detalle("cobrar", null, ayer)} tono={t.porCobrar.vencido > 0 ? "peligro" : undefined} />
              <Tarjeta titulo="En los próximos 7 días" valor={formatMinorArs(t.porCobrar.en7)} href={detalle("cobrar", t.hoy, en7)} />
              <Tarjeta titulo="En los próximos 30 días" valor={formatMinorArs(t.porCobrar.en30)} href={detalle("cobrar", t.hoy, en30)} ayuda="Incluye lo de los próximos 7 días" />
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="inf-pagar" className="fo-card space-y-3">
        <h2 id="inf-pagar" className="text-base font-semibold">Por pagar</h2>
        {t.porPagar === null ? null : !hayAlgo(t.porPagar) ? (
          <p className="text-sm text-[var(--fo-muted)]">No hay cuentas a pagar pendientes.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta titulo="Vencido" valor={formatMinorArs(t.porPagar.vencido)} href={detalle("pagar", null, ayer)} tono={t.porPagar.vencido > 0 ? "peligro" : undefined} />
            <Tarjeta titulo="En los próximos 7 días" valor={formatMinorArs(t.porPagar.en7)} href={detalle("pagar", t.hoy, en7)} />
            <Tarjeta titulo="En los próximos 30 días" valor={formatMinorArs(t.porPagar.en30)} href={detalle("pagar", t.hoy, en30)} ayuda="Incluye lo de los próximos 7 días" />
            <Tarjeta titulo="Sin fecha" valor={formatMinorArs(t.porPagar.sinFecha)} href="/informes/flujo/detalle?tipo=sinfecha" ayuda="Sin vencimiento cargado" />
          </div>
        )}
      </section>

      <section aria-labelledby="inf-saldo" className="fo-card space-y-3">
        <h2 id="inf-saldo" className="text-base font-semibold">Saldo de Caja hoy</h2>
        {t.saldos.cuentas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay cuentas de Caja activas.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.saldos.cuentas.map((c) => (
              <Tarjeta key={c.id} titulo={c.nombre} valor={formatMinorArs(c.centavos)} tono={c.centavos < 0 ? "peligro" : undefined} />
            ))}
            <Tarjeta titulo="Total" valor={formatMinorArs(t.saldos.total)} href="/informes/flujo" ayuda="Ver cómo sigue" tono={t.saldos.total < 0 ? "peligro" : undefined} />
          </div>
        )}
      </section>

      <section aria-labelledby="inf-resultado" className="fo-card space-y-3">
        <h2 id="inf-resultado" className="text-base font-semibold">Resultado del mes</h2>
        {mesActual === null || mesAnterior === null ? null : sinMovimientos ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos de Caja en {nombreDeMes(mesActual.mes)} ni en {nombreDeMes(mesAnterior.mes)}.</p>
        ) : (
          <>
            <p className="text-xs text-[var(--fo-muted)]">Lo cobrado y pagado en Caja, sin los pases entre cuentas.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tarjeta titulo={`Entró en ${nombreDeMes(mesActual.mes)}`} valor={formatMinorArs(mesActual.ingresos)} href="/informes/resultados?periodo=este-mes" />
              <Tarjeta titulo={`Salió en ${nombreDeMes(mesActual.mes)}`} valor={formatMinorArs(mesActual.egresos)} href="/informes/resultados?periodo=este-mes" />
              <Tarjeta titulo="Resultado" valor={formatMinorArs(mesActual.resultado)} href="/informes/resultados?periodo=este-mes" tono={mesActual.resultado < 0 ? "peligro" : undefined} />
            </div>
            <p className="text-sm text-[var(--fo-muted)]">
              {nombreDeMes(mesAnterior.mes)}: {formatMinorArs(mesAnterior.resultado)}.{" "}
              {diferencia === 0 ? "Igual que el mes anterior." : `${diferencia > 0 ? "Mejora" : "Baja"} ${formatMinorArs(Math.abs(diferencia))} respecto del mes anterior.`}
            </p>
          </>
        )}
      </section>

      {t.monotributo ? (
        <section aria-labelledby="inf-mono" className="fo-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="inf-mono" className="text-base font-semibold">Monotributo</h2>
            <Semaforo estado={t.monotributo.estado} />
          </div>
          {t.monotributo.estado === "SIN_CONFIGURAR" ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Cargá el tope anual de tu categoría para controlar cuánto cobraste en los últimos 12 meses.{" "}
              <Link href="/informes/monotributo" className="text-[var(--fo-accent)] hover:underline">Ver Monotributo</Link>
            </p>
          ) : (
            <p className="text-sm text-[var(--fo-muted)]">
              Cobraste {formatMinorArs(t.monotributo.total)} en 12 meses: {String(t.monotributo.porcentaje).replace(".", ",")} % del tope{t.monotributo.categoria ? ` de la categoría ${t.monotributo.categoria}` : ""}.{" "}
              <Link href="/informes/monotributo" className="text-[var(--fo-accent)] hover:underline">Ver el detalle</Link>
            </p>
          )}
          <p className="text-xs text-[var(--fo-muted-soft)]">{t.monotributo.leyenda}</p>
        </section>
      ) : null}

      {t.saldos.cuentas.length === 0 && t.porCobrar && t.porPagar && !hayAlgo(t.porCobrar) && !hayAlgo(t.porPagar) && sinMovimientos ? (
        <SinDatos>Cuando haya cobros, pagos y movimientos de Caja, los informes se llenan solos.</SinDatos>
      ) : null}
    </div>
  );
}
