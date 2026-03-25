"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
  tipo?: "digital" | "impresa";
  productId?: number | null;
  productName?: string | null;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
};

type OrderItemPayload = {
  fileKey: string;
  originalName: string;
  size: string;
  acabado: string;
  quantity: number;
  tipo: "digital" | "impresa";
  priceCents: number;
  productId?: number | null;
  productName?: string | null;
  includedWithPrint?: boolean;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
};

type AlbumPricing = {
  photographerId?: number | null;
  digitalPhotoPriceCents: number | null;
  preferredLabId?: number | null;
  selectedLabId?: number | null;
  profitMarginPercent: number;
  enablePrintedPhotos?: boolean;
  enableDigitalPhotos?: boolean;
  includeDigitalWithPrint?: boolean;
  digitalWithPrintDiscountPercent?: number;
  allowClientLabSelection?: boolean | null;
  pickupBy?: "CLIENT" | "PHOTOGRAPHER";
  extensionPricingActive?: boolean;
  extensionSurchargePercent?: number;
  extensionBaseEndsAt?: string | null;
  extensionEndsAt?: string | null;
  extensionDaysRemaining?: number | null;
  pickupInfo?: {
    type: "LAB" | "PHOTOGRAPHER";
    name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
  } | null;
};

type QuoteTotals = {
  displayTotalCents: number;
  mpTotalCents: number;
  marketplaceFeeCents: number;
  extensionSurchargeCents?: number;
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

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  secondaryColor: string | null;
  publicPageHandler: string;
} | null;

// Helper para formatear moneda ARS
function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AlbumResumenPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;
  
  const [items, setItems] = useState<Item[]>([]);
  const [quote, setQuote] = useState<{ totals: QuoteTotals; items: QuoteItem[] } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [albumPricing, setAlbumPricing] = useState<AlbumPricing | null>(null);
  const [photographer, setPhotographer] = useState<Photographer>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerEmailConfirm, setBuyerEmailConfirm] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);

  // Cargar albumPricing y fotógrafo desde sessionStorage
  useEffect(() => {
    const ap = sessionStorage.getItem(`album_${albumId}_pricing`);
    if (ap) try { setAlbumPricing(JSON.parse(ap)); } catch {}
    
    const photographerData = sessionStorage.getItem(`album_${albumId}_photographer`);
    if (photographerData) {
      try {
        setPhotographer(JSON.parse(photographerData));
      } catch {}
    }
  }, [albumId]);

  useEffect(() => {
    const savedClient = sessionStorage.getItem("client");
    if (!savedClient) return;
    try {
      const clientData = JSON.parse(savedClient);
      setClient(clientData);
      if (clientData?.name && !buyerName) setBuyerName(clientData.name);
      if (clientData?.email && !buyerEmail) {
        setBuyerEmail(clientData.email);
        setBuyerEmailConfirm(clientData.email);
      }
    } catch {}
  }, [buyerName, buyerEmail]);

  // Cargar items desde sessionStorage
  useEffect(() => {
    const savedItems = sessionStorage.getItem(`album_${albumId}_items`);
    if (!savedItems) {
      router.push(`/a/${albumId}/comprar`);
      return;
    }
    try {
      const parsed = JSON.parse(savedItems);
      const cleaned = parsed.map((it: any) => {
        const { unitPrice, ...rest } = it;
        const tipo = rest.tipo || "digital";
        return {
          ...rest,
          tipo,
          size: rest.size || "10x15",
          productId: rest.productId ?? null,
          productName: rest.productName ?? null,
        };
      });
      setItems(cleaned);
    } catch (e) {
      console.error("Error cargando items:", e);
      router.push(`/a/${albumId}/comprar`);
    }
  }, [router, albumId]);

  // Calcular cantidad total por tamaño (solo impresas)
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const tipo = it.tipo || "digital";
      // Solo contar items impresas con un size válido
      if (tipo !== "digital" && it.size && it.size !== "DIGITAL") {
        map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
      }
    }
    return map;
  }, [items]);

  // Calcular resumen por tamaño y acabado (solo impresas; digitales se cuentan aparte)
  const summaryBySizeAndFinish = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if ((it.tipo || "digital") === "digital" || it.size === "DIGITAL") continue;
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

  const digitalCount = useMemo(() => items.filter((it) => (it.tipo || "digital") === "digital" || it.size === "DIGITAL").reduce((s, it) => s + (it.quantity || 1), 0), [items]);

  const totals = quote?.totals || {
    displayTotalCents: 0,
    mpTotalCents: 0,
    marketplaceFeeCents: 0,
    extensionSurchargeCents: 0,
    components: [],
  };
  const totalDiscountArs = 0;
  const totalDisplayArs = totals.displayTotalCents;
  const extensionSurchargeArs = totals.extensionSurchargeCents ?? 0;

  const itemsToSend = useMemo<OrderItemPayload[]>(() => {
    if (!albumPricing) return [];
    const result: OrderItemPayload[] = [];

    items.forEach((it, index) => {
      const t = it.tipo || "digital";
      if (t === "impresa" && albumPricing.includeDigitalWithPrint && albumPricing.enableDigitalPhotos) {
        result.push({
          fileKey: it.fileKey,
          originalName: it.originalName,
          size: "DIGITAL",
          acabado: "DIGITAL",
          quantity: 1,
          tipo: "digital",
          priceCents: 0,
          productId: it.productId ?? null,
          productName: it.productName ?? null,
          includedWithPrint: true,
          uploaderId: it.uploaderId ?? null,
          uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
        });
      }

      if (t === "digital" || it.size === "DIGITAL") {
        const computed = quote?.items?.find((item) => item.inputIndex === index);
        result.push({
          fileKey: it.fileKey,
          originalName: it.originalName,
          size: "DIGITAL",
          acabado: "DIGITAL",
          quantity: 1,
          tipo: "digital",
          priceCents: computed?.unitPriceCents ?? 0,
          productId: it.productId ?? null,
          productName: it.productName ?? null,
          uploaderId: it.uploaderId ?? null,
          uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
        });
        return;
      }

      if (!it.size || it.size === "DIGITAL") {
        result.push({
          fileKey: it.fileKey,
          originalName: it.originalName,
          size: it.size || "10x15",
          acabado: it.finish || "BRILLO",
          quantity: it.quantity || 1,
          tipo: "impresa",
          priceCents: 0,
          productId: it.productId ?? null,
          productName: it.productName ?? null,
          uploaderId: it.uploaderId ?? null,
          uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
        });
        return;
      }

      result.push({
        fileKey: it.fileKey,
        originalName: it.originalName,
        size: it.size,
        acabado: it.finish,
        quantity: it.quantity || 1,
        tipo: "impresa",
        priceCents: quote?.items?.find((item) => item.inputIndex === index)?.subtotalCents ?? 0,
        productId: it.productId ?? null,
        productName: it.productName ?? null,
        uploaderId: it.uploaderId ?? null,
        uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
      });
    });

    return result;
  }, [albumPricing, items, quote]);

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    async function loadQuote() {
      try {
        setQuoteLoading(true);
        const res = await fetch(`/api/a/${albumId}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Error calculando el resumen");
        }
        if (!cancelled) {
          setQuote({
            totals: {
              ...data.totals,
              extensionSurchargeCents: (data?.snapshot?.extensionSurchargeCents ?? 0) as number,
            },
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
  }, [albumId, items]);

  async function handleSubmit() {
    setError(null);
    if (!buyerName.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    if (!buyerEmail.trim()) {
      setError("Ingresá un email para continuar.");
      return;
    }
    if (!buyerEmailConfirm.trim()) {
      setError("Repetí el email para continuar.");
      return;
    }
    if (buyerEmail.trim().toLowerCase() !== buyerEmailConfirm.trim().toLowerCase()) {
      setError("Los emails no coinciden.");
      return;
    }
    if (!buyerPhone.trim()) {
      setError("El teléfono de WhatsApp es obligatorio.");
      return;
    }
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!isValidPhoneForPurchase(buyerPhone)) {
      setError("Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos).");
      return;
    }
    if (itemsToSend.length === 0) {
      setError("No hay items para procesar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/a/${albumId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: buyerEmail.trim(),
          buyerName: buyerName.trim() || undefined,
          buyerPhone: buyerPhone.trim() || undefined,
          items: itemsToSend,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear el pedido.");
      }
      if (data?.initPoint) {
        window.location.href = data.initPoint;
        return;
      }
      throw new Error(data?.error || data?.mpError || "Pedido creado pero no se generó el link de pago.");
    } catch (e: any) {
      setError(e?.message || "No se pudo crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {photographer ? (
        <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
      ) : null}
      <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center px-4">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#1a1a1a] mb-2">
              Resumen del pedido
            </h1>
            <p className="text-[#6b7280] mb-4">
              Revisá los detalles antes de confirmar
            </p>
            <p className="text-sm text-[#6b7280]">
              Verificá todos los detalles de tu pedido antes de continuar. Podés volver atrás si necesitás hacer algún cambio.
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

          {albumPricing?.extensionPricingActive && (
            <Card className="bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                ⏱ Estás comprando durante el período extendido del álbum. El total incluye un recargo especial.
              </p>
            </Card>
          )}

          {/* Items del pedido */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const isDigital = (item.tipo || "digital") === "digital" || item.size === "DIGITAL";
              const computed = quote?.items?.find((q) => q.inputIndex === index);
              const unitPrice = computed?.unitPriceCents ?? 0;
              const subtotal = computed?.subtotalCents ?? 0;
              const discountPercent = 0;

              return (
                <Card key={item.fileKey} className="p-4">
                  <div className="flex gap-4">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#f3f4f6] flex items-center justify-center p-1">
                      <img src={item.previewUrl} alt={item.originalName} className="max-w-full max-h-full object-contain" style={{ width: "auto", height: "auto", maxWidth: "80px", maxHeight: "80px" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-[#1a1a1a] mb-1">{item.originalName}</h3>
                          <p className="text-sm text-[#6b7280]">
                            {isDigital ? "Digital - 1 unidad" : `${item.size} - ${item.finish === "BRILLO" ? "Brillo" : "Mate"} - ${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-[#6b7280]">
                          Precio unitario: <span className="font-medium text-[#1a1a1a]">{formatARS(unitPrice)}</span>
                        </p>
                        {discountPercent > 0 && (
                          <p className="text-xs text-[#10b981]">
                            ✓ Descuento aplicado: {discountPercent.toFixed(0)}%
                          </p>
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

          {/* Resumen por tamaño y acabado */}
          {(summaryBySizeAndFinish.length > 0 || digitalCount > 0) && (
            <Card className="bg-white border border-[#e5e7eb]">
              <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Resumen del pedido</h3>
              <div className="space-y-2">
                {summaryBySizeAndFinish.map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0">
                    <span className="text-sm text-[#6b7280]">{entry.size} - {entry.finish === "BRILLO" ? "Brillo" : "Mate"}</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">{entry.quantity} {entry.quantity === 1 ? "fotografía" : "fotografías"}</span>
                  </div>
                ))}
                {digitalCount > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0">
                    <span className="text-sm text-[#6b7280]">Digital</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">{digitalCount} {digitalCount === 1 ? "fotografía" : "fotografías"}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Mensaje sobre archivo digital incluido */}
          {albumPricing?.includeDigitalWithPrint && items.some((item) => (item.tipo ?? "digital") === "impresa") && (
            <Card className="bg-green-50 border border-green-200">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-900 mb-2">
                  📧 Archivo digital incluido
                </h3>
                <p className="text-sm text-green-800">
                  Al comprar fotos impresas, también recibirás el archivo digital por email
                  {albumPricing.digitalWithPrintDiscountPercent
                    ? ` con ${Math.round(albumPricing.digitalWithPrintDiscountPercent)}% de descuento.`
                    : " con el precio digital configurado."}
                </p>
              </div>
            </Card>
          )}

          {items.length > 1 && (
            <Card className="bg-blue-50 border border-blue-200">
              <div className="space-y-2">
                <p className="text-sm text-blue-900 font-medium">
                  Estamos procesando tu pedido; te enviaremos un correo con el link de descarga cuando esté listo.
                </p>
                <p className="text-xs text-blue-700">
                  Mientras tanto podés seguir revisando la información del pedido o cerrar esta ventana. También podés consultar el estado desde el link que recibiste de la API.
                </p>
              </div>
            </Card>
          )}

          {/* Mensaje de retiro de fotos impresas */}
          {albumPricing?.pickupInfo && items.some((item) => (item.tipo ?? "digital") === "impresa") && (
            <Card className="bg-blue-50 border border-blue-200">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  📍 Información de retiro de fotos impresas
                </h3>
                {albumPricing.pickupInfo.type === "LAB" ? (
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">
                      En el caso de comprar fotos impresas, el laboratorio donde tendrás que retirar las impresiones es:
                    </p>
                    <div className="mt-2 space-y-1">
                      <p><strong>{albumPricing.pickupInfo.name}</strong></p>
                      {albumPricing.pickupInfo.address && (
                        <p>{albumPricing.pickupInfo.address}</p>
                      )}
                      {(albumPricing.pickupInfo.city || albumPricing.pickupInfo.province) && (
                        <p>
                          {albumPricing.pickupInfo.city}
                          {albumPricing.pickupInfo.city && albumPricing.pickupInfo.province && ", "}
                          {albumPricing.pickupInfo.province}
                        </p>
                      )}
                      {albumPricing.pickupInfo.phone && (
                        <p>Teléfono: {albumPricing.pickupInfo.phone}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">
                      En el caso de comprar fotos impresas, el fotógrafo se encargará de entregarte las fotos. Sus datos de contacto son:
                    </p>
                    <div className="mt-2 space-y-1">
                      {albumPricing.pickupInfo.name && (
                        <p><strong>{albumPricing.pickupInfo.name}</strong></p>
                      )}
                      {albumPricing.pickupInfo.address && (
                        <p>{albumPricing.pickupInfo.address}</p>
                      )}
                      {(albumPricing.pickupInfo.city || albumPricing.pickupInfo.province) && (
                        <p>
                          {albumPricing.pickupInfo.city}
                          {albumPricing.pickupInfo.city && albumPricing.pickupInfo.province && ", "}
                          {albumPricing.pickupInfo.province}
                        </p>
                      )}
                      {albumPricing.pickupInfo.phone && (
                        <p>Teléfono: {albumPricing.pickupInfo.phone}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Resumen final */}
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
              {albumPricing?.extensionPricingActive && extensionSurchargeArs > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-700">
                  <span>Recargo por extensión de álbum</span>
                  <span className="font-medium">+{formatARS(extensionSurchargeArs)}</span>
                </div>
              )}
              {totalDiscountArs > 0 ? (
                <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
                  <p className="text-sm text-[#10b981] font-medium">
                    ✅ En este pedido ahorraste {formatARS(totalDiscountArs)} gracias a
                    los descuentos por cantidad de la lista del fotógrafo.
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

          {/* Datos del cliente */}
          <Card className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-medium text-[#1a1a1a]">Tus datos</h2>
              <p className="text-sm text-[#6b7280]">
                Completá tus datos para confirmar la compra
              </p>
            </div>
            {client && (
              <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-3">
                <p className="text-sm text-[#10b981]">
                  ✅ Estás iniciado sesión como {client.name || client.email}. El pedido se vinculará a tu cuenta.
                </p>
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
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
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
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
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
                value={buyerEmailConfirm}
                onChange={(e) => setBuyerEmailConfirm(e.target.value)}
                required
                disabled={!!client}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                Teléfono WhatsApp (Argentina) *
              </label>
              <Input
                className="w-full"
                type="tel"
                placeholder="Ej: 11 1234-5678"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                required
              />
              <p className="text-xs text-[#6b7280] mt-1">
                Solo números, sin formato específico (ej: 11 1234-5678)
              </p>
            </div>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-between pt-6">
            <Button variant="secondary" onClick={() => router.push(`/a/${albumId}/comprar`)}>
              ← Modificar pedido
            </Button>
            <Button variant="primary" onClick={handleSubmit} className="text-lg px-8" disabled={loading}>
              {loading ? "Procesando..." : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      </div>
    </section>
    {photographer ? (
      <PhotographerFooter photographer={photographer} />
    ) : null}
    </>
  );
}
