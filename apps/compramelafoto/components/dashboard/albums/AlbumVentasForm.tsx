"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FlashToast from "@/components/ui/FlashToast";
import AlbumSaleProductCard from "@/components/dashboard/albums/AlbumSaleProductCard";
import { isDigitalPriceReadyForAlbum } from "@/lib/albums/album-sales-capability-readiness";
import {
  ALBUM_SALES_GAP_LABELS,
  ALBUM_SALES_STATUS_LABELS,
  evaluateAlbumSalesReadiness,
} from "@/lib/albums/album-sales-readiness";
import AlbumSalesStatusBadge from "@/components/dashboard/albums/AlbumSalesStatusBadge";
import type { AlbumPricingSnapshot } from "@/components/dashboard/albums/AlbumPricingSection";
import {
  computeDigitalPricePreview,
  computePrintBreakdown,
  computePrintDigitalAddon,
  formatAlbumPriceArs,
  getLabDiscountPercent,
} from "@/lib/pricing/album-sales-calculator";
import { TERMS_VERSION, TERMS_TEXT } from "@/lib/terms/photographerTerms";
import type { AlbumSalesFormState } from "@/lib/albums/album-sales-form-state";

type LabOption = { id: number; name: string; city?: string | null; province?: string | null };

type PhotographerProduct = {
  id: number;
  name: string;
  size?: string | null;
  retailPrice: number;
  isActive?: boolean;
};

type LabPricing = {
  basePrices?: Array<{ size: string; unitPrice: number }>;
  discounts?: Array<{ size: string; minQty: number; discountPercent: number }>;
};

type AlbumSalesState = AlbumSalesFormState;

export type AlbumVentasFormProps = {
  albumId: number;
  active: boolean;
  album: AlbumPricingSnapshot & {
    eventCollaborativePhotoPricing?: {
      locksPhotographerDigitalPricing?: boolean;
      fixedPhotoPrice?: number | null;
    } | null;
    enablePrintedPhotos?: boolean;
    enableDigitalPhotos?: boolean;
    albumPackPayEnabled?: boolean;
    termsAcceptedAt?: string | null;
    termsVersion?: string | null;
  };
  albumSales: AlbumSalesState | null;
  albumSalesLoading: boolean;
  onAlbumSalesChange: (next: AlbumSalesState) => void;
  organizerLocksAlbumDigitalPricing: boolean;
  minDigitalPhotoPrice: number | null;
  mpConnected: boolean | null;
  onPricingSaved: (
    patch: Partial<
      AlbumPricingSnapshot & {
        enableDigitalPhotos?: boolean;
        enablePrintedPhotos?: boolean;
        termsAcceptedAt?: string | null;
        termsVersion?: string | null;
      }
    >
  ) => void;
  onDigitalPriceInputChange?: (value: string) => void;
  onError?: (message: string | null) => void;
  canShareWithClients?: boolean;
  shareBlockReasons?: string[];
};

const AUTOSAVE_DEBOUNCE_MS = 750;

function numToInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type AutosaveUiState = "idle" | "saving" | "saved" | "error";

function AutosaveStatus({
  state,
  errorMessage,
}: {
  state: AutosaveUiState;
  errorMessage?: string | null;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return <p className="text-xs text-[#6b7280] m-0">Guardando cambios…</p>;
  }
  if (state === "saved") {
    return <p className="text-xs text-emerald-700 m-0">Cambios guardados</p>;
  }
  return (
    <p className="text-xs text-[#b91c1c] m-0" role="alert">
      {errorMessage || "No se pudieron guardar los cambios."}
    </p>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#374151]">
      <span className="shrink-0" aria-hidden>
        {ok ? "✅" : "❌"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export default function AlbumVentasForm({
  albumId,
  active,
  album,
  albumSales,
  albumSalesLoading,
  onAlbumSalesChange,
  organizerLocksAlbumDigitalPricing,
  minDigitalPhotoPrice,
  mpConnected,
  onPricingSaved,
  onDigitalPriceInputChange,
  onError,
  canShareWithClients = true,
  shareBlockReasons = [],
}: AlbumVentasFormProps) {

  const [digitalPrice, setDigitalPrice] = useState("");
  const [discount5, setDiscount5] = useState("");
  const [discount10, setDiscount10] = useState("");
  const [discount20, setDiscount20] = useState("");
  const [digitalCalculatorQty, setDigitalCalculatorQty] = useState(1);

  const [printPricingSource, setPrintPricingSource] = useState<"PHOTOGRAPHER" | "LAB_PREFERRED">(
    "PHOTOGRAPHER"
  );
  const [marginPercent, setMarginPercent] = useState("");
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [pickupBy, setPickupBy] = useState<"CLIENT" | "PHOTOGRAPHER">("CLIENT");
  const [includeDigitalWithPrint, setIncludeDigitalWithPrint] = useState(false);
  const [digitalWithPrintDiscount, setDigitalWithPrintDiscount] = useState("");
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [labSearch, setLabSearch] = useState("");
  const [showLabDropdown, setShowLabDropdown] = useState(false);

  const [calculatorProductId, setCalculatorProductId] = useState("");
  const [calculatorSize, setCalculatorSize] = useState("");
  const [calculatorQuantity, setCalculatorQuantity] = useState(1);
  const [calculatorCopyMode, setCalculatorCopyMode] = useState<"SAME_PHOTO" | "DIFFERENT_PHOTOS">(
    "SAME_PHOTO"
  );

  const [platformFeePct, setPlatformFeePct] = useState(10);
  const [photographerProducts, setPhotographerProducts] = useState<PhotographerProduct[]>([]);
  const [labPricing, setLabPricing] = useState<LabPricing | null>(null);
  const [pricingLoaded, setPricingLoaded] = useState(false);

  const [savingToggles, setSavingToggles] = useState(false);
  const [savingDigital, setSavingDigital] = useState(false);
  const [savingPrints, setSavingPrints] = useState(false);
  const [digitalAutosave, setDigitalAutosave] = useState<AutosaveUiState>("idle");
  const [printsAutosave, setPrintsAutosave] = useState<AutosaveUiState>("idle");
  const [digitalAutosaveError, setDigitalAutosaveError] = useState<string | null>(null);
  const [printsAutosaveError, setPrintsAutosaveError] = useState<string | null>(null);
  const lastSavedDigitalKeyRef = useRef<string>("");
  const lastSavedPrintsKeyRef = useRef<string>("");
  const formHydratedRef = useRef(false);
  const digitalSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printsSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const needsTermsAcceptance = useMemo(() => {
    return !album.termsAcceptedAt || album.termsVersion !== TERMS_VERSION;
  }, [album.termsAcceptedAt, album.termsVersion]);

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ message, tone });
      if (tone === "error") onError?.(message);
      else onError?.(null);
    },
    [onError]
  );

  const buildDigitalKey = useCallback(
    (fields: {
      digitalPrice: string;
      discount5: string;
      discount10: string;
      discount20: string;
    }) => JSON.stringify(fields),
    []
  );

  const buildPrintsKey = useCallback(
    (fields: {
      printPricingSource: string;
      marginPercent: string;
      selectedLabId: number | null;
      pickupBy: string;
      includeDigitalWithPrint: boolean;
      digitalWithPrintDiscount: string;
      digitalPrice: string;
    }) => JSON.stringify(fields),
    []
  );

  useEffect(() => {
    formHydratedRef.current = false;
    const digitalFields = {
      digitalPrice: numToInput(album.digitalPhotoPriceCents),
      discount5: numToInput(album.digitalDiscount5Plus),
      discount10: numToInput(album.digitalDiscount10Plus),
      discount20: numToInput(album.digitalDiscount20Plus),
    };
    setDigitalPrice(digitalFields.digitalPrice);
    setDiscount5(digitalFields.discount5);
    setDiscount10(digitalFields.discount10);
    setDiscount20(digitalFields.discount20);
    setPrintPricingSource(album.printPricingSource ?? "PHOTOGRAPHER");
    setMarginPercent(numToInput(album.albumProfitMarginPercent));
    setSelectedLabId(album.selectedLabId);
    setPickupBy(album.pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT");
    setIncludeDigitalWithPrint(Boolean(album.includeDigitalWithPrint));
    setDigitalWithPrintDiscount(numToInput(album.digitalWithPrintDiscountPercent));
    setTermsAccepted(!needsTermsAcceptance);
    setLabSearch(album.selectedLab?.name ?? "");
    lastSavedDigitalKeyRef.current = buildDigitalKey(digitalFields);
    lastSavedPrintsKeyRef.current = buildPrintsKey({
      printPricingSource: album.printPricingSource ?? "PHOTOGRAPHER",
      marginPercent: numToInput(album.albumProfitMarginPercent),
      selectedLabId: album.selectedLabId,
      pickupBy: album.pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT",
      includeDigitalWithPrint: Boolean(album.includeDigitalWithPrint),
      digitalWithPrintDiscount: numToInput(album.digitalWithPrintDiscountPercent),
      digitalPrice: digitalFields.digitalPrice,
    });
    setDigitalAutosave("idle");
    setPrintsAutosave("idle");
    setDigitalAutosaveError(null);
    setPrintsAutosaveError(null);
    formHydratedRef.current = true;
    // Solo rehidratar al cambiar de álbum (no tras cada autosave del padre).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- album snapshot al montar/cambiar albumId
  }, [albumId, buildDigitalKey, buildPrintsKey]);

  useEffect(() => {
    setTermsAccepted(!needsTermsAcceptance);
  }, [needsTermsAcceptance]);

  useEffect(
    () => () => {
      if (digitalSavedTimerRef.current) clearTimeout(digitalSavedTimerRef.current);
      if (printsSavedTimerRef.current) clearTimeout(printsSavedTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/labs", { cache: "no-store" }),
      fetch("/api/fotografo/products", { cache: "no-store" }),
      fetch("/api/config", { cache: "no-store" }),
    ])
      .then(async ([labsRes, productsRes, configRes]) => {
        if (cancelled) return;

        if (labsRes.ok) {
          const data = await labsRes.json().catch(() => []);
          setLabs(Array.isArray(data) ? data : []);
        }
        if (productsRes.ok) {
          const payload = await productsRes.json().catch(() => ({}));
          const products = Array.isArray(payload?.products) ? payload.products : [];
          const activeProducts = products.filter(
            (p: PhotographerProduct) =>
              p.isActive !== false &&
              typeof p.retailPrice === "number" &&
              p.retailPrice > 0 &&
              Boolean(p.size?.trim())
          );
          setPhotographerProducts(activeProducts);
          if (activeProducts.length > 0) {
            setCalculatorProductId(String(activeProducts[0].id));
          }
        }
        if (configRes.ok) {
          const cfg = await configRes.json().catch(() => ({}));
          const pct =
            cfg?.albumDigitalMarketplacePercent ??
            cfg?.platformCommissionPercent ??
            10;
          setPlatformFeePct(typeof pct === "number" ? pct : 10);
        }
      })
      .catch(() => {});


    return () => {
      cancelled = true;
    };
  }, [active, albumId]);

  useEffect(() => {
    if (!active || printPricingSource !== "LAB_PREFERRED" || selectedLabId == null) {
      setLabPricing(null);
      setPricingLoaded(printPricingSource === "PHOTOGRAPHER");
      return;
    }
    let cancelled = false;
    setPricingLoaded(false);
    fetch(`/api/lab/pricing?labId=${selectedLabId}&isPhotographer=true`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setLabPricing(data);
        if (data?.basePrices?.length) {
          setCalculatorSize(data.basePrices[0].size);
        }
        setPricingLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLabPricing(null);
          setPricingLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, printPricingSource, selectedLabId]);

  const sellDigital = useMemo(() => {
    if (album.enableDigitalPhotos === false) return false;
    if (!albumSales) return Boolean(album.enableDigitalPhotos);
    if (albumSales.inheritFromPhotographer) {
      return !albumSales.disabledCapabilities.includes("DIGITAL_SALES");
    }
    return albumSales.allowedCapabilities.includes("DIGITAL_SALES");
  }, [albumSales, album.enableDigitalPhotos]);

  const sellPrints = useMemo(() => {
    if (album.enablePrintedPhotos === false) return false;
    if (!albumSales) return Boolean(album.enablePrintedPhotos);
    if (albumSales.inheritFromPhotographer) {
      return !albumSales.disabledCapabilities.includes("PRINT_SALES");
    }
    return albumSales.allowedCapabilities.includes("PRINT_SALES");
  }, [albumSales, album.enablePrintedPhotos]);

  const hasActivePrintProducts = photographerProducts.length > 0;

  const digitalPriceReady = isDigitalPriceReadyForAlbum(
    {
      digitalPhotoPriceCents: album.digitalPhotoPriceCents,
      eventCollaborativePhotoPricing: album.eventCollaborativePhotoPricing,
    },
    digitalPrice
  ).ready;

  /** Precio digital configurado (para bundle con impresión, sin exigir venta digital suelta). */
  const bundleDigitalPriceReady = digitalPriceReady;

  const printsConfigured = useMemo(() => {
    const marginOk =
      album.albumProfitMarginPercent != null && Number.isFinite(album.albumProfitMarginPercent);
    if (!marginOk) return false;
    if (album.printPricingSource === "LAB_PREFERRED") {
      return album.selectedLabId != null;
    }
    return hasActivePrintProducts;
  }, [album, hasActivePrintProducts]);

  const digitalPriceCalc = useMemo(
    () =>
      computeDigitalPricePreview({
        priceInput: digitalPrice,
        quantity: digitalCalculatorQty,
        minPrice: minDigitalPhotoPrice ?? 5000,
        platformFeePct,
        discounts: { d5: discount5, d10: discount10, d20: discount20 },
      }),
    [digitalPrice, digitalCalculatorQty, minDigitalPhotoPrice, platformFeePct, discount5, discount10, discount20]
  );

  const printBreakdown = useMemo(() => {
    const marginPct =
      marginPercent && !isNaN(parseFloat(marginPercent)) ? parseFloat(marginPercent) : 0;
    const qty = Math.max(1, calculatorQuantity);

    if (printPricingSource === "PHOTOGRAPHER") {
      const product = photographerProducts.find((p) => String(p.id) === calculatorProductId);
      const base = product?.retailPrice ?? 0;
      if (base <= 0) return null;
      return computePrintBreakdown({
        baseUnitPrice: base,
        albumMarginPercent: marginPct,
        platformFeePercent: platformFeePct,
        quantity: qty,
      });
    }

    if (printPricingSource === "LAB_PREFERRED" && pricingLoaded && labPricing && calculatorSize) {
      const bp = labPricing.basePrices?.find((p) => p.size === calculatorSize);
      const basePrice = bp?.unitPrice ?? 0;
      if (basePrice <= 0) return null;
      const discountPercent = getLabDiscountPercent(
        labPricing.discounts,
        calculatorSize,
        calculatorQuantity
      );
      const baseAfterDiscount = Math.round(basePrice * (1 - discountPercent / 100));
      return computePrintBreakdown({
        baseUnitPrice: baseAfterDiscount,
        albumMarginPercent: marginPct,
        platformFeePercent: platformFeePct,
        quantity: qty,
      });
    }
    return null;
  }, [
    printPricingSource,
    photographerProducts,
    calculatorProductId,
    calculatorSize,
    calculatorQuantity,
    labPricing,
    pricingLoaded,
    marginPercent,
    platformFeePct,
  ]);

  const printDigitalAddon = useMemo(
    () =>
      computePrintDigitalAddon({
        includeDigitalWithPrint,
        digitalPriceInput: digitalPrice,
        digitalWithPrintDiscountInput: digitalWithPrintDiscount,
        copyMode: calculatorCopyMode,
        quantity: calculatorQuantity,
        platformFeePct,
      }),
    [
      includeDigitalWithPrint,
      digitalPrice,
      digitalWithPrintDiscount,
      calculatorCopyMode,
      calculatorQuantity,
      platformFeePct,
    ]
  );

  async function ensureTermsIfNeeded(options?: { silent?: boolean }): Promise<boolean> {
    if (!needsTermsAcceptance) return true;
    if (!termsAccepted) {
      if (!options?.silent) {
        showToast("Aceptá los Términos y Condiciones para habilitar ventas.", "error");
      }
      return false;
    }
    const res = await fetch(`/api/dashboard/albums/${albumId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termsAccepted: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "No se pudieron guardar los términos", "error");
      return false;
    }
    onPricingSaved({
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
    });
    return true;
  }

  async function persistProductToggles(next: { digital?: boolean; prints?: boolean }) {
    if (!albumSales) return;
    const digitalOn = next.digital ?? sellDigital;
    const printsOn = next.prints ?? sellPrints;

    if ((digitalOn || printsOn) && !(await ensureTermsIfNeeded())) return;

    if (printsOn && !hasActivePrintProducts && printPricingSource === "PHOTOGRAPHER") {
      showToast(
        "Para habilitar impresiones, primero cargá productos en Configuración → Productos.",
        "error"
      );
      return;
    }

    setSavingToggles(true);
    onError?.(null);
    try {
      const disabled = [
        ...(digitalOn ? [] : ["DIGITAL_SALES"]),
        ...(printsOn ? [] : ["PRINT_SALES"]),
      ];
      const res = await fetch(`/api/dashboard/albums/${albumId}/sales-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inheritFromPhotographer: true,
          allowedCapabilities: albumSales.allowedCapabilities,
          disabledCapabilities: disabled,
          enableDigitalPhotos: digitalOn,
          enablePrintedPhotos: printsOn,
          enableFaceBulkPurchase: albumSales.enableFaceBulkPurchase,
          faceBulkPriceCents:
            albumSales.faceBulkPriceInput.trim() === ""
              ? null
              : Math.round(parseFloat(albumSales.faceBulkPriceInput.replace(",", "."))),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar");
      }
      onAlbumSalesChange({
        ...albumSales,
        inheritFromPhotographer: true,
        disabledCapabilities: disabled,
      });
      onPricingSaved({
        enableDigitalPhotos: digitalOn,
        enablePrintedPhotos: printsOn,
      });
      showToast(digitalOn || printsOn ? "Productos actualizados." : "Ventas desactivadas.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "No se pudo actualizar qué vendés", "error");
    } finally {
      setSavingToggles(false);
    }
  }

  const flashDigitalSaved = useCallback(() => {
    setDigitalAutosave("saved");
    if (digitalSavedTimerRef.current) clearTimeout(digitalSavedTimerRef.current);
    digitalSavedTimerRef.current = setTimeout(() => setDigitalAutosave("idle"), 2200);
  }, []);

  const flashPrintsSaved = useCallback(() => {
    setPrintsAutosave("saved");
    if (printsSavedTimerRef.current) clearTimeout(printsSavedTimerRef.current);
    printsSavedTimerRef.current = setTimeout(() => setPrintsAutosave("idle"), 2200);
  }, []);

  const saveDigital = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (organizerLocksAlbumDigitalPricing) return false;
      if (!(await ensureTermsIfNeeded(options))) return false;

      const trimmed = digitalPrice.trim().replace(",", ".");
      let parsed: number | null = null;
      if (trimmed) {
        parsed = Math.round(parseFloat(trimmed));
        if (!Number.isFinite(parsed) || parsed <= 0) {
          if (!options?.silent) {
            showToast("Ingresá un precio válido.", "error");
          }
          return false;
        }
        const min = minDigitalPhotoPrice ?? 5000;
        if (parsed < min) {
          if (!options?.silent) {
            showToast(`El precio mínimo es $${min.toLocaleString("es-AR")}.`, "error");
          }
          return false;
        }
      } else if (!options?.silent) {
        return false;
      } else {
        return false;
      }

      setSavingDigital(true);
      setDigitalAutosave("saving");
      setDigitalAutosaveError(null);
      onError?.(null);
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            digitalPhotoPriceCents: parsed,
            digitalDiscount5Plus: discount5.trim() === "" ? null : parseFloat(discount5),
            digitalDiscount10Plus: discount10.trim() === "" ? null : parseFloat(discount10),
            digitalDiscount20Plus: discount20.trim() === "" ? null : parseFloat(discount20),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar");
        }
        onPricingSaved({
          digitalPhotoPriceCents: data.digitalPhotoPriceCents ?? parsed,
          digitalDiscount5Plus: data.digitalDiscount5Plus ?? null,
          digitalDiscount10Plus: data.digitalDiscount10Plus ?? null,
          digitalDiscount20Plus: data.digitalDiscount20Plus ?? null,
        });
        lastSavedDigitalKeyRef.current = buildDigitalKey({
          digitalPrice,
          discount5,
          discount10,
          discount20,
        });
        flashDigitalSaved();
        if (!options?.silent) showToast("Precio digital guardado.");
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "No se pudo guardar el precio digital";
        setDigitalAutosave("error");
        setDigitalAutosaveError(msg);
        if (!options?.silent) showToast(msg, "error");
        return false;
      } finally {
        setSavingDigital(false);
      }
    },
    [
      organizerLocksAlbumDigitalPricing,
      digitalPrice,
      discount5,
      discount10,
      discount20,
      minDigitalPhotoPrice,
      albumId,
      onPricingSaved,
      onError,
      buildDigitalKey,
      flashDigitalSaved,
      showToast,
    ]
  );

  const savePrints = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (!(await ensureTermsIfNeeded(options))) return false;

      let bundleDigitalPriceCents: number | null = null;
      if (includeDigitalWithPrint && !sellDigital) {
        if (organizerLocksAlbumDigitalPricing) {
          bundleDigitalPriceCents = album.digitalPhotoPriceCents ?? null;
        } else {
          const trimmed = digitalPrice.trim().replace(",", ".");
          if (!trimmed) {
            if (!options?.silent) {
              showToast("Configurá el precio del archivo digital incluido con la impresión.", "error");
            }
            return false;
          }
          const parsed = Math.round(parseFloat(trimmed));
          const min = minDigitalPhotoPrice ?? 5000;
          if (!Number.isFinite(parsed) || parsed < min) {
            if (!options?.silent) {
              showToast(`El precio digital debe ser al menos $${min.toLocaleString("es-AR")}.`, "error");
            }
            return false;
          }
          bundleDigitalPriceCents = parsed;
        }
      }
      if (printPricingSource === "LAB_PREFERRED" && selectedLabId == null) {
        if (!options?.silent) showToast("Elegí un laboratorio.", "error");
        return false;
      }
      const marginRaw = marginPercent.trim().replace(",", ".");
      if (marginRaw === "") {
        if (!options?.silent) return false;
        return false;
      }
      const margin = parseFloat(marginRaw);
      if (!Number.isFinite(margin) || margin < 0) {
        if (!options?.silent) showToast("El margen debe ser 0 o mayor.", "error");
        return false;
      }

      setSavingPrints(true);
      setPrintsAutosave("saving");
      setPrintsAutosaveError(null);
      onError?.(null);
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printPricingSource,
            albumProfitMarginPercent: margin,
            selectedLabId: printPricingSource === "LAB_PREFERRED" ? selectedLabId : null,
            pickupBy: printPricingSource === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : pickupBy,
            includeDigitalWithPrint,
            digitalWithPrintDiscountPercent:
              digitalWithPrintDiscount.trim() === ""
                ? 0
                : parseFloat(digitalWithPrintDiscount),
            ...(bundleDigitalPriceCents != null && !organizerLocksAlbumDigitalPricing
              ? { digitalPhotoPriceCents: bundleDigitalPriceCents }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar");
        }
        const savedLab = labs.find((l) => l.id === (data.selectedLabId ?? selectedLabId));
        onPricingSaved({
          printPricingSource: data.printPricingSource ?? printPricingSource,
          albumProfitMarginPercent: data.albumProfitMarginPercent ?? margin,
          selectedLabId: data.selectedLabId ?? null,
          pickupBy: data.pickupBy ?? pickupBy,
          includeDigitalWithPrint: data.includeDigitalWithPrint ?? includeDigitalWithPrint,
          digitalWithPrintDiscountPercent: data.digitalWithPrintDiscountPercent ?? null,
          ...(bundleDigitalPriceCents != null
            ? { digitalPhotoPriceCents: data.digitalPhotoPriceCents ?? bundleDigitalPriceCents }
            : {}),
          selectedLab: savedLab
            ? { id: savedLab.id, name: savedLab.name, city: savedLab.city, province: savedLab.province }
            : null,
        });
        lastSavedPrintsKeyRef.current = buildPrintsKey({
          printPricingSource,
          marginPercent,
          selectedLabId,
          pickupBy,
          includeDigitalWithPrint,
          digitalWithPrintDiscount,
          digitalPrice: includeDigitalWithPrint && !sellDigital ? digitalPrice : "",
        });
        flashPrintsSaved();
        if (!options?.silent) showToast("Configuración de impresiones guardada.");
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "No se pudo guardar impresiones";
        setPrintsAutosave("error");
        setPrintsAutosaveError(msg);
        if (!options?.silent) showToast(msg, "error");
        return false;
      } finally {
        setSavingPrints(false);
      }
    },
    [
      includeDigitalWithPrint,
      sellDigital,
      organizerLocksAlbumDigitalPricing,
      album.digitalPhotoPriceCents,
      digitalPrice,
      minDigitalPhotoPrice,
      printPricingSource,
      selectedLabId,
      marginPercent,
      pickupBy,
      digitalWithPrintDiscount,
      albumId,
      labs,
      onPricingSaved,
      onError,
      buildPrintsKey,
      flashPrintsSaved,
      showToast,
    ]
  );

  const debouncedDigitalKey = useDebounced(
    buildDigitalKey({ digitalPrice, discount5, discount10, discount20 }),
    AUTOSAVE_DEBOUNCE_MS
  );

  const printsAutosaveDigitalPrice =
    includeDigitalWithPrint && !sellDigital ? digitalPrice : "";

  const debouncedPrintsKey = useDebounced(
    buildPrintsKey({
      printPricingSource,
      marginPercent,
      selectedLabId,
      pickupBy,
      includeDigitalWithPrint,
      digitalWithPrintDiscount,
      digitalPrice: printsAutosaveDigitalPrice,
    }),
    AUTOSAVE_DEBOUNCE_MS
  );

  useEffect(() => {
    if (!active || !formHydratedRef.current || !sellDigital || organizerLocksAlbumDigitalPricing) {
      return;
    }
    if (debouncedDigitalKey === lastSavedDigitalKeyRef.current) return;
    void saveDigital({ silent: true });
  }, [
    debouncedDigitalKey,
    active,
    sellDigital,
    organizerLocksAlbumDigitalPricing,
    saveDigital,
  ]);

  useEffect(() => {
    if (!active || !formHydratedRef.current || !sellPrints) return;
    if (debouncedPrintsKey === lastSavedPrintsKeyRef.current) return;
    void savePrints({ silent: true });
  }, [debouncedPrintsKey, active, sellPrints, savePrints]);

  function searchLabs(search: string) {
    const url =
      search.trim().length >= 3
        ? `/api/labs?search=${encodeURIComponent(search.trim())}`
        : "/api/labs";
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLabs(Array.isArray(data) ? data : []))
      .catch(() => setLabs([]));
  }

  if (albumSalesLoading || !albumSales) {
    return <p className="w-full py-6 text-sm text-[#6b7280]">Cargando venta del álbum…</p>;
  }

  const salesReadiness = evaluateAlbumSalesReadiness({
    enableDigitalPhotos: sellDigital,
    enablePrintedPhotos: sellPrints,
    digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    albumProfitMarginPercent: album.albumProfitMarginPercent,
    selectedLabId: album.selectedLabId,
    pickupBy: album.pickupBy,
    printPricingSource: album.printPricingSource,
    termsAcceptedAt: album.termsAcceptedAt,
    termsVersion: album.termsVersion,
    eventCollaborativePhotoPricing: album.eventCollaborativePhotoPricing,
    hasActivePrintProducts,
  });

  const statusIncomplete = mpConnected !== true || !salesReadiness.readyToSell;

  return (
    <div className="ds-stack-section w-full min-w-0 gap-6">
      {toast ? (
        <FlashToast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
        <div className="ds-form-stack w-full max-w-[60rem] gap-3">
          <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">
            ¿Qué querés vender en este álbum?
          </h2>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
            Configurá venta digital e impresiones sueltas. Los packs de galería (incluidos «Todas mis
            fotos» y «Todas las fotos»), preventa y extras se administran en sus solapas.
          </p>
        </div>
      </Card>

      {needsTermsAcceptance ? (
        <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[#c27b3d]"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span className="text-sm text-[#374151]">
              Leí y acepto los{" "}
              <button
                type="button"
                className="text-[#c27b3d] underline font-medium"
                onClick={() => setShowTermsModal(true)}
              >
                Términos y Condiciones para fotógrafos
              </button>{" "}
              para habilitar ventas en este álbum.
            </span>
          </label>
        </Card>
      ) : null}

      <div className="ds-stack-section w-full min-w-0 gap-4">
        <AlbumSaleProductCard
          id="album-ventas-digitales"
          active={sellDigital}
          disabled={savingToggles}
          onToggle={(next) => void persistProductToggles({ digital: next })}
          title="Fotos digitales"
          description="El cliente compra y descarga archivos digitales desde la galería."
        >
          {organizerLocksAlbumDigitalPricing ? (
            <p className="ds-readable-text text-sm text-[#374151] m-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              El organizador del evento define el precio digital en este álbum.
            </p>
          ) : (
            <div className="ds-form-stack w-full gap-4">
              <div className="w-full min-w-0 space-y-2">
                <label className="block text-sm font-medium text-[#1a1a1a]">
                  Precio por foto digital (ARS)
                </label>
                <Input
                  type="number"
                  min={minDigitalPhotoPrice ?? 0}
                  step="1"
                  value={digitalPrice}
                  onChange={(e) => {
                    setDigitalPrice(e.target.value);
                    onDigitalPriceInputChange?.(e.target.value);
                  }}
                  className="w-full"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Descuento 5+ fotos (%)", value: discount5, set: setDiscount5 },
                  { label: "Descuento 10+ fotos (%)", value: discount10, set: setDiscount10 },
                  { label: "Descuento 20+ fotos (%)", value: discount20, set: setDiscount20 },
                ].map((field) => (
                  <div key={field.label} className="space-y-2">
                    <label className="block text-sm font-medium text-[#374151]">{field.label}</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {digitalPrice && !isNaN(parseFloat(digitalPrice)) ? (
                <div className="rounded-xl border border-[#bfdbfe] bg-[#f0f9ff] p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-[#1a1a1a] m-0">
                    Vista previa — precio para el cliente
                  </h4>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#6b7280]">Cantidad de fotos</label>
                      <Input
                        type="number"
                        min="1"
                        value={digitalCalculatorQty}
                        onChange={(e) =>
                          setDigitalCalculatorQty(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="max-w-[120px]"
                      />
                    </div>
                  </div>
                  {digitalPriceCalc ? (
                    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 space-y-2 text-sm">
                      {!digitalPriceCalc.isValid ? (
                        <p className="text-amber-700 m-0">
                          El precio debe ser al menos {formatAlbumPriceArs(digitalPriceCalc.minPrice)}.
                        </p>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span className="text-[#6b7280]">Tu precio por foto</span>
                        <span>{formatAlbumPriceArs(digitalPriceCalc.price)}</span>
                      </div>
                      {digitalPriceCalc.discountPercent > 0 ? (
                        <div className="flex justify-between gap-4 text-emerald-700">
                          <span>Descuento ({digitalPriceCalc.discountPercent}%)</span>
                          <span>-{formatAlbumPriceArs(digitalPriceCalc.totalSavings)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span className="text-[#6b7280]">
                          Fee plataforma ({digitalPriceCalc.platformFeePct}%)
                        </span>
                        <span>{formatAlbumPriceArs(digitalPriceCalc.feePerUnit)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-semibold border-t border-[#e5e7eb] pt-2">
                        <span>Precio final por foto</span>
                        <span className="text-[#c27b3d]">
                          {formatAlbumPriceArs(digitalPriceCalc.priceAfterDiscountWithFee)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-semibold">
                        <span>Total ({digitalPriceCalc.quantity} fotos)</span>
                        <span>{formatAlbumPriceArs(digitalPriceCalc.totalForQuantity)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <AutosaveStatus state={digitalAutosave} errorMessage={digitalAutosaveError} />
            </div>
          )}
        </AlbumSaleProductCard>

        <AlbumSaleProductCard
          id="album-ventas-impresiones"
          active={sellPrints}
          disabled={savingToggles}
          onToggle={(next) => void persistProductToggles({ prints: next })}
          title="Impresiones"
          description="El cliente puede pedir copias impresas con los tamaños que configures."
        >
          <div className="ds-form-stack w-full gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#1a1a1a] m-0">Origen de precios</p>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                <input
                  type="radio"
                  name="print-source"
                  checked={printPricingSource === "PHOTOGRAPHER"}
                  onChange={() => setPrintPricingSource("PHOTOGRAPHER")}
                />
                <span className="text-sm">Mi lista de productos</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                <input
                  type="radio"
                  name="print-source"
                  checked={printPricingSource === "LAB_PREFERRED"}
                  onChange={() => setPrintPricingSource("LAB_PREFERRED")}
                />
                <span className="text-sm">Laboratorio</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#1a1a1a]">
                Margen de ganancia (%)
              </label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 0"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="w-full"
              />
            </div>

            {printPricingSource === "LAB_PREFERRED" ? (
              <>
                <div className="relative space-y-2">
                  <label className="block text-sm font-medium text-[#1a1a1a]">Laboratorio</label>
                  <Input
                    type="text"
                    placeholder="Buscar por nombre, ciudad…"
                    value={labSearch}
                    onChange={(e) => {
                      setLabSearch(e.target.value);
                      searchLabs(e.target.value);
                    }}
                    onFocus={() => {
                      setShowLabDropdown(true);
                      if (!labSearch.trim()) searchLabs("");
                    }}
                    onBlur={() => setTimeout(() => setShowLabDropdown(false), 150)}
                  />
                  {showLabDropdown && labs.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-[#e5e7eb] bg-white shadow-lg">
                      {labs.map((lab) => (
                        <button
                          key={lab.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f9fafb]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedLabId(lab.id);
                            setLabSearch(lab.name);
                            setShowLabDropdown(false);
                          }}
                        >
                          {lab.name}
                          {lab.city ? ` — ${lab.city}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#1a1a1a] m-0">Retiro / entrega</p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                    <input
                      type="radio"
                      name="pickup"
                      checked={pickupBy === "CLIENT"}
                      onChange={() => setPickupBy("CLIENT")}
                    />
                    <span className="text-sm">El cliente retira en el laboratorio</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                    <input
                      type="radio"
                      name="pickup"
                      checked={pickupBy === "PHOTOGRAPHER"}
                      onChange={() => setPickupBy("PHOTOGRAPHER")}
                    />
                    <span className="text-sm">Yo entrego las fotos</span>
                  </label>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#6b7280] m-0">
                Las impresiones se realizan a cargo del fotógrafo con tu lista de productos.
              </p>
            )}

            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#c27b3d]"
                  checked={includeDigitalWithPrint}
                  disabled={savingPrints || organizerLocksAlbumDigitalPricing}
                  onChange={(e) => setIncludeDigitalWithPrint(e.target.checked)}
                />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-medium text-[#1a1a1a]">
                    Incluir archivo digital con la impresión
                  </span>
                  <span className="block text-xs text-[#6b7280]">
                    Al comprar una copia impresa, el cliente también recibe el archivo digital por email.
                    No hace falta vender fotos digitales sueltas: usamos el precio digital configurado acá
                    (o en la card de digitales, si también la tenés activa).
                  </span>
                </span>
              </label>
              {includeDigitalWithPrint ? (
                <div className="space-y-3 pl-7">
                  {!sellDigital && !organizerLocksAlbumDigitalPricing ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[#374151]">
                        Precio del archivo digital incluido (ARS)
                      </label>
                      <Input
                        type="number"
                        min={minDigitalPhotoPrice ?? 0}
                        step="1"
                        value={digitalPrice}
                        onChange={(e) => {
                          setDigitalPrice(e.target.value);
                          onDigitalPriceInputChange?.(e.target.value);
                        }}
                        className="max-w-[200px]"
                      />
                      <p className="text-xs text-[#6b7280] m-0">
                        Solo se usa para calcular el digital que acompaña cada impresión. La venta digital
                        suelta puede seguir desactivada.
                      </p>
                    </div>
                  ) : sellDigital && bundleDigitalPriceReady ? (
                    <p className="text-xs text-[#6b7280] m-0">
                      Precio digital de referencia:{" "}
                      <strong>
                        {formatAlbumPriceArs(
                          album.digitalPhotoPriceCents ??
                            (digitalPrice && !isNaN(parseFloat(digitalPrice))
                              ? Math.round(parseFloat(digitalPrice))
                              : 0)
                        )}
                      </strong>{" "}
                      (configurado en Fotos digitales).
                    </p>
                  ) : !organizerLocksAlbumDigitalPricing ? (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0">
                      Indicá el precio del archivo digital incluido antes de guardar.
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#374151]">
                      % de descuento sobre el precio digital incluido
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={digitalWithPrintDiscount}
                        onChange={(e) => setDigitalWithPrintDiscount(e.target.value)}
                        className="max-w-[140px]"
                      />
                      <span className="text-xs text-[#6b7280]">0 a 100</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {(printPricingSource === "PHOTOGRAPHER" && photographerProducts.length > 0) ||
            (printPricingSource === "LAB_PREFERRED" &&
              labPricing?.basePrices &&
              labPricing.basePrices.length > 0) ? (
              <div className="rounded-xl border border-[#bfdbfe] bg-[#f0f9ff] p-4 space-y-3">
                <h4 className="text-sm font-semibold text-[#1a1a1a] m-0">
                  Simulador de impresiones
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {printPricingSource === "PHOTOGRAPHER" ? (
                    <div className="space-y-1">
                      <label className="block text-xs text-[#6b7280]">Producto</label>
                      <Select
                        value={calculatorProductId}
                        onChange={(e) => setCalculatorProductId(e.target.value)}
                      >
                        {photographerProducts.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} {p.size ? `(${p.size})` : ""}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-xs text-[#6b7280]">Tamaño</label>
                      <Select
                        value={calculatorSize}
                        onChange={(e) => setCalculatorSize(e.target.value)}
                      >
                        {labPricing?.basePrices?.map((bp) => (
                          <option key={bp.size} value={bp.size}>
                            {bp.size} cm
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-xs text-[#6b7280]">Cantidad</label>
                    <Input
                      type="number"
                      min="1"
                      value={calculatorQuantity}
                      onChange={(e) => setCalculatorQuantity(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#6b7280]">Tipo de copias</label>
                    <Select
                      value={calculatorCopyMode}
                      onChange={(e) =>
                        setCalculatorCopyMode(e.target.value as "SAME_PHOTO" | "DIFFERENT_PHOTOS")
                      }
                    >
                      <option value="SAME_PHOTO">Misma foto</option>
                      <option value="DIFFERENT_PHOTOS">Fotos distintas</option>
                    </Select>
                  </div>
                </div>
                {printBreakdown ? (
                  <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#6b7280]">Precio base</span>
                      <span>{formatAlbumPriceArs(printBreakdown.baseUnitPrice)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#6b7280]">Con margen ({printBreakdown.albumMarginPercent}%)</span>
                      <span>{formatAlbumPriceArs(printBreakdown.priceAfterAlbumMargin)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#6b7280]">Fee plataforma</span>
                      <span>{formatAlbumPriceArs(printBreakdown.platformFeeAmountPerUnit)}</span>
                    </div>
                    <div className="flex justify-between gap-4 font-semibold border-t border-[#e5e7eb] pt-2">
                      <span>Precio final por unidad</span>
                      <span className="text-[#c27b3d]">
                        {formatAlbumPriceArs(printBreakdown.finalUnitPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 font-semibold">
                      <span>Total cliente ({printBreakdown.quantity} u.)</span>
                      <span>{formatAlbumPriceArs(printBreakdown.subtotal)}</span>
                    </div>
                    {printDigitalAddon.active ? (
                      <div className="border-t border-[#e5e7eb] pt-2 space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-[#6b7280]">Digital incluido</span>
                          <span>{formatAlbumPriceArs(printDigitalAddon.total)}</span>
                        </div>
                        <div className="flex justify-between gap-4 font-semibold">
                          <span>Total con digital</span>
                          <span>
                            {formatAlbumPriceArs(printBreakdown.subtotal + printDigitalAddon.total)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <AutosaveStatus state={printsAutosave} errorMessage={printsAutosaveError} />
              <Link
                href="/fotografo/configuracion?tab=productos"
                prefetch={false}
                className="text-sm text-[#6b7280] hover:text-[#c27b3d] hover:underline w-fit"
              >
                Editar productos impresos
              </Link>
            </div>
          </div>
        </AlbumSaleProductCard>
      </div>

      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6 border border-[#e5e7eb] bg-[#fafafa]">
        <div className="ds-form-stack w-full max-w-[60rem] gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Estado de ventas</h2>
            <AlbumSalesStatusBadge
              album={{
                enableDigitalPhotos: sellDigital,
                enablePrintedPhotos: sellPrints,
                digitalPhotoPriceCents: album.digitalPhotoPriceCents,
                albumProfitMarginPercent: album.albumProfitMarginPercent,
                selectedLabId: album.selectedLabId,
                pickupBy: album.pickupBy,
                printPricingSource: album.printPricingSource,
                termsAcceptedAt: album.termsAcceptedAt,
                termsVersion: album.termsVersion,
                eventCollaborativePhotoPricing: album.eventCollaborativePhotoPricing,
                hasActivePrintProducts,
              }}
            />
          </div>
          {!canShareWithClients && shareBlockReasons.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="ds-readable-text text-sm font-medium text-amber-950 m-0">
                No podés compartir este álbum con clientes hasta resolver:
              </p>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm text-amber-900">
                {shareBlockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : !salesReadiness.readyToSell ? (
            <div className="space-y-2">
              <p className="ds-readable-text text-sm font-medium text-[#374151] m-0">
                Para habilitar ventas falta:
              </p>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm text-[#4b5563]">
                {salesReadiness.gaps.map((gap) => (
                  <li key={gap}>{ALBUM_SALES_GAP_LABELS[gap]}</li>
                ))}
                {mpConnected !== true ? <li>Conectar Mercado Pago</li> : null}
              </ul>
            </div>
          ) : null}
          <ul className="m-0 list-none space-y-2 p-0">
            <StatusRow ok={mpConnected === true} label="Mercado Pago conectado" />
            {sellDigital ? (
              <StatusRow ok={digitalPriceReady} label="Precio digital configurado" />
            ) : null}
            {sellPrints ? (
              <StatusRow ok={printsConfigured} label="Impresiones configuradas" />
            ) : null}
            <StatusRow ok={salesReadiness.termsOk} label="Términos aceptados" />
          </ul>
          {statusIncomplete ? (
            <p className="ds-readable-text text-sm text-[#6b7280] m-0">
              {salesReadiness.status === "pending"
                ? "Activá al menos un producto para empezar a vender."
                : "Para comenzar a vender necesitás completar los elementos marcados."}
            </p>
          ) : (
            <p className="ds-readable-text text-sm text-emerald-800 m-0">
              {ALBUM_SALES_STATUS_LABELS.active}: este álbum puede recibir compras en la galería.
            </p>
          )}
        </div>
      </Card>

      {showTermsModal ? (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[90]"
            onClick={() => setShowTermsModal(false)}
          />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center border-b border-[#e5e7eb] pb-3 mb-3">
                <h3 className="text-lg font-semibold m-0">Términos y Condiciones</h3>
                <button type="button" onClick={() => setShowTermsModal(false)} className="text-[#6b7280]">
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto text-sm whitespace-pre-line text-[#374151]">
                {TERMS_TEXT}
              </div>
              <div className="pt-3 border-t border-[#e5e7eb] mt-3">
                <Button type="button" variant="primary" onClick={() => setShowTermsModal(false)}>
                  Cerrar
                </Button>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
