"use client";

import { useActionState } from "react";
import { STORE_REGRET_REASON_MAX } from "@/lib/store/constants";
import { submitRegretAction, type RegretFormState } from "./actions";

const inicial: RegretFormState = { error: null, code: null };

export function RegretForm({ workspaceSlug, institution }: { workspaceSlug: string; institution: string }) {
  const accion = submitRegretAction.bind(null, workspaceSlug);
  const [state, formAction, pending] = useActionState(accion, inicial);

  if (state.code) {
    return (
      <div role="status" className="fo-alert-success space-y-2 rounded-[var(--fo-radius-sm)] p-4 text-sm leading-relaxed">
        <p className="font-semibold">Recibimos tu pedido de arrepentimiento.</p>
        <p>
          Código de trámite: <strong className="font-mono text-base tracking-wide">{state.code}</strong>
        </p>
        <p>
          Guardalo: es el comprobante de que lo pediste. {institution} se va a comunicar con vos al email de la compra
          para coordinar la devolución del producto y del dinero.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="fo-field-stack">
        <span className="fo-label">Número de pedido</span>
        {/* `text-base`: en un teléfono, letra chica hace que el navegador acerque la pantalla. */}
        <input name="orderNumber" inputMode="numeric" autoComplete="off" required maxLength={12} className="fo-input text-base" />
        <span className="text-xs text-[var(--fo-muted)]">Está en el correo de la compra y en la página del pedido (por ejemplo, #12).</span>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Email con el que compraste</span>
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="fo-input text-base" />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Motivo (opcional)</span>
        <textarea name="reason" rows={3} maxLength={STORE_REGRET_REASON_MAX} className="fo-input text-base" />
        <span className="text-xs text-[var(--fo-muted)]">No hace falta dar explicaciones.</span>
      </label>
      {state.error ? (
        <p role="alert" className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? "Enviando…" : "Enviar arrepentimiento"}
      </button>
    </form>
  );
}
