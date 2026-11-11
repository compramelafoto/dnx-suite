"use client";

import { useActionState, useState } from "react";
import { submitApplicationAction, type ApplicationFormState } from "@/app/actions/membership-applications";

const initial: ApplicationFormState = { error: null, ok: null };

/** Un plan del alta, ya armado en el servidor para mostrar. */
export type SimpleApplicationPlanOption = {
  id: string;
  name: string;
  description: string | null;
  /** "$60.000 por mes", ya armado. null = sin valor cargado. */
  priceLabel: string | null;
  /** Con BOX se pide el domicilio de envío. */
  includesMonthlyBox: boolean;
  /** "el acceso a tu portal, donde ves tus cortes y renovás". */
  portalAccess: string;
};

/**
 * El alta corta de un club de clientes (el VIP de una barbería, el BOX de SOYBELUZ): nombre,
 * apellido, email y teléfono, y a pagar. Lo que el formulario completo pide por estatuto no
 * aplica acá. Usa la misma acción que el completo; la institución decide cuál se muestra
 * (`simpleApplicationForm`).
 *
 * Con varios planes ofrecidos, la persona elige uno; con uno solo se ve como siempre. Si el plan
 * elegido incluye la BOX mensual, se pide el domicilio de envío (el servidor lo vuelve a exigir).
 */
export function SimpleApplicationForm({
  workspaceSlug,
  plans,
  defaultPlanId,
  fallbackPriceLabel,
  autoApprove,
}: {
  workspaceSlug: string;
  plans: SimpleApplicationPlanOption[];
  defaultPlanId: string | null;
  /** El precio cuando la institución no ofrece planes (valor general de la cuota). */
  fallbackPriceLabel: string | null;
  /** Con alta sin aprobación, el botón lleva directo a pagar. */
  autoApprove: boolean;
}) {
  const action = submitApplicationAction.bind(null, workspaceSlug);
  const [state, submit, pending] = useActionState(action, initial);
  const [planId, setPlanId] = useState<string | null>(defaultPlanId ?? plans[0]?.id ?? null);
  const plan = plans.find((p) => p.id === planId) ?? null;
  const priceLabel = plans.length > 0 ? (plan?.priceLabel ?? null) : fallbackPriceLabel;
  const portalAccess = plan?.portalAccess ?? "el acceso a tu portal";

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
      {plans.length > 1 ? (
        <fieldset className="space-y-3">
          <legend className="fo-label mb-2">Elegí tu plan</legend>
          {plans.map((p) => (
            <label
              key={p.id}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${
                p.id === planId ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)]"
              }`}
            >
              <input
                type="radio"
                name="planId"
                value={p.id}
                checked={p.id === planId}
                onChange={() => setPlanId(p.id)}
                className="mt-1 size-4"
                required
              />
              <span className="flex-1 space-y-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.priceLabel ? <span className="text-sm font-medium">{p.priceLabel}</span> : null}
                </span>
                {p.description ? (
                  <span className="block text-sm text-[var(--fo-muted)] leading-relaxed">{p.description}</span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : plan ? (
        <input type="hidden" name="planId" value={plan.id} />
      ) : null}

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
          <p className="fo-helper">Te llega {portalAccess}.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="phone">
            Teléfono
          </label>
          <input id="phone" name="phone" type="tel" className="fo-input" autoComplete="tel" />
        </div>
      </div>

      {plan?.includesMonthlyBox ? (
        <fieldset className="space-y-4">
          <legend className="fo-label">Domicilio de envío de la BOX</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="fo-field-stack sm:col-span-2">
              <label className="fo-label" htmlFor="address">
                Calle y número
              </label>
              <input
                id="address"
                name="address"
                className="fo-input"
                autoComplete="street-address"
                placeholder="Ej.: San Martín 1234, piso 2 B"
                required
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="city">
                Localidad
              </label>
              <input id="city" name="city" className="fo-input" autoComplete="address-level2" required />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="province">
                Provincia
              </label>
              <input id="province" name="province" className="fo-input" autoComplete="address-level1" required />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="postalCode">
                Código postal
              </label>
              <input id="postalCode" name="postalCode" className="fo-input" autoComplete="postal-code" required />
            </div>
          </div>
          <p className="fo-helper">Lo usamos sólo para mandarte la caja; no se publica.</p>
        </fieldset>
      ) : null}

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
