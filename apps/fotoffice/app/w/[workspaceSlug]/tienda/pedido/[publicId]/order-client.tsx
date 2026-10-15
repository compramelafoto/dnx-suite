"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useCart } from "@/components/store/cart-provider";
import { retryStorePaymentAction } from "./actions";

/** Con el pedido pagado, lo que quedó en el carrito de este navegador ya se compró: se vacía. */
export function ClearCartWhenPaid() {
  const { hydrated, clear } = useCart();
  const hecho = useRef(false);
  useEffect(() => {
    if (!hydrated || hecho.current) return;
    hecho.current = true;
    clear();
  }, [hydrated, clear]);
  return null;
}

/** "Volver a pagar": abre otra vez Mercado Pago para un pedido que sigue esperando el pago. */
export function RetryPaymentButton({ workspaceSlug, publicId }: { workspaceSlug: string; publicId: string }) {
  const [enviando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="fo-btn fo-btn-primary"
        disabled={enviando}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await retryStorePaymentAction(workspaceSlug, publicId);
            if (r && !r.ok) setError(r.error);
          });
        }}
      >
        {enviando ? "Abriendo Mercado Pago…" : "Volver a pagar"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
