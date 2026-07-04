"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderType = (searchParams.get("orderType") || "PRINT_ORDER") as "PRINT_ORDER" | "ALBUM_ORDER" | "PRECOMPRA_ORDER";
  const paymentId = searchParams.get("payment_id") || searchParams.get("preference_id");

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadExpiresAt, setDownloadExpiresAt] = useState<string | null>(null);
  const [emailWhenReady, setEmailWhenReady] = useState(false);

  useEffect(() => {
    if (!orderId || !paymentId) {
      setError("Faltan parámetros de pago");
      return;
    }

    // Confirmar el pago consultando Mercado Pago
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

        if (!res.ok) {
          throw new Error(data.error || "Error confirmando pago");
        }

        setConfirmed(true);
        setPaymentStatus(data.paymentStatus);
        if (data?.digitalDelivery?.downloadUrl) {
          setDownloadUrl(data.digitalDelivery.downloadUrl);
          setDownloadExpiresAt(data.digitalDelivery.expiresAt || null);
        }
        if (data?.digitalDelivery?.emailWhenReady) {
          setEmailWhenReady(true);
        }

        // Si el pago fue aprobado y es pre-venta escolar, redirigir a selfies
        if (data.paymentStatus === "approved" && orderType === "PRECOMPRA_ORDER") {
          setTimeout(() => {
            router.push(`/order/${orderId}/selfies`);
          }, 1500);
          return;
        }

        // Si el pago fue aprobado y es un pedido de impresión pública, redirigir a la confirmación
        if (data.paymentStatus === "approved" && orderType === "PRINT_ORDER") {
          const fromPublicPrint = sessionStorage.getItem("orderId") === orderId || 
                                  window.location.href.includes("imprimir-publico");
          
          if (fromPublicPrint) {
            setTimeout(() => {
              router.push(`/imprimir-publico/confirmacion?orderId=${orderId}&paid=true`);
            }, 1500);
            return;
          }
        }
      } catch (err: any) {
        console.error("Error confirmando pago:", err);
        setError(err.message || "Error confirmando pago");
      } finally {
        setConfirming(false);
      }
    }

    confirmPayment();
  }, [orderId, paymentId, orderType, router]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>✅ Pago procesado</h1>
      <p>
        Pedido: <b>#{orderId ?? "-"}</b>
      </p>
      {paymentId && (
        <p>
          ID de pago: <b>{paymentId}</b>
        </p>
      )}

      {confirming && (
        <p style={{ opacity: 0.85, marginTop: 16 }}>
          Confirmando estado del pago...
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
                {orderType === "PRECOMPRA_ORDER"
                  ? "Tu compra fue realizada con éxito. En unos segundos serás redirigido para subir la selfie del alumno."
                  : "Tu pedido ha sido confirmado y está siendo procesado."}
              </p>
            </div>
          ) : paymentStatus === "pending" || paymentStatus === "in_process" ? (
            <div style={{ padding: 16, backgroundColor: "#fef3c7", borderRadius: 8 }}>
              <p style={{ color: "#92400e", fontWeight: "bold" }}>
                ⏳ Pago pendiente
              </p>
              <p style={{ color: "#78350f", marginTop: 8 }}>
                Tu pago está siendo procesado. Te notificaremos cuando se confirme.
              </p>
            </div>
          ) : (
            <div style={{ padding: 16, backgroundColor: "#fee2e2", borderRadius: 8 }}>
              <p style={{ color: "#991b1b", fontWeight: "bold" }}>
                ❌ Pago rechazado
              </p>
              <p style={{ color: "#7f1d1d", marginTop: 8 }}>
                Tu pago fue rechazado. Podés volver atrás e intentar nuevamente.
              </p>
            </div>
          )}
        </div>
      )}

      {downloadUrl && paymentStatus === "approved" && orderType === "ALBUM_ORDER" && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: "#ecfeff", borderRadius: 8 }}>
          <p style={{ color: "#0e7490", fontWeight: "bold" }}>
            📥 Descarga disponible
          </p>
          <p style={{ color: "#155e75", marginTop: 8 }}>
            Ya podés descargar tus fotos digitales.
          </p>
          <a
            href={downloadUrl}
            style={{ display: "inline-block", marginTop: 12, color: "#0ea5e9", fontWeight: "bold" }}
          >
            Descargar fotos
          </a>
          {downloadExpiresAt && (
            <p style={{ color: "#155e75", marginTop: 8, fontSize: 12 }}>
              Disponible hasta: {new Date(downloadExpiresAt).toLocaleDateString("es-AR")}
            </p>
          )}
        </div>
      )}

      {emailWhenReady && paymentStatus === "approved" && orderType === "ALBUM_ORDER" && !downloadUrl && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: "#ecfdf5", borderRadius: 8 }}>
          <p style={{ color: "#065f46", fontWeight: "bold" }}>
            📧 Link de descarga por email
          </p>
          <p style={{ color: "#047857", marginTop: 8 }}>
            Estamos preparando tus fotos digitales. Te enviaremos un email con el link de descarga cuando estén listas (puede tardar unos minutos según la cantidad de fotos).
          </p>
          <p style={{ color: "#047857", marginTop: 8, fontSize: 14 }}>
            Revisá tu bandeja de entrada y, si no aparece, la carpeta de spam.
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: "#fee2e2", borderRadius: 8 }}>
          <p style={{ color: "#991b1b" }}>
            ⚠️ {error}
          </p>
          <p style={{ color: "#7f1d1d", marginTop: 8, fontSize: 14 }}>
            El pedido fue creado, pero no se pudo confirmar el estado del pago. Contactá soporte si el pago fue exitoso.
          </p>
        </div>
      )}

      {!confirming && !confirmed && !error && (
        <p style={{ opacity: 0.85, marginTop: 16 }}>
          Verificando estado del pago...
        </p>
      )}
    </main>
  );
}
