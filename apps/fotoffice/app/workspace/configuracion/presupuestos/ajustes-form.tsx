"use client";

import { useActionState } from "react";
import { guardarAjustesPresupuestosAction, type EstadoPresupuestosConfig } from "./actions";

/** Lo que muestra el formulario. Mismo contenido que `AjustesPresupuestos` del servidor. */
export type AjustesVista = {
  validezDias: number;
  condiciones: string | null;
  propuestaPago: string | null;
  seguimientoDias: number;
  seguimientoActivo: boolean;
};

const INICIAL: EstadoPresupuestosConfig = { error: null };
const MAX_TEXTO = 4000;

/**
 * Ajustes de los presupuestos nuevos: validez, condiciones generales y propuesta de pago se
 * copian a cada presupuesto al crearlo (y se pueden cambiar en cada uno). El seguimiento lo
 * manda una tarea diaria (`lib/presupuestos/seguimiento.ts`).
 */
export function AjustesForm({ ajustes }: { ajustes: AjustesVista }) {
  const [estado, guardar, guardando] = useActionState(guardarAjustesPresupuestosAction, INICIAL);
  return (
    <form action={guardar} className="space-y-6">
      <section className="fo-card space-y-4 p-5" aria-labelledby="ajustes-presupuesto-titulo">
        <div className="space-y-1">
          <h2 id="ajustes-presupuesto-titulo" className="text-base font-semibold">
            Presupuestos nuevos
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Cada presupuesto nuevo arranca con estos datos. En cada presupuesto los podés cambiar; los que ya existen no
            cambian.
          </p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="presupuestos-validez">
            Validez (días)
          </label>
          <input
            id="presupuestos-validez"
            name="validez"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            required
            defaultValue={ajustes.validezDias}
            className="fo-input"
            aria-describedby="presupuestos-validez-ayuda"
          />
          <p id="presupuestos-validez-ayuda" className="text-xs text-[var(--fo-muted)]">
            De 1 a 365 días. Se cuenta desde el día en que se envía.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="presupuestos-condiciones">
            Condiciones generales
          </label>
          <textarea
            id="presupuestos-condiciones"
            name="condiciones"
            rows={5}
            maxLength={MAX_TEXTO}
            defaultValue={ajustes.condiciones ?? ""}
            className="fo-input"
            placeholder="Por ejemplo: qué incluye el servicio, plazos de entrega, viáticos…"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="presupuestos-propuesta">
            Propuesta de pago
          </label>
          <textarea
            id="presupuestos-propuesta"
            name="propuestaPago"
            rows={4}
            maxLength={MAX_TEXTO}
            defaultValue={ajustes.propuestaPago ?? ""}
            className="fo-input"
            placeholder="Por ejemplo: 30% para reservar la fecha y el resto antes del evento."
          />
        </div>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="seguimiento-presupuesto-titulo">
        <div className="space-y-1">
          <h2 id="seguimiento-presupuesto-titulo" className="text-base font-semibold">
            Seguimiento
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Si el cliente no responde, se le recuerda el presupuesto por correo a los días que elijas (una vez por
            versión enviada, a las 10 de la mañana). No sale si ya lo aceptó, lo rechazó o venció. El texto se edita en
            Configuración → Plantillas → Automáticos.
          </p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="presupuestos-seguimiento">
            Días hasta el seguimiento
          </label>
          <input
            id="presupuestos-seguimiento"
            name="seguimiento"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            step={1}
            required
            defaultValue={ajustes.seguimientoDias}
            className="fo-input"
            aria-describedby="presupuestos-seguimiento-ayuda"
          />
          <p id="presupuestos-seguimiento-ayuda" className="text-xs text-[var(--fo-muted)]">
            De 1 a 90 días después del envío.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="seguimientoActivo" value="1" defaultChecked={ajustes.seguimientoActivo} />
          Activar el seguimiento
        </label>
      </section>

      <div className="space-y-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          Guardar
        </button>
        <div aria-live="polite">
          {estado?.error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {estado.error}
            </p>
          ) : estado?.ok ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">
              {estado.ok}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
