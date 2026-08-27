"use client";

import { useActionState } from "react";
import {
  registerManualPaymentAction,
  type ManualPaymentState,
} from "@/app/actions/manual-payment";

const initial: ManualPaymentState = { error: null, ok: null };

/**
 * Registro de un pago cobrado en mano.
 *
 * Existe porque no todo entra por Mercado Pago: en el último año, 44 de 333 pagos fueron en
 * efectivo o por transferencia. Sin esta pantalla el socio seguiría viendo en su portal una
 * deuda que ya saldó, que es peor que no tener sistema.
 *
 * El aviso sobre la comisión no es un detalle legal escondido: quien cobra tiene que saber, en
 * el momento de registrarlo, que ese cobro deja una comisión a deber.
 */
export function ManualPaymentForm({
  memberId,
  feePercent,
}: {
  memberId: string;
  feePercent: string;
}) {
  const [state, action, pending] = useActionState(registerManualPaymentAction, initial);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs text-[var(--fo-muted)]">Importe cobrado</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="8000"
            className="fo-input w-full"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-[var(--fo-muted)]">Cómo pagó</span>
          <select name="method" required defaultValue="EFECTIVO" className="fo-input w-full">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-[var(--fo-muted)]">Cuándo pagó</span>
          <input type="date" name="paidAt" defaultValue={hoy} max={hoy} className="fo-input w-full" />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-[var(--fo-muted)]">
            Comprobante <span className="text-[var(--fo-muted-soft)]">(opcional)</span>
          </span>
          <input name="reference" placeholder="N° de transferencia, recibo…" className="fo-input w-full" />
        </label>
      </div>

      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        El importe se imputa a las cuotas impagas, de la más vieja a la más nueva. Como el cobro
        no pasa por Mercado Pago, la comisión del {feePercent} no se puede retener: queda a deber
        y se cobra del próximo pago que sí entre por Mercado Pago. Los saldos traídos del sistema
        anterior no pagan comisión.
      </p>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}

      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm">
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
    </form>
  );
}
