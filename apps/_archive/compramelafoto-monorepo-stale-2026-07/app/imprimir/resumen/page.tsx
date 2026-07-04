"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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

type AlbumPricing = { preferredLabId: number | null; profitMarginPercent: number };

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
  components?: Array<{
    component: "DIGITAL" | "PRINT";
    displayTotalCents: number;
  }>;
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

export default function ResumenPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [labPricing, setLabPricing] = useState<LabPricing>({ basePrices: [], discounts: [] });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [albumPricing, setAlbumPricing] = useState<AlbumPricing | null>(null);
  const [quote, setQuote] = useState<{ totals: QuoteTotals; items: QuoteItem[] } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Cargar albumPricing y precios del laboratorio
  useEffect(() => {
    const ap = sessionStorage.getItem("albumPricing");
    if (ap) try { setAlbumPricing(JSON.parse(ap)); } catch {}
  }, []);

  useEffect(() => {
    const storedPhotographerId = Number(sessionStorage.getItem("imprimirPhotographerId") || sessionStorage.getItem("photographerId") || "");
    const photographerId = Number.isFinite(storedPhotographerId) ? storedPhotographerId : 32;
    const url = `/api/public/lab-pricing?photographerId=${photographerId}`;
    async function loadPricing() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error cargando precios");
        const data = await res.json();
        setLabPricing({
          basePrices: Array.isArray(data.basePrices) ? data.basePrices : [],
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          platformCommissionPercent: Number(data.platformCommissionPercent ?? 0) || 0,
          products: Array.isArray(data.products) ? data.products.filter((p: LabProduct) => p.isActive !== false) : [],
        });
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios:", e);
        setPricingLoaded(false);
      }
    }
    loadPricing();
  }, [albumPricing?.preferredLabId]);

  // Cargar items desde sessionStorage
  useEffect(() => {
    const savedItems = sessionStorage.getItem("orderItems");
    if (!savedItems) {
      router.push("/imprimir");
      return;
    }
    try {
      const parsed = JSON.parse(savedItems);
      const cleaned = parsed.map((it: any) => {
        const { unitPrice, ...rest } = it;
        return { ...rest, tipo: rest.tipo || "impresa" };
      });
      setItems(cleaned);
    } catch (e) {
      console.error("Error cargando items:", e);
      router.push("/imprimir");
    }
  }, [router]);

  // Calcular cantidad total por tamaño
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
    }
    return map;
  }, [items]);

  // Calcular resumen por tamaño y acabado
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
    entries.sort((a, b) => (a.size !== b.size ? a.size.localeCompare(b.size) : a.finish.localeCompare(b.finish)));
    return entries;
  }, [items]);

  const totals = quote?.totals || {
    displayTotalCents: 0,
    mpTotalCents: 0,
    marketplaceFeeCents: 0,
    components: [],
  };
  const totalDiscountArs = 0;
  const totalDisplayArs = totals.displayTotalCents;

  function handleContinue() {
    router.push("/imprimir/datos");
  }

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    async function loadQuote() {
      try {
        setQuoteLoading(true);
        const photographerId = Number(
          sessionStorage.getItem("imprimirPhotographerId") || sessionStorage.getItem("photographerId") || ""
        );
        const normalizedPhotographerId = Number.isFinite(photographerId) ? photographerId : 32;
        const labId = albumPricing?.preferredLabId ?? null;
        const res = await fetch("/api/print-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: "PRINT_PHOTOGRAPHER",
            photographerId: normalizedPhotographerId,
            labId,
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
  }, [items, albumPricing?.preferredLabId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header actualizado */}
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
              Resumen del pedido
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
              Verificá todos los detalles de tu pedido antes de continuar. Podés volver atrás si necesitás hacer algún cambio.
            </p>
          </div>

          {/* Items del pedido - versión simplificada */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const computed = quote?.items?.find((q) => q.inputIndex === index);
              const unitPrice = computed?.unitPriceCents ?? 0;
              const subtotal = computed?.subtotalCents ?? 0;

              return (
                <Card key={item.fileKey} className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full sm:w-20 h-auto sm:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#f3f4f6] flex items-center justify-center p-1">
                      <img src={item.previewUrl} alt={item.originalName} className="max-w-full max-h-full object-contain" style={{ width: "auto", height: "auto", maxWidth: "80px", maxHeight: "80px" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-[#1a1a1a] mb-1">{item.originalName}</h3>
                          <p className="text-sm text-[#6b7280]">
                            {`${item.size} - ${item.finish === "BRILLO" ? "Brillo" : "Mate"} - ${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-[#6b7280]">
                          Precio unitario: <span className="font-medium text-[#1a1a1a]">{formatARS(unitPrice)}</span>
                        </p>
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

          {/* Resumen por tamaño y acabado */}
          {summaryBySizeAndFinish.length > 0 && (
            <Card className="bg-white border border-[#e5e7eb]">
              <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Resumen del pedido</h3>
              <div className="space-y-2">
                {summaryBySizeAndFinish.map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0">
                    <span className="text-sm text-[#6b7280]">{entry.size} - {entry.finish === "BRILLO" ? "Brillo" : "Mate"}</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">{entry.quantity} {entry.quantity === 1 ? "fotografía" : "fotografías"}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Resumen final (igual que en /imprimir) */}
          <Card className="bg-[#f8f9fa]">
            <div className="space-y-4">
              {totalDiscountArs > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-[#1a1a1a]">
                    Total descuento
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
              {totalDiscountArs > 0 ? (
                <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
                  <p className="text-sm text-[#10b981] font-medium">
                    ✅ En este pedido ahorraste {formatARS(totalDiscountArs)} gracias a
                    los descuentos por cantidad del laboratorio.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-[#f3f4f6] border border-[#e5e7eb] rounded-lg">
                  <p className="text-sm text-[#6b7280]">
                    No se aplicaron descuentos por cantidad en este pedido.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-between pt-6">
            <Button variant="secondary" onClick={() => router.push("/imprimir")}>
              ← Modificar pedido
            </Button>
            <Button variant="primary" onClick={handleContinue} className="text-lg px-8">
              Confirmar pedido
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
