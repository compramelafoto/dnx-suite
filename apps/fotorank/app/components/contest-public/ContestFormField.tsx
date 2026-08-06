import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type Props = {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Campo de formulario para inscripción pública.
 * Relación compacta label → control → helper (sin mt-8/mt-10 arbitrarios).
 */
export function ContestFormField({ id, label, required, hint, error, children, className }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = Children.map(children, (child) => {
    if (!isValidElement(child) || !describedBy) return child;
    const el = child as ReactElement<{ "aria-describedby"?: string }>;
    const existing = el.props["aria-describedby"];
    return cloneElement(el, {
      "aria-describedby": [existing, describedBy].filter(Boolean).join(" "),
    });
  });

  return (
    <div className={["fr-contest-field", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className="fr-type-label">
        {label}
        {required ? (
          <span className="fr-contest-field__req" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="fr-contest-field__control">{control}</div>
      {hint ? (
        <p id={hintId} className="fr-type-helper" role="note">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="fr-type-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const contestControlClass = "fr-contest-control";
export const contestControlErrorClass = "fr-contest-control fr-contest-control--error";
export const contestSelectClass = "fr-contest-control fr-contest-control--select";
