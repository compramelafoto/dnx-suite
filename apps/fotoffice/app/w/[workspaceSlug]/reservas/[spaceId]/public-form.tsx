"use client";

import { useMemo, useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import { createPublicBookingAction } from "../actions";

type Slot = { startISO: string; endISO: string; ymd: string; diaLabel: string; horaLabel: string };
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
  slots,
  extras,
}: {
  workspaceSlug: string;
  spaceId: string;
  hourlyPriceMinor: number;
  defaultEmail: string;
  slots: Slot[];
  extras: ExtraVista[];
}) {
  const [elegido, setElegido] = useState<Slot | null>(null);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Slot[]>();
    for (const s of slots) mapa.set(s.ymd, [...(mapa.get(s.ymd) ?? []), s]);
    return [...mapa.entries()];
  }, [slots]);

  const minutos = elegido
    ? (new Date(elegido.endISO).getTime() - new Date(elegido.startISO).getTime()) / 60_000
    : 0;
  const espacioMinor = Math.round((hourlyPriceMinor * minutos) / 60);

  return (
    <form action={createPublicBookingAction} className="fo-card space-y-5 p-5">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="spaceId" value={spaceId} />
      {elegido ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(elegido.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(elegido.endISO)} />
        </>
      ) : null}

      <div className="space-y-3">
        <span className="fo-label">Elegí un horario</span>
        {porDia.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">
            No hay horarios libres en las próximas dos semanas.
          </p>
        ) : (
          porDia.map(([ymd, delDia]) => (
            <div key={ymd} className="space-y-1">
              <p className="text-xs capitalize text-[var(--fo-muted)]">{delDia[0].diaLabel}</p>
              <div className="flex flex-wrap gap-2">
                {delDia.map((s) => (
                  <button
                    key={s.startISO}
                    type="button"
                    onClick={() => setElegido(s)}
                    className={`fo-btn text-xs ${elegido?.startISO === s.startISO ? "fo-btn-primary" : "fo-btn-secondary"}`}
                  >
                    {s.horaLabel}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

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

      {elegido ? (
        <p className="border-t border-[var(--fo-border)] pt-4 text-sm">
          {minutos / 60} h × {formatMinorArs(hourlyPriceMinor)} por hora —{" "}
          {formatMinorArs(espacioMinor)}, más los extras que elijas.
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={!elegido}>
          {elegido ? "Reservar y pagar" : "Elegí un horario"}
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
