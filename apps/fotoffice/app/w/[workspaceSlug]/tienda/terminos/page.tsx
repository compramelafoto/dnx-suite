import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_HOLD_MINUTES, STORE_LEGAL_VERSION, STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadStoreWorkspace } from "@/lib/store/repository";
import { effectiveReturnsPolicy } from "@/lib/store/settings-form";
import { loadCheckoutDeliveryOptions } from "@/lib/store/shipping/checkout-server";
import { deliveryTermsParagraphs } from "@/lib/store/shipping/terms";
import { StoreLegalFooter } from "@/components/store/store-legal-footer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadStoreWorkspace((await params).workspaceSlug);
  return store ? { title: `Términos y devoluciones — ${store.workspace.name}` } : {};
}

/** "2026-10-04" → "4 de octubre de 2026". La versión es una fecha de calendario, sin hora. */
function fechaDeVersion(version: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!m) return version;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}

/**
 * Los términos que acepta quien compra (versión `STORE_LEGAL_VERSION`, la que se guarda en cada
 * pedido). FUERA del grupo `(abierta)`: se leen aunque la tienda esté cerrada. Sin configuración
 * de la tienda, la política de devoluciones por omisión. La entrega dice las mismas formas que
 * ofrece el checkout (sin envíos configurados, sólo retiro).
 */
export default async function StoreTermsPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) notFound();
  const base = `/w/${store.workspace.slug}/${STORE_PUBLIC_SEGMENT}`;
  const name = store.workspace.name;
  const pickup = store.pickup ?? { pickupAddress: null, pickupHours: null };
  const entrega = deliveryTermsParagraphs(await loadCheckoutDeliveryOptions(store.workspace.id), pickup);

  return (
    <>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 md:px-8 md:py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Términos y devoluciones</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            Tienda online de {name}. Versión del {fechaDeVersion(STORE_LEGAL_VERSION)}.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Quién vende</h2>
          <p className="text-sm leading-relaxed">
            Los productos los vende {name}, que es quien prepara cada pedido, lo entrega y atiende los cambios y
            devoluciones. La tienda funciona sobre FOTOFFICE.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Precios y pago</h2>
          <p className="text-sm leading-relaxed">
            Los precios están en pesos argentinos. Se paga online con Mercado Pago, con los
            medios que ofrezca en ese momento (tarjetas de crédito y débito, dinero en cuenta y otros). Al iniciar el pago
            reservamos los productos por {STORE_HOLD_MINUTES} minutos; si el pago no se completa, la reserva vence sola y no se cobra nada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Entrega</h2>
          {entrega.map((parrafo, i) => (
            <p key={i} className="text-sm leading-relaxed">
              {parrafo}
            </p>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Devoluciones y arrepentimiento</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{effectiveReturnsPolicy(store.returnsPolicy)}</p>
          <p className="text-sm leading-relaxed">
            Para arrepentirte de una compra usá el{" "}
            <Link href={`${base}/arrepentimiento`} className="font-medium underline underline-offset-4">
              botón de arrepentimiento
            </Link>
            : con tu número de pedido y tu email te damos un código de trámite.
          </p>
        </section>
      </main>
      <StoreLegalFooter workspaceSlug={store.workspace.slug} />
    </>
  );
}
