import { formatMinorArs } from "@/lib/membership/money";
import type { CashAccountRow, OpenShiftRow } from "@/lib/cash/repository";
import { openShiftAction } from "./actions";
import { ShiftBlock } from "./shift-panel";

/**
 * Cómo se llama el tipo de cuenta en la pantalla. Sólo texto: la regla de negocio de qué
 * cuenta lleva turno vive en `canOpenShift` (`lib/cash/shift.ts`), esto no la repite.
 */
function accountTypeLabel(cuenta: CashAccountRow): string {
  if (cuenta.kind !== "EFECTIVO") return "Cuenta digital";
  return cuenta.isVault ? "Caja fuerte" : "Efectivo de mostrador";
}

/**
 * Una cuenta del panorama de `/caja`: su nombre, su tipo, su saldo y —si es efectivo de
 * mostrador— su turno.
 *
 * El turno es "una opción más, nunca una exigencia": por eso "Abrir turno" se dibuja igual
 * de chico que el resto de la tarjeta, con un botón secundario en vez del primario que tenía
 * cuando era la pantalla de entrada del módulo. Una cuenta digital o la caja fuerte no
 * llevan nada de esto — ni el panel de turno abierto ni el botón para abrir uno.
 */
export function AccountCard({
  cuenta,
  balanceMinor,
  turno,
  expectedMinor,
}: {
  cuenta: CashAccountRow;
  balanceMinor: number;
  turno: OpenShiftRow | null;
  expectedMinor: number;
}) {
  const llevaTurno = cuenta.kind === "EFECTIVO" && !cuenta.isVault;

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{cuenta.name}</h2>
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{accountTypeLabel(cuenta)}</p>
        </div>
        <p className="text-lg font-semibold">{formatMinorArs(balanceMinor)}</p>
      </div>

      {llevaTurno ? (
        turno ? (
          <ShiftBlock shift={turno} expectedMinor={expectedMinor} />
        ) : (
          <form
            action={openShiftAction}
            className="grid gap-3 rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border)] p-4 sm:grid-cols-[1fr_auto]"
          >
            <input type="hidden" name="accountId" value={cuenta.id} />
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`apertura-${cuenta.id}`}>
                Abrir turno — con cuánto
              </label>
              <input
                id={`apertura-${cuenta.id}`}
                name="openingAmountArs"
                className="fo-input"
                placeholder="20.000"
                required
              />
            </div>
            <div className="self-end">
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Abrir turno
              </button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}
