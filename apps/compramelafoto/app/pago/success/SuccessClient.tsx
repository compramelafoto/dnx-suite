"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";
import Card from "@/components/ui/Card";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import PaymentRecoveryActions from "@/components/checkout/PaymentRecoveryActions";
import { useMpPaymentRetry } from "@/lib/checkout/use-mp-payment-retry";
import { readPendingOrderSession } from "@/lib/checkout/pending-order-session";
import { trackFunnelEvent, FUNNEL_EVENTS } from "@/lib/funnel-track-client";

export default function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderType = (searchParams.get("orderType") || "PRINT_ORDER") as
    | "PRINT_ORDER"
    | "ALBUM_ORDER"
    | "PRECOMPRA_ORDER"
    | "DNX_COURSE_ENROLLMENT";
  const paymentId = searchParams.get("payment_id") || searchParams.get("preference_id");

  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "pending" | "approved" | "error">("loading");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadCenterUrl, setDownloadCenterUrl] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [digitalFiles, setDigitalFiles] = useState<Array<{ photoId: number; filename: string; downloadUrl: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [hasPrintItems, setHasPrintItems] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [zipStatus, setZipStatus] = useState<{
    status: "pending" | "processing" | "uploading" | "completed" | "error" | "not_found";
    progressPercent: number | null;
    currentStep: string | null;
    downloadUrl: string | null;
  } | null>(null);
  const [bridgePreCompraOrderId, setBridgePreCompraOrderId] = useState<number | null>(null);
  const [recoveryContext, setRecoveryContext] = useState<{
    backUrl: string;
    canRetry: boolean;
  } | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const numericOrderId = orderId ? Number(orderId) : null;
  const isAlbumOrder = orderType === "ALBUM_ORDER" && numericOrderId != null && Number.isFinite(numericOrderId);

  const {
    retryPayment,
    retrying,
    mpPreparing,
    mpPreparingStep,
    retryError,
    retryRequiresEmail,
    setRetryRequiresEmail,
  } = useMpPaymentRetry({
    orderId: numericOrderId ?? 0,
    orderType,
    buyerEmail,
  });

  const confirmPayment = useCallback(async () => {
    if (!orderId || !paymentId) {
      setError("Faltan parámetros de pago");
      setPaymentStatus("error");
      return;
    }
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

      if (
        typeof data.preCompraOrderId === "number" &&
        Number.isFinite(data.preCompraOrderId) &&
        data.preCompraOrderId > 0
      ) {
        setBridgePreCompraOrderId(data.preCompraOrderId);
      }
      if (data.paymentStatus === "approved" && orderType === "ALBUM_ORDER" && orderId) {
        void import("@/lib/funnel-track-client").then(({ trackFunnelEvent, FUNNEL_EVENTS }) =>
          trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_SUCCESS, {
            orderId: Number(orderId),
            albumId:
              typeof data.albumId === "number" && Number.isFinite(data.albumId)
                ? data.albumId
                : undefined,
          })
        );
      }
      if (data?.digitalDelivery?.downloadCenterUrl) {
        setDownloadCenterUrl(data.digitalDelivery.downloadCenterUrl);
      }
      if (data?.digitalDelivery?.downloadUrl) {
        setDownloadUrl(data.digitalDelivery.downloadUrl);
        setIsPreparing(false);
      } else if (data?.digitalDelivery?.isPreparing) {
        setIsPreparing(true);
      } else {
        setIsPreparing(false);
      }

      if (data.paymentStatus === "approved") {
        setPaymentStatus("approved");
      } else if (data.paymentStatus === "pending" || data.paymentStatus === "in_process") {
        setPaymentStatus("pending");
      } else {
        setPaymentStatus("error");
      }

      // Preventa escolar: puente legacy selfies o hub unificado (PREVENTA_UX_V2)
      if (data.paymentStatus === "approved" && orderType === "PRECOMPRA_ORDER") {
        setTimeout(() => {
          if (isPreventaUxV2EnabledClient()) {
            router.push(`/cliente/pack/${orderId}`);
          } else {
            router.push(`/order/${orderId}/selfies`);
          }
        }, 1500);
        return;
      }
      if (
        data.paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        typeof data.preCompraOrderId === "number" &&
        Number.isFinite(data.preCompraOrderId)
      ) {
        setTimeout(() => {
          if (isPreventaUxV2EnabledClient() && orderId) {
            router.push(`/cliente/pack/${orderId}`);
          } else {
            router.push(`/order/${data.preCompraOrderId}/selfies`);
          }
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
      setPaymentStatus("error");
    }
  }, [orderId, paymentId, orderType, router]);

  const loadRecoveryContext = useCallback(async () => {
    if (!isAlbumOrder || !numericOrderId) return;
    try {
      const params = new URLSearchParams({
        orderId: String(numericOrderId),
        orderType: "ALBUM_ORDER",
      });
      const email = buyerEmail.trim();
      if (email) params.set("buyerEmail", email);

      const res = await fetch(`/api/payments/mp/failure-context?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.retryRequiresEmail || data.code === "FORBIDDEN") {
          setRetryRequiresEmail(true);
        }
        return;
      }

      setRecoveryContext({
        backUrl: data.backUrl ?? "/",
        canRetry: Boolean(data.canRetry),
      });
      setRetryRequiresEmail(false);
    } catch {
      /* noop */
    }
  }, [buyerEmail, isAlbumOrder, numericOrderId, setRetryRequiresEmail]);

  useEffect(() => {
    if (isAlbumOrder) void loadRecoveryContext();
  }, [isAlbumOrder, loadRecoveryContext]);

  useEffect(() => {
    if (!recoveryContext?.backUrl) return;
    const match = recoveryContext.backUrl.match(/\/a\/(\d+)/);
    if (!match) return;
    const session = readPendingOrderSession(match[1]);
    if (session?.buyerEmail && !buyerEmail.trim()) {
      setBuyerEmail(session.buyerEmail);
    }
  }, [recoveryContext?.backUrl, buyerEmail]);

  const refreshPaymentStatus = useCallback(async () => {
    if (!orderId || !paymentId) {
      setError("Faltan parámetros de pago");
      setPaymentStatus("error");
      return;
    }
    setRefreshing(true);
    void trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_PENDING_STATUS_REFRESHED, {
      orderId: Number(orderId),
    });
    try {
      await confirmPayment();
    } finally {
      setRefreshing(false);
    }
  }, [confirmPayment, orderId, paymentId]);

  const showRecovery =
    isAlbumOrder &&
    numericOrderId != null &&
    paymentStatus !== "approved" &&
    paymentStatus !== "loading" &&
    (paymentStatus === "error" || paymentStatus === "pending" || Boolean(error));

  const recoveryBackHref = recoveryContext?.backUrl ?? "/";
  const recoveryBackLabel =
    recoveryContext?.backUrl && recoveryContext.backUrl !== "/"
      ? "Volver al álbum"
      : "Volver al inicio";

  useEffect(() => {
    if (!orderId || !paymentId) {
      setError("Faltan parámetros de pago");
      setPaymentStatus("error");
      return;
    }
    confirmPayment();
  }, [orderId, paymentId, confirmPayment]);

  useEffect(() => {
    if (!orderId || !paymentId) return;
    const shouldPoll =
      paymentStatus === "pending" ||
      (paymentStatus === "approved" && isPreparing && !downloadUrl);
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      confirmPayment();
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId, paymentId, paymentStatus, isPreparing, downloadUrl, confirmPayment]);

  useEffect(() => {
    if (!orderId || !paymentId) return;
    if (paymentStatus !== "approved") return;
    if (orderType !== "ALBUM_ORDER") return;
    if (bridgePreCompraOrderId != null) return;
    if (filesLoaded || loadingFiles) return;
    setLoadingFiles(true);
    fetch(`/api/orders/${orderId}/digital-downloads`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        const files = Array.isArray(data?.files) ? data.files : [];
        setDigitalFiles(files);
        setHasPrintItems(Boolean(data?.hasPrintItems));
        setFilesLoaded(true);
      })
      .catch(() => null)
      .finally(() => setLoadingFiles(false));
  }, [orderId, paymentId, paymentStatus, orderType, bridgePreCompraOrderId, filesLoaded, loadingFiles]);

  useEffect(() => {
    if (!orderId || !paymentId) return;
    if (paymentStatus !== "approved") return;
    if (orderType !== "ALBUM_ORDER") return;
    if (bridgePreCompraOrderId != null) return;
    if (digitalFiles.length <= 1) return;
    if (downloadUrl) return;

    const fetchZipStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/zip-status`);
        const data = await res.json();
        if (!res.ok) return;
        const nextZip = data?.zip ?? null;
        if (!nextZip) return;
        setZipStatus(nextZip);
        if (typeof nextZip.downloadUrl === "string" && nextZip.downloadUrl) {
          setDownloadUrl(nextZip.downloadUrl);
          setIsPreparing(false);
        } else if (nextZip.status === "pending" || nextZip.status === "processing" || nextZip.status === "uploading") {
          setIsPreparing(true);
        } else {
          setIsPreparing(false);
        }
      } catch {
        // noop
      }
    };

    fetchZipStatus();
    const interval = setInterval(fetchZipStatus, 3000);
    return () => clearInterval(interval);
  }, [orderId, paymentId, paymentStatus, orderType, bridgePreCompraOrderId, digitalFiles.length, downloadUrl]);

  return (
    <>
      <CheckoutMpPreparingOverlay open={mpPreparing} step={mpPreparingStep} />
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(140%); }
        }
      `}</style>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827]">✅ Pago procesado</h1>
      <p className="text-sm sm:text-base text-[#4b5563] mt-2">
        {orderType === "DNX_COURSE_ENROLLMENT" ? "Inscripción" : "Pedido"}: <b>#{orderId ?? "-"}</b>
      </p>
      {paymentId && (
        <p className="text-sm sm:text-base text-[#4b5563]">
          ID de pago: <b>{paymentId}</b>
        </p>
      )}

      {paymentStatus !== "loading" && (
        <div style={{ marginTop: 20 }}>
          {paymentStatus === "approved" ? (
            <div style={{ padding: 16, backgroundColor: "#d1fae5", borderRadius: 8 }}>
              <p style={{ color: "#065f46", fontWeight: "bold" }}>
                ✅ Pago aprobado
              </p>
              <p style={{ color: "#047857", marginTop: 8 }}>
                {orderType === "DNX_COURSE_ENROLLMENT"
                  ? "Tu inscripción al curso quedó confirmada. Vas a recibir los detalles por email; si no llega en las próximas horas, consultanos por WhatsApp."
                  : orderType === "PRECOMPRA_ORDER" || bridgePreCompraOrderId != null
                  ? "Tu compra fue registrada. Te vamos a enviar un email con el acceso a tu pack para continuar el canje cuando corresponda."
                  : downloadCenterUrl
                    ? "Pago confirmado. Ya podés ver y descargar tus fotos desde tu centro de descargas."
                    : downloadUrl
                      ? "Pago confirmado. Ya podés descargar todas tus fotos juntas o bajarlas por separado."
                      : orderType === "ALBUM_ORDER" && isPreparing
                        ? "Pago confirmado. Estamos preparando tu archivo completo."
                        : "Tu pedido ha sido confirmado y está siendo procesado."}
              </p>
            </div>
          ) : paymentStatus === "pending" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-amber-950 font-medium">Estamos confirmando tu pago</p>
              <p className="text-amber-900/90 mt-2 text-sm leading-relaxed">
                Esto puede tardar unos segundos. Si no avanza, podés actualizar el estado o reintentar
                el pago.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
              <p className="text-[#374151] font-medium">No pudimos confirmar el pago</p>
              <p className="text-[#4b5563] mt-2 text-sm leading-relaxed">
                Tu pedido sigue guardado. Podés actualizar el estado o volver a intentar el pago.
              </p>
            </div>
          )}
        </div>
      )}

      {paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        bridgePreCompraOrderId != null && (
        <div style={{ marginTop: 20 }}>
          <div style={{ padding: 16, backgroundColor: "#eef2ff", borderRadius: 8 }}>
            <p style={{ color: "#1e3a8a", fontWeight: "bold" }}>
              Acceso a tu pack
            </p>
            <p style={{ color: "#1e3a8a", marginTop: 8 }}>
              Te enviamos un link por email para continuar el canje cuando el álbum esté listo.
              Si no lo encontrás, podés recuperarlo desde acá.
            </p>
            <Link
              href="/cliente/recuperar-pack"
              style={{ display: "inline-block", marginTop: 12, color: "#1d4ed8", fontWeight: "bold" }}
            >
              Recuperar acceso al pack
            </Link>
          </div>
        </div>
      )}

      {paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        bridgePreCompraOrderId == null && (
        <div style={{ marginTop: 20 }}>
          {downloadCenterUrl ? (
            <div style={{ padding: 16, backgroundColor: "#ecfeff", borderRadius: 8 }}>
              <p style={{ color: "#0e7490", fontWeight: "bold" }}>
                📷 Tus fotos están listas
              </p>
              <p style={{ color: "#155e75", marginTop: 8 }}>
                Entrá a tu centro de descargas para ver las fotos, bajarlas una por una o descargar
                el ZIP cuando esté disponible.
              </p>
              <a
                href={downloadCenterUrl}
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "10px 18px",
                  borderRadius: 8,
                  backgroundColor: "#c27b3d",
                  color: "#ffffff",
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                Ver mis fotos
              </a>
              {downloadUrl && digitalFiles.length > 1 ? (
                <a
                  href={downloadUrl}
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    marginLeft: 12,
                    color: "#0e7490",
                    fontWeight: "bold",
                  }}
                >
                  Descargar todas en ZIP
                </a>
              ) : null}
            </div>
          ) : downloadUrl ? (
            <div style={{ padding: 16, backgroundColor: "#ecfeff", borderRadius: 8 }}>
              <p style={{ color: "#0e7490", fontWeight: "bold" }}>
                📥 Descarga disponible
              </p>
              <p style={{ color: "#155e75", marginTop: 8 }}>
                Podés descargar todas tus fotos juntas o bajarlas por separado.
              </p>
              <a
                href={downloadUrl}
                style={{ display: "inline-block", marginTop: 12, color: "#0e7490", fontWeight: "bold" }}
              >
                Descargar todas en ZIP
              </a>
            </div>
          ) : isPreparing ? (
            <div style={{ padding: 16, backgroundColor: "#ecfdf5", borderRadius: 8 }}>
              <p style={{ color: "#065f46", fontWeight: "bold" }}>
                Estamos preparando tu archivo completo
              </p>
              <p style={{ color: "#047857", marginTop: 8 }}>
                Esto puede tardar unos segundos. Mientras tanto, ya podés ver y descargar cada foto
                por separado desde tu centro de descargas.
              </p>
              {downloadCenterUrl ? (
                <a
                  href={downloadCenterUrl}
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "10px 18px",
                    borderRadius: 8,
                    backgroundColor: "#c27b3d",
                    color: "#ffffff",
                    fontWeight: "bold",
                    textDecoration: "none",
                  }}
                >
                  Ver mis fotos
                </a>
              ) : null}
              {zipStatus?.currentStep && (
                <p style={{ color: "#065f46", marginTop: 10, fontSize: 14 }}>
                  Estado actual: {zipStatus.currentStep}
                </p>
              )}
              {typeof zipStatus?.progressPercent === "number" ? (
                <>
                  <div style={{ marginTop: 12, height: 10, background: "#d1fae5", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, zipStatus.progressPercent))}%`,
                        background: "linear-gradient(90deg, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0.9) 100%)",
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>
                  <p style={{ color: "#047857", marginTop: 8, fontSize: 13 }}>
                    Progreso: {Math.min(100, Math.max(0, zipStatus.progressPercent))}%
                  </p>
                </>
              ) : (
                <div style={{ marginTop: 12, height: 10, background: "#d1fae5", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: "40%",
                      background: "linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.6) 50%, rgba(16,185,129,0) 100%)",
                      animation: "indeterminate 1.4s ease-in-out infinite",
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        bridgePreCompraOrderId == null &&
        digitalFiles.length > 1 &&
        downloadCenterUrl && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "#1f2937", fontWeight: "bold" }}>
            También podés descargar cada foto desde el centro de descargas
          </p>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {digitalFiles.map((file) => (
              <div
                key={file.photoId}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ color: "#374151", wordBreak: "break-word" }}>{file.filename}</span>
                <a
                  href={file.downloadUrl}
                  style={{ color: "#0ea5e9", fontWeight: "bold", whiteSpace: "nowrap" }}
                >
                  Descargar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        bridgePreCompraOrderId == null &&
        hasPrintItems && (
        <div style={{ marginTop: 14, color: "#6b7280", fontSize: 14 }}>
          Este pedido también incluye impresiones. Las fotos digitales se descargan acá y las impresiones siguen su proceso habitual.
        </div>
      )}

      {paymentStatus === "approved" &&
        orderType === "ALBUM_ORDER" &&
        bridgePreCompraOrderId == null &&
        zipStatus?.status === "error" && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: "#fee2e2", borderRadius: 8 }}>
          <p style={{ color: "#991b1b", fontWeight: "bold" }}>
            Hubo un error preparando el ZIP.
          </p>
          <p style={{ color: "#7f1d1d", marginTop: 8 }}>
            Podés descargar cada foto por separado mientras resolvemos el archivo completo.
          </p>
        </div>
      )}

      {error && !showRecovery ? (
        <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
          <p className="text-[#374151] text-sm">{error}</p>
          <p className="text-[#6b7280] mt-2 text-sm leading-relaxed">
            El pedido fue creado, pero no se pudo confirmar el estado del pago. Contactá soporte si el
            pago fue exitoso.
          </p>
        </div>
      ) : null}

      {showRecovery && numericOrderId != null ? (
        <Card className="mt-6 w-full p-5 sm:p-6">
          <p className="text-sm font-medium text-[#374151] mb-1">Tu pedido está guardado</p>
          <p className="text-sm text-[#4b5563] mb-4 leading-relaxed">
            {error ?? "Podés actualizar el estado o reintentar el pago sin volver a elegir las fotos."}
          </p>
          <PaymentRecoveryActions
            orderId={numericOrderId}
            orderType={orderType}
            backHref={recoveryBackHref}
            backLabel={recoveryBackLabel}
            canRetry={recoveryContext?.canRetry ?? true}
            buyerEmail={buyerEmail}
            onBuyerEmailChange={setBuyerEmail}
            retryRequiresEmail={retryRequiresEmail}
            onRetry={() => {
              void retryPayment();
            }}
            onRefresh={() => refreshPaymentStatus()}
            retrying={retrying}
            refreshing={refreshing}
            retryError={retryError}
            showRefresh={Boolean(paymentId)}
          />
        </Card>
      ) : null}

      {paymentStatus === "loading" && !error && (
        <p className="opacity-85 mt-4 text-sm text-[#6b7280]">Verificando tu pago…</p>
      )}
    </main>
    </>
  );
}
