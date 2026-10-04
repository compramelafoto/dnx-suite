import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadOpenStore } from "@/lib/store/repository";
import { CartProvider } from "@/components/store/cart-provider";
import { CartBadge } from "@/components/store/cart-badge";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El marco de la tienda, dentro del sitio público de la institución (el layout de `/w` pone el
 * encabezado y el pie del sitio). Agrega el carrito —que comparten la vitrina, la ficha y el
 * carrito— y una barra con el acceso al carrito y su contador.
 *
 * Tienda cerrada o módulo apagado: 404 en todas sus páginas, igual que el menú, que la esconde.
 */
export default async function StoreLayout({ children, params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();

  return (
    <CartProvider workspaceSlug={workspaceSlug}>
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-4">
          <Link href={`/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`} className="min-w-0 truncate text-sm font-medium hover:underline">
            Tienda de {store.workspace.name}
          </Link>
          <CartBadge />
        </div>
      </div>
      {children}
    </CartProvider>
  );
}
