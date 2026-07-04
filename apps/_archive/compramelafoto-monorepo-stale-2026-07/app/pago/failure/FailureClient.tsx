"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function FailureClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderType = (searchParams.get("orderType") || "PRINT_ORDER") as "PRINT_ORDER" | "ALBUM_ORDER";
  const paymentId = searchParams.get("payment_id") || searchParams.get("preference_id");

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!orderId || !paymentId) {
      return;
    }

    // Confirmar el pago para actualizar el estado en la BD
    async function confirmPayment() {
      setConfirming(true);
      try {
        await fetch("/api/payments/mp/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            orderId: Number(orderId),
            orderType,
          }),
        });
        setConfirmed(true);
      } catch (err) {
        console.error("Error confirmando pago:", err);
      } finally {
        setConfirming(false);
      }
    }

    confirmPayment();
  }, [orderId, paymentId, orderType]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>❌ Pago rechazado / cancelado</h1>
      <p>
        Pedido: <b>#{orderId ?? "-"}</b>
      </p>
      {confirming && (
        <p style={{ opacity: 0.85, marginTop: 16 }}>
          Actualizando estado del pago...
        </p>
      )}
      {confirmed && (
        <p style={{ opacity: 0.85, marginTop: 16, color: "#6b7280" }}>
          Estado actualizado correctamente.
        </p>
      )}
      <div style={{ marginTop: 24 }}>
        <Link href="/">
          <Button variant="primary">Volver al inicio</Button>
        </Link>
      </div>
    </main>
  );
}
