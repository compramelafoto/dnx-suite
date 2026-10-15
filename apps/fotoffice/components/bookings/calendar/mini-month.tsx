"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  calendarHref,
  dayNumberYmd,
  firstOfMonthYmd,
  miniMonthWeeks,
  mondayOfYmd,
  monthLabelYmd,
  sameMonthYmd,
  type CalendarView,
} from "@/lib/bookings/calendar-view";

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * El mes en miniatura, siempre a la vista, como en Google Calendar.
 *
 * Es la respuesta a "¿cómo vuelvo?": no hay un selector que se abre y se cierra, el almanaque
 * está siempre ahí. Sus flechas sólo hojean meses dentro del recuadro —no cambian lo que se
 * mira— y recién tocar un día lleva a esa fecha. La semana que se está mirando queda marcada.
 */
export function MiniMonth({
  selectedYmd,
  todayYmd,
  view,
  basePath,
  keep,
}: {
  selectedYmd: string;
  todayYmd: string;
  view: CalendarView;
  basePath: string;
  keep?: Record<string, string | undefined>;
}) {
  const [mes, setMes] = useState(() => firstOfMonthYmd(selectedYmd));
  // Si la fecha elegida cambia desde afuera (flechas, "Hoy"), el recuadro la acompaña.
  const [seguido, setSeguido] = useState(selectedYmd);
  if (seguido !== selectedYmd) {
    setSeguido(selectedYmd);
    setMes(firstOfMonthYmd(selectedYmd));
  }

  const lunesElegido = mondayOfYmd(selectedYmd);

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center justify-between pl-1">
        <span className="text-sm font-semibold text-[var(--fo-text)] first-letter:uppercase">
          {monthLabelYmd(mes)}
        </span>
        <span className="flex">
          <button
            type="button"
            className="fo-icon-btn h-7 w-7"
            aria-label="Mes anterior"
            onClick={() => setMes((m) => firstOfMonthYmd(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="fo-icon-btn h-7 w-7"
            aria-label="Mes siguiente"
            onClick={() => setMes((m) => firstOfMonthYmd(m, 1))}
          >
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>
      <table className="w-full border-collapse text-center text-xs tabular-nums">
        <thead>
          <tr className="text-[var(--fo-muted-soft)]">
            {INICIALES.map((d, i) => (
              <th key={i} className="h-7 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {miniMonthWeeks(mes).map((semana) => {
            const marcada = view === "semana" && semana[0] === lunesElegido;
            return (
              <tr key={semana[0]}>
                {semana.map((ymd, i) => {
                  const hoy = ymd === todayYmd;
                  const elegido = view !== "semana" && ymd === selectedYmd;
                  const fuera = !sameMonthYmd(ymd, mes);
                  return (
                    <td
                      key={ymd}
                      className={`p-0 ${marcada ? "bg-[var(--fo-accent-soft)]" : ""} ${marcada && i === 0 ? "rounded-l-full" : ""} ${marcada && i === 6 ? "rounded-r-full" : ""}`}
                    >
                      <Link
                        href={calendarHref(basePath, { ymd, view }, keep)}
                        aria-current={ymd === selectedYmd ? "date" : undefined}
                        className={`mx-auto flex size-7 items-center justify-center rounded-full transition-colors ${
                          hoy
                            ? "bg-[var(--fo-accent)] font-semibold text-white"
                            : elegido
                              ? "bg-[var(--fo-accent-soft)] font-semibold text-[var(--fo-accent-hover)]"
                              : fuera
                                ? "text-[var(--fo-muted-soft)] hover:bg-[var(--fo-surface-hover)]"
                                : "text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)]"
                        }`}
                      >
                        {dayNumberYmd(ymd)}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
