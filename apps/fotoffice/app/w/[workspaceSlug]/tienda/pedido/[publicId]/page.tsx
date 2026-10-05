import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { StoreOrderStatus } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { decimalArsToMinor } from "@/lib/membership/money";
import { checkStoreOrderPayment } from "@/lib/store/mp-payment";
import { keptReturnParams, storeOrderCookieName, storeVisibleBase } from "@/lib/store/order-access";
import { findStoreOrderForPage, tokenOpensOrder, type StoreOrderPageRow } from "@/lib/store/order-page";
import { loadOpenStore, loadStoreWorkspace } from "@/lib/store/repository";
import { orderShippingView } from "@/lib/store/shipping/order-destination";
import { trackingUrl } from "@/lib/store/shipping/tracking";
import { hostWithoutPort } from "@/lib/website/domain/normalize";
import { Price } from "@/components/store/price";
import { ClearCartWhenPaid, RetryPaymentButton } from "./order-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; publicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  // Es de quien compró: no se indexa, y no se manda la dirección (que puede llevar el token) a
  // los sitios que se abran desde acá. El encabezado HTTP lo pone `next.config.ts`.
  return { title: "Tu pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

const PAGADO: readonly StoreOrderStatus[] = ["PAID", "READY", "DELIVERED", "PAID_NO_STOCK", "SHIPPED"];

/** Los títulos para quien compró (los del panel, `STORE_ORDER_STATUS_LABELS`, son para el personal). */
const TITULO: Record<StoreOrderStatus, string> = {
  PENDING_PAYMENT: "Esperando el pago",
  PAID: "¡Gracias por tu compra!",
  READY: "Listo para retirar",
  DELIVERED: "Entregado",
  CANCELLED: "Pedido cancelado",
  EXPIRED: "Reserva vencida",
  PAID_NO_STOCK: "Recibimos tu pago",
  SHIPPED: "Tu pedido está en camino",
};

/** Un envío no queda "listo para retirar": si un pedido viejo estuviera ahí, no se lo dice. */
function titulo(status: StoreOrderStatus, conEnvio: boolean): string {
  if (conEnvio && status === "READY") return TITULO.PAID;
  return TITULO[status];
}

function uno(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}

function horaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * La página de un pedido de la tienda. Sin cuenta: se abre con la cookie del pedido o con el
 * token en la dirección (`?t=`, la vuelta de Mercado Pago y los correos). Sin ninguno válido
 * responde 404, igual que un pedido que no existe.
 *
 * A la vuelta de Mercado Pago (`?pago=`), si el pedido sigue esperando, se le pregunta UNA vez a
 * Mercado Pago por el pago que trae la dirección: el aviso suele tardar unos segundos más que la
 * persona.
 */
export default async function StoreOrderPage({ params, searchParams }: Props) {
  const { workspaceSlug, publicId } = await params;
  const sp = await searchParams;
  // Sin exigir la tienda abierta: un pedido pagado se ve aunque la tienda se cierre.
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) notFound();

  let pedido = await findStoreOrderForPage(store.workspace.id, publicId);
  if (!pedido) notFound();

  const h = await headers();
  const host = hostWithoutPort(h.get("x-forwarded-host") ?? h.get("host") ?? "");
  const base = storeVisibleBase({ slug: store.workspace.slug, host, fotofficeOrigin: appUrl() });

  // Token en la dirección: se cambia por la cookie y se saca de la dirección (ver `acceso`).
  const tokenEnDireccion = uno(sp.t);
  if (tokenEnDireccion && tokenOpensOrder(tokenEnDireccion, pedido)) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") query.set(k, v);
    const resto = keptReturnParams(query);
    resto.set("t", tokenEnDireccion);
    redirect(`${base}/pedido/${pedido.publicId}/acceso?${resto.toString()}`);
  }

  const cookie = (await cookies()).get(storeOrderCookieName(pedido.publicId))?.value;
  if (!tokenOpensOrder(cookie, pedido)) notFound();

  const pago = uno(sp.pago);
  const paymentId = uno(sp.payment_id);
  if (pago && paymentId && /^\d{1,30}$/.test(paymentId) && (pedido.status === "PENDING_PAYMENT" || pedido.status === "EXPIRED")) {
    const r = await checkStoreOrderPayment({
      workspaceId: store.workspace.id,
      orderId: pedido.id,
      providerPaymentId: paymentId,
    });
    if (r.outcome === "credited") {
      pedido = (await findStoreOrderForPage(store.workspace.id, publicId)) ?? pedido;
    }
  }

  const ahora = new Date();
  const esperando =
    pedido.status === "PENDING_PAYMENT" && pedido.holdExpiresAt !== null && pedido.holdExpiresAt.getTime() > ahora.getTime();
  const pagado = PAGADO.includes(pedido.status);
  const envio = orderShippingView(pedido);
  const pickupAddress = store.pickup?.pickupAddress ?? null;
  const pickupHours = store.pickup?.pickupHours ?? null;
  const pickupInstructions = store.pickup?.pickupInstructions ?? null;
  // Volver a pagar sí exige la tienda abierta: con la tienda cerrada no se cobra nada nuevo.
  const abierta = esperando ? (await loadOpenStore(workspaceSlug)) !== null : false;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      {pagado ? <ClearCartWhenPaid /> : null}

      <header className="space-y-1">
        <p className="text-sm text-[var(--fo-muted)]">Pedido #{pedido.orderNumber}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{titulo(pedido.status, envio !== null)}</h1>
      </header>

      <EstadoDelPedido pedido={pedido} esperando={esperando} pago={pago} conEnvio={envio !== null} />

      {/* Volviendo de pagar (aprobado o pendiente, p. ej. en efectivo) no se ofrece pagar otra vez: sería un pago doble. */}
      {esperando && abierta && pago !== "ok" && pago !== "pendiente" ? <RetryPaymentButton workspaceSlug={store.workspace.slug} publicId={pedido.publicId} /> : null}

      <section className="fo-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Tu compra</h2>
        <ul className="divide-y divide-[var(--fo-border)]">
          {pedido.items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{it.productName}</p>
                {it.variantName ? <p className="text-xs text-[var(--fo-muted)]">Talle {it.variantName}</p> : null}
                <p className="text-xs text-[var(--fo-muted)]">
                  {it.qty} × <Price minor={decimalArsToMinor(it.unitPriceArs)} />
                </p>
              </div>
              <Price minor={decimalArsToMinor(it.lineTotalArs)} className="shrink-0 font-medium" />
            </li>
          ))}
          {envio ? (
            <li className="flex items-start justify-between gap-4 py-3">
              <p className="font-medium">{envio.label}</p>
              <Price minor={decimalArsToMinor(pedido.shippingArs)} className="shrink-0 font-medium" />
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-[var(--fo-border)] pt-4 text-lg font-semibold">
          <span>Total</span>
          <Price minor={decimalArsToMinor(pedido.totalArs)} />
        </div>
      </section>

      {envio ? (
        <section className="fo-card space-y-2 p-6">
          <h2 className="text-lg font-semibold">{envio.label}</h2>
          {envio.lines.map((l, i) => (
            <p key={i} className={i === 0 ? undefined : "text-sm text-[var(--fo-muted)]"}>
              {l}
            </p>
          ))}
        </section>
      ) : pickupAddress || pickupHours || pickupInstructions ? (
        <section className="fo-card space-y-2 p-6">
          <h2 className="text-lg font-semibold">Retiro</h2>
          {pickupAddress ? <p>{pickupAddress}</p> : null}
          {pickupHours ? <p className="text-sm text-[var(--fo-muted)]">{pickupHours}</p> : null}
          {pickupInstructions ? <p className="text-sm text-[var(--fo-muted)]">{pickupInstructions}</p> : null}
        </section>
      ) : null}

      <p className="text-sm">
        <Link href={base} className="hover:underline">
          Volver a la tienda
        </Link>
      </p>
    </main>
  );
}

function EstadoDelPedido({
  pedido,
  esperando,
  pago,
  conEnvio,
}: {
  pedido: StoreOrderPageRow;
  esperando: boolean;
  pago: string | null;
  conEnvio: boolean;
}) {
  const texto = (t: string) => <p className="text-[var(--fo-muted)]">{t}</p>;

  switch (pedido.status) {
    case "PAID":
      return texto(
        conEnvio
          ? "Recibimos tu pago. Estamos preparando tu envío: te avisamos por correo cuando lo despachemos."
          : "Recibimos tu pago. Te avisamos por correo cuando tu pedido esté listo para retirar.",
      );
    case "READY":
      return texto(conEnvio ? "Estamos preparando tu envío." : "Tu pedido está listo. Podés pasar a retirarlo.");
    case "SHIPPED": {
      const enlace = trackingUrl(pedido.shippingSource, pedido.trackingNumber);
      return (
        <div className="space-y-1">
          {texto("Tu pedido está en camino.")}
          {pedido.trackingNumber ? (
            <p>
              Número de seguimiento: <span className="font-medium">{pedido.trackingNumber}</span>
              {enlace ? (
                <>
                  {" · "}
                  <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline">
                    Seguilo en Correo Argentino
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      );
    }
    case "DELIVERED":
      return texto(conEnvio ? "Entregado. ¡Gracias por tu compra!" : "Ya retiraste este pedido. ¡Gracias por tu compra!");
    case "PAID_NO_STOCK":
      return texto(
        "Recibimos tu pago, pero nos quedamos sin stock de algo de tu pedido. La institución se va a comunicar con vos para resolverlo.",
      );
    case "CANCELLED":
      return texto("Este pedido se canceló.");
    case "EXPIRED":
    case "PENDING_PAYMENT":
      if (pago === "ok" || pago === "pendiente") {
        return texto("Estamos confirmando tu pago… Puede tardar unos minutos. Te avisamos por correo cuando se acredite.");
      }
      if (!esperando) {
        return texto("La reserva de este pedido venció sin que se acreditara el pago. Si querés, volvé a la tienda para comprar de nuevo.");
      }
      if (pago === "error") {
        return texto(
          `El pago no se completó. Podés intentarlo de nuevo: reservamos tus productos hasta las ${horaArgentina(pedido.holdExpiresAt as Date)}.`,
        );
      }
      return texto(`Reservamos tus productos hasta las ${horaArgentina(pedido.holdExpiresAt as Date)}. Falta el pago.`);
  }
}
