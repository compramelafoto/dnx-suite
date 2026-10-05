import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadOpenStore } from "@/lib/store/repository";
import { loadCheckoutDeliveryOptions } from "@/lib/store/shipping/checkout-server";
import { CartView } from "@/components/store/cart-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadOpenStore((await params).workspaceSlug);
  // El carrito es de cada persona: no tiene nada que indexar.
  return store ? { title: `Carrito — ${store.workspace.name}`, robots: { index: false, follow: false } } : {};
}

/** El carrito. Vive en el navegador; esta página sólo pone el marco y lo que el servidor sabe (dónde se retira y si hay envíos). */
export default async function CartPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();
  const opciones = await loadCheckoutDeliveryOptions(store.workspace.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Tu carrito</h1>
      <CartView pickupAddress={store.settings.pickupAddress} shippingAvailable={opciones.home || opciones.branch} />
    </main>
  );
}
