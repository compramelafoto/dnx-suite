"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Gift, X } from "lucide-react";
import { formatMinorArs } from "@/lib/membership/money";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import { selectRange, type GridCell, type WeekGrid } from "@/lib/bookings/week-grid";
import type { FreeHoursBalance } from "@/lib/bookings/free-hours";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { CalendarToolbar } from "@/components/bookings/calendar/calendar-toolbar";
import { MiniMonth } from "@/components/bookings/calendar/mini-month";
import { TimeGrid, minuteToPx } from "@/components/bookings/calendar/time-grid";
import { quoteForSpace, type CustomerType, type SpacePricing } from "@/lib/bookings/pricing";

type ExtraVista = {
  id: string;
  name: string;
  available: boolean;
  requiresConfirmation: boolean;
  precioLabel: string;
};

type EspacioVista = { id: string; name: string; color: string; priceLabel: string; href: string };

type MiReserva = {
  id: string;
  ymd: string;
  startMinute: number;
  endMinute: number;
  statusLabel: string;
};

const ALTO_HORA = 48;

/**
 * Elegir horario y extras, con la forma de Google Calendar. La usan el portal del socio y la
 * página pública de reservas del no socio: cambian la acción, el tipo de cliente y los datos
 * de contacto, no la forma de elegir.
 *
 * Dos toques: uno en la hora de inicio y otro en la de fin. Todo lo del medio se pinta del
 * color del espacio, como el evento que Google dibuja mientras lo creás. Funciona con el
 * pulgar, sin arrastrar.
 *
 * Lo que se muestra es una estimación: **el servidor recalcula todo al recibir**. Si entre
 * que la pantalla se pintó y la persona confirma alguien tomó el horario, el servidor lo
 * rechaza con su motivo.
 */
export function ReservarForm({
  action,
  basePath,
  hiddenFields,
  contactFields,
  customerType,
  spaceId,
  spaceName,
  spaceColor,
  description,
  spaces,
  pricing,
  freeHours,
  grid,
  ymd,
  todayYmd,
  nowMinute,
  canGoBack,
  mine,
  extras,
  vocabulary,
}: {
  /** La acción del servidor que crea la reserva. */
  action: (formData: FormData) => Promise<void>;
  /** Dónde vive la pantalla, para las flechas y el mes en miniatura. */
  basePath: string;
  /** Campos ocultos propios de quien usa el formulario (p. ej. el slug de la institución). */
  hiddenFields?: React.ReactNode;
  /** Nombre, correo y teléfono, para quien no tiene ficha de socio. Van en la tarjeta final. */
  contactFields?: React.ReactNode;
  customerType: CustomerType;
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  description: string | null;
  spaces: EspacioVista[];
  pricing: SpacePricing;
  freeHours: FreeHoursBalance;
  grid: WeekGrid;
  ymd: string;
  todayYmd: string;
  nowMinute: number;
  canGoBack: boolean;
  mine: MiReserva[];
  extras: ExtraVista[];
  vocabulary: PersonVocabulary;
}) {
  const [primero, setPrimero] = useState<string | null>(null);
  const [segundo, setSegundo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [extrasElegidos, setExtrasElegidos] = useState<string[]>([]);

  const seleccion = useMemo(() => {
    if (!primero) return null;
    const r = selectRange(grid, primero, segundo ?? primero);
    return r.ok ? r : null;
  }, [grid, primero, segundo]);

  /** Dónde cae la selección: el día y sus minutos, para dibujarla como un bloque. */
  const bloqueElegido = (() => {
    if (!seleccion) return null;
    for (const dia of grid.days) {
      const dentro = dia.cells.filter(
        (c) => c.startISO >= seleccion.startISO && c.endISO <= seleccion.endISO,
      );
      if (dentro.length > 0) {
        return {
          ymd: dia.ymd,
          startMinute: dentro[0].minuteOfDay,
          endMinute: dentro[dentro.length - 1].minuteOfDay + grid.slotMinutes,
        };
      }
    }
    return null;
  })();

  function tocar(startISO: string) {
    setAviso(null);

    // Sin nada elegido, o ya con un rango cerrado: este toque empieza uno nuevo.
    if (!primero || segundo) {
      setPrimero(startISO);
      setSegundo(null);
      return;
    }
    // Segundo toque: cierra el rango, si se puede.
    const r = selectRange(grid, primero, startISO);
    if (!r.ok) {
      setAviso(r.motivo);
      setPrimero(startISO);
      setSegundo(null);
      return;
    }
    setSegundo(startISO);
  }

  function limpiar() {
    setPrimero(null);
    setSegundo(null);
    setAviso(null);
  }

  const minutos = seleccion?.minutes ?? 0;
  // El mismo cálculo que hace el servidor al recibir: lo que se muestra es lo que se cobra.
  const quote = quoteForSpace(pricing, {
    minutes: minutos,
    customerType,
    freeMinutesAvailable: freeHours.availableMinutes,
  });
  const porBloque = quote.mode === "BLOCK";
  const nombrePaquete = pricing.blockMinutes ? `paquete de ${pricing.blockMinutes / 60} h` : "jornada";
  const nombrePaquetes = pricing.blockMinutes
    ? `paquetes de ${pricing.blockMinutes / 60} h`
    : "jornadas";
  // Reservar menos de lo que dura el paquete paga el paquete entero: hay que decirlo.
  const cubre = porBloque
    ? pricing.blockMinutes
      ? (quote.blocksBilled + quote.blocksFree) * pricing.blockMinutes
      : null
    : null;

  const horas = (m: number) => {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`;
  };

  const ultimaFila = grid.rows[grid.rows.length - 1] ?? 0;
  const desdeHora = Math.floor((grid.rows[0] ?? 0) / 60);
  const hastaHora = Math.max(desdeHora + 1, Math.ceil((ultimaFila + grid.slotMinutes) / 60));
  const altoCelda = (grid.slotMinutes / 60) * ALTO_HORA;
  const primerDiaLibre =
    grid.days.find((d) => d.cells.some((c) => c.state === "FREE"))?.ymd ?? todayYmd;
  const unSoloToque = Boolean(primero && !segundo && seleccion);

  const saldo =
    freeHours.grantedMinutes > 0 ? (
      <p className="flex items-start gap-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-success-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--fo-success)]">
        <Gift className="mt-0.5 size-4 flex-none" />
        <span>
          Te quedan <strong>{horas(freeHours.availableMinutes)}</strong> de{" "}
          {horas(freeHours.grantedMinutes)} bonificadas este mes.
        </span>
      </p>
    ) : null;

  /** Agrupa casilleros seguidos con el mismo estado, para dibujar un bloque y no diez. */
  const tramos = (cells: GridCell[]) => {
    const salida: { state: GridCell["state"]; cells: GridCell[] }[] = [];
    for (const c of cells) {
      const ultimo = salida[salida.length - 1];
      if (ultimo && ultimo.state === c.state && c.state !== "FREE") ultimo.cells.push(c);
      else salida.push({ state: c.state, cells: [c] });
    }
    return salida;
  };

  return (
    <form
      action={action}
      className="overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]"
    >
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="paymentMethod" value="MERCADO_PAGO" />
      {hiddenFields}
      {seleccion ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(seleccion.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(seleccion.endISO)} />
        </>
      ) : null}

      <aside className="hidden space-y-6 border-r border-[var(--fo-border)] p-4 lg:block">
        <MiniMonth
          selectedYmd={ymd}
          todayYmd={todayYmd}
          view="semana"
          basePath={basePath}
          keep={{ espacio: spaceId }}
        />

        <div className="space-y-1.5">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
            ¿Qué querés reservar?
          </p>
          <ul className="space-y-0.5">
            {spaces.map((s) => {
              const activo = s.id === spaceId;
              return (
                <li key={s.id}>
                  <Link
                    href={s.href}
                    aria-current={activo ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-[var(--fo-radius-sm)] px-3 py-2 text-sm transition-colors ${
                      activo
                        ? "bg-[var(--fo-accent-soft)] font-semibold text-[var(--fo-text)]"
                        : "text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)]"
                    }`}
                  >
                    <span className="size-2.5 flex-none rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-[11px] font-normal tabular-nums text-[var(--fo-muted)]">
                        {s.priceLabel}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {saldo}

        <ul className="space-y-2 px-2 text-xs text-[var(--fo-muted)]">
          <li className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-sm border border-[var(--fo-border-strong)] bg-[var(--fo-surface)]" />
            Libre
          </li>
          <li className="flex items-center gap-2">
            <span className="fo-cal-hatch inline-block size-3 rounded-sm" />
            Ocupado
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-sm bg-[var(--fo-surface-muted)]" />
            Cerrado o ya pasó
          </li>
          {customerType === "MEMBER" ? (
            <li className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm bg-[var(--fo-accent)]" />
              Tus reservas
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="min-w-0">
        <CalendarToolbar
          view="semana"
          ymd={ymd}
          todayYmd={todayYmd}
          basePath={basePath}
          keep={{ espacio: spaceId }}
          views={["semana"]}
          canGoBack={canGoBack}
        />

        {/* Teléfono: el panel izquierdo no entra, los espacios y el saldo van arriba. */}
        <div className="space-y-2 border-b border-[var(--fo-border)] px-3 py-2.5 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {spaces.map((s) => {
              const activo = s.id === spaceId;
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  aria-current={activo ? "page" : undefined}
                  className="flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    borderColor: s.color,
                    background: activo ? s.color : "transparent",
                    color: activo ? "#fff" : s.color,
                  }}
                >
                  {s.name}
                </Link>
              );
            })}
          </div>
          {saldo}
        </div>

        <div className="border-b border-[var(--fo-border)] px-4 py-3">
          <p className="text-base font-semibold text-[var(--fo-text)]">{spaceName}</p>
          {description ? (
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{description}</p>
          ) : null}
        </div>

        {grid.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--fo-muted-soft)]">
            Este espacio todavía no tiene horarios cargados.
          </p>
        ) : (
          <TimeGrid
            days={grid.days.map((d) => d.ymd)}
            todayYmd={todayYmd}
            nowMinute={nowMinute}
            startHour={desdeHora}
            endHour={hastaHora}
            hourHeight={ALTO_HORA}
            initialMobileDay={primerDiaLibre}
            renderColumn={(diaYmd) => {
              const dia = grid.days.find((d) => d.ymd === diaYmd);
              if (!dia) return null;
              const propias = mine.filter((m) => m.ymd === diaYmd);
              return (
                <>
                  {tramos(dia.cells).map((t) => {
                    const top = minuteToPx(t.cells[0].minuteOfDay, desdeHora, ALTO_HORA);
                    const alto = t.cells.length * altoCelda;
                    if (t.state === "FREE") {
                      const c = t.cells[0];
                      return (
                        <button
                          key={c.startISO}
                          type="button"
                          onClick={() => tocar(c.startISO)}
                          aria-label={`${dia.label} ${minuteOfDayToLabel(c.minuteOfDay)}, libre`}
                          className="group absolute inset-x-0 z-0 px-1.5 text-left text-xs font-semibold text-transparent transition-colors hover:bg-[var(--fo-accent-soft)] hover:text-[var(--fo-accent-hover)] focus-visible:bg-[var(--fo-accent-soft)] focus-visible:text-[var(--fo-accent-hover)] focus-visible:outline-none"
                          style={{ top, height: alto }}
                        >
                          + {minuteOfDayToLabel(c.minuteOfDay)}
                        </button>
                      );
                    }
                    if (t.state === "TAKEN") {
                      return (
                        <div
                          key={t.cells[0].startISO}
                          className="fo-cal-hatch absolute inset-x-0.5 overflow-hidden rounded-md border border-[var(--fo-border)] px-1.5 py-1 text-[11px] text-[var(--fo-muted)]"
                          style={{ top: top + 1, height: alto - 2 }}
                        >
                          Ocupado
                        </div>
                      );
                    }
                    return (
                      <div
                        key={t.cells[0].startISO}
                        className={`absolute inset-x-0 overflow-hidden px-1.5 py-1 text-[11px] text-[var(--fo-muted-soft)] ${
                          t.state === "PAST" ? "bg-[var(--fo-bg)]" : "bg-[var(--fo-surface-muted)]/70"
                        }`}
                        style={{ top, height: alto }}
                      >
                        {t.state === "LATER" && alto >= 40 ? "Todavía no se puede reservar" : null}
                      </div>
                    );
                  })}

                  {propias.map((m) => {
                    const top = minuteToPx(m.startMinute, desdeHora, ALTO_HORA);
                    const alto = minuteToPx(m.endMinute, desdeHora, ALTO_HORA) - top;
                    return (
                      <div
                        key={m.id}
                        className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md bg-[var(--fo-accent)] px-1.5 py-1 text-xs leading-tight text-white"
                        style={{ top: top + 1, height: alto - 2 }}
                      >
                        <span className="block truncate font-semibold">Tu reserva</span>
                        {alto >= 40 ? (
                          <span className="block truncate opacity-90">
                            {minuteOfDayToLabel(m.startMinute)} – {minuteOfDayToLabel(m.endMinute)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}

                  {bloqueElegido && bloqueElegido.ymd === diaYmd
                    ? (() => {
                        const top = minuteToPx(bloqueElegido.startMinute, desdeHora, ALTO_HORA);
                        const alto =
                          minuteToPx(bloqueElegido.endMinute, desdeHora, ALTO_HORA) - top;
                        return (
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0.5 z-20 overflow-hidden rounded-md px-1.5 py-1 text-xs leading-tight text-white shadow-[var(--fo-shadow-md)] ring-2 ring-white"
                            style={{ top: top + 1, height: alto - 2, background: spaceColor }}
                          >
                            <span className="block truncate font-semibold">{spaceName}</span>
                            <span className="block truncate opacity-90">
                              {minuteOfDayToLabel(bloqueElegido.startMinute)} –{" "}
                              {minuteOfDayToLabel(bloqueElegido.endMinute)}
                            </span>
                          </div>
                        );
                      })()
                    : null}
                </>
              );
            }}
          />
        )}

        <div className="space-y-4 p-4">
          {aviso ? (
            <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-warning)]">
              {aviso}
            </p>
          ) : null}

          {!seleccion ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Tocá la hora en que querés empezar. Para reservar varias horas seguidas, tocá
              después la última.
            </p>
          ) : (
            <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-4 shadow-[var(--fo-shadow-xs)]">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 size-3.5 flex-none rounded" style={{ background: spaceColor }} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-snug text-[var(--fo-text)]">
                    {spaceName}
                  </p>
                  <p className="text-sm text-[var(--fo-text-secondary)] first-letter:uppercase">
                    {rangoLegible(seleccion.startISO, seleccion.endISO)} · {horas(minutos)}
                  </p>
                  {unSoloToque ? (
                    <p className="mt-1 text-xs text-[var(--fo-muted)]">
                      Para más de una hora, tocá la última hora que querés del mismo día.
                    </p>
                  ) : null}
                </div>
                <button type="button" onClick={limpiar} className="fo-icon-btn" aria-label="Quitar el horario elegido">
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-3 space-y-1 pl-[1.625rem] text-sm">
                {porBloque ? (
                  <>
                    {quote.blocksFree > 0 ? (
                      <p className="text-[var(--fo-success)]">
                        {quote.blocksFree === 1
                          ? `1 ${nombrePaquete} ${pricing.blockMinutes ? "bonificado" : "bonificada"} por ser ${vocabulary.singular} — sin cargo`
                          : `${quote.blocksFree} ${nombrePaquetes} bonificados por ser ${vocabulary.singular} — sin cargo`}
                      </p>
                    ) : null}
                    {quote.blocksBilled > 0 ? (
                      <p className="text-[var(--fo-text-secondary)]">
                        {pricing.blockMinutes
                          ? `${quote.blocksBilled} × ${nombrePaquete} a ${formatMinorArs(quote.blockPriceMinor)} — ${formatMinorArs(quote.totalMinor)}`
                          : `Jornada — ${formatMinorArs(quote.totalMinor)}`}
                      </p>
                    ) : null}
                    {cubre !== null && cubre > minutos ? (
                      <p className="text-xs text-[var(--fo-muted)]">
                        Se cobra el {nombrePaquete} completo: si querés, tocá otra hora del mismo
                        día y usás hasta {horas(cubre)} por el mismo precio.
                      </p>
                    ) : null}
                    {!pricing.blockMinutes && quote.blocksBilled > 0 ? (
                      <p className="text-xs text-[var(--fo-muted)]">
                        Se cobra por jornada: el precio es el mismo dure lo que dure.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    {quote.freeMinutesUsed > 0 ? (
                      <p className="text-[var(--fo-success)]">
                        {`${horas(quote.freeMinutesUsed)} bonificadas por ser ${vocabulary.singular} — sin cargo`}
                      </p>
                    ) : null}
                    {quote.billedMinutes > 0 ? (
                      <p className="text-[var(--fo-text-secondary)]">
                        {horas(quote.billedMinutes)} × {formatMinorArs(quote.hourlyPriceMinor)} por hora —{" "}
                        {formatMinorArs(quote.totalMinor)}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {contactFields ? (
                <div className="mt-3 space-y-3 border-t border-[var(--fo-border)] pl-[1.625rem] pt-3">
                  {contactFields}
                </div>
              ) : null}

              {extras.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-[var(--fo-border)] pl-[1.625rem] pt-3">
                  <span className="fo-label">Extras</span>
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
                        className="mt-0.5"
                      />
                      <span>
                        {e.name} — {e.precioLabel}
                        {!e.available ? (
                          <span className="block text-xs text-[var(--fo-danger)]">
                            Sin disponibilidad en ese horario. Probá con otro.
                          </span>
                        ) : e.requiresConfirmation ? (
                          <span className="block text-xs text-[var(--fo-muted)]">
                            Hay que coordinarlo: tu reserva queda a la espera y no se te cobra
                            hasta que la institución confirme.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                  {extrasElegidos.length > 0 ? (
                    <p className="text-xs text-[var(--fo-muted)]">
                      Los extras se suman al total. Las horas bonificadas cubren el espacio, no
                      el equipamiento.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-[1.625rem]">
                <p className="text-base font-semibold tabular-nums text-[var(--fo-text)]">
                  {extrasElegidos.length > 0 ? "Espacio" : "Total"} {formatMinorArs(quote.totalMinor)}
                </p>
                <button type="submit" className="fo-btn fo-btn-primary text-sm">
                  {quote.totalMinor > 0 || extrasElegidos.length > 0
                    ? "Reservar y pagar"
                    : `Reservar ${horas(minutos)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </form>
  );
}

const TZ = "America/Argentina/Buenos_Aires";

function rangoLegible(startISO: string, endISO: string): string {
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(startISO));
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dia}, de ${hora.format(new Date(startISO))} a ${hora.format(new Date(endISO))}`;
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
