"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PhotographerHeader from "./PhotographerHeader";
import PhotographerFooter from "./PhotographerFooter";

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
  products?: LabProduct[];
};

type LabProduct = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  retailPrice: number;
  isActive: boolean;
};

type QuoteTotals = {
  displayTotalCents: number;
  mpTotalCents: number;
  marketplaceFeeCents: number;
};

type Photographer = {
  id: number;
  name: string | null;
  email: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  preferredLabId: number | null;
  profitMarginPercent: number | null;
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

// Función para obtener descuento por tamaño y cantidad total
function getDiscountPercent(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  return 0;
}

// Función para calcular precio unitario final
function calculateFinalUnitPrice(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  const basePrice = getBasePrice(size, pricing);
  return Math.round(basePrice);
}

function normalizeProductName(name: string) {
  return name.split(" - ")[0].trim().toLowerCase();
}

function findProductForItem(item: Item, products: LabProduct[] = []) {
  if (!products.length) return undefined;
  if (item.productId) {
    const byId = products.find((p) => p.id === item.productId);
    if (byId) return byId;
  }
  if (item.productName) {
    const normalized = normalizeProductName(item.productName);
    const finish = item.finish || null;
    const size = item.size || null;
    return (
      products.find((p) => {
        return normalizeProductName(p.name) === normalized &&
          (p.size || null) === size &&
          (p.acabado || null) === finish;
      }) ||
      products.find((p) => normalizeProductName(p.name) === normalized && (p.size || null) === size) ||
      products.find((p) => normalizeProductName(p.name) === normalized)
    );
  }
  return products.find((p) => (p.size || null) === (item.size || null));
}

export default function PhotographerDatosPage({
  photographer,
  handler,
}: {
  photographer: Photographer;
  handler: string;
}) {
  const router = useRouter();
  const primaryColor = photographer.primaryColor || "#c27b3d";
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

  // Cargar precios del fotógrafo
  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch(`/api/public/lab-pricing?photographerId=${photographer.id}`, { cache: "no-store" });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error || "Error cargando precios");
        }
        const data = await res.json();
        
        const basePrices = Array.isArray(data.basePrices) ? data.basePrices : [];
        const discounts = Array.isArray(data.discounts) ? data.discounts : [];
        const products = Array.isArray(data.products) ? data.products.filter((p: LabProduct) => p.isActive !== false) : [];
        
        setLabPricing({
          basePrices,
          discounts,
          platformCommissionPercent: Number(data.platformCommissionPercent ?? 0) || 0,
          products,
        });
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios del fotógrafo:", e);
        setPricingLoaded(false);
      }
    }
    loadPricing();
  }, [photographer.id]);

  useEffect(() => {
    const savedItems = sessionStorage.getItem("orderItems");
    if (!savedItems) {
      router.push(`/${handler}/imprimir`);
      return;
    }
    setItems(JSON.parse(savedItems));
  }, [router, handler]);

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
            flow: "PRINT_PHOTOGRAPHER",
            photographerId: photographer.id,
            labId: null, // FASE 1: precios solo del fotógrafo; sin selección de laboratorio
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
  }, [items, photographer.id]);

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

    setLoading(true);

    try {
      const res = await fetch("/api/print-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          ownerType: "PHOTOGRAPHER",
          ownerId: photographer.id,
          clientId: client?.id || null,
          pickupBy: "PHOTOGRAPHER",
          items: items.map((it) => ({
            fileKey: it.fileKey,
            originalName: it.originalName,
            size: it.size,
            acabado: it.finish,
            quantity: it.quantity,
            productId: it.productId ?? null,
            productName: it.productName ?? null,
            meta: it.meta ?? null,
          })),
        }),
      });

      let responseText = "";
      let data: any = {};

      try {
        responseText = await res.text();
        if (responseText && responseText.trim()) {
          data = JSON.parse(responseText);
        } else {
          data = { error: `Error ${res.status}: ${res.statusText || "Respuesta vacía"}` };
        }
      } catch (parseError: any) {
        console.error("Error parseando respuesta:", parseError);
        data = { error: `Error ${res.status}: ${res.statusText || "Error al leer respuesta"}` };
      }

      if (!res.ok) {
        const errorMsg = data?.error || data?.detail || `Error ${res.status}: ${res.statusText || "Error desconocido"}`;
        throw new Error(errorMsg);
      }

      sessionStorage.setItem("orderId", data.id.toString());

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

        let prefResponseText = "";
        let prefData: any = {};

        try {
          prefResponseText = await prefRes.text();
          if (prefResponseText && prefResponseText.trim()) {
            prefData = JSON.parse(prefResponseText);
          } else {
            prefData = { error: `Error ${prefRes.status}: ${prefRes.statusText || "Respuesta vacía"}` };
          }
        } catch (parseError: any) {
          console.error("Error parseando respuesta de preferencia:", parseError);
          prefData = { error: `Error ${prefRes.status}: ${prefRes.statusText || "Error al leer respuesta"}` };
        }

        if (!prefRes.ok) {
          const errorMsg = prefData?.error || prefData?.detail || `Error ${prefRes.status}: ${prefRes.statusText || "Error desconocido"}`;
          throw new Error(errorMsg);
        }

        if (prefData.initPoint) {
          console.log("Redirigiendo a Mercado Pago:", prefData.initPoint);
          sessionStorage.removeItem("uploadedPhotos");
          sessionStorage.removeItem("orderItems");
          window.location.href = prefData.initPoint;
          return;
        }

        throw new Error("No se recibió el link de pago de Mercado Pago");
      } catch (mpError: any) {
        console.error("Error creando preferencia MP:", mpError);
        const errorMessage = mpError?.message || "Error desconocido al crear preferencia de pago";
        setError(`Pedido creado (#${data.id}), pero error al generar link de pago: ${errorMessage}`);
        setLoading(false);
        sessionStorage.removeItem("uploadedPhotos");
        sessionStorage.removeItem("orderItems");
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
      <PhotographerHeader photographer={photographer} handler={handler} />
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
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: "1.6",
                    margin: 0,
                    width: "100%",
                    maxWidth: "672px",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                    whiteSpace: "normal",
                    wordSpacing: "normal",
                    letterSpacing: "normal",
                    textAlign: "center",
                    display: "block",
                  }}
                >
                  Verificá los detalles de tu pedido antes de confirmar.
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
                        Fotografía - {entry.size} - {entry.finish === "BRILLO" ? "Brillo" : "Mate"} - {entry.quantity} {entry.quantity === 1 ? "unidad" : "unidades"}
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
                  onClick={() => router.push(`/${handler}/imprimir/resumen`)}
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
      <PhotographerFooter photographer={photographer} />
    </>
  );
}
