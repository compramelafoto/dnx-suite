import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  calendarHref,
  calendarTitle,
  shiftYmd,
  type CalendarView,
} from "@/lib/bookings/calendar-view";

const NOMBRE_VISTA: Record<CalendarView, string> = { dia: "Día", semana: "Semana", mes: "Mes" };

const PASO: Record<CalendarView, string> = { dia: "día", semana: "semana", mes: "mes" };

/**
 * La barra de arriba, en el orden de Google Calendar: Hoy · ‹ › · el título · las vistas.
 *
 * Son enlaces y no botones: cada vista tiene su dirección, así que "atrás" del navegador
 * vuelve a la semana anterior que se miró y una semana se puede mandar por WhatsApp.
 */
export function CalendarToolbar({
  view,
  ymd,
  todayYmd,
  basePath,
  keep,
  views,
  canGoBack = true,
  children,
}: {
  view: CalendarView;
  ymd: string;
  todayYmd: string;
  basePath: string;
  keep?: Record<string, string | undefined>;
  /** Las vistas que se ofrecen. Con una sola, no se muestra el selector. */
  views: CalendarView[];
  /** Falso para no ofrecer volver a una semana que ya pasó entera. */
  canGoBack?: boolean;
  /** Lo que va a la derecha, antes del selector de vista. */
  children?: React.ReactNode;
}) {
  const href = (target: string, v: CalendarView = view) =>
    calendarHref(basePath, { ymd: target, view: views.length > 1 ? v : undefined }, keep);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[var(--fo-border)] px-3 py-2.5 sm:px-4">
      <Link
        href={href(todayYmd)}
        className="inline-flex h-9 items-center rounded-full border border-[var(--fo-border-strong)] px-4 text-sm font-semibold text-[var(--fo-text-secondary)] transition-colors hover:bg-[var(--fo-surface-hover)]"
      >
        Hoy
      </Link>
      <span className="flex items-center">
        {canGoBack ? (
          <Link
            href={href(shiftYmd(view, ymd, -1))}
            className="fo-icon-btn size-9"
            aria-label={`${PASO[view]} anterior`}
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <span className="fo-icon-btn size-9 opacity-35" aria-hidden>
            <ChevronLeft className="size-5" />
          </span>
        )}
        <Link
          href={href(shiftYmd(view, ymd, 1))}
          className="fo-icon-btn size-9"
          aria-label={`${PASO[view]} siguiente`}
        >
          <ChevronRight className="size-5" />
        </Link>
      </span>
      <h2 className="min-w-0 text-lg font-semibold tracking-tight text-[var(--fo-text)] first-letter:uppercase sm:text-xl">
        {calendarTitle(view, ymd)}
      </h2>
      <span className="flex-1" />
      {children}
      {views.length > 1 ? (
        <nav
          aria-label="Vista"
          className="flex overflow-hidden rounded-full border border-[var(--fo-border-strong)]"
        >
          {views.map((v) => (
            <Link
              key={v}
              href={href(ymd, v)}
              aria-current={v === view ? "page" : undefined}
              className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
                v === view
                  ? "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]"
                  : "text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
              }`}
            >
              {NOMBRE_VISTA[v]}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
