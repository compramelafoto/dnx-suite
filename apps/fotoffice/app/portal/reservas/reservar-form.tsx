"use client";

import { useMemo, useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import type { FreeHoursBalance } from "@/lib/bookings/free-hours";
import { createPortalBookingAction } from "./actions";

type Slot = {
  startISO: string;
  endISO: string;
  ymd: string;
  diaLabel: string;
  horaLabel: string;
};

type ExtraVista = {
  id: string;
  name: string;
  available: boolean;
  unitsFree: number | null;
  requiresConfirmation: boolean;
  precioLabel: string;
};

/**
 * Elegir horario y extras.
 *
 * Es un componente de navegador porque el socio necesita ver el precio moverse mientras
 * elige — sin eso tendría que confirmar a ciegas y descubrir el total en Mercado Pago.
 *
 * Lo que se muestra acá es una estimación: **el servidor recalcula todo al recibir**. Si
 * entre que la pantalla se pintó y la persona confirma alguien tomó el último flash, el
 * total real puede ser menor. Nunca mayor.
 */
export function ReservarForm({
  spaceId,
  spaceName,
  description,
  memberHourlyPriceMinor,
  freeHours,
  slots,
  extras,
}: {
  spaceId: string;
  spaceName: string;
  description: string | null;
  memberHourlyPriceMinor: number;
  freeHours: FreeHoursBalance;
  slots: Slot[];
  extras: ExtraVista[];
}) {
  const [elegido, setElegido] = useState<Slot | null>(null);
  const [extrasElegidos, setExtrasElegidos] = useState<string[]>([]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Slot[]>();
    for (const s of slots) mapa.set(s.ymd, [...(mapa.get(s.ymd) ?? []), s]);
    return [...mapa.entries()];
  }, [slots]);

  const minutos = elegido
    ? (new Date(elegido.endISO).getTime() - new Date(elegido.startISO).getTime()) / 60_000
    : 0;
  const bonificados = Math.min(minutos, freeHours.availableMinutes);
  const cobrados = minutos - bonificados;
  const espacioMinor = Math.round((memberHourlyPriceMinor * cobrados) / 60);

  const horas = (m: number) => {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`;
  };

  return (
    <form action={createPortalBookingAction} className="fo-card space-y-5 p-5">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="paymentMethod" value="MERCADO_PAGO" />
      {elegido ? (
        <>
          <input type="hidden" name="startAt" value={toLocalInput(elegido.startISO)} />
          <input type="hidden" name="endAt" value={toLocalInput(elegido.endISO)} />
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
                    Hay que coordinarlo: tu reserva queda a la espera y no se te cobra hasta
                    que la institución confirme.
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {elegido ? (
        <div className="space-y-1 border-t border-[var(--fo-border)] pt-4">
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
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={!elegido}>
          {elegido ? "Reservar" : "Elegí un horario"}
        </button>
      </div>
    </form>
  );
}

/**
 * ISO → el texto que espera el servidor, en hora local.
 *
 * El servidor lo vuelve a interpretar con `parseLocalDateTime` en la zona de la institución.
 * Mandar el ISO directo funcionaría, pero obligaría a tener dos caminos de parseo según
 * quién manda el formulario, y el de la carga manual ya usa este.
 */
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
