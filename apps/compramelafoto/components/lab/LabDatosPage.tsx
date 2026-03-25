"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LabHeader from "./LabHeader";
import LabPublicFooter from "./LabPublicFooter";

type Item = {
  fileKey: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
  productId?: number | null;
  productName?: string | null;
  meta?: Record<string, unknown> | null;
};

type LabPricing = {
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
  platformCommissionPercent?: number;
};

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

type QuoteTotals = {
  displayTotalCents: number;
  mpTotalCents: number;
  marketplaceFeeCents: number;
};

// Helper para formatear moneda ARS
function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// Función para obtener precio base por tamaño
function getBasePrice(size: string, pricing: LabPricing): number {
  const basePrice = pricing.basePrices.find((p) => p.size === size);
  return basePrice?.unitPrice ?? 0;
}

function pickDiscountFromThresholds(qty: number, discounts: Array<{ minQty: number; discountPercent: number }>): number {
  const applicable = discounts.filter((d) => d.minQty <= qty).sort((a, b) => b.minQty - a.minQty);
  return applicable[0]?.discountPercent ?? 0;
}

function getDiscountPercent(size: string, sizeQty: number, pricing: LabPricing): number {
  const sizeDiscounts = pricing.discounts.filter((d) => d.size === size);
  if (sizeDiscounts.length > 0) {
    return pickDiscountFromThresholds(sizeQty, sizeDiscounts.map((d) => ({ minQty: d.minQty, discountPercent: d.discountPercent })));
  }
  const globalDiscounts = pricing.discounts.filter((d) => d.size === "GLOBAL");
  if (globalDiscounts.length > 0) {
    return pickDiscountFromThresholds(sizeQty, globalDiscounts.map((d) => ({ minQty: d.minQty, discountPercent: d.discountPercent })));
  }
  return 0;
}

// Función para calcular precio unitario final
function calculateFinalUnitPrice(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  const basePrice = getBasePrice(size, pricing);
  const platformFee = (pricing.platformCommissionPercent ?? 0) / 100;
  return Math.round(basePrice * (1 + platformFee));
}

export default function LabDatosPage({
  lab,
  handler,
}: {
  lab: Lab;
  handler: string;
}) {
  const router = useRouter();
  const primaryColor = lab.primaryColor || "#c27b3d";
  const [items, setItems] = useState<Item[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerEmailConfirm, setCustomerEmailConfirm] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [quote, setQuote] = useState<{ totals: QuoteTotals } | null>(null);
  const [labSlaDays, setLabSlaDays] = useState<number | null>(null);

  // Verificar si hay un cliente autenticado
  useEffect(() => {
    const savedClient = sessionStorage.getItem("client");
    if (savedClient) {
      try {
        const clientData = JSON.parse(savedClient);
        setClient(clientData);
        if (clientData.name && !customerName) {
          setCustomerName(clientData.name);
        }
        if (clientData.email && !customerEmail) {
          setCustomerEmail(clientData.email);
          setCustomerEmailConfirm(clientData.email);
        }
      } catch (e) {
        console.error("Error cargando cliente:", e);
      }
    }
  }, []);

  // Cargar precios del laboratorio (landing lab)
  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch(`/api/public/lab-pricing?labId=${lab.id}`, { cache: "no-store" });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error || "Error cargando precios");
        }
        const data = await res.json();
        const basePrices = Array.isArray(data.basePrices) ? data.basePrices : [];
        const discounts = Array.isArray(data.discounts) ? data.discounts : [];
        setLabPricing({
          basePrices,
          discounts,
          platformCommissionPercent: Number(data.platformCommissionPercent ?? 0) || 0,
        });
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios del laboratorio:", e);
        setPricingLoaded(false);
      }
    }
    loadPricing();
  }, [lab.id]);

  useEffect(() => {
    const savedItems = sessionStorage.getItem(`lab_${lab.id}_orderItems`);
    if (!savedItems) {
      router.push(`/l/${handler}/imprimir`);
      return;
    }
    try {
      const parsed = JSON.parse(savedItems);
      setItems(parsed);
    } catch (e) {
      console.error("Error cargando items:", e);
      router.push(`/l/${handler}/imprimir`);
    }
  }, [router, handler, lab.id]);

  // Calcular cantidad total por tamaño
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
    }
    return map;
  }, [items]);

  // Resumen agrupado por tamaño-acabado-cantidad
  const summaryBySizeAndFinish = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = `${it.size}-${it.finish}`;
      map.set(key, (map.get(key) ?? 0) + it.quantity);
    }
    const entries: Array<{ size: string; finish: string; quantity: number }> = [];
    map.forEach((qty, key) => {
      const [size, finish] = key.split("-");
      entries.push({ size, finish, quantity: qty });
    });
    entries.sort((a, b) => {
      if (a.size !== b.size) return a.size.localeCompare(b.size);
      return a.finish.localeCompare(b.finish);
    });
    return entries;
  }, [items]);

  const totals = quote?.totals || {
    displayTotalCents: 0,
    mpTotalCents: 0,
    marketplaceFeeCents: 0,
  };
  const totalDisplayArs = totals.displayTotalCents;
  const totalDiscountArs = 0;

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    async function loadQuote() {
      try {
        const res = await fetch("/api/print-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: "PRINT_PUBLIC",
            labId: lab.id,
            items,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Error calculando el resumen");
        }
        if (!cancelled) {
          setQuote({ totals: data.totals });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando resumen:", err);
        }
      }
    }
    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [items, lab.id]);

  async function handleSubmit() {
    setError(null);

    if (!customerName.trim()) {
      setError("El nombre es requerido");
      return;
    }

    if (!customerEmail.trim()) {
      setError("El email es requerido");
      return;
    }
    if (!customerEmailConfirm.trim()) {
      setError("Repetí el email para continuar");
      return;
    }
    if (customerEmail.trim().toLowerCase() !== customerEmailConfirm.trim().toLowerCase()) {
      setError("Los emails no coinciden");
      return;
    }

    if (!customerPhone.trim()) {
      setError("El teléfono de WhatsApp es obligatorio");
      return;
    }
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!isValidPhoneForPurchase(customerPhone)) {
      setError("Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos)");
      return;
    }

    // Validar items antes de enviar
    const validItems = items.filter((it) => {
      return it.fileKey && it.size && it.quantity > 0;
    });

    if (validItems.length === 0) {
      setError("No hay items válidos en el pedido");
      return;
    }

    setLoading(true);

    try {
      const requestBody = {
        flow: "PUBLIC",
        customerName,
        customerEmail,
        customerPhone,
        ownerType: "LAB",
        ownerId: lab.id,
        ...(client?.id ? { clientId: client.id } : {}),
        pickupBy: "CLIENT",
        items: validItems.map((it) => ({
          fileKey: it.fileKey,
          originalName: it.originalName || null,
          size: it.size,
          acabado: it.finish || "BRILLO",
          quantity: it.quantity,
          productId: it.productId ?? null,
          productName: it.productName ?? null,
          meta: it.meta ?? null,
        })),
      };

      console.log("Enviando pedido:", requestBody);

      const res = await fetch("/api/print-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Leer el texto completo de la respuesta primero
      let responseText = "";
      let data: any = {};
      const contentType = res.headers.get("content-type");
      
      try {
        // Leer el texto completo primero
        responseText = await res.text();
        
        // Intentar parsear como JSON si hay contenido
        if (responseText && responseText.trim()) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Si no es JSON válido, usar el texto como mensaje de error
            console.warn("Response is not valid JSON:", { contentType, text: responseText.substring(0, 500) });
            data = { error: responseText || `Error ${res.status}: ${res.statusText}` };
          }
        } else {
          // Respuesta vacía
          data = { error: `Error ${res.status}: ${res.statusText || "Respuesta vacía del servidor"}` };
        }
      } catch (e: any) {
        console.error("Error reading response:", e);
        data = { 
          error: `Error ${res.status}: ${res.statusText || "Error al leer la respuesta del servidor"}`,
          detail: e?.message || String(e)
        };
      }

      if (!res.ok) {
        // Verificar si data está vacío o es un objeto sin propiedades útiles
        const isEmptyData = !data || (typeof data === "object" && Object.keys(data).length === 0);
        const hasNoUsefulData = isEmptyData && (!responseText || !responseText.trim());
        
        // Log detallado para debugging
        console.error("Error creando pedido - Detalles completos:", {
          status: res.status,
          statusText: res.statusText,
          contentType,
          responseTextLength: responseText?.length || 0,
          responseTextPreview: responseText ? responseText.substring(0, 500) : "(vacío)",
          parsedData: data,
          parsedDataType: typeof data,
          dataKeys: data && typeof data === "object" ? Object.keys(data) : [],
          isEmptyObject: isEmptyData,
          hasNoUsefulData,
        });
        
        // Construir mensaje de error más descriptivo
        let errorMsg = "";
        
        // Prioridad 1: Mensaje del objeto data parseado
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          errorMsg = data.error || data.detail || data.message || "";
        }
        
        // Prioridad 2: Mensaje del texto de respuesta si no hay data útil
        if (!errorMsg && responseText && responseText.trim()) {
          const textLower = responseText.toLowerCase();
          if (textLower.includes("error") || textLower.includes("faltan") || textLower.includes("invalid") || textLower.includes("requerido")) {
            errorMsg = responseText.substring(0, 300);
          } else {
            errorMsg = responseText.substring(0, 200);
          }
        }
        
        // Prioridad 3: Mensajes específicos según el código de estado
        if (!errorMsg) {
          if (res.status === 400) {
            errorMsg = "Error de validación. Verificá que todos los campos estén completos (nombre, email, teléfono) y que los items del pedido sean válidos.";
          } else if (res.status === 403) {
            errorMsg = "No tenés permisos para realizar esta acción o el laboratorio no está disponible.";
          } else if (res.status === 404) {
            errorMsg = "El recurso solicitado no fue encontrado.";
          } else if (res.status === 500) {
            errorMsg = "Error interno del servidor. Por favor intentá nuevamente o contactá al soporte.";
          } else {
            errorMsg = `Error ${res.status}: ${res.statusText || "Error desconocido al crear el pedido"}`;
          }
        }
        
        console.error("Mensaje de error final para el usuario:", errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Guardar ID del pedido
      sessionStorage.setItem("orderId", data.id.toString());
      
      // Crear preferencia de pago en Mercado Pago
      try {
        console.log("Creando preferencia de Mercado Pago para pedido:", data.id);
        
        const prefRes = await fetch("/api/payments/mp/create-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.id,
            orderType: "PRINT_ORDER",
          }),
        });

        // Capturar valores importantes ANTES de leer el texto (algunas propiedades pueden no estar disponibles después)
        const prefStatus = prefRes.status;
        const prefStatusText = prefRes.statusText;
        const prefOk = prefRes.ok;
        const prefContentType = prefRes.headers.get("content-type");
        
        let prefData: any = {};
        let responseText: string = "";
        
        try {
          // Primero obtener el texto completo de la respuesta
          responseText = await prefRes.text();
          console.log("Raw response text:", responseText ? responseText.substring(0, 500) : "(vacío)");
          
          if (prefContentType && prefContentType.includes("application/json")) {
            if (responseText && responseText.trim()) {
              try {
                prefData = JSON.parse(responseText);
              } catch (parseError: any) {
                console.error("Error parseando JSON de preferencia:", parseError);
                prefData = { 
                  error: `Error parseando JSON: ${parseError?.message}`,
                  rawText: responseText.substring(0, 200)
                };
              }
            } else {
              prefData = { error: `Respuesta vacía (${prefStatus})` };
            }
          } else {
            console.warn("Preference response is not JSON:", { 
              prefContentType, 
              status: prefStatus,
              statusText: prefStatusText,
              text: responseText ? responseText.substring(0, 500) : "(vacío)"
            });
            if (responseText && responseText.trim()) {
              try {
                prefData = JSON.parse(responseText);
              } catch (e: any) {
                prefData = { 
                  error: responseText || `Error ${prefStatus}: ${prefStatusText}`,
                  rawText: responseText.substring(0, 200)
                };
              }
            } else {
              prefData = { error: `Error ${prefStatus}: ${prefStatusText || "sin cuerpo"}` };
            }
          }
        } catch (e: any) {
          console.error("Error reading/parsing preference response:", e);
          prefData = { 
            error: `Error procesando respuesta: ${e?.message || String(e)}`,
            status: prefStatus,
            statusText: prefStatusText,
            rawText: responseText ? responseText.substring(0, 200) : "(no disponible)"
          };
        }

        console.log("Respuesta de preferencia MP:", {
          ok: prefOk,
          status: prefStatus,
          statusText: prefStatusText,
          prefData,
          responseTextLength: responseText?.length || 0,
        });

        if (!prefOk) {
          // Verificar si prefData está vacío o es un objeto sin propiedades útiles
          const isEmptyPrefData = !prefData || (typeof prefData === "object" && Object.keys(prefData).length === 0);
          const hasNoUsefulData = isEmptyPrefData && (!responseText || !responseText.trim());
          
          // Log detallado con valores explícitos para evitar problemas de serialización
          console.error("Error en respuesta de preferencia - Detalles completos:");
          console.error("  status:", prefStatus);
          console.error("  statusText:", prefStatusText);
          console.error("  contentType:", prefContentType);
          console.error("  responseTextLength:", responseText?.length || 0);
          console.error("  responseTextPreview:", responseText ? responseText.substring(0, 500) : "(vacío)");
          console.error("  prefData:", prefData);
          console.error("  prefDataType:", typeof prefData);
          console.error("  prefDataKeys:", prefData && typeof prefData === "object" ? Object.keys(prefData) : []);
          console.error("  isEmptyPrefData:", isEmptyPrefData);
          console.error("  hasNoUsefulData:", hasNoUsefulData);
          
          // También crear objeto para referencia (usando valores capturados antes)
          const errorDetails = {
            status: String(prefStatus || "unknown"),
            statusText: String(prefStatusText || "unknown"),
            contentType: String(prefContentType || "unknown"),
            responseTextLength: Number(responseText?.length || 0),
            responseTextPreview: String(responseText ? responseText.substring(0, 500) : "(vacío)"),
            prefData: prefData ? JSON.parse(JSON.stringify(prefData)) : null, // Serializar para evitar problemas
            prefDataType: String(typeof prefData),
            prefDataKeys: Array.isArray(prefData && typeof prefData === "object" ? Object.keys(prefData) : []),
            isEmptyPrefData: Boolean(isEmptyPrefData),
            hasNoUsefulData: Boolean(hasNoUsefulData),
          };
          console.error("Error en respuesta de preferencia - Objeto serializado:", JSON.stringify(errorDetails, null, 2));
          
          // Construir mensaje de error más descriptivo
          let errorMsg = "";
          
          // Prioridad 1: Mensaje del objeto prefData parseado
          if (prefData && typeof prefData === "object" && Object.keys(prefData).length > 0) {
            errorMsg = prefData.error || prefData.detail || prefData.message || "";
          }
          
          // Prioridad 2: Mensaje del texto de respuesta si no hay prefData útil
          if (!errorMsg && responseText && responseText.trim()) {
            const textLower = responseText.toLowerCase();
            if (textLower.includes("error") || textLower.includes("invalid") || textLower.includes("failed")) {
              errorMsg = responseText.substring(0, 300);
            } else {
              errorMsg = responseText.substring(0, 200);
            }
          }
          
          // Prioridad 3: Mensajes específicos según el código de estado
          if (!errorMsg) {
            if (prefStatus === 400) {
              errorMsg = "Error de validación al crear la preferencia de pago. Verificá que el pedido tenga un total válido.";
            } else if (prefStatus === 404) {
              errorMsg = "El pedido no fue encontrado. Por favor intentá nuevamente.";
            } else if (prefStatus === 500) {
              errorMsg = "Error interno del servidor al crear la preferencia de pago. Por favor intentá nuevamente o contactá al soporte.";
            } else {
              errorMsg = `Error ${prefStatus}: ${prefStatusText || "Error desconocido al crear la preferencia de pago"}`;
            }
          }
          
          console.error("Mensaje de error final para el usuario:", errorMsg);
          setError(`Pedido creado (#${data.id}), pero error al generar link de pago: ${errorMsg}`);
          setLoading(false);
          sessionStorage.removeItem(`lab_${lab.id}_uploadedPhotos`);
          sessionStorage.removeItem(`lab_${lab.id}_orderItems`);
          return;
        }

        // Redirigir a Mercado Pago
        if (prefData.initPoint) {
          console.log("Redirigiendo a Mercado Pago:", prefData.initPoint);
          sessionStorage.removeItem(`lab_${lab.id}_uploadedPhotos`);
          sessionStorage.removeItem(`lab_${lab.id}_orderItems`);
          window.location.href = prefData.initPoint;
          return;
        } else {
          console.error("No se recibió initPoint en la respuesta:", prefData);
          throw new Error("No se recibió el link de pago de Mercado Pago");
        }
      } catch (mpError: any) {
        console.error("Error creando preferencia MP:", {
          error: mpError,
          message: mpError?.message,
          stack: mpError?.stack,
        });
        const errorMessage = mpError?.message || "Error desconocido al crear preferencia de pago";
        setError(`Pedido creado (#${data.id}), pero error al generar link de pago: ${errorMessage}`);
        setLoading(false);
        sessionStorage.removeItem(`lab_${lab.id}_uploadedPhotos`);
        sessionStorage.removeItem(`lab_${lab.id}_orderItems`);
        // No redirigir automáticamente, dejar que el usuario vea el error
        return;
      }

    } catch (err: any) {
      setError(err?.message || "Error al crear el pedido");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <LabHeader lab={lab} handler={handler} />
      <main className="flex-1">
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-5xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
              {/* Header */}
              <div
                style={{
                  textAlign: "center",
                  padding: "0 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(24px, 5vw, 36px)",
                    fontWeight: "normal",
                    color: "#1a1a1a",
                    lineHeight: "1.3",
                    margin: 0,
                    width: "100%",
                    maxWidth: "800px",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                    whiteSpace: "normal",
                  }}
                >
                  Tus datos
                </h1>
                <p
                  style={{
                    fontSize: "clamp(16px, 2.5vw, 18px)",
                    color: "#6b7280",
                    lineHeight: "1.5",
                    margin: 0,
                    width: "100%",
                    maxWidth: "800px",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                    whiteSpace: "normal",
                  }}
                >
                  Completá tus datos para finalizar el pedido
                </p>
              </div>

              {error && (
                <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                  <p className="text-[#ef4444]">{error}</p>
                </Card>
              )}

              <Card className="space-y-6">
                {client && (
                  <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-[#10b981]">
                      ✅ Estás iniciado sesión como {client.name || client.email}. El pedido se vinculará a tu cuenta.
                    </p>
                    <Link href="/cliente/pedidos" className="text-xs text-[#10b981] hover:underline mt-1 inline-block">
                      Ver mis pedidos →
                    </Link>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Nombre completo *
                  </label>
                  <Input
                    className="w-full"
                    type="text"
                    placeholder="Juan Pérez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Email *
                  </label>
                  <Input
                    className="w-full"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    disabled={!!client}
                  />
                  {client && (
                    <p className="text-xs text-[#6b7280] mt-1">
                      El email está bloqueado porque estás iniciado sesión.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Repetir email *
                  </label>
                  <Input
                    className="w-full"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={customerEmailConfirm}
                    onChange={(e) => setCustomerEmailConfirm(e.target.value)}
                    required
                    disabled={!!client}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Teléfono / WhatsApp *
                  </label>
                  <Input
                    className="w-full"
                    type="tel"
                    placeholder="Ej: 11 1234-5678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>

                {!client && (
                  <div className="pt-4 border-t border-[#e5e7eb]">
                    <p className="text-sm text-[#6b7280] mb-2">
                      ¿Querés ver el estado de tus pedidos?
                    </p>
                    <Link href="/cliente/registro" className="text-sm text-[#c27b3d] hover:underline">
                      Creá una cuenta gratuita →
                    </Link>
                  </div>
                )}
              </Card>

              {/* Resumen del pedido agrupado */}
              <Card className="bg-white border border-[#e5e7eb]">
                <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Resumen del pedido</h3>
                <div className="space-y-2">
                  {summaryBySizeAndFinish.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0">
                      <span className="text-sm text-[#6b7280]">
                        Fotografía - {entry.size} - {entry.finish === "BRILLO" ? "Brillo" : entry.finish === "MATE" ? "Mate" : entry.finish} - {entry.quantity} {entry.quantity === 1 ? "unidad" : "unidades"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Resumen de precios final */}
              {pricingLoaded && (
                <Card className="bg-[#f8f9fa]">
                  <div className="space-y-4">
                    {totalDiscountArs > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium text-[#1a1a1a]">
                          Descuento aplicado
                        </span>
                        <span className="text-xl font-normal text-[#10b981]">
                          -{formatARS(totalDiscountArs)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-[#e5e7eb] gap-2">
                      <span className="text-lg sm:text-xl font-medium text-[#1a1a1a]">Total de tu pedido</span>
                      <span className="text-2xl sm:text-3xl font-normal text-[#1a1a1a]">
                        {formatARS(totalDisplayArs)}
                      </span>
                    </div>
                    {totalDiscountArs > 0 && (
                      <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
                        <p className="text-sm text-[#10b981] font-medium">
                          ✅ En este pedido ahorraste {formatARS(totalDiscountArs)} gracias a
                          los descuentos por cantidad del laboratorio.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Mensaje de tiempo de producción */}
              {labSlaDays && labSlaDays > 0 && (
                <Card className="bg-[#f0f9ff] border border-[#0ea5e9]">
                  <div className="flex items-start gap-3">
                    <div className="text-[#0ea5e9] text-xl">⏱️</div>
                    <div>
                      <p className="text-sm font-medium text-[#1a1a1a] mb-1">
                        Tiempo de producción del pedido
                      </p>
                      <p className="text-sm text-[#6b7280]">
                        Entre <strong>{labSlaDays}</strong> y <strong>{labSlaDays * 2}</strong> días aprox. Te notificaremos por email cuando el pedido esté listo.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex justify-between pt-6">
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/l/${handler}/imprimir/resumen`)}
                >
                  Volver
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={loading || !pricingLoaded}
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  }}
                >
                  {loading ? "Procesando..." : "Finalizar pedido"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LabPublicFooter lab={lab} />
    </>
  );
}
