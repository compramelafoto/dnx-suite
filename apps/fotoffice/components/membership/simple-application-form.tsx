"use client";

import { useActionState } from "react";
import { submitApplicationAction, type ApplicationFormState } from "@/app/actions/membership-applications";

const initial: ApplicationFormState = { error: null, ok: null };

/**
 * El alta corta de un club de clientes (el VIP de una barbería): nombre, apellido, email y
 * teléfono, y a pagar. Lo que el formulario completo pide por estatuto no aplica acá. Usa la
 * misma acción que el completo; la institución decide cuál se muestra (`simpleApplicationForm`).
 */
export function SimpleApplicationForm({
  workspaceSlug,
  priceLabel,
  autoApprove,
}: {
  workspaceSlug: string;
  /** "$ 60.000 por mes", ya armado. */
  priceLabel: string | null;
  /** Con alta sin aprobación, el botón lleva directo a pagar. */
  autoApprove: boolean;
}) {
  const action = submitApplicationAction.bind(null, workspaceSlug);
  const [state, submit, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <div className="fo-card space-y-2 p-6">
        <h2 className="text-lg font-semibold">Listo</h2>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={submit} className="fo-card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="firstName">
            Nombre
          </label>
          <input id="firstName" name="firstName" className="fo-input" autoComplete="given-name" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="lastName">
            Apellido
          </label>
          <input id="lastName" name="lastName" className="fo-input" autoComplete="family-name" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="fo-input" autoComplete="email" required />
          <p className="fo-helper">Te llega el acceso a tu portal, donde ves tus cortes y renovás.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="phone">
            Teléfono
          </label>
          <input id="phone" name="phone" type="tel" className="fo-input" autoComplete="tel" />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending
            ? "Un momento…"
            : autoApprove
              ? `Continuar al pago${priceLabel ? ` — ${priceLabel}` : ""}`
              : "Enviar"}
        </button>
      </div>
    </form>
  );
}
