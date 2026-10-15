"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Plus, X } from "lucide-react";
import { CalendarToolbar } from "@/components/bookings/calendar/calendar-toolbar";
import { MiniMonth } from "@/components/bookings/calendar/mini-month";
import { TimeGrid, minuteToPx } from "@/components/bookings/calendar/time-grid";
import {
  calendarHref,
  dayNumberYmd,
  layoutOverlaps,
  sameMonthYmd,
  visibleDays,
  weekdayIndexYmd,
  type CalendarView,
} from "@/lib/bookings/calendar-view";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import {
  approveBookingAction,
  cancelBookingAction,
  confirmTransferAction,
  rejectBookingAction,
} from "./actions";

export type AgendaEvent = {
  id: string;
  spaceId: string;
  ymd: string;
  startMinute: number;
  endMinute: number;
  status: string;
  contactName: string;
  isMember: boolean;
  paymentMethod: string;
  totalLabel: string;
  holdExpiresLabel: string | null;
  extraLines: { id: string; name: string; amountLabel: string; pending: boolean }[];
};

type AgendaSpace = { id: string; name: string; color: string; active: boolean };

const ETIQUETA_ESTADO: Record<string, string> = {
  HOLD: "Esperando pago",
  PENDING_APPROVAL: "A aprobar",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

const DIA_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const ALTO_HORA = 48;
const OCULTOS_KEY = "fo-agenda-espacios-ocultos";

const inactiva = (e: AgendaEvent) => e.status === "CANCELLED" || e.status === "EXPIRED";
/** Las que todavía esperan algo de alguien: se dibujan con borde punteado, sin relleno. */
const pendiente = (e: AgendaEvent) => e.status === "HOLD" || e.status === "PENDING_APPROVAL";

const rango = (e: AgendaEvent) =>
  `${minuteOfDayToLabel(e.startMinute)} – ${minuteOfDayToLabel(e.endMinute)}`;

/**
 * La agenda del equipo con forma de Google Calendar: el mes en miniatura y los espacios a la
 * izquierda, la semana (o el día, o el mes) a la derecha, y cada reserva como un bloque del
 * color de su espacio. Tocar una reserva abre su ficha con las acciones de siempre.
 */
export function AgendaCalendar({
  view,
  ymd,
  todayYmd,
  nowMinute,
  startHour,
  endHour,
  spaces,
  events,
  canOperate,
  volver,
}: {
  view: CalendarView;
  ymd: string;
  todayYmd: string;
  nowMinute: number;
  startHour: number;
  endHour: number;
  spaces: AgendaSpace[];
  events: AgendaEvent[];
  canOperate: boolean;
  volver: string;
}) {
  // Qué espacios se esconden: preferencia de quien mira, se recuerda en su navegador.
  const ocultosGuardados = useSyncExternalStore(suscribirOcultos, leerOcultos, () => "[]");
  const ocultos = useMemo(() => parsearOcultos(ocultosGuardados), [ocultosGuardados]);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const alternarEspacio = (id: string) => {
    guardarOcultos(ocultos.includes(id) ? ocultos.filter((x) => x !== id) : [...ocultos, id]);
  };

  const espacioPorId = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const visibles = useMemo(
    () =>
      events.filter(
        (e) => !ocultos.includes(e.spaceId) && (verCanceladas || !inactiva(e)),
      ),
    [events, ocultos, verCanceladas],
  );
  const porDia = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    for (const e of visibles) m.set(e.ymd, [...(m.get(e.ymd) ?? []), e]);
    return m;
  }, [visibles]);

  const seleccionada = abierta ? events.find((e) => e.id === abierta) ?? null : null;
  const dias = visibleDays(view, ymd);
  const aDia = (d: string) => calendarHref("/reservas", { ymd: d, view: "dia" });
  const color = (e: AgendaEvent) => espacioPorId.get(e.spaceId)?.color ?? "#64748b";
  const pendientes = events.filter((e) => pendiente(e)).length;

  const filtroEspacios = (
    <ul className="space-y-0.5">
      {spaces.map((s) => {
        const visible = !ocultos.includes(s.id);
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => alternarEspacio(s.id)}
              aria-pressed={visible}
              className="flex w-full items-center gap-2.5 rounded-[var(--fo-radius-sm)] px-2 py-1.5 text-left text-sm text-[var(--fo-text-secondary)] transition-colors hover:bg-[var(--fo-surface-hover)]"
            >
              <span
                className="flex size-4 flex-none items-center justify-center rounded border-2 text-white"
                style={{ borderColor: s.color, background: visible ? s.color : "transparent" }}
              >
                {visible ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{s.name}</span>
              {!s.active ? (
                <span className="ml-auto text-[11px] text-[var(--fo-muted-soft)]">inactivo</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden space-y-6 border-r border-[var(--fo-border)] p-4 lg:block">
        {canOperate ? (
          <Link
            href="/reservas/nueva"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-surface)] px-4 py-3 text-sm font-semibold text-[var(--fo-text)] shadow-[var(--fo-shadow-md)] transition-colors hover:bg-[var(--fo-surface-hover)]"
          >
            <Plus className="size-5 text-[var(--fo-accent)]" />
            Cargar reserva
          </Link>
        ) : null}

        <MiniMonth selectedYmd={ymd} todayYmd={todayYmd} view={view} basePath="/reservas" />

        <div className="space-y-1.5">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
            Espacios
          </p>
          {filtroEspacios}
        </div>

        <div className="space-y-2 px-2 text-xs text-[var(--fo-muted)]">
          <p className="flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm border-[1.5px] border-dashed border-[var(--fo-muted)]" />
            A aprobar o esperando pago
          </p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={verCanceladas}
              onChange={(ev) => setVerCanceladas(ev.target.checked)}
            />
            Mostrar canceladas y vencidas
          </label>
        </div>
      </aside>

      <section className="min-w-0">
        <CalendarToolbar
          view={view}
          ymd={ymd}
          todayYmd={todayYmd}
          basePath="/reservas"
          views={["dia", "semana", "mes"]}
        >
          {pendientes > 0 ? (
            <span className="rounded-full bg-[var(--fo-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--fo-warning)]">
              {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}
            </span>
          ) : null}
        </CalendarToolbar>

        {/* En pantallas chicas el panel izquierdo no entra: los espacios van arriba. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--fo-border)] px-3 py-2 lg:hidden">
          {spaces.map((s) => {
            const visible = !ocultos.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => alternarEspacio(s.id)}
                aria-pressed={visible}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  borderColor: s.color,
                  background: visible ? s.color : "transparent",
                  color: visible ? "#fff" : s.color,
                }}
              >
                {s.name}
              </button>
            );
          })}
          {canOperate ? (
            <Link href="/reservas/nueva" className="fo-btn fo-btn-primary ml-auto min-h-8 px-3 text-xs">
              <Plus className="size-4" />
              Cargar
            </Link>
          ) : null}
        </div>

        {view === "mes" ? (
          <VistaMes
            key={ymd}
            ymd={ymd}
            todayYmd={todayYmd}
            porDia={porDia}
            color={color}
            aDia={aDia}
            onOpen={setAbierta}
          />
        ) : (
          <TimeGrid
            key={`${view}-${dias[0]}`}
            days={dias}
            todayYmd={todayYmd}
            nowMinute={nowMinute}
            startHour={startHour}
            endHour={endHour}
            hourHeight={ALTO_HORA}
            initialMobileDay={dias.includes(todayYmd) ? todayYmd : ymd}
            dayHref={view === "semana" ? aDia : undefined}
            isDimmed={(d) => d < todayYmd}
            renderColumn={(d) =>
              layoutOverlaps(porDia.get(d) ?? []).map((e) => {
                const top = minuteToPx(e.startMinute, startHour, ALTO_HORA);
                const alto = Math.max(
                  20,
                  minuteToPx(e.endMinute, startHour, ALTO_HORA) - top - 2,
                );
                const c = color(e);
                const corto = alto < 40;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setAbierta(e.id)}
                    className={`absolute z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight transition-shadow hover:z-30 hover:shadow-[var(--fo-shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fo-accent)] ${
                      inactiva(e) ? "line-through opacity-50" : d < todayYmd ? "opacity-70" : ""
                    }`}
                    style={{
                      top: top + 1,
                      height: alto,
                      left: `calc(${(e.column / e.columns) * 100}% + 2px)`,
                      width: `calc(${100 / e.columns}% - 5px)`,
                      ...(pendiente(e) || inactiva(e)
                        ? {
                            background: "var(--fo-surface)",
                            border: `1.5px dashed ${c}`,
                            color: c,
                          }
                        : { background: c, color: "#fff", border: "1px solid var(--fo-surface)" }),
                    }}
                  >
                    <span className="block truncate font-semibold">
                      {e.contactName}
                      {corto ? `, ${minuteOfDayToLabel(e.startMinute)}` : ""}
                    </span>
                    {!corto ? <span className="block truncate opacity-90">{rango(e)}</span> : null}
                    {alto >= 64 ? (
                      <span className="block truncate opacity-90">
                        {pendiente(e) ? ETIQUETA_ESTADO[e.status] : espacioPorId.get(e.spaceId)?.name}
                      </span>
                    ) : null}
                  </button>
                );
              })
            }
          />
        )}
      </section>

      {seleccionada ? (
        <FichaReserva
          reserva={seleccionada}
          espacio={espacioPorId.get(seleccionada.spaceId)}
          canOperate={canOperate}
          volver={volver}
          onClose={() => setAbierta(null)}
        />
      ) : null}
    </div>
  );
}

// ── Espacios escondidos ──
// Se guardan en el navegador de quien mira. Si el navegador no deja guardar (ventana privada,
// datos bloqueados), la preferencia vive en memoria mientras dure la visita.
const avisarCambio = new Set<() => void>();
let ocultosEnMemoria = "[]";

function leerOcultos(): string {
  try {
    return window.localStorage.getItem(OCULTOS_KEY) ?? ocultosEnMemoria;
  } catch {
    return ocultosEnMemoria;
  }
}

function guardarOcultos(ids: string[]) {
  ocultosEnMemoria = JSON.stringify(ids);
  try {
    window.localStorage.setItem(OCULTOS_KEY, ocultosEnMemoria);
  } catch {
    // Queda en memoria.
  }
  for (const avisar of avisarCambio) avisar();
}

function suscribirOcultos(avisar: () => void) {
  avisarCambio.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    avisarCambio.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

function parsearOcultos(texto: string): string[] {
  try {
    const valor = JSON.parse(texto);
    return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function VistaMes({
  ymd,
  todayYmd,
  porDia,
  color,
  aDia,
  onOpen,
}: {
  ymd: string;
  todayYmd: string;
  porDia: Map<string, AgendaEvent[]>;
  color: (e: AgendaEvent) => string;
  aDia: (d: string) => string;
  onOpen: (id: string) => void;
}) {
  const dias = visibleDays("mes", ymd);
  const MAX = 3;
  return (
    <div className="fo-cal-fade">
      <div className="grid grid-cols-7 border-b border-[var(--fo-border)]">
        {DIA_CORTO.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-semibold tracking-wider text-[var(--fo-muted)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const delDia = porDia.get(d) ?? [];
          const hoy = d === todayYmd;
          const fuera = !sameMonthYmd(d, ymd);
          return (
            <div
              key={d}
              className={`min-h-24 border-b border-[var(--fo-border)] p-1 sm:min-h-28 ${
                weekdayIndexYmd(d) > 0 ? "border-l" : ""
              } ${fuera ? "bg-[var(--fo-bg)]" : ""}`}
            >
              <div className="mb-1 text-center">
                <Link
                  href={aDia(d)}
                  className={`inline-flex size-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors ${
                    hoy
                      ? "bg-[var(--fo-accent)] font-semibold text-white"
                      : fuera
                        ? "text-[var(--fo-muted-soft)] hover:bg-[var(--fo-surface-hover)]"
                        : "font-medium text-[var(--fo-text)] hover:bg-[var(--fo-surface-hover)]"
                  }`}
                >
                  {dayNumberYmd(d)}
                </Link>
              </div>
              <div className="space-y-0.5">
                {delDia.slice(0, MAX).map((e) => {
                  const c = color(e);
                  const lleno = !pendiente(e) && !inactiva(e);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpen(e.id)}
                      className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight hover:brightness-95 ${
                        inactiva(e) ? "line-through opacity-50" : ""
                      }`}
                      style={
                        lleno
                          ? { background: c, color: "#fff" }
                          : { color: "var(--fo-text-secondary)" }
                      }
                    >
                      {!lleno ? (
                        <span
                          className="size-2 flex-none rounded-full border-[1.5px] border-dashed"
                          style={{ borderColor: c }}
                        />
                      ) : null}
                      <span className="truncate">
                        <span className="tabular-nums">{minuteOfDayToLabel(e.startMinute)}</span>{" "}
                        <span className="font-semibold">{e.contactName}</span>
                      </span>
                    </button>
                  );
                })}
                {delDia.length > MAX ? (
                  <Link
                    href={aDia(d)}
                    className="block rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
                  >
                    {delDia.length - MAX} más
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * La ficha de una reserva, como la tarjeta que abre Google al tocar un evento. Trae las
 * mismas acciones que tenía la lista de antes: confirmar transferencia, aprobar (quitando
 * los extras que no se consiguieron), rechazar con motivo y cancelar.
 */
function FichaReserva({
  reserva,
  espacio,
  canOperate,
  volver,
  onClose,
}: {
  reserva: AgendaEvent;
  espacio: AgendaSpace | undefined;
  canOperate: boolean;
  volver: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const alApretar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [onClose]);

  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${reserva.ymd}T12:00:00Z`));
  const terminada = reserva.status === "CANCELLED" || reserva.status === "EXPIRED";
  const color = espacio?.color ?? "#64748b";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reserva de ${reserva.contactName}`}
        className="fo-cal-fade max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-5 shadow-[var(--fo-shadow-md)] sm:max-w-md sm:rounded-[var(--fo-radius)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-1.5 size-3.5 flex-none rounded" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug text-[var(--fo-text)]">
              {reserva.contactName}
            </h3>
            <p className="text-sm text-[var(--fo-text-secondary)] first-letter:uppercase">
              {fecha} · {rango(reserva)}
            </p>
          </div>
          <button type="button" className="fo-icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        <dl className="mt-4 space-y-1.5 pl-[1.625rem] text-sm">
          <div className="flex gap-2">
            <dt className="w-20 flex-none text-[var(--fo-muted)]">Espacio</dt>
            <dd className="text-[var(--fo-text)]">{espacio?.name ?? "Espacio"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 flex-none text-[var(--fo-muted)]">Quién</dt>
            <dd className="text-[var(--fo-text)]">{reserva.isMember ? "Socio" : "No socio"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 flex-none text-[var(--fo-muted)]">Estado</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  reserva.status === "CONFIRMED"
                    ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]"
                    : terminada
                      ? "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
                      : "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]"
                }`}
              >
                {ETIQUETA_ESTADO[reserva.status] ?? reserva.status}
              </span>
              {reserva.holdExpiresLabel ? (
                <span className="ml-2 text-xs text-[var(--fo-muted)]">
                  vence {reserva.holdExpiresLabel}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 flex-none text-[var(--fo-muted)]">Total</dt>
            <dd className="font-semibold tabular-nums text-[var(--fo-text)]">{reserva.totalLabel}</dd>
          </div>
          {reserva.extraLines.length > 0 ? (
            <div className="flex gap-2">
              <dt className="w-20 flex-none text-[var(--fo-muted)]">Extras</dt>
              <dd className="text-[var(--fo-text)]">
                {reserva.extraLines
                  .map((l) => `${l.name}${l.pending ? " (a confirmar)" : ""}`)
                  .join(", ")}
              </dd>
            </div>
          ) : null}
        </dl>

        {canOperate && !terminada ? (
          <div className="mt-5 space-y-3 border-t border-[var(--fo-border)] pt-4">
            {reserva.status === "HOLD" && reserva.paymentMethod === "TRANSFERENCIA" ? (
              <form action={confirmTransferAction}>
                <input type="hidden" name="bookingId" value={reserva.id} />
                <input type="hidden" name="volver" value={volver} />
                <button type="submit" className="fo-btn fo-btn-primary w-full text-sm">
                  Confirmar transferencia
                </button>
              </form>
            ) : null}

            {reserva.status === "PENDING_APPROVAL" ? (
              <>
                <form action={approveBookingAction} className="space-y-2">
                  <input type="hidden" name="bookingId" value={reserva.id} />
                  <input type="hidden" name="volver" value={volver} />
                  {reserva.extraLines
                    .filter((l) => l.pending)
                    .map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="removeExtraLineIds" value={l.id} />
                        No se pudo conseguir: {l.name} ({l.amountLabel})
                      </label>
                    ))}
                  <button type="submit" className="fo-btn fo-btn-primary w-full text-sm">
                    Aprobar
                  </button>
                  <p className="text-xs text-[var(--fo-muted)]">
                    Al aprobar se le manda el enlace de pago con el total definitivo. Lo que
                    marques como no conseguido se descuenta.
                  </p>
                </form>
                <form action={rejectBookingAction} className="flex gap-2">
                  <input type="hidden" name="bookingId" value={reserva.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <input
                    name="reason"
                    className="fo-input min-w-0 flex-1 text-sm"
                    placeholder="Motivo del rechazo"
                  />
                  <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                    Rechazar
                  </button>
                </form>
              </>
            ) : null}

            {reserva.status !== "PENDING_APPROVAL" ? (
              <form action={cancelBookingAction}>
                <input type="hidden" name="bookingId" value={reserva.id} />
                <input type="hidden" name="volver" value={volver} />
                <button type="submit" className="fo-btn fo-btn-danger-outline w-full text-sm">
                  Cancelar reserva
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
