import { formatMinorArs } from "@/lib/membership/money";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import type { SpaceRecord } from "@/lib/bookings/repository";
import { saveSpaceAction } from "../actions";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Los horarios se cargan como texto, un tramo por línea (`09:00-13:00`).
 *
 * Un selector visual sería más lindo y necesita estado en el navegador, validación
 * duplicada y su propio manejo de errores. El texto se valida en un solo lugar
 * (`lib/bookings/space-form.ts`), se prueba sin navegador, y quien carga esto lo hace una
 * vez por espacio y no todos los días.
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

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Días y horarios</h2>
        <p className="fo-helper">
          Un tramo por línea, con el formato <code>09:00-13:00</code>. Se pueden poner varios
          tramos en el mismo día. Un día vacío es un día en que no se alquila.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {DIAS.map((nombre, weekday) => {
            const tramos = (space?.weeklyHours ?? [])
              .filter((h) => h.weekday === weekday)
              .map(
                (h) =>
                  `${minuteOfDayToLabel(h.startMinute)}-${minuteOfDayToLabel(h.endMinute)}`,
              );
            return (
              <div key={weekday} className="fo-field-stack">
                <label className="fo-label" htmlFor={`hours-${weekday}`}>
                  {nombre}
                </label>
                <textarea
                  id={`hours-${weekday}`}
                  name={`hours.${weekday}`}
                  rows={2}
                  className="fo-input"
                  placeholder="09:00-13:00"
                  defaultValue={tramos.join("\n")}
                />
              </div>
            );
          })}
        </div>
      </section>

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
              defaultValue={space?.rules.slotMinutes ?? 60}
            />
            <p className="fo-helper">60 = se reserva por hora.</p>
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
              defaultValue={space?.rules.minBookingMinutes ?? 60}
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="memberHourlyPriceArs">
              Precio por hora — socios
            </label>
            <input
              id="memberHourlyPriceArs"
              name="memberHourlyPriceArs"
              className="fo-input"
              defaultValue={space ? pesos(space.memberHourlyPriceMinor) : ""}
              placeholder="3.000"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="nonMemberHourlyPriceArs">
              Precio por hora — no socios
            </label>
            <input
              id="nonMemberHourlyPriceArs"
              name="nonMemberHourlyPriceArs"
              className="fo-input"
              defaultValue={space ? pesos(space.nonMemberHourlyPriceMinor) : ""}
              placeholder="5.000"
              required
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
            <p className="fo-helper">Para socios. No se acumulan de un mes al otro.</p>
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
