import Link from "next/link";
import type { ReactNode } from "react";

/** La ficha de un cliente. Única fuente de la ruta: cualquier nombre de cliente enlaza acá. */
export function hrefFichaCliente(clientId: string): string {
  return `/clientes/${encodeURIComponent(clientId)}`;
}

/**
 * El nombre de un cliente como enlace a su ficha. Regla del panel: donde aparezca el nombre de un
 * cliente, al tocarlo se va a su ficha. Sin `clientId` (un contacto que todavía no es cliente),
 * se muestra el texto solo.
 *
 * Hereda tamaño y peso del lugar donde va; sólo agrega el subrayado al pasar y el foco visible.
 * Sin estado ni hooks: sirve en componentes de servidor y de cliente.
 */
export function EnlaceCliente({
  clientId,
  children,
  className = "",
}: {
  clientId: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!clientId) return <span className={className}>{children}</span>;
  return (
    <Link
      href={hrefFichaCliente(clientId)}
      title="Ver la ficha del cliente"
      className={`underline-offset-2 hover:text-[var(--fo-ent-cliente)] hover:underline focus-visible:underline ${className}`}
    >
      {children}
    </Link>
  );
}
