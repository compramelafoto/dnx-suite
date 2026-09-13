import { formatMinorArs } from "@/lib/membership/money";
import type { CashCategoryRow, MovementRow, OpenShiftRow } from "@/lib/cash/repository";
import type { ClientRow } from "@/lib/clients/repository";
import { closeShiftAction } from "./actions";
import { MovementForm } from "./movement-form";
import { MovementsTable } from "./movements-table";

/**
 * El turno abierto de una cuenta: lo que entró y salió, el botón para cargar más, y el
 * panel de cierre.
 *
 * No lleva `"use client"`: el único estado del árbol —mostrar u ocultar el formulario de
 * movimiento— vive adentro de `MovementForm`. Cuanto menos código corre en el navegador,
 * menos hay que mantener.
 */
export function ShiftPanel({
  shift,
  accountName,
  expectedMinor,
  movements,
  categories,
  clients,
}: {
  shift: OpenShiftRow;
  accountName: string;
  expectedMinor: number;
  movements: MovementRow[];
  categories: CashCategoryRow[];
  clients: ClientRow[];
}) {
  return (
    <section className="fo-card space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{accountName}</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Turno abierto desde el {shift.openedAt.toLocaleString("es-AR")} con{" "}
            {formatMinorArs(shift.openingAmountMinor)} de fondo inicial.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Saldo esperado</p>
          <p className="text-xl font-semibold">{formatMinorArs(expectedMinor)}</p>
        </div>
      </div>

      <MovementForm accountId={shift.accountId} accountName={accountName} categories={categories} clients={clients} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Movimientos del turno</h3>
        <MovementsTable movements={movements} />
      </div>

      <form action={closeShiftAction} className="space-y-4 border-t border-[var(--fo-border)] pt-4">
        <input type="hidden" name="shiftId" value={shift.id} />
        <h3 className="text-sm font-semibold">Cerrar turno</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="countedAmountArs">
              Cuánto contaste
            </label>
            <input
              id="countedAmountArs"
              name="countedAmountArs"
              className="fo-input"
              placeholder="47.300"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="differenceNote">
              Si no cuadra, explicá por qué
            </label>
            <input id="differenceNote" name="differenceNote" className="fo-input" placeholder="Vuelto de más" />
          </div>
        </div>
        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Cerrar turno
          </button>
        </div>
      </form>
    </section>
  );
}
