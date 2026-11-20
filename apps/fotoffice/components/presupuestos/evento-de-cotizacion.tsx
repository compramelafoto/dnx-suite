import Link from "next/link";
import { Building2, CalendarClock, Camera, Church, Clock, Eye, EyeOff, Heart, MapPin, Megaphone, Navigation, PartyPopper, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconoEntidad } from "@/components/entidades/entidad";
import { EnlaceCliente } from "@/components/entidades/enlace-cliente";
import {
  hojaDeCalendario,
  lineasDelEvento,
  textoDeCuantoFalta,
  textoDeVistas,
  type EventoDeCotizacion,
  type ResumenDeVistas,
} from "@/lib/presupuestos/evento-vista";

/** Un ícono por dato del evento (la fecha y el tipo van aparte, en grande). */
const ICONO: Record<string, LucideIcon> = {
  Protagonistas: Heart,
  Lugar: MapPin,
  Ceremonia: Church,
  Fiesta: PartyPopper,
  Ciudad: Building2,
  Invitados: Users,
  "Horas de cobertura": Clock,
  "Segundo fotógrafo": Camera,
  "Distancia desde el estudio": Navigation,
  Origen: Megaphone,
};

/** Tinte suave del color del estudio (el acento cambia por workspace). */
const TINTE = "bg-[color-mix(in_srgb,var(--fo-accent)_10%,transparent)]";

/** El total que muestra el encabezado: uno solo o el rango de las opciones. */
export type TotalCabecera = { tipo: "unico"; total: string } | { tipo: "opciones"; cantidad: number; desde: string; hasta: string };

/**
 * Encabezado de la ficha de la cotización: de quién es, el evento completo (leído de la consulta,
 * sin copia), cuánto suma y si el cliente la abrió. Debajo van las acciones y la lista de lo
 * cotizado. Componente de servidor: no lleva estado ni importa la base.
 */
export function CabeceraCotizacion({
  titulo,
  estado,
  claseEstado,
  versiones,
  vence,
  contacto,
  clientId,
  evento,
  vistas,
  enviada,
  consultaHref,
  hoy,
  total,
  totalAclaracion,
  enlaces,
  acciones,
  nivel = "h1",
}: {
  titulo: string;
  estado: string;
  claseEstado: string;
  versiones: string;
  vence: string;
  contacto: string;
  /** El cliente: su nombre lleva a la ficha. */
  clientId: string;
  evento: EventoDeCotizacion | null;
  vistas: ResumenDeVistas | null;
  enviada: boolean;
  consultaHref: string;
  /** "aaaa-mm-dd" de hoy en Argentina, para "Faltan N días". */
  hoy: string;
  total: TotalCabecera | null;
  totalAclaracion?: string | null;
  /** Ver la consulta / Volver. */
  enlaces: React.ReactNode;
  /** Enviar, Editar, Rechazar… (van al pie del encabezado). */
  acciones?: React.ReactNode;
  /** `h2` adentro de la ficha del cliente (que ya tiene su `h1`). */
  nivel?: "h1" | "h2";
}) {
  const Titulo = nivel;
  const hoja = evento?.fecha ? hojaDeCalendario(evento.fecha, evento.horaConocida) : null;
  const detalles = evento ? lineasDelEvento(evento).filter((l) => l.termino !== "Tipo de evento" && l.termino !== "Fecha") : [];
  const mensaje = evento?.mensaje?.trim() || null;
  const tipo = evento?.tipo?.trim() || null;
  const falta = hoja ? textoDeCuantoFalta(hoja.ymd, hoy) : null;
  const yaPaso = falta?.startsWith("Fue") ?? false;
  const sinDatos = !hoja && !tipo && detalles.length === 0;

  return (
    <header aria-labelledby="cotizacion-titulo" className="overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)]">
      {/* Franja superior: qué documento es, en qué estado está y hasta cuándo vale. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] bg-[var(--fo-bg)] px-5 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Titulo id="cotizacion-titulo" className="flex items-center gap-2 font-semibold text-[var(--fo-text)]">
            <IconoEntidad entidad="cotizacion" tamano="sm" />
            {titulo}
          </Titulo>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${claseEstado}`}>{estado}</span>
          <span className="text-[var(--fo-muted)]">{versiones}</span>
          <span className="flex items-center gap-1 text-[var(--fo-muted)]">
            <CalendarClock className="size-3.5" aria-hidden />
            Vale hasta el {vence}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">{enlaces}</div>
      </div>

      <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
        {/* La hoja de calendario: lo primero que se lee es cuándo es el evento. */}
        {hoja ? (
          <div className="flex items-center gap-4 lg:block">
            <div
              role="img"
              aria-label={`Fecha del evento: ${hoja.diaSemana} ${hoja.dia} de ${hoja.mes} de ${hoja.anio}`}
              className="w-28 shrink-0 overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] text-center shadow-[var(--fo-shadow-xs)]"
            >
              <div className="bg-[var(--fo-accent)] py-1 text-xs font-semibold text-white">
                {hoja.mes}. {hoja.anio}
              </div>
              <div className="pt-2 text-4xl font-bold leading-none tabular-nums text-[var(--fo-text)]">{hoja.dia}</div>
              <div className="pb-2 pt-1 text-xs capitalize text-[var(--fo-muted)]">{hoja.diaSemana}</div>
            </div>
            <div className="space-y-0.5 text-sm lg:mt-2 lg:text-center">
              {hoja.hora ? <p className="font-medium text-[var(--fo-text)]">{hoja.hora}</p> : null}
              {falta ? <p className={`font-medium ${yaPaso ? "text-[var(--fo-muted)]" : "text-[var(--fo-accent)]"}`}>{falta}</p> : null}
            </div>
          </div>
        ) : (
          <div className="flex w-28 items-center justify-center rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border-strong)] px-2 py-5 text-center text-xs text-[var(--fo-muted)]">
            Sin fecha del evento
          </div>
        )}

        {/* Quién y qué. */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="break-words text-2xl font-semibold tracking-tight text-[var(--fo-text)] sm:text-3xl">
              <EnlaceCliente clientId={clientId}>{contacto}</EnlaceCliente>
            </p>
            {tipo ? <p className="text-base text-[var(--fo-text-secondary)]">{tipo}</p> : null}
          </div>

          {detalles.length > 0 ? (
            <dl className="flex flex-wrap gap-2">
              {detalles.map((l) => {
                const Icono = ICONO[l.termino] ?? MapPin;
                return (
                  <div key={l.termino} className="flex min-w-0 max-w-full items-center gap-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] px-3 py-1.5">
                    <Icono className="size-4 shrink-0 text-[var(--fo-accent)]" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-[11px] leading-tight text-[var(--fo-muted)]">{l.termino}</dt>
                      <dd className="break-words text-sm font-medium leading-tight text-[var(--fo-text)]">{l.valor}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          ) : null}

          {sinDatos ? (
            <p className="text-sm text-[var(--fo-muted)]">La consulta todavía no tiene datos del evento. Cargalos en la consulta.</p>
          ) : null}

          {mensaje ? (
            <blockquote className="border-l-2 border-[var(--fo-accent)] pl-3 text-sm">
              <p className="text-xs text-[var(--fo-muted)]">Lo que escribió el cliente</p>
              <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words text-[var(--fo-text-secondary)]">{mensaje}</p>
            </blockquote>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                vistas ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]" : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
              }`}
            >
              {vistas ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
              <span>
                <span className="sr-only">¿La vio el cliente? </span>
                {textoDeVistas(vistas, enviada)}
              </span>
            </span>
            <Link href={consultaHref} className="font-medium text-[var(--fo-accent)] hover:underline">
              Corregir datos del evento en la consulta
            </Link>
          </div>
        </div>

        {/* Cuánto suma. */}
        {total ? (
          <div className={`rounded-[var(--fo-radius)] px-5 py-4 lg:min-w-56 lg:text-right ${TINTE}`}>
            {total.tipo === "unico" ? (
              <>
                <p className="text-xs font-medium text-[var(--fo-muted)]">Total</p>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-[var(--fo-text)]">{total.total}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-[var(--fo-muted)]">{total.cantidad} opciones para elegir</p>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-[var(--fo-text)]">de {total.desde}</p>
                <p className="text-sm tabular-nums text-[var(--fo-text-secondary)]">a {total.hasta}</p>
              </>
            )}
            {totalAclaracion ? <p className="mt-1 text-xs text-[var(--fo-muted)]">{totalAclaracion}</p> : null}
          </div>
        ) : null}
      </div>

      {acciones ? <div className="space-y-3 border-t border-[var(--fo-border)] px-5 py-4 sm:px-6">{acciones}</div> : null}
    </header>
  );
}
