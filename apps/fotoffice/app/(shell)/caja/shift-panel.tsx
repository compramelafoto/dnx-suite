import { formatMinorArs } from "@/lib/membership/money";
import type { OpenShiftRow } from "@/lib/cash/repository";
import { closeShiftAction } from "./actions";

/**
 * El turno abierto de una cuenta, para mostrar DENTRO de su tarjeta en el panorama de
 * `/caja` — no una pantalla propia. Sólo lo esperado y el cierre: cargar un movimiento y ver
 * el detalle del turno ya tienen su lugar (el botón siempre visible del panorama y
 * `/caja/movimientos` filtrado por cuenta), así que este bloque no los repite.
 */
export function ShiftBlock({ shift, expectedMinor }: { shift: OpenShiftRow; expectedMinor: number }) {
  return (
    <div className="space-y-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Turno abierto</p>
          <p className="text-sm text-[var(--fo-muted)]">
            Desde el {shift.openedAt.toLocaleString("es-AR")} con {formatMinorArs(shift.openingAmountMinor)} de
            fondo inicial.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Esperado</p>
          <p className="text-lg font-semibold">{formatMinorArs(expectedMinor)}</p>
        </div>
      </div>

      <form action={closeShiftAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="shiftId" value={shift.id} />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`contado-${shift.id}`}>
            Cuánto contaste
          </label>
          <input id={`contado-${shift.id}`} name="countedAmountArs" className="fo-input" placeholder="47.300" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`diferencia-${shift.id}`}>
            Si no cuadra, explicá por qué
          </label>
          <input id={`diferencia-${shift.id}`} name="differenceNote" className="fo-input" placeholder="Vuelto de más" />
        </div>
        <div className="self-end">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Cerrar turno
          </button>
        </div>
      </form>
    </div>
  );
}
