"use client";

import * as React from "react";

/* Default — dashboards / onboarding genérico */
export const inputBase =
  "block w-full rounded-lg border border-[#262626] bg-[#0a0a0a] px-5 py-4 text-base leading-relaxed text-fr-primary placeholder:text-fr-muted-soft transition-colors hover:border-[#333] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20";

/** Login / registro en shell: contenido y placeholder centrados, más alto táctil, borde un poco más suave. */
export const inputAuth =
  "block w-full min-h-[3.25rem] rounded-xl border border-[#333333] bg-[#0a0a0a] px-5 py-[1.125rem] text-center text-base leading-relaxed text-fr-primary placeholder:text-center placeholder:text-fr-muted-soft transition-colors hover:border-[#404040] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 md:min-h-[3.5rem] md:py-5";

/** Wizard / SaaS: más alto, bordes suaves, glow sutil al focus */
export const inputWizard =
  "block w-full min-h-[46px] rounded-xl border border-zinc-700 bg-[#050505] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 placeholder:transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

/** Textarea wizard: mismo estilo que inputWizard pero min-h mayor */
export const textareaWizard =
  "block w-full min-h-[120px] rounded-xl border border-zinc-700 bg-[#050505] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 placeholder:transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-y";

export const selectBase =
  "block w-full cursor-pointer appearance-none rounded-lg border border-[#262626] bg-[#0a0a0a] bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center] px-5 py-4 pr-10 text-base leading-relaxed text-fr-primary transition-colors hover:border-[#333] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23a1a1a1%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]";

export const selectWizard =
  "block w-[67%] ml-[12%] max-w-full min-h-[3.5rem] cursor-pointer appearance-none rounded-xl border border-[#383838] bg-[#0e0e0e] bg-[length:1.125rem] bg-[position:right_1rem_center] bg-no-repeat px-4 py-4 pr-12 text-base font-medium leading-relaxed text-fr-primary shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-all duration-200 hover:border-gold/40 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.08)] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/35 [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23c9a227%22%20stroke-width%3D%222.25%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

export const labelBase = "text-lg font-semibold leading-snug text-fr-primary";
export const labelWizard =
  "text-sm font-medium leading-snug text-white sm:text-base";

export const hintBase = "mt-6 text-sm leading-relaxed text-fr-muted";

interface FormFieldProps {
  id?: string;
  label: React.ReactNode;
  /** Microcopy contextual debajo del input (UX) */
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
  const gapInput = isWizard ? "mt-3" : isAuth ? "mt-12 md:mt-14" : "mt-10";
  const microCls = `text-xs leading-relaxed text-fr-muted ${isAuth ? "mt-5 text-center md:mt-6" : "mt-3"}`;
  const pb = isWizard ? "pb-0" : isAuth ? "pb-14 md:pb-16" : "pb-6";

  return (
    <div className={`fr-form-field ${pb} ${className}`}>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>
      <div className={gapInput}>{children}</div>
      {microcopy ? <p className={`${microCls} ${error ? "text-fr-muted-soft/90" : ""}`}>{microcopy}</p> : null}
      {hint ? (
        <p
          className={
            isWizard
              ? `text-xs leading-relaxed text-fr-muted-soft ${microcopy ? "mt-1.5" : "mt-2"}`
              : isAuth
                ? "mt-5 text-center text-sm leading-relaxed text-fr-muted md:mt-6"
                : hintBase
          }
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={`mt-3 text-xs font-medium text-red-400 ${isAuth ? "text-center" : ""}`}>{error}</p>
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

export function FormSection({
  title,
  description,
  reserveSubtitleSpace = false,
  children,
  className = "",
}: FormSectionProps) {
  const showSpacer = reserveSubtitleSpace && !description;

  return (
    <div className={`fr-form-section ${className}`}>
      <div className="mb-16">
        <h3 className="font-sans text-xl font-semibold leading-tight text-fr-primary">{title}</h3>
        {description ? (
          <p className="mt-6 text-base leading-relaxed text-fr-muted">{description}</p>
        ) : showSpacer ? (
          <div className="mt-6 min-h-[2.75rem]" aria-hidden />
        ) : null}
      </div>
      <div className="space-y-16">{children}</div>
    </div>
  );
}
