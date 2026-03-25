"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PhotographerHeader from "./PhotographerHeader";
import PhotographerFooter from "./PhotographerFooter";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
};

type LabPricing = {
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
  platformCommissionPercent?: number;
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

// Helper para formatear moneda ARS
function formatARS(n: number): string {
  // Validar que n sea un número válido
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
  const sizeDiscounts = pricing.discounts.filter((d) => d.size === size);
  
  const d50 = sizeDiscounts.find((d) => d.minQty === 50)?.discountPercent;
  const d100 = sizeDiscounts.find((d) => d.minQty === 100)?.discountPercent;

  if (sizeQty >= 100) return d100 ?? 0;
  if (sizeQty >= 50) return d50 ?? 0;
  return 0;
}

// Función para calcular precio unitario final (sin fee)
function calculateFinalUnitPrice(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  const basePrice = getBasePrice(size, pricing);
  if (!basePrice || basePrice === 0 || !Number.isFinite(basePrice)) {
    return 0;
  }
  const discountPercent = getDiscountPercent(size, sizeQty, pricing);
  const discountedPrice = basePrice * (1 - discountPercent / 100);
  const result = Math.round(discountedPrice);
  return Number.isFinite(result) ? result : 0;
}

export default function PhotographerResumenPage({
  photographer,
  handler,
}: {
  photographer: Photographer;
  handler: string;
}) {
  const router = useRouter();
  const primaryColor = photographer.primaryColor || "#c27b3d";
  const [items, setItems] = useState<Item[]>([]);
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [quote, setQuote] = useState<{ totals: QuoteTotals; items: QuoteItem[] } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

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
  }, [photographer.id]);

  // Cargar items desde sessionStorage
  useEffect(() => {
    const savedItems = sessionStorage.getItem("orderItems");
    if (!savedItems) {
      router.push(`/${handler}/imprimir`);
      return;
    }
    try {
      const parsed = JSON.parse(savedItems);
      setItems(parsed);
    } catch (e) {
      console.error("Error cargando items:", e);
      router.push(`/${handler}/imprimir`);
    }
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
    return entries.sort((a, b) => {
      if (a.size !== b.size) return a.size.localeCompare(b.size);
      return a.finish.localeCompare(b.finish);
    });
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
        setQuoteLoading(true);
        const res = await fetch("/api/print-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: "PRINT_PHOTOGRAPHER",
            photographerId: photographer.id,
            labId: photographer.preferredLabId ?? null,
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
  }, [items, photographer.id, photographer.preferredLabId]);

  function handleContinue() {
    router.push(`/${handler}/imprimir/datos`);
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
            <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
              {quoteLoading && (
                <Card className="bg-[#f3f4f6] border border-[#e5e7eb]">
                  <p className="text-sm text-[#6b7280]">Calculando precios...</p>
                </Card>
              )}
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
                  Resumen de tu pedido
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
                  Revisá los detalles antes de confirmar
                </p>
              </div>

              {/* Items individuales (simplificados) */}
              <div className="space-y-4">
                {items.map((item, index) => {
                  const computed = quote?.items?.find((q) => q.inputIndex === index);
                  const finalUnitPrice = computed?.unitPriceCents ?? 0;
                  const subtotal = computed?.subtotalCents ?? 0;
                  const hasDiscount = false;

                  return (
                    <Card key={`${item.fileKey}-${index}`} className="p-4">
                      <div className="flex gap-4 items-start">
                        <img
                          src={item.previewUrl}
                          alt={item.originalName}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-[#1a1a1a] mb-1">
                            {item.originalName}
                          </p>
                          <p className="text-sm text-[#6b7280]">
                            {item.size} - {item.finish === "BRILLO" ? "Brillo" : item.finish === "MATE" ? "Mate" : item.finish} - {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}
                          </p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-[#6b7280]">
                              Precio unitario: <span className="font-medium text-[#1a1a1a]">{formatARS(finalUnitPrice)}</span>
                            </p>
                            {hasDiscount && (
                              <p className="text-xs text-[#10b981]">✓ Descuento aplicado</p>
                            )}
                            <p className="text-sm font-medium text-[#1a1a1a]">
                              Subtotal: {formatARS(subtotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Resumen agrupado */}
              {summaryBySizeAndFinish.length > 0 && (
                <Card>
                  <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">
                    Resumen por tipo
                  </h2>
                  <div className="space-y-2">
                    {summaryBySizeAndFinish.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0"
                      >
                        <span className="text-sm text-[#6b7280]">
                          Fotografía - {entry.size} - {entry.finish}
                        </span>
                        <span className="text-sm font-medium text-[#1a1a1a]">
                          {entry.quantity} {entry.quantity === 1 ? "fotografía" : "fotografías"}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Resumen final */}
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

              {/* Botones de acción */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/${handler}/imprimir`)}
                >
                  ← Modificar pedido
                </Button>
                <Button
                  variant="primary"
                  onClick={handleContinue}
                  className="text-lg px-8"
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  }}
                >
                  Confirmar pedido
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
