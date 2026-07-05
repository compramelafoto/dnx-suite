"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";
import CheckoutLeakGuard from "@/components/checkout/CheckoutLeakGuard";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";
import EmailConfirmationHint, {
  EMAIL_EMPTY_PLACEHOLDER_COPY,
} from "@/components/checkout/EmailConfirmationHint";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import { readFaceBulkPackPhotoIds } from "@/lib/album-checkout-selection";
import { stripCartCopySuffix } from "@/lib/album-photo-ref";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import { expandAlbumCheckoutItemsWithPrintDigitalBundle } from "@/lib/pricing/album-checkout-print-digital-bundle";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import { savePendingOrderSession } from "@/lib/checkout/pending-order-session";
import { redirectToMercadoPago } from "@/lib/checkout/mp-redirect";
import { trackFunnelEvent, FUNNEL_EVENTS } from "@/lib/funnel-track-client";

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
  includedWithPrint?: boolean;
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

type FaceBulkPackSnapshot = {
  packPhotoIds: number[];
  packBaseCents: number;
  packClientTotalCents: number;
  packPhotoCount: number;
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

type QuoteSnapshot = {
  extensionSurchargeCents?: number;
  faceBulkPack?: FaceBulkPackSnapshot | null;
  platformFeePercent?: number;
} | null;

type QuoteItem = {
  inputIndex: number;
  component: "DIGITAL" | "PRINT";
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  basePriceCents?: number;
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

function parsePhotoIdFromCheckoutFileKey(fileKey: string): number | null {
  const base = stripCartCopySuffix(fileKey);
  const m = /^photo:(\d+)$/.exec(base);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function AlbumResumenPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const albumId = params.id as string;
  const checkoutDebugEnabled =
    searchParams.get("debugCheckout") === "1" ||
    process.env.NEXT_PUBLIC_CHECKOUT_DEBUG === "1";
  
  const [items, setItems] = useState<Item[]>([]);
  const [faceBulkPackPhotoIds, setFaceBulkPackPhotoIds] = useState<number[]>([]);
  const [quote, setQuote] = useState<{
    totals: QuoteTotals;
    items: QuoteItem[];
    snapshot: QuoteSnapshot;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [albumPricing, setAlbumPricing] = useState<AlbumPricing | null>(null);
  const [photographer, setPhotographer] = useState<Photographer>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  const [mpPreparing, setMpPreparing] = useState(false);
  const [mpPreparingStep, setMpPreparingStep] = useState<1 | 2>(1);
  const submitAttemptKeyRef = useRef<string | null>(null);

  function getSubmitAttemptKey() {
    if (submitAttemptKeyRef.current) return submitAttemptKeyRef.current;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    submitAttemptKeyRef.current = `album-order:${albumId}:${generated}`;
    return submitAttemptKeyRef.current;
  }

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
    if (typeof window === "undefined") return;
    setFaceBulkPackPhotoIds(readFaceBulkPackPhotoIds(albumId));
  }, [albumId, items]);

  useEffect(() => {
    const savedClient = sessionStorage.getItem("client");
    if (!savedClient) return;
    try {
      const clientData = JSON.parse(savedClient);
      setClient(clientData);
      if (clientData?.name && !buyerName) setBuyerName(clientData.name);
      if (clientData?.email && !buyerEmail) {
        setBuyerEmail(clientData.email);
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

  useEffect(() => {
    if (!albumId) return;
    void (async () => {
      const { trackFunnelEvent, FUNNEL_EVENTS } = await import("@/lib/funnel-track-client");
      await trackFunnelEvent(FUNNEL_EVENTS.ORDER_FINAL_VIEW, { albumId });
    })();
  }, [albumId]);

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

  const pricingItems = useMemo(
    () => expandAlbumCheckoutItemsWithPrintDigitalBundle(items, albumPricing),
    [items, albumPricing]
  );

  const faceBulkSnap = quote?.snapshot?.faceBulkPack ?? null;
  const faceBulkPackIdSet = useMemo(
    () => new Set(faceBulkSnap?.packPhotoIds ?? []),
    [faceBulkSnap?.packPhotoIds]
  );

  const totals = quote?.totals || {
    displayTotalCents: 0,
    mpTotalCents: 0,
    marketplaceFeeCents: 0,
    extensionSurchargeCents: 0,
    components: [],
  };
  const totalDiscountArs = useMemo(() => {
    if (!quote?.items?.length) return 0;
    const feePercent = Number(quote?.snapshot?.platformFeePercent ?? 0) || 0;
    const faceBulkSet = new Set(faceBulkSnap?.packPhotoIds ?? []);
    let totalDiscount = 0;

    for (const line of quote.items) {
      if (line.component !== "DIGITAL") continue;
      const basePrice = Number(line.basePriceCents ?? 0);
      if (!Number.isFinite(basePrice) || basePrice <= 0) continue;

      const sourceItem = pricingItems[line.inputIndex];
      const sourcePhotoId = sourceItem
        ? parsePhotoIdFromCheckoutFileKey(sourceItem.fileKey)
        : null;
      if (sourcePhotoId != null && faceBulkSet.has(sourcePhotoId)) {
        // Las fotos incluidas en face-bulk van en una línea aparte del pack, no cuentan como descuento unitario.
        continue;
      }

      const originalUnitPrice = totalFromBase(Math.round(basePrice), feePercent);
      const originalSubtotal = originalUnitPrice * line.quantity;
      totalDiscount += Math.max(0, originalSubtotal - line.subtotalCents);
    }

    return totalDiscount;
  }, [quote, pricingItems, faceBulkSnap?.packPhotoIds]);

  const getCartItemQuoteTotals = useCallback(
    (item: Item) => {
      if (!quote?.items?.length) {
        return { unitPrice: 0, subtotal: 0, includesDigitalBundle: false };
      }
      const fileKey = stripCartCopySuffix(item.fileKey);
      const isDigital = (item.tipo || "digital") === "digital" || item.size === "DIGITAL";
      let unitPrice = 0;
      let subtotal = 0;
      let includesDigitalBundle = false;

      for (const line of quote.items) {
        const source = pricingItems[line.inputIndex];
        if (!source || stripCartCopySuffix(source.fileKey) !== fileKey) continue;

        if (isDigital) {
          if (line.component === "DIGITAL" && !source.includedWithPrint) {
            unitPrice = line.unitPriceCents;
            subtotal = line.subtotalCents;
          }
          continue;
        }

        if (line.component === "PRINT") {
          unitPrice = line.unitPriceCents;
          subtotal += line.subtotalCents;
        }
        if (line.component === "DIGITAL" && source.includedWithPrint) {
          subtotal += line.subtotalCents;
          includesDigitalBundle = line.subtotalCents > 0;
        }
      }

      return { unitPrice, subtotal, includesDigitalBundle };
    },
    [quote, pricingItems]
  );

  const itemsToSend = useMemo<OrderItemPayload[]>(() => {
    if (!albumPricing) return [];

    return pricingItems.map((it, index) => {
      const t = it.tipo || "digital";
      const computed = quote?.items?.find((item) => item.inputIndex === index);

      if (t === "digital" || it.size === "DIGITAL") {
        return {
          fileKey: it.fileKey,
          originalName: it.originalName,
          size: "DIGITAL",
          acabado: "DIGITAL",
          quantity: 1,
          tipo: "digital",
          priceCents: computed?.unitPriceCents ?? 0,
          productId: it.productId ?? null,
          productName: it.productName ?? null,
          includedWithPrint: it.includedWithPrint ?? false,
          uploaderId: it.uploaderId ?? null,
          uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
        };
      }

      return {
        fileKey: it.fileKey,
        originalName: it.originalName,
        size: it.size || "10x15",
        acabado: it.finish || "BRILLO",
        quantity: it.quantity || 1,
        tipo: "impresa",
        priceCents: computed?.subtotalCents ?? 0,
        productId: it.productId ?? null,
        productName: it.productName ?? null,
        uploaderId: it.uploaderId ?? null,
        uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
      };
    });
  }, [albumPricing, pricingItems, quote]);

  const totalDisplayArs = totals.displayTotalCents;
  const extensionSurchargeArs = totals.extensionSurchargeCents ?? 0;

  useEffect(() => {
    if (!pricingItems.length) return;
    let cancelled = false;
    async function loadQuote() {
      try {
        setQuoteLoading(true);
        setQuoteError(null);
        const startedAt = performance.now();
        const res = await fetch(`/api/a/${albumId}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: pricingItems,
            ...(faceBulkPackPhotoIds.length > 0 ? { faceBulkPackPhotoIds } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Error calculando el resumen");
        }
        if (checkoutDebugEnabled) {
          console.info("[checkout-debug] Quote cargada", {
            albumId,
            itemCount: pricingItems.length,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        }
        if (!cancelled) {
          setQuote({
            totals: {
              ...data.totals,
              extensionSurchargeCents: (data?.snapshot?.extensionSurchargeCents ?? 0) as number,
            },
            items: Array.isArray(data.items) ? data.items : [],
            snapshot: (data?.snapshot ?? null) as QuoteSnapshot,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando resumen:", err);
          const msg =
            err instanceof Error && err.message
              ? err.message
              : "No pudimos calcular los precios. Volvé al carrito e intentá de nuevo.";
          setQuoteError(msg);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [albumId, pricingItems, faceBulkPackPhotoIds, checkoutDebugEnabled]);

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    if (!buyerName.trim()) {
      setError("El nombre es requerido.");
      setLoading(false);
      return;
    }
    const emailError = getCheckoutEmailValidationError(buyerEmail);
    if (emailError) {
      setError(emailError);
      setLoading(false);
      return;
    }
    if (!buyerPhone.trim()) {
      setError("El teléfono de WhatsApp es obligatorio.");
      setLoading(false);
      return;
    }
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!isValidPhoneForPurchase(buyerPhone)) {
      setError("Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos).");
      setLoading(false);
      return;
    }
    if (itemsToSend.length === 0) {
      setError("No hay items para procesar.");
      setLoading(false);
      return;
    }
    if (!termsAccepted) {
      setTermsError("Para continuar necesitás aceptar los términos.");
      setLoading(false);
      return;
    }
    setTermsError(null);

    if (quoteLoading) {
      setError("Estamos calculando los precios. Esperá un momento e intentá de nuevo.");
      setLoading(false);
      return;
    }
    if (!quote || totalDisplayArs <= 0) {
      setError(
        quoteError ??
          "No pudimos calcular el total de tu pedido. Volvé al carrito, actualizá la selección e intentá de nuevo."
      );
      setLoading(false);
      return;
    }

    const idempotencyKey = getSubmitAttemptKey();
    const mpRedirectStartedAt = Date.now();
    const orderCreateController = new AbortController();
    const orderCreateTimeoutId = window.setTimeout(
      () => orderCreateController.abort(),
      30_000
    );
    try {
      const startedAt = performance.now();
      if (checkoutDebugEnabled) {
        const sampleUrl = items[0]?.previewUrl || "";
        const sampleMode = sampleUrl.includes("mode=thumb")
          ? "thumb"
          : sampleUrl.includes("mode=preview")
            ? "preview"
            : sampleUrl.includes("mode=original")
              ? "original"
              : "unknown";
        console.info("[checkout-debug] Submit pedido iniciado", {
          albumId,
          selectedCount: items.length,
          sampleMode,
          sampleUrl,
        });
      }
      const res = await fetch(`/api/a/${albumId}/orders`, {
        method: "POST",
        signal: orderCreateController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          buyerEmail: buyerEmail.trim(),
          buyerName: buyerName.trim() || undefined,
          buyerPhone: buyerPhone.trim() || undefined,
          items: itemsToSend,
          idempotencyKey,
          termsAccepted: true,
          ...(faceBulkPackPhotoIds.length > 0 ? { faceBulkPackPhotoIds } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (checkoutDebugEnabled) {
        console.info("[checkout-debug] API /orders respondió", {
          albumId,
          elapsedMs: Math.round(performance.now() - startedAt),
          ok: res.ok,
          hasInitPoint: Boolean(data?.initPoint),
        });
      }
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear el pedido.");
      }
      if (data?.initPoint) {
        const oid = typeof data?.id === "number" ? data.id : undefined;
        if (oid) {
          savePendingOrderSession(albumId, {
            orderId: oid,
            buyerEmail: buyerEmail.trim(),
          });
        }
        setMpPreparing(true);
        setMpPreparingStep(1);
        void trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_REDIRECT_PREPARING_SHOWN, {
          albumId,
          orderId: oid,
        });
        try {
          await trackFunnelEvent(FUNNEL_EVENTS.ORDER_CREATED, { albumId, orderId: oid });
          await trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_START, { albumId, orderId: oid });
        } catch {
          /* seguir al pago */
        }
        await new Promise((r) => setTimeout(r, 320));
        setMpPreparingStep(2);
        await redirectToMercadoPago(data.initPoint, { startedAt: mpRedirectStartedAt });
        return;
      }
      throw new Error(data?.error || data?.mpError || "Pedido creado pero no se generó el link de pago.");
    } catch (submitErr) {
      setMpPreparing(false);
      setMpPreparingStep(1);
      const isTimeout =
        submitErr instanceof DOMException
          ? submitErr.name === "AbortError"
          : submitErr instanceof Error && submitErr.name === "AbortError";
      if (!isTimeout) {
        submitAttemptKeyRef.current = null;
      }
      const msg = isTimeout
        ? "La conexión tardó demasiado. Revisá tu internet e intentá de nuevo."
        : submitErr instanceof Error && submitErr.message
          ? submitErr.message
          : "Hubo un problema preparando tu compra. Por favor intentá nuevamente.";
      setError(msg);
      setLoading(false);
    } finally {
      window.clearTimeout(orderCreateTimeoutId);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <ProtectedAlbumWrapper enableProtection={false} albumId={Number.isFinite(Number(albumId)) ? Number(albumId) : undefined}>
      <>
        <CheckoutMpPreparingOverlay open={mpPreparing} step={mpPreparingStep} />
        {photographer ? (
          <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
        ) : null}
        <CheckoutLeakGuard active>
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
          {quoteError && !quoteLoading && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{quoteError}</p>
            </Card>
          )}

          {faceBulkSnap && faceBulkSnap.packClientTotalCents > 0 && (
            <Card className="border border-emerald-200 bg-emerald-50/90 p-4">
              <h2 className="text-base font-semibold text-emerald-950">Pack: todas las fotos donde aparecés</h2>
              <p className="mt-1 text-sm text-emerald-900">
                {faceBulkSnap.packPhotoCount}{" "}
                {faceBulkSnap.packPhotoCount === 1 ? "foto incluida" : "fotos incluidas"} en digital — precio final con
                comisión de plataforma incluida.
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-950">
                {formatARS(faceBulkSnap.packClientTotalCents)}
              </p>
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
            {items.map((item) => {
              const isDigital = (item.tipo || "digital") === "digital" || item.size === "DIGITAL";
              const { unitPrice, subtotal, includesDigitalBundle } = getCartItemQuoteTotals(item);
              const rowPhotoId = parsePhotoIdFromCheckoutFileKey(item.fileKey);
              const inFaceBulkPackRow =
                Boolean(faceBulkSnap && rowPhotoId != null && faceBulkPackIdSet.has(rowPhotoId) && isDigital);

              return (
                <Card key={item.fileKey} className="p-4">
                  <div className="flex gap-4">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#f3f4f6] flex items-center justify-center p-1">
                      <img
                        src={item.previewUrl}
                        alt="Vista previa protegida"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        className="max-w-full max-h-full object-contain select-none"
                        style={{ width: "auto", height: "auto", maxWidth: "80px", maxHeight: "80px" }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-[#1a1a1a] mb-1">Foto del pedido</h3>
                          <p className="text-sm text-[#6b7280]">
                            {isDigital ? "Digital - 1 unidad" : `${item.size} - ${item.finish === "BRILLO" ? "Brillo" : "Mate"} - ${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
                          </p>
                          {inFaceBulkPackRow && (
                            <p className="mt-2 text-sm text-emerald-800">
                              Incluida en el pack «todas las fotos donde aparecés»; el importe está en la línea del pack,
                              no se cobra de nuevo en esta foto.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {includesDigitalBundle && !isDigital ? (
                          <p className="text-sm font-medium text-[#1a1a1a]">
                            Precio (impresa + digital incluido):{" "}
                            <span className="font-semibold">{formatARS(subtotal)}</span>
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-[#6b7280]">
                              Precio unitario:{" "}
                              <span className="font-medium text-[#1a1a1a]">
                                {inFaceBulkPackRow ? formatARS(0) : formatARS(unitPrice)}
                              </span>
                              {inFaceBulkPackRow && (
                                <span className="ml-2 text-xs text-emerald-800">(incluido en el pack)</span>
                              )}
                            </p>
                            <p className="text-sm font-medium text-[#1a1a1a]">
                              Subtotal: {formatARS(subtotal)}
                            </p>
                          </>
                        )}
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
                  Mientras tanto podés seguir revisando esta pantalla o cerrar la ventana. Te avisamos por email cuando haya novedades.
                </p>
              </div>
            </Card>
          )}

          {/* Mensaje de retiro de fotos impresas */}
          {albumPricing?.pickupInfo && items.some((item) => (item.tipo ?? "digital") === "impresa") && (
            <Card className="bg-blue-50 border border-blue-200">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  📍 Retiro de fotos impresas
                </h3>
                <p className="text-sm text-blue-800">
                  La dirección y el contacto para coordinar el retiro te los enviamos por email cuando el pago esté confirmado.
                </p>
                {albumPricing.pickupInfo.name && (
                  <p className="text-sm text-blue-900 font-medium">{albumPricing.pickupInfo.name}</p>
                )}
                {(albumPricing.pickupInfo.city || albumPricing.pickupInfo.province) && (
                  <p className="text-xs text-blue-700">
                    {[albumPricing.pickupInfo.city, albumPricing.pickupInfo.province].filter(Boolean).join(" · ")}
                  </p>
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
              {client?.email ? (
                <EmailConfirmationHint
                  email=""
                  variant="album"
                  accountEmail={client.email}
                  className="mt-1"
                />
              ) : (
                <>
                  <Input
                    className="w-full"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="juan@ejemplo.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    required
                  />
                  {!buyerEmail.trim() ? (
                    <p className="text-xs text-[#6b7280] mt-1">
                      {EMAIL_EMPTY_PLACEHOLDER_COPY.album}
                    </p>
                  ) : null}
                  <EmailConfirmationHint
                    email={buyerEmail}
                    variant="album"
                    onApplySuggestion={setBuyerEmail}
                    className="mt-1"
                  />
                </>
              )}
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

          {/* Términos + CTA final */}
          <div className="space-y-4 pt-4">
            <CheckoutTermsAcceptance
              checked={termsAccepted}
              onChange={(next) => {
                setTermsAccepted(next);
                if (next) setTermsError(null);
              }}
              disabled={loading}
              error={termsError}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center">
            <Button
              variant="secondary"
              onClick={() => router.push(`/a/${albumId}/comprar`)}
              disabled={loading || mpPreparing}
            >
              ← Modificar pedido
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              className="min-h-[48px] text-lg px-8 w-full sm:w-auto"
              disabled={
                loading ||
                mpPreparing ||
                quoteLoading ||
                !quote ||
                totalDisplayArs <= 0 ||
                !termsAccepted
              }
            >
              {loading || mpPreparing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Preparando pago…
                </span>
              ) : (
                "Confirmar pedido"
              )}
            </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
      </CheckoutLeakGuard>
    {photographer ? (
      <PhotographerFooter photographer={photographer} />
    ) : null}
    </>
    </ProtectedAlbumWrapper>
  );
}
