import Link from "next/link";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";

/**
 * El pie legal de la tienda: el botón de arrepentimiento (Res. SCI 424/2020 pide que esté a la
 * vista, con ese nombre, en el sitio donde se vende) y los términos. Lo ponen el layout de la
 * vitrina, el del pedido y las páginas de arrepentimiento y términos: todas las páginas públicas
 * de la tienda, abierta o cerrada.
 */
export function StoreLegalFooter({ workspaceSlug }: { workspaceSlug: string }) {
  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 md:px-8">
      <nav
        aria-label="Información legal de la tienda"
        className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--fo-border)] pt-4 text-sm"
      >
        <Link href={`${base}/arrepentimiento`} className="font-medium underline underline-offset-4">
          Botón de arrepentimiento
        </Link>
        <Link href={`${base}/terminos`} className="underline underline-offset-4">
          Términos y devoluciones
        </Link>
      </nav>
    </div>
  );
}
