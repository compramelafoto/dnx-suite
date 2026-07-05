import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DsFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control con ancho stretch (`.ds-field` + `.ds-input-wrapper`). */
export function DsField({ label, hint, error, htmlFor, errorId, className, children }: DsFieldProps) {
  const resolvedErrorId = errorId ?? (htmlFor ? `${htmlFor}-error` : undefined);

  return (
    <div className={cn("ds-field", className)}>
      <label htmlFor={htmlFor} className="ds-field__label ds-admin-text mb-2 block text-sm font-medium text-[#1a1a1a]">
        {label}
      </label>
      <div className="ds-input-wrapper">{children}</div>
      {hint && !error ? (
        <p className="ds-field__hint ds-admin-text mt-1 text-xs text-[#6b7280]">{hint}</p>
      ) : null}
      {error ? (
        <p id={resolvedErrorId} className="ds-field__error ds-admin-text mt-1.5 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
