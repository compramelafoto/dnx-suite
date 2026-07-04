"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UploadZone from "@/components/photo/UploadZone";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import OrderItem from "@/components/order/OrderItem";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import { isCarnetOrPolaroidProduct } from "@/lib/print-products";
import { DEFAULT_PUBLIC_PHOTOGRAPHER_ID } from "@/lib/public-flow-config";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type UploadedFile = {
  fileKey: string;
  url: string;
  originalName: string;
};

type Finish = "BRILLO" | "MATE";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: Finish;
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

type Lab = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  hasWholesalePricing: boolean;
};

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

// Función para obtener precio base por tamaño
function getBasePrice(size: string, pricing: LabPricing): number {
  const basePrice = pricing.basePrices.find((p) => p.size === size);
  return basePrice?.unitPrice ?? 0;
}

// Función para obtener descuento por tamaño y cantidad total
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

// Función para calcular precio unitario final
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

const ACCENT_COLOR = "#c27b3d";

export default function PublicImprimirPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUploadZone, setShowUploadZone] = useState(true);

  // Búsqueda de laboratorios
  const [labSearch, setLabSearch] = useState("");
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [labsLoading, setLabsLoading] = useState(false);
  const [showLabDropdown, setShowLabDropdown] = useState(false);

  // Precios del laboratorio seleccionado
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [labProducts, setLabProducts] = useState<LabProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);

  // Configuración masiva
  const [bulkSize, setBulkSize] = useState("10x15");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkProductId, setBulkProductId] = useState<number | null>(null);
  const [bulkProductName, setBulkProductName] = useState<string | null>(null);

  // Calcular cantidad total por tamaño
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
    }
    return map;
  }, [items]);

  // Calcular máximos descuentos para el tip
  const maxDiscounts = useMemo(() => {
    if (!pricingLoaded || labPricing.discounts.length === 0) {
      return { d50: 0, d100: 0 };
    }

    let maxD50 = 0;
    let maxD100 = 0;

    for (const d of labPricing.discounts) {
      if (d.minQty === 50 && d.discountPercent > maxD50) {
        maxD50 = d.discountPercent;
      }
      if (d.minQty === 100 && d.discountPercent > maxD100) {
        maxD100 = d.discountPercent;
      }
    }

    return { d50: Math.round(maxD50), d100: Math.round(maxD100) };
  }, [labPricing, pricingLoaded]);

  // Calcular totales
  const totals = useMemo(() => {
    if (!pricingLoaded || labPricing.basePrices.length === 0) {
      return { totalBase: 0, totalFinal: 0, totalDiscount: 0 };
    }

    let totalBase = 0;
    let totalFinal = 0;

    for (const item of items) {
      const product = findProductForItem(item, labProducts);
      const basePrice = product?.retailPrice ?? getBasePrice(item.size, labPricing);
      const platformFeePctLab = labPricing.platformCommissionPercent ?? 0;
      const finalUnitPrice = totalFromBase(Math.round(basePrice), platformFeePctLab);

      totalBase += basePrice * item.quantity;
      totalFinal += finalUnitPrice * item.quantity;
    }

    return {
      totalBase,
      totalFinal,
      totalDiscount: totalBase - totalFinal,
    };
  }, [items, qtyBySize, labPricing, pricingLoaded]);

  // Buscar laboratorios por cualquier valor
  useEffect(() => {
    async function searchLabs() {
      if (!labSearch.trim()) {
        setLabs([]);
        return;
      }

      setLabsLoading(true);
      try {
        const res = await fetch(`/api/public/labs?search=${encodeURIComponent(labSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setLabs(data);
        }
      } catch (err) {
        console.error("Error buscando laboratorios:", err);
      } finally {
        setLabsLoading(false);
      }
    }

    const timeoutId = setTimeout(searchLabs, 300);
    return () => clearTimeout(timeoutId);
  }, [labSearch]);

  // Cargar precios del fotógrafo asignado al flujo público (ID 79)
  useEffect(() => {
    async function loadPricing() {
      setPricingLoading(true);
      try {
        const res = await fetch(`/api/public/lab-pricing?photographerId=${DEFAULT_PUBLIC_PHOTOGRAPHER_ID}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Error cargando precios");
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
        setLabProducts(products);
        setProductsLoaded(true);
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios:", e);
        setError("No se pudieron cargar los precios del fotógrafo. Por favor intentá nuevamente.");
        setPricingLoaded(false);
      } finally {
        setPricingLoading(false);
      }
    }
    loadPricing();
  }, []);

  useEffect(() => {
    if (!pricingLoaded) return;
    if (labProducts.length === 0) {
      setProductsLoaded(true);
    }
  }, [pricingLoaded, labProducts.length]);

  // Seleccionar por defecto el primer producto disponible (excluir Fotos Carnet y Polaroid)
  useEffect(() => {
    if (!productsLoaded || labProducts.length === 0) return;
    const first = labProducts.find((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim())) || labProducts[0];
    if (!first) return;
    const firstName = first.name.split(" - ")[0].trim();

    setBulkProductId((prev) => (prev == null ? first.id : prev));
    setBulkProductName((prev) => (prev == null ? firstName : prev));

    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        if (it.productId || it.productName) return it;
        changed = true;
        return {
          ...it,
          productId: first.id,
          productName: firstName,
          size: first.size || it.size,
          finish: first.acabado ? (first.acabado as Finish) : it.finish,
        };
      });
      if (changed) {
        sessionStorage.setItem("publicOrderItems", JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, [productsLoaded, labProducts.length]);

  // Cargar estado guardado al montar
  useEffect(() => {
    const savedPhotos = sessionStorage.getItem("publicUploadedPhotos");
    const savedItems = sessionStorage.getItem("publicOrderItems");
    const savedLabId = sessionStorage.getItem("publicSelectedLabId");
    if (savedPhotos) {
      try {
        const parsed = JSON.parse(savedPhotos);
        setPhotos(parsed);
      } catch (e) {
        console.error("Error cargando fotos guardadas:", e);
      }
    }

    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        setItems(parsed);
        setShowUploadZone(false);
      } catch (e) {
        console.error("Error cargando items guardados:", e);
      }
    }

    if (savedLabId && Number.isFinite(Number(savedLabId))) {
      setSelectedLabId(Number(savedLabId));
    } else {
      setSelectedLabId(9);
      sessionStorage.setItem("publicSelectedLabId", "9");
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSelectedLab() {
      if (!selectedLabId) return;
      try {
        const res = await fetch(`/api/lab/${selectedLabId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.id === selectedLabId) {
          setSelectedLab({
            id: data.id,
            name: data.name,
            email: data.email ?? null,
            phone: data.phone ?? null,
            address: data.address ?? null,
            city: data.city ?? null,
            province: data.province ?? null,
            country: data.country ?? null,
            hasWholesalePricing: Boolean(data.hasWholesalePricing),
          });
        }
      } catch (err) {
        console.error("Error cargando laboratorio seleccionado:", err);
      }
    }

    loadSelectedLab();
    return () => {
      alive = false;
    };
  }, [selectedLabId]);

  // Sincronizar items cuando cambian las fotos
  useEffect(() => {
    if (photos.length === 0) {
      const savedItems = sessionStorage.getItem("publicOrderItems");
      if (!savedItems) {
        setItems([]);
      }
      return;
    }

    setItems((prevItems) => {
      if (prevItems.length > 0) {
        const existingKeys = new Set(prevItems.map((i) => i.fileKey));
        const newPhotos = photos.filter((p) => !existingKeys.has(p.fileKey));

        if (newPhotos.length > 0) {
          const newItems: Item[] = newPhotos.map((p) => ({
            fileKey: p.fileKey,
            previewUrl: p.url,
            originalName: p.originalName,
            size: "10x15",
            finish: "BRILLO" as Finish,
            quantity: 1,
            productId: null,
            productName: null,
          }));

          const updatedExistingItems = prevItems
            .filter((item) => photos.some((p) => p.fileKey === item.fileKey))
            .map((item) => (item.size === "15x21" ? { ...item, size: "15x20" } : item));

          const updatedItems = [...updatedExistingItems, ...newItems];
          sessionStorage.setItem("publicOrderItems", JSON.stringify(updatedItems));
          return updatedItems;
        }

        const updatedExistingItems = prevItems
          .filter((item) => photos.some((p) => p.fileKey === item.fileKey))
          .map((item) => (item.size === "15x21" ? { ...item, size: "15x20" } : item));

        sessionStorage.setItem("publicOrderItems", JSON.stringify(updatedExistingItems));
        return updatedExistingItems;
      }

      const newItems: Item[] = photos.map((p) => ({
        fileKey: p.fileKey,
        previewUrl: p.url,
        originalName: p.originalName,
        size: "10x15",
        finish: "BRILLO" as Finish,
        quantity: 1,
        productId: null,
        productName: null,
      }));

      sessionStorage.setItem("publicOrderItems", JSON.stringify(newItems));
      return newItems;
    });
  }, [photos]);

  async function handleFilesSelected(files: FileList) {
    setUploading(true);
    setError(null);

    try {
      const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
      const maxBytes = maxMb * 1024 * 1024;
      const fileList = Array.from(files);
      setUploadTotal(fileList.length);
      setUploadDone(0);
      const tooLarge = fileList.filter((f) => f.size > maxBytes);
      if (tooLarge.length > 0) {
        throw new Error(`Algunas fotos superan el límite de ${maxMb} MB.`);
      }

      const uploaded: UploadedFile[] = [];
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("files", file);
        formData.append("applyWatermark", "false");

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          if (contentType.includes("application/json")) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error || "Error subiendo archivos");
          }
          const text = await res.text();
          throw new Error(text || "Error subiendo archivos");
        }

        const data = contentType.includes("application/json") ? await res.json() : { files: [] };
        const batch = ((data.files as any[]) || []).map((f) => ({
          fileKey: f.fileKey || f.key,
          url: f.url,
          originalName: f.originalName || f.name,
        })) as UploadedFile[];
        uploaded.push(...batch);
        setUploadDone((prev) => prev + 1);
      }

      setPhotos((prev) => {
        const existingKeys = new Set(prev.map((p) => p.fileKey));
        const newPhotos = uploaded.filter((p) => !existingKeys.has(p.fileKey));
        const updated = [...prev, ...newPhotos];
        sessionStorage.setItem("publicUploadedPhotos", JSON.stringify(updated));
        return updated;
      });
      setShowUploadZone(false);
    } catch (err: any) {
      setError(err?.message || "Error subiendo archivos");
    } finally {
      setUploading(false);
    }
  }

  function updateItem(index: number, updates: Partial<Item>) {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const nextItem = { ...current, ...updates };
      const productKey =
        (nextItem.productName || "").trim() ||
        (nextItem.productId != null ? String(nextItem.productId) : "__NO_PRODUCT__");
      const nextKey = `${nextItem.previewUrl}::${productKey}::${nextItem.size}::${nextItem.finish}`;
      if (productKey) {
        const hasDuplicate = prev.some((it, i) => {
          if (i === index) return false;
          const key =
            `${it.previewUrl}::${(it.productName || "").trim() || (it.productId != null ? String(it.productId) : "__NO_PRODUCT__")}::${it.size}::${it.finish}`;
          return key === nextKey;
        });
        if (hasDuplicate) {
          setError("Ya existe un ítem igual para esta foto (mismo producto, tamaño y acabado).");
          return prev;
        }
      }
      const updated = prev.map((item, i) => (i === index ? nextItem : item));
      sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
      return updated;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
      return updated;
    });
    setPhotos((prev) => {
      const item = items[index];
      const updated = prev.filter((p) => p.fileKey !== item.fileKey);
      sessionStorage.setItem("publicUploadedPhotos", JSON.stringify(updated));
      return updated;
    });
  }

  function findAlternateVariant(itemToDuplicate: Item, itemsList: Item[]) {
    const usedKeys = new Set(
      itemsList.map((it) => {
        const key =
          `${it.previewUrl}::${(it.productName || "").trim() || (it.productId != null ? String(it.productId) : "__NO_PRODUCT__")}::${it.size}::${it.finish}`;
        return key;
      })
    );

    const currentKey =
      `${itemToDuplicate.previewUrl}::${(itemToDuplicate.productName || "").trim() || (itemToDuplicate.productId != null ? String(itemToDuplicate.productId) : "__NO_PRODUCT__")}::${itemToDuplicate.size}::${itemToDuplicate.finish}`;

    let candidates: Array<{ productId?: number | null; productName?: string | null; size: string; finish: Finish }> = [];

    if (labProducts.length > 0) {
      const unique = new Map<string, { productId: number; productName: string; size: string; finish: Finish }>();
      labProducts.forEach((p) => {
        const productName = p.name.split(" - ")[0].trim();
        const size = p.size || itemToDuplicate.size;
        const finish = (p.acabado as Finish) || (itemToDuplicate.finish as Finish);
        if (!size || !finish) return;
        const key = `${productName}::${size}::${finish}`;
        if (!unique.has(key)) {
          unique.set(key, { productId: p.id, productName, size, finish });
        }
      });
      candidates = Array.from(unique.values());
    } else {
      const sizes = Array.from(new Set(labPricing.basePrices.map((bp) => bp.size)));
      const finishes: Finish[] = ["BRILLO", "MATE"];
      candidates = sizes.flatMap((size) => finishes.map((finish) => ({ size, finish })));
    }

    const available = candidates.find((c) => {
      const productKey =
        (c.productName || "").trim() ||
        (c.productId != null ? String(c.productId) : "__NO_PRODUCT__");
      const key = `${itemToDuplicate.previewUrl}::${productKey}::${c.size}::${c.finish}`;
      return key !== currentKey && !usedKeys.has(key);
    });

    return available || null;
  }

  function duplicateItem(index: number) {
    setItems((prev) => {
      const itemToDuplicate = prev[index];
      if (!itemToDuplicate) return prev;
      const productKey =
        (itemToDuplicate.productName || "").trim() ||
        (itemToDuplicate.productId != null ? String(itemToDuplicate.productId) : "__NO_PRODUCT__");
      const keyToDuplicate = `${itemToDuplicate.previewUrl}::${productKey}::${itemToDuplicate.size}::${itemToDuplicate.finish}`;
      const hasDuplicate = prev.some((it, i) => {
        if (i === index) return false;
        const key =
          `${it.previewUrl}::${(it.productName || "").trim() || (it.productId != null ? String(it.productId) : "__NO_PRODUCT__")}::${it.size}::${it.finish}`;
        return key === keyToDuplicate;
      });
      if (hasDuplicate) {
        const alternative = findAlternateVariant(itemToDuplicate, prev);
        if (!alternative) {
          setError("No hay otra variante disponible para duplicar esta foto.");
          return prev;
        }
        const duplicatedItem: Item = {
          ...itemToDuplicate,
          fileKey: `${itemToDuplicate.fileKey}_copy_${Date.now()}`,
          productId: alternative.productId ?? null,
          productName: alternative.productName ?? itemToDuplicate.productName ?? null,
          size: alternative.size,
          finish: alternative.finish,
        };
        const updated = [...prev];
        updated.splice(index + 1, 0, duplicatedItem);
        sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
        return updated;
      }
      
      // Crear una copia del item con un nuevo fileKey único
      const duplicatedItem: Item = {
        ...itemToDuplicate,
        fileKey: `${itemToDuplicate.fileKey}_copy_${Date.now()}`,
      };
      
      // Insertar después del item original
      const updated = [...prev];
      updated.splice(index + 1, 0, duplicatedItem);
      sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
      return updated;
    });
  }

  function toggleSelectItem(index: number) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  }

  function applyBulkToAll() {
    setItems((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        productId: bulkProductId,
        productName: bulkProductName,
        size: bulkSize,
        finish: bulkFinish,
        quantity: bulkQuantity,
      }));
      sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
      return updated;
    });
  }

  function applyBulkToSelected() {
    if (selectedItems.size === 0) return;
    setItems((prev) => {
      const updated = prev.map((item, i) =>
        selectedItems.has(i)
          ? { ...item, productId: bulkProductId, productName: bulkProductName, size: bulkSize, finish: bulkFinish, quantity: bulkQuantity }
          : item
      );
      sessionStorage.setItem("publicOrderItems", JSON.stringify(updated));
      return updated;
    });
  }

  function handleLabSelect(labId: number) {
    const lab = labs.find((l) => l.id === labId);
    if (lab) {
      setSelectedLabId(labId);
      setSelectedLab(lab);
      sessionStorage.setItem("publicSelectedLabId", String(labId));
    }
  }

  function handleContinue() {
    if (items.length === 0) {
      setError("Agregá al menos una foto para continuar");
      return;
    }
    if (!selectedLabId) {
      setError("Seleccioná un laboratorio para continuar");
      return;
    }
    router.push(`/imprimir-publico/resumen`);
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
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
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
                  Imprimí tus fotos fácil
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
                  Subí tus fotos, elegí tamaño y cantidad. Nosotros nos encargamos del resto.
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
                  Elegí el laboratorio que prefieras y obtené precios en tiempo real. Aplicá la misma configuración a todas las fotos o personalizá cada una.
                </p>
              </div>

              {error && (
                <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                  <p className="text-[#ef4444]">{error}</p>
                </Card>
              )}

              {/* Laboratorio fijo */}
              <Card className="space-y-4 overflow-visible">
                <h2 className="text-xl font-medium text-[#1a1a1a]">1. Laboratorio</h2>
                <p className="text-sm text-[#6b7280]">
                  Este pedido se procesa con un laboratorio preseleccionado.
                </p>
                {selectedLab ? (
                  <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg space-y-2">
                    <p className="text-sm text-[#10b981] font-medium">
                      ✅ Laboratorio seleccionado: {selectedLab.name}
                    </p>
                    <div className="text-sm text-[#1a1a1a] space-y-1">
                      {selectedLab.address && (
                        <p className="flex items-start gap-2">
                          <span className="text-[#6b7280]">🏠</span>
                          <span>{selectedLab.address}</span>
                        </p>
                      )}
                      {(selectedLab.city || selectedLab.province) && (
                        <p className="flex items-start gap-2">
                          <span className="text-[#6b7280]">📍</span>
                          <span>
                            {selectedLab.city || ""}
                            {selectedLab.city && selectedLab.province ? ", " : ""}
                            {selectedLab.province || ""}
                          </span>
                        </p>
                      )}
                      {selectedLab.phone && (
                        <p className="flex items-start gap-2">
                          <span className="text-[#6b7280]">📞</span>
                          <span>{selectedLab.phone}</span>
                        </p>
                      )}
                    </div>
                    {pricingLoading && <p className="text-xs text-[#6b7280] mt-2">Cargando precios...</p>}
                  </div>
                ) : (
                  <div className="p-4 bg-[#f3f4f6] border border-[#e5e7eb] rounded-lg">
                    <p className="text-sm text-[#6b7280]">Cargando laboratorio...</p>
                  </div>
                )}
              </Card>

              {items.length === 0 ? (
                <Card className="border-2 border-dashed p-8" style={{ borderColor: ACCENT_COLOR + "40" }}>
                  <UploadZone
                    onFilesSelected={handleFilesSelected}
                    uploading={uploading}
                    uploadedCount={uploadDone}
                    totalCount={uploadTotal}
                    accentColor={ACCENT_COLOR}
                  />
                </Card>
              ) : (
                <>
                  <div className="flex justify-start md:justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSlideViewerIndex(0);
                        setShowSlideViewer(true);
                      }}
                      className="text-sm"
                    >
                      Ver en modo slide
                    </Button>
                  </div>
                  {selectedItems.size <= 1 && (
                    <div className="text-sm text-[#6b7280]">
                      Seleccioná más de una fotografía para hacer una configuración masiva.
                    </div>
                  )}
                  {selectedItems.size > 1 && (
                    <div className="bg-[#f6f6f6] border border-[#e5e7eb] rounded-xl p-4" style={{ borderRadius: "12px" }}>
                      <h3 className="text-lg font-medium text-[#1a1a1a] mb-3">
                        Configuración rápida
                      </h3>
                      <p className="text-sm text-[#6b7280] mb-4">
                        Aplicá tamaño, acabado y cantidad de forma masiva. Los cambios pueden afectar a todas las fotos o solo a las que selecciones.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        {productsLoaded && labProducts.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                              Producto
                            </label>
                            <Select
                              value={bulkProductName || ""}
                              onChange={(e) => {
                                const selectedName = e.target.value;
                                if (!selectedName) {
                                  setBulkProductName(null);
                                  setBulkProductId(null);
                                  return;
                                }
                                const match =
                                  labProducts.find(
                                    (p) =>
                                      p.name.split(" - ")[0].trim() === selectedName &&
                                      (p.size === bulkSize || !bulkSize)
                                  ) ||
                                  labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                                if (match) {
                                  setBulkProductName(selectedName);
                                  setBulkProductId(match.id);
                                  if (match.size && match.size !== bulkSize) setBulkSize(match.size);
                                  if (match.acabado) setBulkFinish(match.acabado as Finish);
                                }
                              }}
                            >
                              <option value="">Sin producto específico</option>
                              {Array.from(
                                new Set(
                                  labProducts
                                    .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                                    .map((p) => p.name.split(" - ")[0].trim())
                                )
                              ).map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                            Tamaño
                          </label>
                          <Select
                            value={bulkSize}
                            onChange={(e) => setBulkSize(e.target.value)}
                          >
                            {labPricing.basePrices.length > 0 ? (
                              // Filtrar tamaños duplicados usando un Map para mantener solo el primero de cada tamaño
                              Array.from(
                                new Map(labPricing.basePrices.map((bp) => [bp.size, bp])).values()
                              ).map((bp) => (
                                <option key={bp.size} value={bp.size}>
                                  {bp.size} cm
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="10x15">10x15 cm</option>
                                <option value="13x18">13x18 cm</option>
                                <option value="15x20">15x20 cm</option>
                              </>
                            )}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                            Acabado
                          </label>
                          <Select
                            value={bulkFinish}
                            onChange={(e) => setBulkFinish(e.target.value as Finish)}
                          >
                            <option value="BRILLO">Brillo</option>
                            <option value="MATE">Mate</option>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                            Cantidad
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={bulkQuantity}
                            onChange={(e) => setBulkQuantity(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-start md:justify-end">
                        <Button
                          variant="primary"
                          onClick={applyBulkToAll}
                          className="text-sm px-4 py-2"
                          accentColor={ACCENT_COLOR}
                          style={{
                            backgroundColor: ACCENT_COLOR,
                            borderColor: ACCENT_COLOR,
                          }}
                        >
                          Aplicar a todas
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={applyBulkToSelected}
                          disabled={selectedItems.size === 0}
                          className="text-sm px-4 py-2"
                        >
                          Aplicar a seleccionadas ({selectedItems.size})
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={toggleSelectAll}
                          className="text-sm px-4 py-2"
                        >
                          {selectedItems.size === items.length
                            ? "Deseleccionar todas"
                            : "Seleccionar todas"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Zona de subida colapsable */}
                  <details className="bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg p-4">
                    <summary className="cursor-pointer text-sm font-medium text-[#1a1a1a] mb-3">
                      Agregar más fotos
                    </summary>
                    <UploadZone
                      onFilesSelected={handleFilesSelected}
                      uploading={uploading}
                      uploadedCount={uploadDone}
                      totalCount={uploadTotal}
                      accentColor={ACCENT_COLOR}
                    />
                  </details>

                  {/* Lista de items */}
                  <div className="space-y-6">
                    {items.map((item, index) => {
                      const product = findProductForItem(item, labProducts);
                      const basePrice = product?.retailPrice ?? getBasePrice(item.size, labPricing);
                      const platformFeePctLab = labPricing.platformCommissionPercent ?? 0;
                      const finalUnitPrice = totalFromBase(Math.round(basePrice), platformFeePctLab);
                      const quantity = Number(item.quantity) || 1;
                      const subtotal = (Number.isFinite(finalUnitPrice) && Number.isFinite(quantity) 
                        ? finalUnitPrice * quantity 
                        : 0);

                      return (
                        <OrderItem
                          key={`${item.fileKey}-${index}`}
                          id={item.fileKey}
                          previewUrl={item.previewUrl}
                          originalName={item.originalName}
                          tipo="impresa"
                          size={item.size}
                          finish={item.finish}
                          quantity={item.quantity}
                          basePrice={basePrice}
                          discountPercent={0}
                          finalUnitPrice={finalUnitPrice}
                          subtotal={subtotal}
                          selected={selectedItems.has(index)}
                          onSelect={() => toggleSelectItem(index)}
                          onRemove={() => removeItem(index)}
                          onDuplicate={() => duplicateItem(index)}
                          onOpenSlide={() => {
                            setSlideViewerIndex(index);
                            setShowSlideViewer(true);
                          }}
                          onSizeChange={(size) => {
                            if (item.productName && labProducts.length > 0) {
                              const match = labProducts.find((p) => {
                                const pName = p.name.split(" - ")[0].trim();
                                return pName === item.productName && p.size === size;
                              });
                              if (match) {
                                updateItem(index, { size, productId: match.id, productName: item.productName });
                                return;
                              }
                            }
                            updateItem(index, { size });
                          }}
                          onFinishChange={(finish) => {
                            const newFinish = finish as Finish;
                            if (item.productName && labProducts.length > 0) {
                              const match =
                                labProducts.find((p) => {
                                  const pName = p.name.split(" - ")[0].trim();
                                  const matchesSize = p.size === item.size;
                                  const matchesFinish =
                                    p.acabado === newFinish || (!p.acabado && newFinish === "BRILLO");
                                  return pName === item.productName && matchesSize && matchesFinish;
                                }) ||
                                labProducts.find((p) => {
                                  const pName = p.name.split(" - ")[0].trim();
                                  return pName === item.productName && p.size === item.size;
                                });
                              if (match) {
                                updateItem(index, { finish: newFinish, productId: match.id, productName: item.productName });
                                return;
                              }
                            }
                            updateItem(index, { finish: newFinish });
                          }}
                          onQuantityChange={(quantity) => updateItem(index, { quantity })}
                          availableSizes={labPricing.basePrices}
                          availableProducts={productsLoaded && labProducts.length > 0 ? labProducts.map((p) => ({ id: p.id, name: p.name, size: p.size, acabado: p.acabado })) : undefined}
                          productId={item.productId || null}
                          productName={item.productName || null}
                          showProductInHeader
                          showPrintType
                          onProductChange={(productId, productName) => {
                              if (!productId) {
                                updateItem(index, { productId: null, productName: null });
                                return;
                              }
                              const selectedProduct = labProducts.find((p) => p.id === productId);
                              if (selectedProduct) {
                                const prodName = productName || selectedProduct.name.split(" - ")[0].trim();
                                const match =
                                  labProducts.find((p) => {
                                    const pName = p.name.split(" - ")[0].trim();
                                    return pName === prodName && (p.size === item.size || !item.size);
                                  }) ||
                                  labProducts.find((p) => p.name.split(" - ")[0].trim() === prodName);
                                updateItem(index, {
                                  productId: match?.id || productId,
                                  productName: prodName,
                                  ...(match?.size && match.size !== item.size ? { size: match.size } : {}),
                                  ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                                });
                              }
                            }}
                          tertiaryColor={ACCENT_COLOR}
                        />
                      );
                    })}
                  </div>

                  {/* Resumen de precios */}
                  {pricingLoaded && labPricing.basePrices.length > 0 && (
                    <Card className="space-y-4">
                      <h2 className="text-xl font-medium text-[#1a1a1a]">Resumen de tu pedido</h2>
                      <div className="space-y-2">
                        {totals.totalDiscount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-medium text-[#1a1a1a]">
                              Total descuento
                            </span>
                            <span className="text-xl font-normal text-[#10b981]">
                              -{formatARS(totals.totalDiscount)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-[#e5e7eb] gap-2">
                        <span className="text-lg sm:text-xl font-medium text-[#1a1a1a]">
                          Total de tu pedido (con fee incluido)
                        </span>
                        <span className="text-2xl sm:text-3xl font-normal text-[#1a1a1a]">
                          {formatARS(totals.totalFinal)}
                        </span>
                      </div>
                      <p className="text-sm text-[#6b7280]">
                        El fee de plataforma ya está incluido en el precio final.
                      </p>
                      {totals.totalDiscount > 0 ? (
                        <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
                          <p className="text-sm text-[#10b981] font-medium">
                            ✅ En este pedido ahorraste {formatARS(totals.totalDiscount)} gracias a
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
                    </Card>
                  )}

                  <div className="flex justify-start md:justify-end pt-6">
                    <Button
                      variant="primary"
                      onClick={handleContinue}
                      disabled={!selectedLabId || !pricingLoaded}
                      accentColor={ACCENT_COLOR}
                      style={{
                        backgroundColor: ACCENT_COLOR,
                        borderColor: ACCENT_COLOR,
                      }}
                    >
                      Continuar al resumen
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {showSlideViewer && items.length > 0 && (
        <PhotoSlideViewer
          photos={items.map((item, index) => ({
            id: String(index),
            src: item.previewUrl,
            alt: item.originalName,
            selected: selectedItems.has(index),
          }))}
          initialIndex={slideViewerIndex}
          onClose={() => setShowSlideViewer(false)}
          onPhotoSelect={(id) => toggleSelectItem(Number(id))}
          renderControls={(_, index) => {
            const item = items[index];
            if (!item) return null;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                {productsLoaded && labProducts.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-medium mb-1">Producto</label>
                    <Select
                      className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                      value={item.productName || ""}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        if (!selectedName) {
                          updateItem(index, { productId: null, productName: null });
                          return;
                        }
                        const match =
                          labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName && (p.size === item.size || !item.size)) ||
                          labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                        updateItem(index, {
                          productId: match?.id ?? null,
                          productName: selectedName,
                          ...(match?.size ? { size: match.size } : {}),
                          ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                        });
                      }}
                    >
                      <option value="">Sin producto específico</option>
                      {Array.from(new Set(labProducts.filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim())).map((p) => p.name.split(" - ")[0].trim()))).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium mb-1">Tamaño</label>
                  <Select
                    className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                    value={item.size}
                    onChange={(e) => updateItem(index, { size: e.target.value })}
                  >
                    {Array.from(new Map(labPricing.basePrices.map((bp) => [bp.size, bp])).values()).map((bp) => (
                      <option key={bp.size} value={bp.size}>
                        {bp.size} cm
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Acabado</label>
                  <Select
                    className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                    value={item.finish}
                    onChange={(e) => updateItem(index, { finish: e.target.value as Finish })}
                  >
                    <option value="BRILLO">Brillo</option>
                    <option value="MATE">Mate</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Cantidad</label>
                  <Input
                    className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>
            );
          }}
        />
      )}
    </>
  );
}
