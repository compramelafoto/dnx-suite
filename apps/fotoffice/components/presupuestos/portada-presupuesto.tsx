import type { VistaPublica } from "@/lib/presupuestos/vista-publica";
import { cuotasSinInteres, totalDeAlternativa } from "./tarjeta-alternativa";

/**
 * La portada del enlace público: número, validez y qué hacer. Ocupa todo el ancho y es oscura a
 * propósito: el logo y el menú ya los pone el sitio (si además los repitiera, como antes, se veían
 * dos logos), y con la barra transparente del sitio (`transparent-hero`), que flota encima de la
 * página, el menú blanco queda legible. El relleno de arriba deja lugar a esa barra.
 */
export function PortadaPresupuesto({ vista }: { vista: VistaPublica }) {
  const opciones = vista.alternativas.length;
  const activo = vista.estado === "ACTIVO";
  const maxCuotas = Math.max(
    0,
    ...(opciones > 0
      ? vista.alternativas.map((a) => cuotasSinInteres(a.opcionesPago, totalDeAlternativa(a))?.cuotas ?? 0)
      : [cuotasSinInteres(vista.opcionesPago, vista.cobro && vista.cobro.iva > 0 ? vista.cobro.totalConIva : vista.totales.total)?.cuotas ?? 0]),
  );
  const titulo = !activo ? "Tu presupuesto" : opciones > 1 ? "Elegí tu propuesta" : "Tu presupuesto está listo";
  const bajada = !activo
    ? null
    : opciones > 1
      ? `Te armamos ${opciones} opciones. Elegí la que más te guste, cómo querés pagarla y reservá en un minuto.`
      : "Revisalo, elegí cómo querés pagarlo y reservá en un minuto.";
  const pasos = opciones > 1 ? ["Elegí tu opción", "Elegí cómo pagar", "Confirmá y reservá"] : ["Elegí cómo pagar", "Confirmá y reservá"];

  return (
    <section className="no-imprimir relative overflow-hidden bg-[#0b1220] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 80% at 85% 0%, var(--fo-accent) 0%, transparent 60%), radial-gradient(50% 60% at 0% 100%, #1e293b 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-32 md:px-8 md:pb-16 md:pt-40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Presupuesto{vista.numero ? ` N° ${vista.numero}` : ""} · Versión {vista.version}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">{titulo}</h1>
        {bajada ? <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">{bajada}</p> : null}
        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
          {vista.vence ? <li className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">Válido hasta el {vista.vence}</li> : null}
          {activo && maxCuotas > 1 ? <li className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">Hasta {maxCuotas} cuotas sin interés</li> : null}
          {activo && vista.cobro && vista.cobro.descuentoTransferencia > 0 ? (
            <li className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">{vista.cobro.descuentoTransferencia} % off por transferencia</li>
          ) : null}
        </ul>
        {activo ? (
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
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
