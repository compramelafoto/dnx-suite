import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadOpenStore } from "@/lib/store/repository";
import { hasPublicArtworks } from "@/lib/store/artworks/storefront";
import { CartProvider } from "@/components/store/cart-provider";
import { CartBadge } from "@/components/store/cart-badge";
import { StoreLegalFooter } from "@/components/store/store-legal-footer";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El marco de la tienda, dentro del sitio público de la institución (el layout de `/w` pone el
 * encabezado y el pie del sitio). Agrega el carrito —que comparten la vitrina, la ficha y el
 * carrito— y una barra con el acceso al carrito y su contador.
 *
 * Tienda cerrada o módulo apagado: 404 en todas sus páginas, igual que el menú, que la esconde.
 * La página de un pedido (`../pedido`) queda fuera de este grupo a propósito: quien pagó tiene
 * que poder verla aunque la tienda se cierre.
 *
 * "Obras" (las copias de obras de concursos) aparece en la barra sólo si hay al menos una obra a
 * la venta: sin obras, la tienda se ve como antes.
 */
export default async function StoreLayout({ children, params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();
  const conObras = await hasPublicArtworks(store.workspace.id);
  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;

  return (
    <CartProvider workspaceSlug={workspaceSlug}>
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-4">
          <Link href={base} className="min-w-0 truncate text-sm font-medium hover:underline">
            Tienda de {store.workspace.name}
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            {conObras ? (
              <nav aria-label="Secciones de la tienda" className="flex items-center gap-4 text-sm">
                <Link href={base} className="underline-offset-4 hover:underline">
                  Productos
                </Link>
                <Link href={`${base}/obras`} className="underline-offset-4 hover:underline">
                  Obras
                </Link>
              </nav>
            ) : null}
            <CartBadge />
          </div>
        </div>
      </div>
      {children}
      <StoreLegalFooter workspaceSlug={workspaceSlug} />
    </CartProvider>
  );
}
