import type { ReactNode } from "react";
import type { OpcionPublica } from "@/lib/presupuestos/opciones-pago";
import type { VistaPublica } from "@/lib/presupuestos/vista-publica";
import { totalDeAlternativa } from "./tarjeta-alternativa";

/**
 * La portada del enlace público: para quién es, de qué evento, cómo se puede pagar y qué hacer.
 * Ocupa todo el ancho y es oscura a propósito: el logo ya lo pone el sitio (el resto del menú se
 * esconde en esta página, ver `ESTILO_SIN_MENU`), y con la barra transparente del sitio
 * (`transparent-hero`), que flota encima de la página, el logo queda legible. El relleno de arriba
 * deja lugar a esa barra.
 */

/** En el presupuesto el cliente tiene que decidir: del encabezado del sitio queda sólo el logo. */
export const ESTILO_SIN_MENU = "[data-sitio-menu]{display:none!important}";

/** «1 pago · ahorrás 10 %», «3 cuotas sin interés», «6 cuotas»: cómo se puede pagar, sin repetir. */
export function formasDePagoEnCorto(opciones: readonly OpcionPublica[], total: number): string[] {
  const textos = [...opciones]
    .sort((a, b) => a.cuotas - b.cuotas || a.total - b.total)
    .map((o) => {
      if (o.cuotas <= 1) {
        const ahorro = total > 0 && o.total < total - 0.5 ? Math.round((1 - o.total / total) * 100) : 0;
        return ahorro > 0 ? `1 pago · ahorrás ${ahorro} %` : "1 pago";
      }
      return o.total <= total + 0.5 ? `${o.cuotas} cuotas sin interés` : `${o.cuotas} cuotas`;
    });
  return [...new Set(textos)];
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{etiqueta}</dt>
      <dd className="mt-1 break-words text-base font-medium text-white">{children}</dd>
    </div>
  );
}

export function PortadaPresupuesto({ vista }: { vista: VistaPublica }) {
  const opciones = vista.alternativas.length;
  const activo = vista.estado === "ACTIVO";
  const ficha = vista.ficha;

  // Las formas de pago de la opción destacada (todas las opciones se pagan igual, cambia el monto).
  const destacada = vista.alternativas.find((a) => a.masElegida) ?? vista.alternativas[0];
  const pago = destacada
    ? { opciones: destacada.opcionesPago, total: totalDeAlternativa(destacada), cobro: destacada.cobro }
    : { opciones: vista.opcionesPago, total: vista.cobro && vista.cobro.iva > 0 ? vista.cobro.totalConIva : vista.totales.total, cobro: vista.cobro };
  const formas = formasDePagoEnCorto(pago.opciones, pago.total);
  const medios = [
    pago.opciones.some((o) => o.medio === "MERCADO_PAGO") ? "Mercado Pago" : null,
    pago.opciones.some((o) => o.medio === "TRANSFERENCIA") || (pago.cobro?.descuentoTransferencia ?? 0) > 0 ? "Transferencia" : null,
  ].filter((m): m is string => m !== null);

  const titulo = !activo
    ? ficha?.nombrePila ? `${ficha.nombrePila}, este es tu presupuesto` : "Tu presupuesto"
    : opciones > 1
      ? ficha?.nombrePila ? `${ficha.nombrePila}, elegí tu propuesta` : "Elegí tu propuesta"
      : ficha?.nombrePila ? `${ficha.nombrePila}, tu presupuesto está listo` : "Tu presupuesto está listo";
  const bajada = !activo
    ? null
    : opciones > 1
      ? `Te armamos ${opciones} opciones${ficha?.evento ? ` para tu ${ficha.evento.toLowerCase()}` : ""}. Elegí la que más te guste, cómo querés pagarla y reservá en un minuto.`
      : "Revisalo, elegí cómo querés pagarlo y reservá en un minuto.";
  const pasos = opciones > 1 ? ["Elegí tu opción", "Elegí cómo pagar", "Confirmá y reservá"] : ["Elegí cómo pagar", "Confirmá y reservá"];

  const hayEvento = Boolean(ficha && (ficha.evento || ficha.fecha || ficha.lugares.length || ficha.ciudad || ficha.invitados || ficha.pareja));
  const pie = [
    ficha?.emitido ? `Emitido el ${ficha.emitido}` : null,
    vista.vence ? `Válido hasta el ${vista.vence}` : null,
    ficha?.preparadoPor ? `Preparado por ${ficha.preparadoPor}` : null,
  ].filter(Boolean);

  return (
    <section className="no-imprimir relative overflow-hidden bg-[#0b1220] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 80% at 85% 0%, var(--fo-accent) 0%, transparent 60%), radial-gradient(50% 60% at 0% 100%, #1e293b 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 md:px-8 md:pb-16 md:pt-36">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Presupuesto{vista.numero ? ` N° ${vista.numero}` : ""} · Versión {vista.version}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">{titulo}</h1>
        {bajada ? <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">{bajada}</p> : null}

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Para quién y de qué evento. */}
          <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/15 backdrop-blur-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{ficha?.cliente ? "Preparado para" : "Tu presupuesto"}</p>
                {ficha?.cliente ? <p className="mt-1 text-xl font-semibold md:text-2xl">{ficha.cliente}</p> : null}
              </div>
              {ficha?.faltan ? (
                <span className="rounded-full bg-[var(--fo-accent)] px-3 py-1 text-xs font-semibold text-[var(--fo-on-accent,#fff)]">{ficha.faltan}</span>
              ) : null}
            </div>
            {hayEvento && ficha ? (
              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                {ficha.evento ? <Dato etiqueta="Evento">{ficha.evento}</Dato> : null}
                {ficha.fecha ? (
                  <Dato etiqueta="Fecha">
                    <span className="first-letter:uppercase">{ficha.fecha}</span>
                    {ficha.hora ? ` · ${ficha.hora} h` : ""}
                  </Dato>
                ) : null}
                {ficha.pareja ? <Dato etiqueta="Novios">{ficha.pareja}</Dato> : null}
                {ficha.lugares.map((l) => (
                  <Dato key={l.etiqueta} etiqueta={l.etiqueta}>{l.valor}</Dato>
                ))}
                {ficha.ciudad ? <Dato etiqueta="Ciudad">{ficha.ciudad}</Dato> : null}
                {ficha.invitados ? <Dato etiqueta="Invitados">{ficha.invitados.toLocaleString("es-AR")}</Dato> : null}
              </dl>
            ) : null}
            {pie.length > 0 ? <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/60">{pie.join(" · ")}</p> : null}
          </div>

          {/* Cómo se puede pagar. */}
          {formas.length > 0 || (pago.cobro?.senaPorcentaje ?? 0) > 0 ? (
            <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/15 backdrop-blur-sm md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Formas de pago</p>
              <ul className="mt-3 space-y-2.5">
                {formas.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm font-medium">
                    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-xs text-white/70">
                {pago.cobro && pago.cobro.senaPorcentaje > 0 ? <p>Reservás la fecha con una seña del {pago.cobro.senaPorcentaje} %.</p> : null}
                {pago.cobro && pago.cobro.descuentoTransferencia > 0 ? <p>{pago.cobro.descuentoTransferencia} % de descuento pagando por transferencia.</p> : null}
                {ficha?.fecha ? <p>Todo queda pagado antes del evento.</p> : null}
                {medios.length > 0 ? <p>Medios: {medios.join(" o ")}.</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        {activo ? (
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {pasos.map((p, i) => (
              <li key={p} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-sm font-bold text-[var(--fo-on-accent,#fff)]">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{p}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
