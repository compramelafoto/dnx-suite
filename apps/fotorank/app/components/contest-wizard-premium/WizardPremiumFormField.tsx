"use client";

interface WizardPremiumFormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/**
 * Label blanco, asterisco dorado, hint gris; el input lo pasás como children.
 */
export function WizardPremiumFormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: WizardPremiumFormFieldProps) {
  return (
    <div className="wizard-premium-field flex w-full flex-col space-y-3">
      <label htmlFor={id} className="block text-sm font-semibold leading-snug tracking-tight text-white sm:text-base">
        {label}
        {required ? (
          <span className="ml-1 text-sm font-medium text-amber-400/90" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="w-full">{children}</div>
      {hint && !error ? (
        <p className="text-sm leading-relaxed text-zinc-400" role="note">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium leading-snug text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Input / textarea: oscuro, borde sutil, focus dorado elegante.
 * El `!` en padding evita que el reset global `* { padding: 0 }` en `globals.css`
 * pise las utilidades de Tailwind (orden de capas).
 */
export const wizardPremiumInputClass =
  "block w-full h-[46px] rounded-xl border border-zinc-700 bg-[#050505] !px-5 !py-3 text-sm leading-normal text-white outline-none transition placeholder:text-zinc-500 placeholder:transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export const wizardPremiumTextareaClass =
  "block w-full min-h-[120px] rounded-xl border border-zinc-700 bg-[#050505] !px-5 !py-4 text-sm leading-relaxed text-white outline-none transition placeholder:text-zinc-500 placeholder:transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-y";
