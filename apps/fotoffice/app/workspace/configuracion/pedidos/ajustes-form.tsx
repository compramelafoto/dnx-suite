"use client";

import { useActionState } from "react";
import { guardarAjustesPedidosAction, type EstadoPedidosConfig } from "./actions";

/** Lo que muestra el formulario. Mismo contenido que `AjustesPedidos` del servidor. */
export type AjustesPedidosVista = {
  recordatorioDias: number;
  recordatorioActivo: boolean;
  rubroIngresoId: string | null;
};

const INICIAL: EstadoPedidosConfig = { error: null };

/**
 * Recordatorio de cuotas (lo manda una tarea diaria, `lib/pedidos/recordatorios.ts`) y rubro de
 * ingreso por omisión (se usa al confirmar un pedido si ningún ítem tiene rubro).
 */
export function AjustesPedidosForm({ ajustes, rubros }: { ajustes: AjustesPedidosVista; rubros: { id: string; nombre: string }[] }) {
  const [estado, guardar, guardando] = useActionState(guardarAjustesPedidosAction, INICIAL);
  // Un rubro guardado que ya no es INGRESO (o se borró) no se ofrece: se ve "Sin rubro".
  const rubroActual = ajustes.rubroIngresoId && rubros.some((r) => r.id === ajustes.rubroIngresoId) ? ajustes.rubroIngresoId : "";
  return (
    <form action={guardar} className="space-y-6">
      <section className="fo-card space-y-4 p-5" aria-labelledby="recordatorio-cuotas-titulo">
        <div className="space-y-1">
          <h2 id="recordatorio-cuotas-titulo" className="text-base font-semibold">
            Recordatorio de cuotas
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Antes de que venza una cuota que todavía tiene saldo, se le manda un correo al contacto del pedido con el enlace
            para ver el detalle y sus recibos. Sale a las 10 de la mañana, una vez por cuota y vencimiento (si cambiás el
            vencimiento, vuelve a avisar). No sale si el pedido está cancelado o la cuota ya está pagada. El texto se edita
            en Configuración → Plantillas → Automáticos.
          </p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="pedidos-recordatorio-dias">
            Días antes del vencimiento
          </label>
          <input
            id="pedidos-recordatorio-dias"
            name="recordatorioDias"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            step={1}
            required
            defaultValue={ajustes.recordatorioDias}
            className="fo-input"
            aria-describedby="pedidos-recordatorio-dias-ayuda"
          />
          <p id="pedidos-recordatorio-dias-ayuda" className="text-xs text-[var(--fo-muted)]">
            De 0 a 30. Con 0 se avisa el mismo día del vencimiento; con 3, desde tres días antes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="recordatorioActivo" value="1" defaultChecked={ajustes.recordatorioActivo} />
          Activar el recordatorio de cuotas
        </label>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="rubro-ingreso-titulo">
        <div className="space-y-1">
          <h2 id="rubro-ingreso-titulo" className="text-base font-semibold">
            Rubro de ingreso por omisión
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Al confirmar un pedido, sus cobros entran a Caja con el rubro de ingreso del primer producto que tenga uno. Si
            ninguno tiene, se usa este. En cada pedido se puede cambiar.
          </p>
        </div>
        <div className="fo-field-stack max-w-sm">
          <label className="fo-label" htmlFor="pedidos-rubro-ingreso">
            Rubro
          </label>
          <select id="pedidos-rubro-ingreso" name="rubroIngresoId" defaultValue={rubroActual} className="fo-input">
            <option value="">Sin rubro</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          {rubros.length === 0 ? (
            <p className="text-xs text-[var(--fo-muted)]">Todavía no hay rubros de ingreso: se crean en Caja → Configuración.</p>
          ) : null}
        </div>
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
