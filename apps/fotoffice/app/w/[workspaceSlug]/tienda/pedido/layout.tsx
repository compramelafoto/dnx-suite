import type { ReactNode } from "react";
import { CartProvider } from "@/components/store/cart-provider";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El marco de la página de un pedido. A propósito FUERA del grupo `(abierta)`, cuyo layout da 404
 * si la tienda está cerrada o el módulo apagado: quien pagó tiene que poder ver su pedido igual.
 * Sólo pone el carrito (para vaciarlo cuando el pedido está pagado).
 */
export default async function StoreOrderLayout({ children, params }: Props) {
  const { workspaceSlug } = await params;
  return <CartProvider workspaceSlug={workspaceSlug}>{children}</CartProvider>;
}
