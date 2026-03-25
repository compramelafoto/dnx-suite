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
    <div className="wizard-premium-field w-full space-y-5">
      <label htmlFor={id} className="block text-sm font-medium text-white">
        {label}
        {required ? <span className="ml-0.5 text-amber-400">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="pl-0 text-[11px] leading-relaxed text-zinc-500">{hint}</p>
      ) : null}
      {error ? <p className="pl-0 text-xs font-medium text-red-400">{error}</p> : null}
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
