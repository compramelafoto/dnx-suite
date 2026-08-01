"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { routes } from "@/config/navigation";
import type { PublicStoreOrderView } from "@/lib/public-store/checkout/types";
import { useStoreCart } from "@/components/store/cart/StoreCartProvider";

type Props = {
  order: PublicStoreOrderView;
};

export function StoreOrderView({ order }: Props) {
  const { clearPurchasedLines } = useStoreCart();

  useEffect(() => {
    if (order.status === "PAID" && order.paymentStatus === "APPROVED") {
      clearPurchasedLines({
        commercialFingerprint: order.commercialFingerprint,
        items: [],
      });
    }
  }, [order.status, order.paymentStatus, order.commercialFingerprint, clearPurchasedLines]);

  return (
    <div className="space-y-10">
      <Card className="space-y-6">
        <div className="space-y-2">
          <p className="ck-eyebrow text-ck-yellow">Pedido</p>
          <h1 className="ck-display-md text-ck-text">{order.publicId}</h1>
          <p className="ck-body-sm text-ck-text-muted">
            {new Date(order.createdAt).toLocaleString("es-AR")}
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="ck-caption text-ck-text-muted">Estado del pedido</dt>
            <dd className="font-semibold text-ck-text">{order.status}</dd>
          </div>
          <div>
            <dt className="ck-caption text-ck-text-muted">Estado del pago</dt>
            <dd className="font-semibold text-ck-text">{order.paymentStatus}</dd>
          </div>
          <div>
            <dt className="ck-caption text-ck-text-muted">Contacto</dt>
            <dd className="text-ck-text">
              {order.customer.firstName} {order.customer.lastName}
              <br />
              {order.customer.emailMasked} · {order.customer.phoneMasked}
            </dd>
          </div>
          <div>
            <dt className="ck-caption text-ck-text-muted">Entrega</dt>
            <dd className="text-ck-text">{order.deliverySummary}</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-4" aria-label="Ítems del pedido">
        <h2 className="ck-heading-md">Productos</h2>
        <ul className="divide-y divide-ck-border">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between gap-4 py-4">
              <div>
                <p className="font-semibold text-ck-text">{item.productName}</p>
                <p className="ck-body-sm text-ck-text-muted">
                  {item.variantName} · x{item.quantity}
                </p>
              </div>
              <p className="font-semibold text-ck-text">
                {formatPublicPrice(item.lineSubtotalAmount, item.currency)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-ck-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatPublicPrice(order.subtotalAmount, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Entrega</dt>
            <dd>{formatPublicPrice(order.deliveryAmount, order.currency)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="text-ck-yellow">
              {formatPublicPrice(order.totalAmount, order.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      {order.canRetryPayment ? (
        <RetryPaymentButton publicId={order.publicId} />
      ) : null}

      <ul className="list-disc space-y-2 pl-5 ck-body-sm text-ck-text-muted">
        {order.operationalNotes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <Button href={routes.store} variant="secondary">
        Volver a la tienda
      </Button>
    </div>
  );
}

function RetryPaymentButton({ publicId }: { publicId: string }) {
  return (
    <Button
      type="button"
      variant="primary"
      onClick={async () => {
        const res = await fetch("/api/store/orders/retry-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ publicId }),
        });
        const data = (await res.json()) as { checkoutUrl?: string; error?: string };
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        alert(data.error ?? "No se pudo reiniciar el pago.");
      }}
    >
      Reintentar pago
    </Button>
  );
}
