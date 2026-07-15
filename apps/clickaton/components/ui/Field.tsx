import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Wrapper accesible de campo: label visible + hint/error asociados al control.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      id,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
      required: required || undefined,
      invalid: Boolean(error) || undefined,
    });
  });

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="ck-label block text-ck-text">
        {label}
        {required ? (
          <span className="text-ck-yellow" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint && !error ? (
        <p id={hintId} className="ck-caption text-ck-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ck-caption text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
