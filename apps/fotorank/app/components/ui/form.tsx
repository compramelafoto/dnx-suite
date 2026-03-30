"use client";

import * as React from "react";

/* -------------------------------------------------------------------------- */
/* Controles — estados default / hover / focus alineados (premium, legibles)  */
/* -------------------------------------------------------------------------- */

export const inputBase =
  "block w-full min-h-[3.25rem] rounded-lg border border-[#262626] bg-[#0a0a0a] px-5 py-[0.875rem] text-base leading-relaxed text-fr-primary placeholder:text-fr-muted-soft placeholder:opacity-90 transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#333333] hover:bg-[#0d0d0d] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-55";

/** `datetime-local` nativo: misma piel que input + cursor para abrir picker */
export const datetimeLocalBase = `${inputBase} cursor-pointer font-sans`;

/** Textarea: misma piel que input + altura mínima cómoda */
export const textareaBase = `${inputBase} min-h-[7.5rem] resize-y py-4 align-top`;

/** Login / registro en shell: contenido y placeholder centrados, más alto táctil, borde un poco más suave. */
export const inputAuth =
  "block w-full min-h-[3.25rem] rounded-xl border border-[#333333] bg-[#0a0a0a] px-5 py-[1.125rem] text-center text-base leading-relaxed text-fr-primary placeholder:text-center placeholder:text-fr-muted-soft transition-colors hover:border-[#404040] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 md:min-h-[3.5rem] md:py-5";

/** Wizard / SaaS: más alto, bordes suaves, glow sutil al focus */
export const inputWizard =
  "block w-full min-h-[46px] rounded-xl border border-zinc-700 bg-[#050505] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 placeholder:opacity-90 hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50";

/** Textarea wizard: mismo estilo que inputWizard pero min-h mayor */
export const textareaWizard =
  "block w-full min-h-[128px] rounded-xl border border-zinc-700 bg-[#050505] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-y";

/** Chevron más visible (acento dorado suave) + misma altura táctil que inputBase */
export const selectBase =
  "block w-full min-h-[3.25rem] cursor-pointer appearance-none rounded-lg border border-[#262626] bg-[#0a0a0a] bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center] px-5 py-[0.875rem] pr-11 text-base leading-relaxed text-fr-primary transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#333333] hover:bg-[#0d0d0d] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-55 [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23c8a86b%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]";

export const selectWizard =
  "block w-[67%] ml-[12%] max-w-full min-h-[3.5rem] cursor-pointer appearance-none rounded-xl border border-[#383838] bg-[#0e0e0e] bg-[length:1.125rem] bg-[position:right_1rem_center] bg-no-repeat px-4 py-4 pr-12 text-base font-medium leading-relaxed text-fr-primary shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-all duration-200 hover:border-gold/40 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.08)] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/35 [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23c9a227%22%20stroke-width%3D%222.25%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

/* -------------------------------------------------------------------------- */
/* Tipografía semántica — usar también en pantallas sueltas (.fr-form-*)      */
/* -------------------------------------------------------------------------- */

export const labelBase = "text-base font-semibold leading-snug tracking-tight text-fr-primary";
export const labelWizard =
  "text-sm font-medium leading-snug text-white sm:text-base";

/** Ayuda persistente bajo el control (restricciones, formato, ejemplos) */
export const helperTextClass = "fr-form-helper-text";

/** Microcopy más tenue (contexto breve, no compite con el label) */
export const microcopyTextClass = "fr-form-microcopy";

export const errorTextClass = "fr-form-error-text";

interface FormFieldProps {
  id?: string;
  label: React.ReactNode;
  /** Microcopy contextual bajo el input (menor jerarquía que hint) */
  microcopy?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "wizard";
  /**
   * Login / registro en shell centrado: labels e hints centrados, más aire vertical.
   */
  layout?: "default" | "auth";
}

/**
 * Campo de formulario FotoRank: label → control (32px) → helper → error.
 * Jerarquía: label (base semibold) > hint (sm muted) > microcopy (xs soft).
 */
export function FormField({
  id,
  label,
  microcopy,
  hint,
  error,
  required,
  children,
  className = "",
  variant = "default",
  layout = "default",
}: FormFieldProps) {
  const isWizard = variant === "wizard";
  const isAuth = layout === "auth" && !isWizard;
  const labelCls = isWizard
    ? `${labelWizard} block`
    : isAuth
      ? `${labelBase} block text-center`
      : `${labelBase} block`;
  const gapLabelToControl = isWizard ? "mt-3" : isAuth ? "mt-12 md:mt-14" : "mt-10";
  const pb = isWizard ? "pb-0" : isAuth ? "pb-14 md:pb-16" : "pb-10 last:pb-0";

  return (
    <div className={`fr-form-field ${pb} ${className}`.trim()}>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required ? (
          <span className="ml-1 text-sm font-medium text-gold/90" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className={gapLabelToControl}>{children}</div>
      {microcopy ? (
        <p
          className={`${microcopyTextClass} ${isAuth ? "mt-5 text-center md:mt-6" : "mt-3"} ${error ? "opacity-80" : ""}`}
        >
          {microcopy}
        </p>
      ) : null}
      {hint ? (
        <p
          className={`${helperTextClass} ${microcopy ? "mt-2" : "mt-3"} ${isAuth ? "text-center" : ""}`}
          role="note"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={`${errorTextClass} mt-3 ${isAuth ? "text-center" : ""}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  reserveSubtitleSpace?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Sección de formulario: título → descripción (16px) → stack de campos (40px entre campos vía hijos).
 */
export function FormSection({
  title,
  description,
  reserveSubtitleSpace = false,
  children,
  className = "",
}: FormSectionProps) {
  const showSpacer = reserveSubtitleSpace && !description;

  return (
    <div className={`fr-form-section ${className}`.trim()}>
      <header className="mb-10 max-w-2xl">
        <h3 className="font-sans text-xl font-semibold leading-tight tracking-tight text-fr-primary md:text-2xl">
          {title}
        </h3>
        {description ? (
          <p className="mt-4 text-sm leading-relaxed text-fr-muted md:text-base">{description}</p>
        ) : showSpacer ? (
          <div className="mt-4 min-h-[1.5rem]" aria-hidden />
        ) : null}
      </header>
      <div className="fr-form-section-fields flex flex-col space-y-0">{children}</div>
    </div>
  );
}

/** Footer de formulario: borde, separación 64px + padding (design_rule fr-form-actions). */
export function FormActions({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`fr-form-actions ${className}`.trim()}>{children}</div>;
}
