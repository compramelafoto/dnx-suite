"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/navigation";

type Props = {
  variant: "exito" | "pendiente" | "error";
  publicId: string | null;
  orderPath: string | null;
  canonicalStatus: string | null;
};

const COPY = {
  exito: {
    title: "Regresaste del pago",
    body: "Si el pago fue aprobado, el estado se actualizará cuando el proveedor lo confirme. Esta pantalla no marca el pedido como pagado.",
  },
  pendiente: {
    title: "Pago pendiente",
    body: "Tu pago todavía no está confirmado. Podés consultar el estado del pedido en unos minutos.",
  },
  error: {
    title: "No se completó el pago",
    body: "Podés reintentar el pago desde el detalle del pedido si la reserva sigue vigente.",
  },
} as const;

export function StorePaymentReturnView({
  variant,
  publicId,
  orderPath,
  canonicalStatus,
}: Props) {
  const copy = COPY[variant];
  return (
    <Card className="space-y-6">
      <h1 className="ck-display-md text-ck-text">{copy.title}</h1>
      <p className="ck-body text-ck-text-secondary">{copy.body}</p>
      {publicId ? (
        <p className="ck-body-sm text-ck-text-muted">
          Pedido: <span className="font-semibold text-ck-text">{publicId}</span>
        </p>
      ) : null}
      {canonicalStatus ? (
        <p className="ck-body-sm text-ck-text-muted" aria-live="polite">
          Estado canónico actual: <strong>{canonicalStatus}</strong>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {orderPath ? (
          <Button href={orderPath} variant="primary">
            Ver pedido
          </Button>
        ) : null}
        <Button href={routes.storeCart} variant="secondary">
          Ir al carrito
        </Button>
      </div>
    </Card>
  );
}
