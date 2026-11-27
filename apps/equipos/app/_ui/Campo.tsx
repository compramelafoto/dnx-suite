import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Etiqueta, control, ayuda y error (debajo del control). Si el hijo es un único control, le pone el
 * `id` y lo vincula con la ayuda y el error; si no, la etiqueta envuelve al contenido.
 */
export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  const base = useId();
  const idAyuda = ayuda ? `${base}-ayuda` : undefined;
  const idError = error ? `${base}-error` : undefined;

  const ayudaYError = (
    <>
      {ayuda ? (
        <p className="campo-ayuda" id={idAyuda}>
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p className="campo-error" id={idError} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (isValidElement<ControlProps>(children)) {
    const control = children as ReactElement<ControlProps>;
    const id = control.props.id ?? `${base}-control`;
    const describedBy =
      [control.props["aria-describedby"], idAyuda, idError].filter(Boolean).join(" ") || undefined;
    return (
      <div className="campo">
        <label className="campo-etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
        {cloneElement(control, {
          id,
          "aria-describedby": describedBy,
          ...(error ? { "aria-invalid": true } : {}),
        })}
        {ayudaYError}
      </div>
    );
  }

  return (
    <div className="campo">
      <label className="campo">
        <span className="campo-etiqueta">{etiqueta}</span>
        {children}
      </label>
      {ayudaYError}
    </div>
  );
}
