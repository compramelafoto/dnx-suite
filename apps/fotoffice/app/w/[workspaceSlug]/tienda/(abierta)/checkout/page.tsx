import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadOpenStore } from "@/lib/store/repository";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadOpenStore((await params).workspaceSlug);
  // Es de cada comprador: no hay nada que indexar.
  return store ? { title: `Finalizar compra — ${store.workspace.name}`, robots: { index: false, follow: false } } : {};
}

/**
 * El checkout. El carrito vive en el navegador; esta página pone lo que sabe el servidor: dónde y
 * cuándo se retira, y a dónde están los términos (`/tienda/terminos`).
 */
export default async function CheckoutPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();

  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;
  const { pickupAddress, pickupHours, pickupInstructions } = store.settings;
  const pickupLine = pickupAddress
    ? `Retiro en ${pickupAddress}${pickupHours ? ` — ${pickupHours}` : ""}`
    : pickupHours
      ? `Horarios de retiro: ${pickupHours}`
      : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Finalizar compra</h1>
      <CheckoutForm
        storeHref={base}
        cartHref={`${base}/carrito`}
        termsHref={`${base}/terminos`}
        pickupLine={pickupLine}
        pickupInstructions={pickupInstructions}
      />
    </main>
  );
}
