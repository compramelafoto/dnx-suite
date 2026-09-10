"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMinorArs } from "@/lib/membership/money";
import { durationOptions, hoursLabel, type DayOffer } from "@/lib/bookings/day-slots";
import { WEEKDAY_INITIALS, type MonthCell } from "@/lib/bookings/month";
import type { FreeHoursBalance } from "@/lib/bookings/free-hours";
import { createPortalBookingAction } from "./actions";

export type ExtraVista = {
  id: string;
  name: string;
  available: boolean;
  requiresConfirmation: boolean;
  /** Precio de una unidad: por hora o por reserva, según `priceMode`. */
  unitPriceMinor: number;
  priceMode: "PER_HOUR" | "PER_BOOKING";
};

const TZ = "America/Argentina/Buenos_Aires";
const DIAS_VISIBLES = 5;

/**
 * Paso 2: cuándo.
 *
 * ── Por qué el día y la hora se eligen por separado ──
 *
 * La grilla semanal pedía dos toques —la hora de inicio y la de fin— sobre casilleros de una
 * hora. Funciona mientras todos los turnos duren lo mismo; con el salón, que tiene un mínimo
 * de tres horas, el casillero suelto es una mentira: se puede tocar y no se puede reservar.
 *
 * Acá el calendario contesta "qué días hay lugar", la tira contesta "a qué hora puedo entrar"
 * y el selector de abajo contesta "cuánto me quedo". Cada control tiene una sola pregunta.
 *
 * El día y la hora viajan en la dirección web, no en el estado del navegador. No es un
 * capricho: el equipamiento disponible y su precio dependen del horario elegido, y esos los
 * calcula el servidor. Teniéndolos en la URL, lo que se muestra siempre corresponde al
 * horario que se está mirando, y el botón "atrás" del teléfono funciona.
 *
 * Todo esto es una estimación: **el servidor recalcula al recibir**. Si entre que se pintó la
 * pantalla y se confirma alguien tomó el horario, lo rechaza con su motivo.
 */
export function ReservarForm({
  spaceId,
  spaceName,
  description,
  memberHourlyPriceMinor,
  freeHours,
  slotMinutes,
  minBookingMinutes,
  monthTitle,
  monthCells,
  mesAnterior,
  mesSiguiente,
  dayOffers,
  diaElegido,
  horaElegida,
  extras,
  hrefBase,
}: {
  spaceId: string;
  spaceName: string;
  description: string | null;
  memberHourlyPriceMinor: number;
  freeHours: FreeHoursBalance;
  slotMinutes: number;
  minBookingMinutes: number;
  monthTitle: string;
  monthCells: MonthCell[];
  /** "2026-08". Null cuando el mes anterior ya pasó entero. */
  mesAnterior: string | null;
  mesSiguiente: string;
  dayOffers: DayOffer[];
  diaElegido: string | null;
  /** El comienzo elegido, en ISO. */
  horaElegida: string | null;
  extras: ExtraVista[];
  /** "/portal/reservas?espacio=xxx" */
  hrefBase: string;
}) {
  const minima = Math.max(minBookingMinutes, slotMinutes);
  const [extrasElegidos, setExtrasElegidos] = useState<string[]>([]);

  // La duración elegida recuerda PARA QUÉ horario se eligió. Cambiar de horario la devuelve
  // sola al mínimo: arrastrar las cinco horas de un horario a otro donde sólo entran tres
  // daría un precio que después no se puede reservar.
  const [duracion, setDuracion] = useState<{ para: string | null; minutos: number }>({
    para: horaElegida,
    minutos: minima,
  });
  const minutos = duracion.para === horaElegida ? duracion.minutos : minima;
  const setMinutos = (m: number) => setDuracion({ para: horaElegida, minutos: m });

  const porDia = useMemo(
    () => new Map(dayOffers.map((d) => [d.ymd, d])),
    [dayOffers],
  );
  const conLugar = useMemo(() => new Set(dayOffers.map((d) => d.ymd)), [dayOffers]);

  const start = useMemo(() => {
    if (!horaElegida || !diaElegido) return null;
    return porDia.get(diaElegido)?.starts.find((s) => s.startISO === horaElegida) ?? null;
  }, [porDia, diaElegido, horaElegida]);

  const duraciones = start ? durationOptions(start.maxMinutes, minBookingMinutes, slotMinutes) : [];
  const iDuracion = duraciones.indexOf(minutos);

  // ── La tira de días ──
  const delMes = useMemo(() => monthCells.filter((c) => c.inMonth), [monthCells]);
  const iElegido = Math.max(0, delMes.findIndex((c) => c.ymd === diaElegido));
  // Igual que la duración: correr la tira a mano vale hasta que se elige otro día, y ahí
  // vuelve a encuadrarse sola en el día elegido.
  const [corrida, setCorrida] = useState<{ para: string | null; desde: number } | null>(null);
  const desde =
    corrida && corrida.para === diaElegido
      ? corrida.desde
      : arranqueTira(iElegido, delMes.length);
  const setDesde = (i: number) => setCorrida({ para: diaElegido, desde: i });
  const tira = delMes.slice(desde, desde + DIAS_VISIBLES);

  // ── Dinero ──
  const bonificados = Math.min(minutos, freeHours.availableMinutes);
  const cobrados = minutos - bonificados;
  const espacioMinor = Math.round((memberHourlyPriceMinor * cobrados) / 60);
  const extrasMinor = extras
    .filter((e) => extrasElegidos.includes(e.id))
    .reduce(
      (total, e) =>
        total +
        (e.priceMode === "PER_HOUR"
          ? Math.round((e.unitPriceMinor * minutos) / 60)
          : e.unitPriceMinor),
      0,
    );

  const finISO = start ? new Date(new Date(start.startISO).getTime() + minutos * 60_000).toISOString() : null;

  return (
    <form action={createPortalBookingAction} className="space-y-5">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="paymentMethod" value="MERCADO_PAGO" />
      {start && finISO ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(start.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(finISO)} />
        </>
      ) : null}

      <div className="fo-card space-y-1 p-5">
        <Link
          href="/portal/reservas"
          className="text-sm text-[var(--fo-muted)] underline underline-offset-4"
        >
          ← Cambiar de espacio
        </Link>
        <h2 className="pt-1 text-lg font-semibold tracking-tight">{spaceName}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{description}</p>
        ) : null}
        {freeHours.grantedMinutes > 0 ? (
          <p className="text-sm text-[var(--fo-success)]">
            Te quedan {hoursLabel(freeHours.availableMinutes)} de{" "}
            {hoursLabel(freeHours.grantedMinutes)} bonificadas este mes.
          </p>
        ) : null}
        {minima > 60 ? (
          <p className="text-sm text-[var(--fo-text-secondary)]">
            Este espacio se alquila por un mínimo de {hoursLabel(minima)}.
          </p>
        ) : null}
      </div>

      <div className="fo-card space-y-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Elegí el día y la hora de entrada</h3>
          <span className="text-xs text-[var(--fo-muted)]">
            Hora de Buenos Aires (GMT−03:00)
          </span>
        </div>

        {dayOffers.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">
            No queda lugar en {monthTitle}. Probá con el mes siguiente.
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          {/* ── Calendario del mes: qué días hay lugar ── */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold capitalize">{monthTitle}</span>
              <span className="flex gap-1">
                {mesAnterior ? (
                  <Link
                    href={`${hrefBase}&mes=${mesAnterior}`}
                    scroll={false}
                    className="fo-icon-btn"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft aria-hidden className="size-4" />
                  </Link>
                ) : (
                  <span className="fo-icon-btn opacity-30" aria-hidden>
                    <ChevronLeft className="size-4" />
                  </span>
                )}
                <Link
                  href={`${hrefBase}&mes=${mesSiguiente}`}
                  scroll={false}
                  className="fo-icon-btn"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </span>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-xs tabular-nums">
              {WEEKDAY_INITIALS.map((inicial, i) => (
                <span key={i} className="pb-1 font-semibold text-[var(--fo-muted-soft)]">
                  {inicial}
                </span>
              ))}
              {monthCells.map((celda) => {
                const hayLugar = conLugar.has(celda.ymd);
                const elegido = celda.ymd === diaElegido;
                if (!hayLugar) {
                  return (
                    <span
                      key={celda.ymd}
                      className={`flex aspect-square items-center justify-center text-[var(--fo-muted-soft)] ${celda.inMonth ? "line-through" : "opacity-40"}`}
                    >
                      {celda.dayNumber}
                    </span>
                  );
                }
                return (
                  <Link
                    key={celda.ymd}
                    href={`${hrefBase}&mes=${celda.ymd.slice(0, 7)}&dia=${celda.ymd}`}
                    scroll={false}
                    aria-current={elegido ? "date" : undefined}
                    className={`flex aspect-square items-center justify-center rounded-full font-semibold transition-colors ${
                      elegido
                        ? "bg-[var(--fo-accent)] text-white"
                        : "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)] hover:bg-[var(--fo-accent-muted)]"
                    }`}
                  >
                    {celda.dayNumber}
                  </Link>
                );
              })}
            </div>
            <p className="fo-helper mt-2">
              En celeste, los días con lugar. Tachados, los que el espacio no abre o ya pasaron.
            </p>
          </div>

          {/* ── La tira de días: a qué hora se puede entrar ── */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="fo-icon-btn"
                aria-label="Días anteriores"
                disabled={desde === 0}
                onClick={() => setDesde(Math.max(0, desde - DIAS_VISIBLES))}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <span className="text-xs text-[var(--fo-muted)]">
                Tocá la hora en la que querés entrar
              </span>
              <button
                type="button"
                className="fo-icon-btn"
                aria-label="Días siguientes"
                disabled={desde + DIAS_VISIBLES >= delMes.length}
                onClick={() =>
                  setDesde(Math.min(delMes.length - DIAS_VISIBLES, desde + DIAS_VISIBLES))
                }
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {tira.map((celda) => {
                const oferta = porDia.get(celda.ymd);
                return (
                  <div key={celda.ymd} className="flex flex-col gap-2 text-center">
                    <div className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">
                      {etiquetaDia(celda.ymd)}
                      <b className="block text-xl font-semibold tracking-tight text-[var(--fo-text)]">
                        {celda.dayNumber}
                      </b>
                    </div>
                    {!oferta || oferta.starts.length === 0 ? (
                      <span className="py-2 text-sm text-[var(--fo-muted-soft)]">—</span>
                    ) : (
                      oferta.starts.map((s) => {
                        const elegida = s.startISO === horaElegida;
                        return (
                          <Link
                            key={s.startISO}
                            href={`${hrefBase}&mes=${celda.ymd.slice(0, 7)}&dia=${celda.ymd}&hora=${encodeURIComponent(s.startISO)}`}
                            scroll={false}
                            aria-current={elegida ? "true" : undefined}
                            className={`min-h-10 rounded-full border px-1 py-2 text-sm font-medium tabular-nums transition-colors ${
                              elegida
                                ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                                : "border-[var(--fo-border-strong)] bg-[var(--fo-surface)] text-[var(--fo-accent-hover)] hover:bg-[var(--fo-accent-soft)]"
                            }`}
                          >
                            {s.label}
                          </Link>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuánto se queda, y cuánto sale ── */}
      {start ? (
        <div className="fo-card grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="fo-label">¿Hasta qué hora?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="fo-icon-btn"
                aria-label="Menos tiempo"
                disabled={iDuracion <= 0}
                onClick={() => setMinutos(duraciones[Math.max(0, iDuracion - 1)]!)}
              >
                <span aria-hidden className="text-lg leading-none">
                  −
                </span>
              </button>
              <span className="min-w-20 text-center text-base font-medium tabular-nums">
                {hoursLabel(minutos)}
              </span>
              <button
                type="button"
                className="fo-icon-btn"
                aria-label="Más tiempo"
                disabled={iDuracion < 0 || iDuracion >= duraciones.length - 1}
                onClick={() =>
                  setMinutos(duraciones[Math.min(duraciones.length - 1, iDuracion + 1)]!)
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
              </button>
              <span className="text-sm text-[var(--fo-muted)] tabular-nums">
                {start.label} → {finLegible(start.startISO, minutos)}
              </span>
            </div>
            <p className="fo-helper">
              {duraciones.length === 1
                ? "Es lo único que entra en ese horario."
                : `Hasta ${hoursLabel(start.maxMinutes)} seguidas desde esa hora.`}
            </p>
          </div>

          <div className="space-y-1 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] p-4 text-sm">
            <p className="font-medium capitalize">{diaLegible(start.startISO)}</p>
            {bonificados > 0 ? (
              <p className="flex justify-between gap-3 text-[var(--fo-success)]">
                <span>{hoursLabel(bonificados)} bonificadas por ser socio</span>
                <span className="tabular-nums">sin cargo</span>
              </p>
            ) : null}
            {cobrados > 0 ? (
              <p className="flex justify-between gap-3">
                <span>
                  {hoursLabel(cobrados)} × {formatMinorArs(memberHourlyPriceMinor)}
                </span>
                <span className="tabular-nums">{formatMinorArs(espacioMinor)}</span>
              </p>
            ) : null}
            {extrasMinor > 0 ? (
              <p className="flex justify-between gap-3">
                <span>Equipamiento</span>
                <span className="tabular-nums">{formatMinorArs(extrasMinor)}</span>
              </p>
            ) : null}
            <p className="flex justify-between gap-3 border-t border-[var(--fo-border)] pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMinorArs(espacioMinor + extrasMinor)}</span>
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Equipamiento ── */}
      {start && extras.length > 0 ? (
        <div className="fo-card space-y-2 p-5">
          <span className="fo-label">Equipamiento</span>
          {extras.map((e) => (
            <label
              key={e.id}
              className={`flex items-start gap-2 text-sm ${e.available ? "" : "opacity-50"}`}
            >
              <input
                type="checkbox"
                name="extraIds"
                value={e.id}
                disabled={!e.available}
                checked={extrasElegidos.includes(e.id)}
                onChange={(ev) =>
                  setExtrasElegidos((prev) =>
                    ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                  )
                }
              />
              <span>
                {e.name} — {formatMinorArs(e.unitPriceMinor)}
                {e.priceMode === "PER_HOUR" ? " por hora" : ""}
                {!e.available ? (
                  <span className="block text-xs text-[var(--fo-danger)]">
                    Sin disponibilidad en ese horario. Probá con otro.
                  </span>
                ) : e.requiresConfirmation ? (
                  <span className="block text-xs text-[var(--fo-muted)]">
                    Hay que coordinarlo: tu reserva queda a la espera y no se te cobra hasta que
                    la institución confirme.
                  </span>
                ) : null}
              </span>
            </label>
          ))}
          <p className="fo-helper">
            Las horas bonificadas cubren el espacio, no el equipamiento.
          </p>
        </div>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={!start}>
          {start ? `Reservar ${hoursLabel(minutos)}` : "Elegí un horario"}
        </button>
      </div>
    </form>
  );
}

/** La tira arranca en el día elegido, salvo al final del mes, donde muestra los últimos. */
function arranqueTira(iElegido: number, total: number): number {
  return Math.max(0, Math.min(iElegido, total - DIAS_VISIBLES));
}

/** "2026-09-12" → el mediodía UTC de ese día, que en Argentina es la mañana del mismo día. */
function alMediodia(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

function etiquetaDia(ymd: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "short" })
    .format(alMediodia(ymd))
    .replace(".", "");
}

function diaLegible(startISO: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(startISO));
}

function finLegible(startISO: string, minutos: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(new Date(startISO).getTime() + minutos * 60_000));
}

/**
 * ISO → el texto en hora local que el servidor vuelve a interpretar con la zona.
 *
 * Mandar el ISO directo funcionaría, pero obligaría a tener dos caminos de parseo según
 * quién manda el formulario, y el de la carga manual ya usa este.
 */
function toLocalInput(iso: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date(iso)).replace(" ", "T");
}
