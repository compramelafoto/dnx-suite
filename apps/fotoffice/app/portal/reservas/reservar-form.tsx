"use client";

import { useMemo, useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import { selectRange, type WeekGrid } from "@/lib/bookings/week-grid";
import type { FreeHoursBalance } from "@/lib/bookings/free-hours";
import { createPortalBookingAction } from "./actions";

type ExtraVista = {
  id: string;
  name: string;
  available: boolean;
  requiresConfirmation: boolean;
  precioLabel: string;
};

/**
 * Elegir horario y extras.
 *
 * Dos toques: uno en la hora de inicio y otro en la de fin. Todo lo del medio se pinta. Es
 * lo que hace cualquier calendario y funciona con el pulgar, sin arrastrar.
 *
 * Lo que se muestra es una estimación: **el servidor recalcula todo al recibir**. Si entre
 * que la pantalla se pintó y la persona confirma alguien tomó el horario, el servidor lo
 * rechaza con su motivo.
 */
export function ReservarForm({
  spaceId,
  spaceName,
  description,
  memberHourlyPriceMinor,
  freeHours,
  grid,
  extras,
  semanaAnterior,
  semanaSiguiente,
  tituloSemana,
}: {
  spaceId: string;
  spaceName: string;
  description: string | null;
  memberHourlyPriceMinor: number;
  freeHours: FreeHoursBalance;
  grid: WeekGrid;
  extras: ExtraVista[];
  semanaAnterior: string | null;
  semanaSiguiente: string;
  tituloSemana: string;
}) {
  const [primero, setPrimero] = useState<string | null>(null);
  const [segundo, setSegundo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [extrasElegidos, setExtrasElegidos] = useState<string[]>([]);
  // En el teléfono se ve un día por vez: siete columnas no entran en 375 píxeles.
  const [diaVisible, setDiaVisible] = useState(() => {
    const conLibres = grid.days.findIndex((d) => d.cells.some((c) => c.state === "FREE"));
    return conLibres >= 0 ? conLibres : 0;
  });

  const seleccion = useMemo(() => {
    if (!primero) return null;
    const r = selectRange(grid, primero, segundo ?? primero);
    return r.ok ? r : null;
  }, [grid, primero, segundo]);

  const elegidas = useMemo(() => {
    if (!seleccion) return new Set<string>();
    const dentro = new Set<string>();
    for (const dia of grid.days) {
      for (const c of dia.cells) {
        if (c.startISO >= seleccion.startISO && c.endISO <= seleccion.endISO) dentro.add(c.startISO);
      }
    }
    return dentro;
  }, [grid, seleccion]);

  function tocar(startISO: string, state: string) {
    setAviso(null);
    if (state !== "FREE") return;

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

  const minutos = seleccion?.minutes ?? 0;
  const bonificados = Math.min(minutos, freeHours.availableMinutes);
  const cobrados = minutos - bonificados;
  const espacioMinor = Math.round((memberHourlyPriceMinor * cobrados) / 60);

  const horas = (m: number) => {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`;
  };

  const claseCelda = (state: string, elegida: boolean) => {
    if (elegida) return "bg-[var(--fo-accent)] text-white border-[var(--fo-accent)]";
    if (state === "FREE")
      return "bg-[var(--fo-surface)] border-[var(--fo-border-strong)] hover:bg-[var(--fo-accent-soft)] cursor-pointer";
    if (state === "TAKEN")
      return "bg-[var(--fo-surface-muted)] border-[var(--fo-border)] text-[var(--fo-muted-soft)] cursor-not-allowed";
    if (state === "PAST")
      return "bg-[var(--fo-bg)] border-[var(--fo-border-muted)] text-[var(--fo-muted-soft)] cursor-not-allowed";
    return "bg-transparent border-transparent cursor-default";
  };

  const etiqueta = (state: string) =>
    state === "TAKEN" ? "Ocupado" : state === "PAST" ? "Pasó" : state === "CLOSED" ? "" : "";

  return (
    <form action={createPortalBookingAction} className="fo-card space-y-5 p-5">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="paymentMethod" value="MERCADO_PAGO" />
      {seleccion ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(seleccion.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(seleccion.endISO)} />
        </>
      ) : null}

      <div className="space-y-1">
        <h2 className="text-base font-semibold">{spaceName}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{description}</p>
        ) : null}
        {freeHours.grantedMinutes > 0 ? (
          <p className="text-sm text-[var(--fo-success)]">
            Te quedan {horas(freeHours.availableMinutes)} de {horas(freeHours.grantedMinutes)}{" "}
            bonificadas este mes.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fo-border)] pt-4">
        <p className="text-sm font-medium capitalize">{tituloSemana}</p>
        <div className="flex gap-2">
          {semanaAnterior ? (
            <a
              href={`/portal/reservas?espacio=${spaceId}&semana=${semanaAnterior}`}
              className="fo-btn fo-btn-secondary text-xs"
            >
              ← Semana anterior
            </a>
          ) : (
            <span className="fo-btn fo-btn-secondary pointer-events-none text-xs opacity-40">
              ← Semana anterior
            </span>
          )}
          <a
            href={`/portal/reservas?espacio=${spaceId}&semana=${semanaSiguiente}`}
            className="fo-btn fo-btn-secondary text-xs"
          >
            Semana siguiente →
          </a>
        </div>
      </div>

      <p className="text-xs text-[var(--fo-muted)]">
        Tocá la hora de inicio y después la de fin. Podés reservar varias horas seguidas.
      </p>

      {grid.rows.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted-soft)]">
          Este espacio todavía no tiene horarios cargados.
        </p>
      ) : (
        <>
          {/* Teléfono: un día por vez. Siete columnas no entran en 375 píxeles. */}
          <div className="md:hidden">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDiaVisible((d) => Math.max(0, d - 1))}
                disabled={diaVisible === 0}
                className="fo-btn fo-btn-secondary text-xs disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-sm font-medium capitalize">{grid.days[diaVisible].label}</span>
              <button
                type="button"
                onClick={() => setDiaVisible((d) => Math.min(6, d + 1))}
                disabled={diaVisible === 6}
                className="fo-btn fo-btn-secondary text-xs disabled:opacity-40"
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {grid.days[diaVisible].cells
                .filter((c) => c.state !== "CLOSED")
                .map((c) => (
                  <button
                    key={c.startISO}
                    type="button"
                    onClick={() => tocar(c.startISO, c.state)}
                    disabled={c.state !== "FREE"}
                    aria-pressed={elegidas.has(c.startISO)}
                    className={`min-h-11 rounded-[var(--fo-radius-sm)] border px-2 py-2 text-sm font-medium transition-colors ${claseCelda(c.state, elegidas.has(c.startISO))}`}
                  >
                    {minuteOfDayToLabel(c.minuteOfDay)}
                    {c.state !== "FREE" ? (
                      <span className="block text-[10px] font-normal">{etiqueta(c.state)}</span>
                    ) : null}
                  </button>
                ))}
              {grid.days[diaVisible].cells.every((c) => c.state === "CLOSED") ? (
                <p className="col-span-3 py-6 text-center text-sm text-[var(--fo-muted-soft)]">
                  Este día el espacio no abre.
                </p>
              ) : null}
            </div>
          </div>

          {/* Pantalla grande: la semana entera. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-1 text-center">
              <thead>
                <tr>
                  <th className="w-14" />
                  {grid.days.map((d) => (
                    <th
                      key={d.ymd}
                      className="pb-1 text-xs font-medium capitalize text-[var(--fo-muted)]"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, iFila) => (
                  <tr key={row}>
                    <th className="pr-2 text-right align-middle text-xs font-normal tabular-nums text-[var(--fo-muted)]">
                      {minuteOfDayToLabel(row)}
                    </th>
                    {grid.days.map((d) => {
                      const c = d.cells[iFila];
                      const elegida = elegidas.has(c.startISO);
                      return (
                        <td key={`${d.ymd}-${row}`} className="p-0">
                          <button
                            type="button"
                            onClick={() => tocar(c.startISO, c.state)}
                            disabled={c.state !== "FREE"}
                            aria-pressed={elegida}
                            aria-label={`${d.label} ${minuteOfDayToLabel(row)} — ${c.state === "FREE" ? "libre" : c.state === "TAKEN" ? "ocupado" : c.state === "PAST" ? "ya pasó" : "cerrado"}`}
                            className={`h-9 w-full rounded-[var(--fo-radius-sm)] border text-xs font-medium transition-colors ${claseCelda(c.state, elegida)}`}
                          >
                            {c.state === "TAKEN" ? "·" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-[var(--fo-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-[var(--fo-border-strong)] bg-[var(--fo-surface)]" />
              Libre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-[var(--fo-border)] bg-[var(--fo-surface-muted)]" />
              Ocupado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-[var(--fo-accent)] bg-[var(--fo-accent)]" />
              Tu selección
            </span>
          </div>
        </>
      )}

      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}

      {extras.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
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
              />
              <span>
                {e.name} — {e.precioLabel}
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
        </div>
      ) : null}

      {seleccion ? (
        <div className="space-y-1 border-t border-[var(--fo-border)] pt-4">
          <p className="text-sm font-medium">
            {horas(minutos)} — {rangoLegible(seleccion.startISO, seleccion.endISO)}
          </p>
          {bonificados > 0 ? (
            <p className="text-sm text-[var(--fo-success)]">
              {horas(bonificados)} bonificadas por ser socio — sin cargo
            </p>
          ) : null}
          {cobrados > 0 ? (
            <p className="text-sm">
              {horas(cobrados)} × {formatMinorArs(memberHourlyPriceMinor)} por hora —{" "}
              {formatMinorArs(espacioMinor)}
            </p>
          ) : null}
          {extrasElegidos.length > 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Más los extras elegidos. Las horas bonificadas cubren el espacio, no el
              equipamiento.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={!seleccion}>
          {seleccion ? `Reservar ${horas(minutos)}` : "Elegí un horario"}
        </button>
        {seleccion ? (
          <button
            type="button"
            onClick={() => {
              setPrimero(null);
              setSegundo(null);
              setAviso(null);
            }}
            className="text-sm text-[var(--fo-muted)] underline underline-offset-4"
          >
            Empezar de nuevo
          </button>
        ) : null}
      </div>
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
