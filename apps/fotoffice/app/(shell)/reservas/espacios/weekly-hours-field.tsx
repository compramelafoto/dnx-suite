"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Clock3, Copy, Plus } from "lucide-react";
import { minuteOfDayToLabel, BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import {
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  copyDayTo,
  endOptions,
  formatRange,
  nextRangeFor,
  overlappingIndexes,
  rangeIssue,
  startOptions,
  toWeekRanges,
  type HourRange,
  type WeekRanges,
} from "@/lib/bookings/weekly-hours-form";
import type { WeeklyHour } from "@/lib/bookings/availability";

/**
 * Días y horarios de un espacio, una fila por día.
 *
 * Antes esto eran siete recuadros de texto donde había que escribir `09:00-13:00` a mano. La
 * validación era buena pero llegaba tarde: el error aparecía después de guardar y sin decir
 * cuál de los catorce tramos estaba mal. Acá los desplegables sólo ofrecen horas que caen en
 * la grilla del espacio, así que la mayoría de esos errores ya no se pueden cometer.
 *
 * Lo que viaja al servidor sigue siendo exactamente lo mismo —un `hours.{día}` por tramo, con
 * formato `09:00-13:00`—, así que `parseSpaceForm` no cambia y sigue siendo la última palabra.
 */
export function WeeklyHoursField({
  initialHours,
  slotMinutes,
  minBookingMinutes,
}: {
  initialHours: WeeklyHour[];
  slotMinutes: number;
  minBookingMinutes: number;
}) {
  const [semana, setSemana] = useState<WeekRanges>(() => toWeekRanges(initialHours));
  const [copiandoDe, setCopiandoDe] = useState<number | null>(null);

  function cambiarDia(weekday: number, tramos: HourRange[]) {
    setSemana((actual) => actual.map((dia, i) => (i === weekday ? tramos : dia)));
  }

  function agregarTramo(weekday: number) {
    const dia = semana[weekday] ?? [];
    const nuevo = nextRangeFor(dia, slotMinutes, minBookingMinutes);
    if (!nuevo) return;
    cambiarDia(weekday, [...dia, nuevo]);
  }

  function quitarTramo(weekday: number, indice: number) {
    cambiarDia(weekday, (semana[weekday] ?? []).filter((_, i) => i !== indice));
  }

  function editarTramo(weekday: number, indice: number, cambio: Partial<HourRange>) {
    cambiarDia(
      weekday,
      (semana[weekday] ?? []).map((tramo, i) => (i === indice ? { ...tramo, ...cambio } : tramo)),
    );
  }

  const sinHorarios = semana.every((dia) => dia.length === 0);

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <Clock3 aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--fo-muted)]" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Días y horarios</h2>
          <p className="fo-helper">
            Cuándo se puede reservar este espacio. Un día puede tener más de un tramo —por
            ejemplo mañana y tarde—. Un día sin tramos es un día en que no se alquila.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--fo-border-muted)] border-y border-[var(--fo-border-muted)]">
        {WEEKDAY_NAMES.map((nombre, weekday) => {
          const tramos = semana[weekday] ?? [];
          const pisados = overlappingIndexes(tramos);
          const hayLugar = nextRangeFor(tramos, slotMinutes, minBookingMinutes) !== null;

          return (
            <div
              key={weekday}
              className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-start sm:gap-4"
            >
              <div
                className="w-16 shrink-0 pt-2 text-sm font-semibold text-[var(--fo-text-secondary)]"
                title={nombre}
              >
                {WEEKDAY_SHORT[weekday]}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                {tramos.length === 0 ? (
                  <div className="flex h-9 items-center gap-2">
                    <span className="text-sm text-[var(--fo-muted)]">No disponible</span>
                    <button
                      type="button"
                      className="fo-icon-btn"
                      title={`Agregar un horario el ${nombre.toLowerCase()}`}
                      aria-label={`Agregar un horario el ${nombre.toLowerCase()}`}
                      onClick={() => agregarTramo(weekday)}
                    >
                      <Plus aria-hidden className="size-4" />
                    </button>
                  </div>
                ) : (
                  tramos.map((tramo, indice) => {
                    const problema = rangeIssue(tramo, { slotMinutes, minBookingMinutes });
                    const pisa = pisados.includes(indice);
                    return (
                      <div key={indice} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="hidden"
                            name={`hours.${weekday}`}
                            value={formatRange(tramo)}
                          />
                          <SelectorDeHora
                            value={tramo.start}
                            options={startOptions(slotMinutes, [tramo.start])}
                            invalid={problema !== null || pisa}
                            label={`${nombre}, inicio del tramo ${indice + 1}`}
                            onChange={(start) => {
                              // Mover el inicio arrastra el fin: si no, el tramo queda dado
                              // vuelta y hay que arreglarlo en dos pasos.
                              const duracion = tramo.end - tramo.start;
                              editarTramo(weekday, indice, {
                                start,
                                end: Math.min(start + duracion, 24 * 60),
                              });
                            }}
                          />
                          <span aria-hidden className="text-sm text-[var(--fo-muted)]">
                            –
                          </span>
                          <SelectorDeHora
                            value={tramo.end}
                            options={endOptions(slotMinutes, tramo.start, minBookingMinutes, [
                              tramo.end,
                            ])}
                            invalid={problema !== null || pisa}
                            label={`${nombre}, fin del tramo ${indice + 1}`}
                            onChange={(end) => editarTramo(weekday, indice, { end })}
                          />

                          <button
                            type="button"
                            className="fo-icon-btn fo-icon-btn-danger"
                            title="Quitar este horario"
                            aria-label={`Quitar el tramo ${indice + 1} del ${nombre.toLowerCase()}`}
                            onClick={() => quitarTramo(weekday, indice)}
                          >
                            <Ban aria-hidden className="size-4" />
                          </button>

                          {indice === 0 ? (
                            <>
                              <button
                                type="button"
                                className="fo-icon-btn"
                                title="Agregar otro horario a este día"
                                aria-label={`Agregar otro horario el ${nombre.toLowerCase()}`}
                                disabled={!hayLugar}
                                onClick={() => agregarTramo(weekday)}
                              >
                                <Plus aria-hidden className="size-4" />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  className="fo-icon-btn"
                                  title="Copiar este día a otros"
                                  aria-label={`Copiar los horarios del ${nombre.toLowerCase()} a otros días`}
                                  aria-expanded={copiandoDe === weekday}
                                  onClick={() =>
                                    setCopiandoDe((actual) =>
                                      actual === weekday ? null : weekday,
                                    )
                                  }
                                >
                                  <Copy aria-hidden className="size-4" />
                                </button>
                                {copiandoDe === weekday ? (
                                  <CopiarADias
                                    origen={weekday}
                                    onCancelar={() => setCopiandoDe(null)}
                                    onAplicar={(destinos) => {
                                      setSemana((actual) =>
                                        copyDayTo(actual, weekday, destinos),
                                      );
                                      setCopiandoDe(null);
                                    }}
                                  />
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>

                        {problema ? (
                          <p className="text-xs text-[var(--fo-danger)]">{problema}</p>
                        ) : pisa ? (
                          <p className="text-xs text-[var(--fo-warning)]">
                            Se superpone con otro horario del mismo día.
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="fo-helper">
          Horario de {BOOKINGS_TIME_ZONE.split("/").at(-1)?.replace(/_/g, " ")}, el mismo que ve
          el socio.
        </p>
        {sinHorarios ? (
          <p className="text-xs font-medium text-[var(--fo-warning)]">
            Sin horarios el espacio no se puede reservar.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SelectorDeHora({
  value,
  options,
  invalid,
  label,
  onChange,
}: {
  value: number;
  options: number[];
  invalid: boolean;
  label: string;
  onChange: (minuto: number) => void;
}) {
  return (
    <select
      className="fo-time-select"
      data-invalid={invalid ? "true" : undefined}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((minuto) => (
        <option key={minuto} value={minuto}>
          {minuteOfDayToLabel(minuto)}
        </option>
      ))}
    </select>
  );
}

/** El panelito de "copiar a": los otros seis días, para no repetir la misma carga siete veces. */
function CopiarADias({
  origen,
  onAplicar,
  onCancelar,
}: {
  origen: number;
  onAplicar: (destinos: number[]) => void;
  onCancelar: () => void;
}) {
  const [elegidos, setElegidos] = useState<number[]>([]);
  const panel = useRef<HTMLDivElement>(null);

  // Cerrar con Escape o tocando afuera: el panel tapa las filas de abajo y quedarse abierto
  // haría creer que el resto del formulario no responde.
  useEffect(() => {
    function afuera(e: MouseEvent) {
      if (panel.current && !panel.current.contains(e.target as Node)) onCancelar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [onCancelar]);

  const destinos = WEEKDAY_NAMES.map((_, i) => i).filter((i) => i !== origen);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={`Copiar los horarios del ${WEEKDAY_NAMES[origen]!.toLowerCase()}`}
      className="fo-popover absolute right-0 top-10 z-20 w-56 space-y-2 p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
        Copiar a
      </p>
      <div className="space-y-1">
        {destinos.map((weekday) => (
          <label key={weekday} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={elegidos.includes(weekday)}
              onChange={(e) =>
                setElegidos((actual) =>
                  e.target.checked
                    ? [...actual, weekday]
                    : actual.filter((d) => d !== weekday),
                )
              }
            />
            {WEEKDAY_NAMES[weekday]}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="fo-btn fo-btn-primary h-8 min-h-0 px-3 text-xs"
          disabled={elegidos.length === 0}
          onClick={() => onAplicar(elegidos)}
        >
          Copiar
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-ghost h-8 min-h-0 px-3 text-xs"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
