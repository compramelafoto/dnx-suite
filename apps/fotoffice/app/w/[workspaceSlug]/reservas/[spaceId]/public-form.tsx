"use client";

import { useMemo, useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import { selectRange, type WeekGrid } from "@/lib/bookings/week-grid";
import { createPublicBookingAction } from "../actions";

type ExtraVista = {
  id: string;
  name: string;
  available: boolean;
  requiresConfirmation: boolean;
  precioLabel: string;
};

/**
 * Reservar sin ser socio. Tarifa plena, sin horas bonificadas y solo Mercado Pago.
 *
 * Lo que muestra es una estimación: el servidor recalcula todo al recibir.
 */
export function PublicBookingForm({
  workspaceSlug,
  spaceId,
  hourlyPriceMinor,
  defaultEmail,
  grid,
  extras,
  tituloSemana,
  semanaAnterior,
  semanaSiguiente,
}: {
  workspaceSlug: string;
  spaceId: string;
  hourlyPriceMinor: number;
  defaultEmail: string;
  grid: WeekGrid;
  extras: ExtraVista[];
  tituloSemana: string;
  semanaAnterior: string | null;
  semanaSiguiente: string;
}) {
  const [primero, setPrimero] = useState<string | null>(null);
  const [segundo, setSegundo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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
    if (!primero || segundo) {
      setPrimero(startISO);
      setSegundo(null);
      return;
    }
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
  const espacioMinor = Math.round((hourlyPriceMinor * minutos) / 60);

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

  return (
    <form action={createPublicBookingAction} className="fo-card space-y-5 p-5">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="spaceId" value={spaceId} />
      {seleccion ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(seleccion.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(seleccion.endISO)} />
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium capitalize">{tituloSemana}</p>
        <div className="flex gap-2">
          {semanaAnterior ? (
            <a
              href={`/w/${workspaceSlug}/reservas/${spaceId}?semana=${semanaAnterior}`}
              className="fo-btn fo-btn-secondary text-xs"
            >
              ← Semana anterior
            </a>
          ) : null}
          <a
            href={`/w/${workspaceSlug}/reservas/${spaceId}?semana=${semanaSiguiente}`}
            className="fo-btn fo-btn-secondary text-xs"
          >
            Semana siguiente →
          </a>
        </div>
      </div>

      <p className="text-xs text-[var(--fo-muted)]">
        Tocá la hora de inicio y después la de fin. Podés reservar varias horas seguidas.
      </p>

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
          <span className="text-sm font-medium capitalize">{grid.days[diaVisible]?.label}</span>
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
          {(grid.days[diaVisible]?.cells ?? [])
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
                {c.state === "TAKEN" ? (
                  <span className="block text-[10px] font-normal">Ocupado</span>
                ) : null}
              </button>
            ))}
          {(grid.days[diaVisible]?.cells ?? []).every((c) => c.state === "CLOSED") ? (
            <p className="col-span-3 py-6 text-center text-sm text-[var(--fo-muted-soft)]">
              Este día el espacio no abre.
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="w-14" />
              {grid.days.map((d) => (
                <th key={d.ymd} className="pb-1 text-xs font-medium capitalize text-[var(--fo-muted)]">
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

      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}

      {extras.length > 0 ? (
        <div className="space-y-2">
          <span className="fo-label">Extras</span>
          {extras.map((e) => (
            <label
              key={e.id}
              className={`flex items-start gap-2 text-sm ${e.available ? "" : "opacity-50"}`}
            >
              <input type="checkbox" name="extraIds" value={e.id} disabled={!e.available} />
              <span>
                {e.name} — {e.precioLabel}
                {!e.available ? (
                  <span className="block text-xs text-[var(--fo-danger)]">
                    Sin disponibilidad en ese horario.
                  </span>
                ) : e.requiresConfirmation ? (
                  <span className="block text-xs text-[var(--fo-muted)]">
                    Hay que coordinarlo: tu pedido queda a la espera y no se te cobra hasta que
                    la institución confirme.
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="contactName">
            Tu nombre
          </label>
          <input id="contactName" name="contactName" className="fo-input" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="contactEmail">
            Email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className="fo-input"
            defaultValue={defaultEmail}
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="contactPhone">
            Teléfono
          </label>
          <input id="contactPhone" name="contactPhone" className="fo-input" />
        </div>
      </div>

      {seleccion ? (
        <p className="border-t border-[var(--fo-border)] pt-4 text-sm">
          {minutos / 60} h × {formatMinorArs(hourlyPriceMinor)} por hora —{" "}
          {formatMinorArs(espacioMinor)}, más los extras que elijas.
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={!seleccion}>
          {seleccion ? "Reservar y pagar" : "Elegí un horario"}
        </button>
      </div>
    </form>
  );
}

/** ISO → el texto en hora local que el servidor vuelve a interpretar con la zona. */
function toLocalInput(iso: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date(iso)).replace(" ", "T");
}
