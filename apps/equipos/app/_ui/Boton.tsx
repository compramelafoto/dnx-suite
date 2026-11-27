import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export type VarianteBoton = "principal" | "secundario" | "peligro";

function clases(variante: VarianteBoton, extra?: string): string {
  return ["boton", `boton-${variante}`, extra].filter(Boolean).join(" ");
}

/** Botón del portal. El texto es la acción exacta («Guardar cambios», «Enviar denuncia»). */
export function Boton({
  variante = "principal",
  className,
  type = "submit",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return <button type={type} className={clases(variante, className)} {...props} />;
}

/** Enlace con forma de botón, para acciones que llevan a otra pantalla. */
export function BotonEnlace({
  variante = "principal",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variante?: VarianteBoton; href: string }) {
  return <a className={clases(variante, className)} {...props} />;
}
