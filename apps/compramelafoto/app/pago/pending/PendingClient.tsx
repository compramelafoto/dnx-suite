"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function PendingClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderType = (searchParams.get("orderType") || "PRINT_ORDER") as "PRINT_ORDER" | "ALBUM_ORDER";
  const paymentId = searchParams.get("payment_id") || searchParams.get("preference_id");

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !paymentId) {
      return;
    }

    // Confirmar el pago para actualizar el estado en la BD
    async function confirmPayment() {
      setConfirming(true);
      try {
        const res = await fetch("/api/payments/mp/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            orderId: Number(orderId),
            orderType,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setPaymentStatus(data.paymentStatus);
        }
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
      <h1>⏳ Pago pendiente</h1>
      <p>
        Pedido: <b>#{orderId ?? "-"}</b>
      </p>
      {confirming && (
        <p style={{ opacity: 0.85, marginTop: 16 }}>
          Verificando estado del pago...
        </p>
      )}
      {confirmed && paymentStatus && (
        <div style={{ marginTop: 16 }}>
          {paymentStatus === "approved" ? (
            <div style={{ padding: 16, backgroundColor: "#d1fae5", borderRadius: 8 }}>
              <p style={{ color: "#065f46", fontWeight: "bold" }}>
                ✅ Pago aprobado
              </p>
              <p style={{ color: "#047857", marginTop: 8 }}>
                Tu pago fue confirmado exitosamente.
              </p>
            </div>
          ) : (
            <p style={{ opacity: 0.85, marginTop: 16 }}>
              El pago sigue pendiente. Te notificaremos cuando se confirme.
            </p>
          )}
        </div>
      )}
      {!confirming && !confirmed && (
        <p style={{ opacity: 0.85, marginTop: 16 }}>
          El pago quedó pendiente. El estado se actualiza cuando Mercado Pago lo confirme.
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
