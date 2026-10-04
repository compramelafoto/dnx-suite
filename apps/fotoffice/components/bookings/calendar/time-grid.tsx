"use client";

import Link from "next/link";
import { useState } from "react";
import { dayNumberYmd, weekdayIndexYmd } from "@/lib/bookings/calendar-view";

const DIA_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

/** Píxeles desde el borde de arriba de la grilla para un minuto del día. */
export function minuteToPx(minute: number, startHour: number, hourHeight: number): number {
  return ((minute - startHour * 60) / 60) * hourHeight;
}

/**
 * El esqueleto de la vista por horas: encabezado de días, regla de horas a la izquierda,
 * líneas de cada hora y la línea roja de "ahora". Lo que va adentro de cada columna lo pone
 * quien la usa —reservas en el panel, horarios libres en el portal—.
 *
 * En el teléfono siete columnas no entran: se ve un día por vez y arriba queda la tira de la
 * semana para cambiar de día con el pulgar, como en la aplicación de Google.
 */
export function TimeGrid({
  days,
  todayYmd,
  nowMinute,
  startHour,
  endHour,
  hourHeight,
  initialMobileDay,
  dayHref,
  isDimmed,
  renderColumn,
}: {
  days: string[];
  todayYmd: string;
  /** Minuto del día local en este momento, para la línea de "ahora". */
  nowMinute: number;
  startHour: number;
  endHour: number;
  hourHeight: number;
  /** El día que se muestra primero en el teléfono. */
  initialMobileDay?: string;
  /** A dónde lleva tocar el número de un día. Sin esto, el número no es enlace. */
  dayHref?: (ymd: string) => string;
  /** Días que se pintan apagados (los que ya pasaron). */
  isDimmed?: (ymd: string) => boolean;
  renderColumn: (ymd: string) => React.ReactNode;
}) {
  const [diaMovil, setDiaMovil] = useState(() => {
    const i = days.indexOf(initialMobileDay ?? todayYmd);
    return i >= 0 ? i : 0;
  });
  const varios = days.length > 1;
  const horas = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const alto = (endHour - startHour) * hourHeight;
  const ahoraVisible = nowMinute >= startHour * 60 && nowMinute <= endHour * 60;

  const columnas = {
    "--fo-cal-cols": days.length,
  } as React.CSSProperties;

  const encabezado = (ymd: string) => {
    const hoy = ymd === todayYmd;
    const numero = (
      <span
        className={`mx-auto flex size-10 items-center justify-center rounded-full text-xl tabular-nums transition-colors ${
          hoy
            ? "bg-[var(--fo-accent)] font-semibold text-white"
            : `text-[var(--fo-text)] ${dayHref ? "hover:bg-[var(--fo-surface-hover)]" : ""}`
        }`}
      >
        {dayNumberYmd(ymd)}
      </span>
    );
    return (
      <>
        <span
          className={`block text-[11px] font-semibold tracking-wider ${hoy ? "text-[var(--fo-accent-hover)]" : "text-[var(--fo-muted)]"}`}
        >
          {DIA_CORTO[weekdayIndexYmd(ymd)]}
        </span>
        {dayHref ? (
          <Link href={dayHref(ymd)} aria-label={`Ver el día ${dayNumberYmd(ymd)}`}>
            {numero}
          </Link>
        ) : (
          numero
        )}
      </>
    );
  };

  return (
    <div>
      {varios ? (
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--fo-border)] px-2 py-2 md:hidden">
          {days.map((ymd, i) => {
            const hoy = ymd === todayYmd;
            const activo = i === diaMovil;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setDiaMovil(i)}
                aria-pressed={activo}
                className={`flex min-w-11 flex-1 flex-col items-center rounded-[var(--fo-radius-sm)] py-1.5 transition-colors ${
                  activo ? "bg-[var(--fo-accent-soft)]" : "hover:bg-[var(--fo-surface-hover)]"
                }`}
              >
                <span
                  className={`text-[10px] font-semibold tracking-wider ${hoy ? "text-[var(--fo-accent-hover)]" : "text-[var(--fo-muted)]"}`}
                >
                  {DIA_CORTO[weekdayIndexYmd(ymd)]}
                </span>
                <span
                  className={`mt-0.5 flex size-8 items-center justify-center rounded-full text-base tabular-nums ${
                    hoy
                      ? "bg-[var(--fo-accent)] font-semibold text-white"
                      : activo
                        ? "font-semibold text-[var(--fo-accent-hover)]"
                        : "text-[var(--fo-text)]"
                  }`}
                >
                  {dayNumberYmd(ymd)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        style={columnas}
        className={`grid grid-cols-[3.25rem_minmax(0,1fr)] border-b border-[var(--fo-border)] md:grid-cols-[3.25rem_repeat(var(--fo-cal-cols),minmax(0,1fr))] ${varios ? "hidden md:grid" : ""}`}
      >
        <div />
        {days.map((ymd) => (
          <div key={ymd} className="py-2 text-center">
            {encabezado(ymd)}
          </div>
        ))}
      </div>

      <div
        style={columnas}
        className="fo-cal-fade grid grid-cols-[3.25rem_minmax(0,1fr)] md:grid-cols-[3.25rem_repeat(var(--fo-cal-cols),minmax(0,1fr))]"
      >
        <div className="relative" style={{ height: alto }}>
          {horas.slice(1).map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-[var(--fo-muted-soft)]"
              style={{ top: (h - startHour) * hourHeight }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((ymd, i) => (
          <div
            key={ymd}
            className={`relative border-l border-[var(--fo-border)] ${
              varios && i !== diaMovil ? "hidden md:block" : ""
            } ${isDimmed?.(ymd) ? "bg-[var(--fo-bg)]" : ""}`}
            style={{
              height: alto,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, var(--fo-border-muted) ${hourHeight - 1}px, var(--fo-border-muted) ${hourHeight}px)`,
            }}
          >
            {renderColumn(ymd)}
            {ymd === todayYmd && ahoraVisible ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -left-1 right-0 z-20 h-0.5 bg-[var(--fo-danger)]"
                style={{ top: minuteToPx(nowMinute, startHour, hourHeight) }}
              >
                <span className="absolute -top-[5px] left-0 size-3 rounded-full bg-[var(--fo-danger)]" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
