"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { totalFromBase } from "@/lib/pricing/fee-formula";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
  productId?: number | null;
  productName?: string | null;
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

type QuoteItem = {
  inputIndex: number;
  component: "DIGITAL" | "PRINT";
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
};

import { DEFAULT_PUBLIC_PHOTOGRAPHER_ID } from "@/lib/public-flow-config";

const ACCENT_COLOR = "#c27b3d";

// Helper para formatear moneda ARS
function formatARS(n: number): string {
  if (!Number.isFinite(n) || isNaN(n)) {
    return "$ 0";
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getBasePrice(size: string, pricing: LabPricing): number {
  const basePrice = pricing.basePrices.find((p) => p.size === size);
  return basePrice?.unitPrice ?? 0;
}

function pickDiscountPercent(qty: number, d50?: number, d100?: number): number {
  if (qty >= 100) return d100 ?? 0;
  if (qty >= 50) return d50 ?? 0;
  return 0;
}

function getDiscountPercent(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  return 0;
}

function calculateFinalUnitPrice(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  const basePrice = getBasePrice(size, pricing);
  if (!basePrice || basePrice === 0 || !Number.isFinite(basePrice)) {
    return 0;
  }
  const platformFeePct = pricing.platformCommissionPercent ?? 0;
  const result = totalFromBase(Math.round(basePrice), platformFeePct);
  return Number.isFinite(result) ? result : 0;
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

export default function PublicResumenPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [selectedLab, setSelectedLab] = useState<any>(null);
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [photographerId, setPhotographerId] = useState<number | null>(null);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [quote, setQuote] = useState<{ totals: QuoteTotals; items: QuoteItem[] } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerEmailConfirm, setCustomerEmailConfirm] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedItems = sessionStorage.getItem("publicOrderItems");
    const savedLabId = sessionStorage.getItem("publicSelectedLabId");

    if (!savedItems) {
      router.push("/imprimir-publico");
      return;
    }

    if (!savedLabId) {
      router.push("/imprimir-publico");
      return;
    }

    try {
      const parsed = JSON.parse(savedItems);
      const normalized = (Array.isArray(parsed) ? parsed : []).map((it: any) => ({
        ...it,
        fileKey: it.fileKey || it.key || it.originalKey || "",
      }));
      setItems(normalized);
    } catch {
      setItems([]);
    }
    const labId = Number(savedLabId);
    if (Number.isFinite(labId)) {
      setSelectedLabId(labId);
    }
  }, [router]);

  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch(`/api/public/lab-pricing?photographerId=${DEFAULT_PUBLIC_PHOTOGRAPHER_ID}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Error cargando precios");
        const data = await res.json();
        
        setLabPricing({
          basePrices: Array.isArray(data.basePrices) ? data.basePrices : [],
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          platformCommissionPercent: Number(data.platformCommissionPercent ?? 0) || 0,
          products: Array.isArray(data.products) ? data.products.filter((p: LabProduct) => p.isActive !== false) : [],
        });
        const resolvedId = Number(data?.photographer?.id);
        setPhotographerId(Number.isFinite(resolvedId) ? resolvedId : null);
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios:", e);
        setError("Error cargando precios del fotógrafo");
      }
    }
    loadPricing();
  }, []);

  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
    }
    return map;
  }, [items]);

  const totals = quote?.totals || {
    displayTotalCents: 0,
    mpTotalCents: 0,
    marketplaceFeeCents: 0,
  };
  const totalDisplayArs = totals.displayTotalCents;
  const totalDiscountArs = 0;

  useEffect(() => {
    if (!items.length || !selectedLabId || !photographerId) return;
    let cancelled = false;
    async function loadQuote() {
      try {
        setQuoteLoading(true);
        const res = await fetch("/api/print-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: "PRINT_PUBLIC",
            photographerId,
            labId: selectedLabId,
            items,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Error calculando el resumen");
        }
        if (!cancelled) {
          setQuote({
            totals: data.totals,
            items: Array.isArray(data.items) ? data.items : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando resumen:", err);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [items, selectedLabId, photographerId]);

  async function handleCreateOrder() {
    if (!customerName.trim() || !customerEmail.trim()) {
      setError("Completá nombre y email para continuar");
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

    if (!selectedLabId) {
      setError("No se seleccionó un laboratorio");
      return;
    }
    if (!photographerId) {
      setError("No se pudo resolver el fotógrafo");
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

    const invalidItems = items.filter((it) => !it.fileKey || !it.size || !it.quantity);
    if (invalidItems.length > 0) {
      setError("Items inválidos (faltan fileKey/size/quantity).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Crear el pedido
      const res = await fetch("/api/print-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "PUBLIC",
          labId: selectedLabId,
          photographerId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          pickupBy: "CLIENT",
          items: items.map((it) => ({
            fileKey: it.fileKey,
            originalName: it.originalName,
            size: it.size,
            acabado: it.finish,
            quantity: it.quantity,
            productId: it.productId ?? null,
            productName: it.productName ?? null,
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

      // Guardar orderId en sessionStorage para la confirmación
      sessionStorage.setItem("orderId", data.id.toString());

      // 2. Crear preferencia de pago en Mercado Pago
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

        // 3. Redirigir a Mercado Pago para pagar
        if (prefData.initPoint) {
          console.log("Redirigiendo a Mercado Pago:", prefData.initPoint);
          // Limpiar sessionStorage antes de redirigir
          sessionStorage.removeItem("publicOrderItems");
          sessionStorage.removeItem("publicSelectedLabId");
          sessionStorage.removeItem("publicUploadedPhotos");
          window.location.href = prefData.initPoint;
          return;
        } else {
          throw new Error("No se recibió el link de pago de Mercado Pago");
        }
      } catch (mpError: any) {
        console.error("Error creando preferencia MP:", mpError);
        const errorMessage = mpError?.message || "Error desconocido al crear preferencia de pago";
        setError(`Pedido creado (#${data.id}), pero error al generar link de pago: ${errorMessage}`);
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.error("Error creando pedido:", e);
      setError(e?.message || "Error creando pedido");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Header con logo */}
      <header className="bg-white border-b border-[#e5e7eb]">
        <div className="container-custom">
          <div className="flex items-center justify-between py-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/LOGO CLF.png"
                alt="ComprameLaFoto"
                width={200}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            <Link href="/imprimir-publico" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              Volver
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center">
                <h1 className="text-3xl font-medium text-[#1a1a1a] mb-2">
                  Resumen de tu pedido
                </h1>
                <p className="text-[#6b7280]">
                  Revisá los detalles y completá tus datos para finalizar
                </p>
              </div>

              {error && (
                <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                  <p className="text-[#ef4444]">{error}</p>
                </Card>
              )}
              {quoteLoading && (
                <Card className="bg-[#f3f4f6] border border-[#e5e7eb]">
                  <p className="text-sm text-[#6b7280]">Calculando precios...</p>
                </Card>
              )}

              {selectedLab && (
                <Card>
                  <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">Laboratorio seleccionado</h2>
                  <p className="text-[#1a1a1a]">{selectedLab.name}</p>
                  {selectedLab.city && (
                    <p className="text-sm text-[#6b7280]">
                      {selectedLab.city}
                      {selectedLab.province ? `, ${selectedLab.province}` : ""}
                    </p>
                  )}
                </Card>
              )}

              <Card>
                <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">Tus fotos</h2>
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const computed = quote?.items?.find((q) => q.inputIndex === index);
                    const subtotal = computed?.subtotalCents ?? 0;

                    return (
                    <div key={index} className="flex flex-col sm:flex-row items-start gap-4 p-3 border border-[#e5e7eb] rounded-lg">
                        <img
                          src={item.previewUrl}
                          alt={item.originalName}
                          className="w-full sm:w-20 h-auto sm:h-20 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-[#1a1a1a]">{item.originalName}</p>
                          <p className="text-sm text-[#6b7280]">
                            {item.size} • {item.finish} • Cantidad: {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#1a1a1a]">{formatARS(subtotal)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {(pricingLoaded || quote) && (
                <Card>
                  <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">Resumen de precios</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between pt-4 border-t border-[#e5e7eb]">
                      <span className="text-xl font-medium text-[#1a1a1a]">Total</span>
                      <span className="text-2xl font-medium text-[#1a1a1a]">
                        {formatARS(totalDisplayArs)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">Tus datos</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Nombre completo *
                    </label>
                    <Input
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
                      type="email"
                      placeholder="juan@ejemplo.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Repetir email *
                    </label>
                    <Input
                      type="email"
                      placeholder="juan@ejemplo.com"
                      value={customerEmailConfirm}
                      onChange={(e) => setCustomerEmailConfirm(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Teléfono WhatsApp *
                    </label>
                    <Input
                      type="tel"
                      placeholder="Ej: 11 1234-5678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-[#6b7280] mt-1">
                      Solo números, sin formato específico (ej: 11 1234-5678)
                    </p>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end gap-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/imprimir-publico")}
                >
                  Volver
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateOrder}
                  disabled={
                    loading ||
                    !pricingLoaded ||
                    !customerName.trim() ||
                    !customerEmail.trim() ||
                    !customerEmailConfirm.trim() ||
                    !customerPhone.trim() ||
                    customerEmail.trim().toLowerCase() !== customerEmailConfirm.trim().toLowerCase()
                  }
                  accentColor={ACCENT_COLOR}
                  style={{
                    backgroundColor: ACCENT_COLOR,
                    borderColor: ACCENT_COLOR,
                  }}
                >
                  {loading ? "Procesando..." : "Pagar y confirmar pedido"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
