import Link from "next/link";
import { lineasDelEvento, textoDeVistas, type EventoDeCotizacion, type ResumenDeVistas } from "@/lib/presupuestos/evento-vista";

/**
 * Recuadro de la ficha de la cotización: el evento (leído de la consulta, sin copia) y si el
 * cliente la abrió. Sólo muestra las líneas que tienen dato. Componente de servidor: no lleva
 * estado ni importa la base.
 */
export function EventoDeCotizacionTarjeta({
  evento,
  vistas,
  enviada,
  consultaHref,
}: {
  evento: EventoDeCotizacion | null;
  vistas: ResumenDeVistas | null;
  enviada: boolean;
  consultaHref: string;
}) {
  const lineas = evento ? lineasDelEvento(evento) : [];
  const mensaje = evento?.mensaje?.trim() || null;
  return (
    <section aria-labelledby="evento-cotizacion-titulo" className="fo-card space-y-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="evento-cotizacion-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Evento
        </h2>
        <Link href={consultaHref} className="text-sm font-medium text-[var(--fo-accent)] hover:underline">
          Editar en la consulta →
        </Link>
      </div>
      {lineas.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {lineas.map((l) => (
            <div key={l.termino} className="min-w-0">
              <dt className="text-xs text-[var(--fo-muted)]">{l.termino}</dt>
              <dd className="break-words text-[var(--fo-text)]">{l.valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[var(--fo-muted)]">La consulta todavía no tiene datos del evento. Cargalos en la consulta.</p>
      )}
      {mensaje ? (
        <div className="space-y-1 border-t border-[var(--fo-border)] pt-3">
          <p className="text-xs text-[var(--fo-muted)]">Mensaje del cliente</p>
          <p className="whitespace-pre-line break-words text-[var(--fo-text)]">{mensaje}</p>
        </div>
      ) : null}
      <div className="space-y-1 border-t border-[var(--fo-border)] pt-3">
        <p className="text-xs text-[var(--fo-muted)]">¿La vio el cliente?</p>
        <p className={vistas ? "font-medium text-[var(--fo-text)]" : "text-[var(--fo-muted)]"}>{textoDeVistas(vistas, enviada)}</p>
      </div>
    </section>
  );
}
