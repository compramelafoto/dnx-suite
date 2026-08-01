"use client";

import { Card } from "@/components/ui/Card";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import type { StoreCartTotals } from "@/lib/public-store/cart";

type Props = {
  totals: StoreCartTotals;
  deliveryAmount: number;
};

export function StoreCheckoutSummary({ totals, deliveryAmount }: Props) {
  const subtotal = formatPublicPrice(totals.subtotalMinor, totals.currency);
  const delivery = formatPublicPrice(deliveryAmount, totals.currency);
  const total = formatPublicPrice(totals.subtotalMinor + deliveryAmount, totals.currency);

  return (
    <Card className="space-y-6" aria-label="Resumen del pedido">
      <h2 className="ck-heading-md">Resumen</h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ck-text-secondary">Productos</dt>
          <dd className="font-semibold text-ck-text">{subtotal}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ck-text-secondary">Entrega (retiro)</dt>
          <dd className="font-semibold text-ck-text">{delivery}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-ck-border pt-3">
          <dt className="ck-heading-md">Total</dt>
          <dd className="ck-heading-md text-ck-yellow">{total}</dd>
        </div>
      </dl>
      <p className="ck-caption text-ck-text-muted">
        Precios y stock se confirman en servidor al crear el pedido. El stock se reserva
        temporalmente al confirmar.
      </p>
    </Card>
  );
}
