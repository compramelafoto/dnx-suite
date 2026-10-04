"use client";

import { useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import type { SpaceRecord } from "@/lib/bookings/repository";
import { saveSpaceAction } from "../actions";
import { WeeklyHoursField } from "./weekly-hours-field";

/**
 * Alta y edición de un espacio.
 *
 * El formulario corre en el navegador por una sola razón: la grilla y la duración mínima
 * mandan sobre qué horas se pueden elegir en "Días y horarios". Teniéndolas en estado, el
 * editor de horarios ofrece únicamente valores que el servidor va a aceptar, en vez de
 * enterarse del choque recién al guardar. La validación de verdad no se movió de
 * `lib/bookings/space-form.ts`.
 */
export function SpaceForm({
  space,
  otrosEspacios,
  compatibleCon,
  error,
}: {
  space: SpaceRecord | null;
  otrosEspacios: { id: string; name: string }[];
  compatibleCon: string[];
  error?: string;
}) {
  const pesos = (minor: number) =>
    minor === 0 ? "" : formatMinorArs(minor).replace("$", "").trim();

  const [slotMinutes, setSlotMinutes] = useState(space?.rules.slotMinutes ?? 60);
  const [minBookingMinutes, setMinBookingMinutes] = useState(
    space?.rules.minBookingMinutes ?? 60,
  );
  const [modo, setModo] = useState<"HOURLY" | "BLOCK">(space?.pricingMode ?? "HOURLY");

  return (
    <form action={saveSpaceAction} className="space-y-6">
      {space ? <input type="hidden" name="spaceId" value={space.id} /> : null}

      {error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Identidad</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            className="fo-input"
            defaultValue={space?.name ?? ""}
            required
          />
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="fo-input"
            defaultValue={space?.description ?? ""}
          />
          <p className="fo-helper">Lo que va a leer el socio antes de reservar.</p>
        </div>
      </section>

      <WeeklyHoursField
        initialHours={space?.weeklyHours ?? []}
        slotMinutes={slotMinutes}
        minBookingMinutes={minBookingMinutes}
      />

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Reglas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="slotMinutes">
              Grilla (minutos)
            </label>
            <input
              id="slotMinutes"
              name="slotMinutes"
              type="number"
              min={5}
              step={5}
              className="fo-input"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            />
            <p className="fo-helper">
              60 = se reserva por hora. Manda sobre las horas que se pueden elegir arriba.
            </p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="minBookingMinutes">
              Duración mínima
            </label>
            <input
              id="minBookingMinutes"
              name="minBookingMinutes"
              type="number"
              min={5}
              step={5}
              className="fo-input"
              value={minBookingMinutes}
              onChange={(e) => setMinBookingMinutes(Number(e.target.value))}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="maxBookingMinutes">
              Duración máxima
            </label>
            <input
              id="maxBookingMinutes"
              name="maxBookingMinutes"
              type="number"
              min={0}
              step={5}
              className="fo-input"
              defaultValue={space?.rules.maxBookingMinutes ?? ""}
            />
            <p className="fo-helper">Vacío = sin tope.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="bufferMinutes">
              Limpieza entre reservas
            </label>
            <input
              id="bufferMinutes"
              name="bufferMinutes"
              type="number"
              min={0}
              step={5}
              className="fo-input"
              defaultValue={space?.rules.bufferMinutes ?? 0}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="minAdvanceHours">
              Anticipación mínima (horas)
            </label>
            <input
              id="minAdvanceHours"
              name="minAdvanceHours"
              type="number"
              min={0}
              className="fo-input"
              defaultValue={space?.rules.minAdvanceHours ?? 2}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="maxAdvanceDays">
              Anticipación máxima (días)
            </label>
            <input
              id="maxAdvanceDays"
              name="maxAdvanceDays"
              type="number"
              min={1}
              className="fo-input"
              defaultValue={space?.rules.maxAdvanceDays ?? 90}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresApproval"
            defaultChecked={space?.requiresApproval ?? false}
          />
          Requiere aprobación de la institución antes de cobrarse
        </label>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Tarifas</h2>

        <fieldset className="space-y-2">
          <legend className="fo-label">Cómo se cobra</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["HOURLY", "Por hora", "Cada hora se cobra igual. Ej.: coworking a $3.000 la hora."],
                [
                  "BLOCK",
                  "Por paquete o jornada",
                  "Un precio fijo por bloque de horas, o uno solo por día. Ej.: estudio $30.000 cada 2 h.",
                ],
              ] as const
            ).map(([valor, titulo, ayuda]) => (
              <label
                key={valor}
                className={`flex cursor-pointer gap-3 rounded-[var(--fo-radius-sm)] border p-3 text-sm transition-colors ${
                  modo === valor
                    ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]"
                    : "border-[var(--fo-border)] hover:bg-[var(--fo-surface-hover)]"
                }`}
              >
                <input
                  type="radio"
                  name="pricingMode"
                  value={valor}
                  checked={modo === valor}
                  onChange={() => setModo(valor)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-[var(--fo-text)]">{titulo}</span>
                  <span className="block text-xs text-[var(--fo-muted)]">{ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {modo === "BLOCK" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="blockMinutes">
                Largo del paquete
              </label>
              <select
                id="blockMinutes"
                name="blockMinutes"
                className="fo-input"
                defaultValue={space?.blockMinutes ? String(space.blockMinutes) : ""}
              >
                <option value="">Jornada (un precio, dure lo que dure)</option>
                {[60, 120, 180, 240, 300, 360]
                  .filter((m) => m % slotMinutes === 0)
                  .map((m) => (
                    <option key={m} value={m}>
                      {m / 60} {m === 60 ? "hora" : "horas"}
                    </option>
                  ))}
              </select>
              <p className="fo-helper">
                Si alguien reserva menos, paga el paquete entero.
              </p>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="memberBlockPriceArs">
                Precio del paquete — socios
              </label>
              <input
                id="memberBlockPriceArs"
                name="memberBlockPriceArs"
                className="fo-input"
                defaultValue={space ? pesos(space.memberBlockPriceMinor) : ""}
                placeholder="30.000"
                required
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="nonMemberBlockPriceArs">
                Precio del paquete — no socios
              </label>
              <input
                id="nonMemberBlockPriceArs"
                name="nonMemberBlockPriceArs"
                className="fo-input"
                defaultValue={space ? pesos(space.nonMemberBlockPriceMinor) : ""}
                placeholder="40.000"
                required
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`fo-field-stack ${modo === "BLOCK" ? "hidden" : ""}`}>
            <label className="fo-label" htmlFor="memberHourlyPriceArs">
              Precio por hora — socios
            </label>
            <input
              id="memberHourlyPriceArs"
              name="memberHourlyPriceArs"
              className="fo-input"
              defaultValue={space ? pesos(space.memberHourlyPriceMinor) : ""}
              placeholder="3.000"
              required={modo === "HOURLY"}
            />
          </div>
          <div className={`fo-field-stack ${modo === "BLOCK" ? "hidden" : ""}`}>
            <label className="fo-label" htmlFor="nonMemberHourlyPriceArs">
              Precio por hora — no socios
            </label>
            <input
              id="nonMemberHourlyPriceArs"
              name="nonMemberHourlyPriceArs"
              className="fo-input"
              defaultValue={space ? pesos(space.nonMemberHourlyPriceMinor) : ""}
              placeholder="5.000"
              required={modo === "HOURLY"}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="memberFreeHoursPerMonth">
              Horas bonificadas por mes
            </label>
            <input
              id="memberFreeHoursPerMonth"
              name="memberFreeHoursPerMonth"
              type="number"
              min={0}
              className="fo-input"
              defaultValue={space?.memberFreeHoursPerMonth ?? 0}
            />
            <p className="fo-helper">
              Para socios. No se acumulan de un mes al otro.
              {modo === "BLOCK" ? " Cubren paquetes enteros: 2 h bonificadas pagan un paquete de 2 h." : ""}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allowsNonMembers"
            defaultChecked={space?.allowsNonMembers ?? true}
          />
          Se puede alquilar a no socios
        </label>
        {/* Va después de la casilla: destildada, el navegador no la manda y queda sólo este
            "off"; tildada, el "on" llega primero y es el que se lee. */}
        <input type="hidden" name="allowsNonMembers" value="off" />
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Convivencia</h2>
        <p className="fo-helper">
          Por defecto, ocupar este espacio ocupa <strong>todos</strong> los demás. Marcá acá
          los que sí pueden usarse al mismo tiempo. Es a propósito: un espacio nuevo mal
          configurado tiene que dar &ldquo;no hay horarios&rdquo;, no dos alquileres del mismo
          salón.
        </p>
        {otrosEspacios.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay otros espacios con los que convivir.
          </p>
        ) : (
          <div className="space-y-2">
            {otrosEspacios.map((otro) => (
              <label key={otro.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="compatibleWith"
                  value={otro.id}
                  defaultChecked={compatibleCon.includes(otro.id)}
                />
                Puede usarse a la vez que {otro.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          {space ? "Guardar cambios" : "Crear espacio"}
        </button>
      </div>
    </form>
  );
}
