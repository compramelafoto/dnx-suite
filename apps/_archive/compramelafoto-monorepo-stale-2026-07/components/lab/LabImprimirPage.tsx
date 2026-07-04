"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/photo/UploadZone";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import OrderItem from "@/components/order/OrderItem";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import LabHeader from "./LabHeader";
import LabPublicFooter from "./LabPublicFooter";
import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";
import { isCarnetOrPolaroidProduct } from "@/lib/print-products";

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

type LabProduct = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  photographerPrice: number;
  retailPrice: number;
  isActive: boolean;
};

type LabPricing = {
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
};

type Lab = {
  id: number;
  name: string;
  email: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor?: string | null;
  fontColor?: string | null;
  showCarnetPrints?: boolean;
  showPolaroidPrints?: boolean;
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

// Obtiene el descuento aplicable según cantidad (umbrales 10, 30, 50, 80, 100)
function pickDiscountFromThresholds(qty: number, discounts: Array<{ minQty: number; discountPercent: number }>): number {
  const applicable = discounts.filter((d) => d.minQty <= qty).sort((a, b) => b.minQty - a.minQty);
  return applicable[0]?.discountPercent ?? 0;
}

function getDiscountPercent(
  size: string,
  sizeQty: number,
  pricing: LabPricing
): number {
  // Primero buscar descuentos específicos por tamaño
  const sizeDiscounts = pricing.discounts.filter((d) => d.size === size);
  if (sizeDiscounts.length > 0) {
    return pickDiscountFromThresholds(sizeQty, sizeDiscounts.map((d) => ({ minQty: d.minQty, discountPercent: d.discountPercent })));
  }
  // Si no hay, usar descuentos globales (GLOBAL)
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
  pricing: LabPricing,
  platformFeePercent: number
): number {
  const basePrice = getBasePrice(size, pricing);
  if (!basePrice || basePrice === 0 || !Number.isFinite(basePrice)) {
    return 0;
  }
  const discountPercent = getDiscountPercent(size, sizeQty, pricing);
  const discountedPrice = basePrice * (1 - discountPercent / 100);
  const result = totalFromBase(Math.round(discountedPrice), Math.max(0, platformFeePercent));
  return Number.isFinite(result) ? result : 0;
}

export default function LabImprimirPage({
  lab,
  handler,
}: {
  lab: Lab;
  handler: string;
}) {
  const router = useRouter();
  const primaryColor = lab.primaryColor || "#c27b3d";
  const tertiaryColor = lab.tertiaryColor || lab.primaryColor || "#c27b3d";
  const fontColor = lab.fontColor || "#1a1a1a";
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUploadZone, setShowUploadZone] = useState(true);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);

  // Precios del laboratorio
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  
  // Productos del laboratorio
  const [labProducts, setLabProducts] = useState<LabProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);

  // Configuración masiva
  const [bulkProductId, setBulkProductId] = useState<number | null>(null);
  const [bulkProductName, setBulkProductName] = useState<string | null>(null);
  const [bulkSize, setBulkSize] = useState("");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQuantity, setBulkQuantity] = useState(1);

  // Actualizar bulkSize cuando se carguen los precios
  useEffect(() => {
    if (pricingLoaded && labPricing.basePrices.length > 0 && !bulkSize) {
      setBulkSize(labPricing.basePrices[0].size);
    } else if (!pricingLoaded && !bulkSize) {
      setBulkSize("10x15"); // Fallback mientras carga
    }
  }, [pricingLoaded, labPricing.basePrices, bulkSize]);

  useEffect(() => {
    let active = true;
    async function loadConfig() {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const fee = Number(data?.platformCommissionPercent);
        if (active && Number.isFinite(fee)) {
          setPlatformFeePercent(fee);
        }
      } catch (err) {
        console.error("Error cargando config general:", err);
      }
    }
    loadConfig();
    return () => {
      active = false;
    };
  }, []);

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
      return { totalBase: 0, totalFinal: 0, totalDiscount: 0, totalFee: 0 };
    }

    let totalBase = 0;
    let totalFinal = 0;
    let totalDiscount = 0;
    let totalFee = 0;

    for (const item of items) {
      const basePrice = getBasePrice(item.size, labPricing);
      const sizeQty = qtyBySize.get(item.size) ?? item.quantity;
      const discountPercent = getDiscountPercent(item.size, sizeQty, labPricing);
      const discountedPrice = basePrice * (1 - discountPercent / 100);
      const feePerUnit = feeFromBase(Math.round(discountedPrice), Math.max(0, platformFeePercent));
      const finalUnitPrice = calculateFinalUnitPrice(item.size, sizeQty, labPricing, platformFeePercent);

      totalBase += basePrice * item.quantity;
      totalFinal += finalUnitPrice * item.quantity;
      totalDiscount += (basePrice - discountedPrice) * item.quantity;
      totalFee += feePerUnit * item.quantity;
    }

    return {
      totalBase,
      totalFinal,
      totalDiscount,
      totalFee,
    };
  }, [items, qtyBySize, labPricing, pricingLoaded, platformFeePercent]);

  // Cargar precios del laboratorio (usar el labId directamente)
  useEffect(() => {
    if (!lab?.id) {
      setPricingLoaded(true); // Si no hay lab.id, marcar como cargado para no bloquear
      return;
    }

    async function loadPricing() {
      try {
        const res = await fetch(`/api/lab/pricing?labId=${lab.id}&isPhotographer=false`, { cache: "no-store" });
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
        });
        setPricingLoaded(true);
      } catch (e) {
        console.error("Error cargando precios del laboratorio:", e);
        setError("No se pudieron cargar los precios. Por favor recargá la página.");
        setPricingLoaded(true); // Marcar como cargado aunque haya error para no bloquear la UI
      }
    }
    loadPricing();
  }, [lab?.id]);

  // Cargar productos del laboratorio
  useEffect(() => {
    if (!lab?.id) {
      setProductsLoaded(true); // Si no hay lab.id, marcar como cargado para no bloquear
      return;
    }

    async function loadProducts() {
      try {
        const res = await fetch(`/api/lab/products?labId=${lab.id}`, { cache: "no-store" });
        if (!res.ok) {
          console.warn("No se pudieron cargar los productos del laboratorio");
          setProductsLoaded(true); // Marcar como cargado aunque haya error para no bloquear
          return;
        }
        const products = await res.json();
        setLabProducts(Array.isArray(products) ? products.filter((p: LabProduct) => p.isActive) : []);
        setProductsLoaded(true);
      } catch (e) {
        console.error("Error cargando productos del laboratorio:", e);
        setProductsLoaded(true); // Marcar como cargado aunque haya error para no bloquear
      }
    }
    loadProducts();
  }, [lab?.id]);

  // Cargar estado guardado al montar
  useEffect(() => {
    const savedPhotos = sessionStorage.getItem(`lab_${lab.id}_uploadedPhotos`);
    const savedItems = sessionStorage.getItem(`lab_${lab.id}_orderItems`);

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
        const cleaned = parsed.map((it: any) => {
          const { unitPrice, ...rest } = it;
          return rest;
        });
        setItems(cleaned);
        setShowUploadZone(false);
      } catch (e) {
        console.error("Error cargando items guardados:", e);
      }
    }
  }, [lab.id]);

  // Sincronizar items cuando cambian las fotos
  useEffect(() => {
    if (photos.length === 0) {
      const savedItems = sessionStorage.getItem(`lab_${lab.id}_orderItems`);
      if (!savedItems) {
        setItems([]);
      }
      return;
    }

    // Obtener el tamaño por defecto (primer tamaño disponible o "10x15")
    const defaultSize = pricingLoaded && labPricing.basePrices.length > 0 
      ? labPricing.basePrices[0].size 
      : "10x15";

    setItems((prevItems) => {
      if (prevItems.length > 0) {
        const existingKeys = new Set(prevItems.map((i) => i.fileKey));
        const newPhotos = photos.filter((p) => !existingKeys.has(p.fileKey));

        if (newPhotos.length > 0) {
          const newItems: Item[] = newPhotos.map((p) => ({
            fileKey: p.fileKey,
            previewUrl: p.url,
            originalName: p.originalName,
            size: defaultSize,
            finish: "BRILLO" as Finish,
            quantity: 1,
          }));

          const updatedExistingItems = prevItems
            .filter((item) => photos.some((p) => p.fileKey === item.fileKey))
            .map((item) => {
              // Si el tamaño del item no existe en los precios, usar el default
              const sizeExists = !pricingLoaded || labPricing.basePrices.length === 0 || 
                labPricing.basePrices.some((bp) => bp.size === item.size);
              return {
                ...item,
                size: item.size === "15x21" ? "15x20" : (sizeExists ? item.size : defaultSize),
              };
            });

          const updatedItems = [...updatedExistingItems, ...newItems];
          sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updatedItems));
          return updatedItems;
        }

        const updatedExistingItems = prevItems
          .filter((item) => photos.some((p) => p.fileKey === item.fileKey))
          .map((item) => {
            // Si el tamaño del item no existe en los precios, usar el default
            const sizeExists = !pricingLoaded || labPricing.basePrices.length === 0 || 
              labPricing.basePrices.some((bp) => bp.size === item.size);
            return {
              ...item,
              size: item.size === "15x21" ? "15x20" : (sizeExists ? item.size : defaultSize),
            };
          });

        sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updatedExistingItems));
        return updatedExistingItems;
      }

      const newItems: Item[] = photos.map((p) => ({
        fileKey: p.fileKey,
        previewUrl: p.url,
        originalName: p.originalName,
        size: defaultSize,
        finish: "BRILLO" as Finish,
        quantity: 1,
      }));

      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(newItems));
      return newItems;
    });
  }, [photos, lab.id, pricingLoaded, labPricing.basePrices]);

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
        sessionStorage.setItem(`lab_${lab.id}_uploadedPhotos`, JSON.stringify(updated));
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
      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
      return updated;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
      return updated;
    });
    setPhotos((prev) => {
      const item = items[index];
      const updated = prev.filter((p) => p.fileKey !== item.fileKey);
      sessionStorage.setItem(`lab_${lab.id}_uploadedPhotos`, JSON.stringify(updated));
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
        sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
        return updated;
      }
      
      // Crear una copia del item con un nuevo fileKey único
      const duplicatedItem: Item = {
        ...itemToDuplicate,
        fileKey: `${itemToDuplicate.fileKey}_copy_${Date.now()}`,
        // Mantener la misma configuración inicial, pero el usuario puede cambiarla
      };
      
      // Insertar después del item original
      const updated = [...prev];
      updated.splice(index + 1, 0, duplicatedItem);
      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
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
      // Si hay productos disponibles y no se seleccionó un producto específico, buscar el producto que coincida con tamaño + acabado
      let finalProductId = bulkProductId;
      let finalProductName = bulkProductName;
      
      if (!finalProductId && labProducts.length > 0 && bulkSize && bulkFinish) {
        // Buscar producto que coincida con tamaño y acabado
        const matchingProduct = labProducts.find(p => {
          const matchesSize = p.size === bulkSize || (!p.size && !bulkSize);
          const matchesFinish = p.acabado === bulkFinish || (!p.acabado && bulkFinish === "BRILLO");
          return matchesSize && matchesFinish;
        });
        
        if (matchingProduct) {
          finalProductId = matchingProduct.id;
          finalProductName = matchingProduct.name.split(' - ')[0].trim();
        }
      }
      
      const updated = prev.map((item) => ({
        ...item,
        productId: finalProductId,
        productName: finalProductName,
        size: bulkSize,
        finish: bulkFinish,
        quantity: bulkQuantity,
      }));
      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
      return updated;
    });
  }

  function applyBulkToSelected() {
    if (selectedItems.size === 0) return;
    setItems((prev) => {
      // Si hay productos disponibles y no se seleccionó un producto específico, buscar el producto que coincida con tamaño + acabado
      let finalProductId = bulkProductId;
      let finalProductName = bulkProductName;
      
      if (!finalProductId && labProducts.length > 0 && bulkSize && bulkFinish) {
        // Buscar producto que coincida con tamaño y acabado
        const matchingProduct = labProducts.find(p => {
          const matchesSize = p.size === bulkSize || (!p.size && !bulkSize);
          const matchesFinish = p.acabado === bulkFinish || (!p.acabado && bulkFinish === "BRILLO");
          return matchesSize && matchesFinish;
        });
        
        if (matchingProduct) {
          finalProductId = matchingProduct.id;
          finalProductName = matchingProduct.name.split(' - ')[0].trim();
        }
      }
      
      const updated = prev.map((item, i) =>
        selectedItems.has(i)
          ? { 
              ...item, 
              productId: finalProductId,
              productName: finalProductName,
              size: bulkSize, 
              finish: bulkFinish, 
              quantity: bulkQuantity 
            }
          : item
      );
      sessionStorage.setItem(`lab_${lab.id}_orderItems`, JSON.stringify(updated));
      return updated;
    });
  }

  function handleContinue() {
    if (items.length === 0) {
      setError("Agregá al menos una foto para continuar");
      return;
    }
    router.push(`/l/${handler}/imprimir/resumen`);
  }

  return (
    <>
      <LabHeader lab={lab} handler={handler} />
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
                  Elegí el tamaño y acabado que prefieras y obtené precios en tiempo real. Aplicá la misma configuración a todas las fotos o personalizá cada una.
                </p>
              </div>

              {error && (
                <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                  <p className="text-[#ef4444]">{error}</p>
                </Card>
              )}

              {pricingLoaded && labPricing.basePrices.length === 0 && (
                <Card className="bg-[#fef3c7]/10 border-[#f59e0b]">
                  <p className="text-[#92400e]">
                    ⚠️ El laboratorio no tiene precios configurados. No podrás realizar pedidos hasta que se configuren los precios.
                  </p>
                </Card>
              )}

              {items.length === 0 ? (
                <Card className="border-2 border-dashed p-8" style={{ borderColor: tertiaryColor + "40" }}>
                  <UploadZone
                    onFilesSelected={handleFilesSelected}
                    uploading={uploading}
                    uploadedCount={uploadDone}
                    totalCount={uploadTotal}
                    accentColor={tertiaryColor}
                  />
                </Card>
              ) : (
                <>
                  <div className="flex justify-end">
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
                    <p className="text-sm text-[#6b7280]">
                      Seleccioná 2 o más fotos para usar la configuración rápida (producto, tamaño, acabado y cantidad en forma masiva).
                    </p>
                  )}
                  {selectedItems.size >= 2 && (
                  <div className="bg-[#f6f6f6] border border-[#e5e7eb] rounded-xl p-4" style={{ borderRadius: "12px" }}>
                    <h3 className="text-lg font-medium mb-3" style={{ color: fontColor }}>
                      Configuración rápida
                    </h3>
                    <p className="text-sm text-[#6b7280] mb-4">
                      Aplicá producto, tamaño, acabado y cantidad de forma masiva. Los cambios pueden afectar a todas las fotos o solo a las que selecciones.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      {productsLoaded && labProducts.length > 0 && (() => {
                        // Agrupar productos por nombre genérico
                        const productsGrouped = labProducts.reduce((acc, p) => {
                          const productName = p.name.split(' - ')[0].trim();
                          if (!acc[productName]) {
                            acc[productName] = [];
                          }
                          acc[productName].push(p);
                          return acc;
                        }, {} as Record<string, typeof labProducts>);
                        
                        return (
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
                                // Encontrar el primer producto con ese nombre que tenga el tamaño actual, o el primero disponible
                                const matchingProduct = labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === selectedName && (p.size === bulkSize || !bulkSize);
                                }) || labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === selectedName;
                                });
                                
                                if (matchingProduct) {
                                  setBulkProductName(selectedName);
                                  setBulkProductId(matchingProduct.id);
                                  // Si el producto tiene un tamaño específico, actualizarlo
                                  if (matchingProduct.size && matchingProduct.size !== bulkSize) {
                                    setBulkSize(matchingProduct.size);
                                  }
                                  // Si el producto tiene un acabado específico, actualizarlo
                                  if (matchingProduct.acabado) {
                                    setBulkFinish(matchingProduct.acabado as Finish);
                                  }
                                }
                              }}
                            >
                              <option value="">Sin producto específico</option>
                              {Object.keys(productsGrouped).map((productName) => (
                                <option key={productName} value={productName}>
                                  {productName}
                                </option>
                              ))}
                            </Select>
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                          Tamaño
                        </label>
                        <Select
                          value={bulkSize}
                          onChange={(e) => {
                            const newSize = e.target.value;
                            setBulkSize(newSize);
                            
                            // Buscar producto que coincida con tamaño + acabado
                            if (labProducts.length > 0 && bulkFinish) {
                              // Si hay un producto seleccionado, buscar el producto que tenga ese nombre + tamaño + acabado
                              if (bulkProductName) {
                                const matchingProduct = labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  const matchesSize = p.size === newSize;
                                  const matchesFinish = p.acabado === bulkFinish || (!p.acabado && bulkFinish === "BRILLO");
                                  return pName === bulkProductName && matchesSize && matchesFinish;
                                }) || labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === bulkProductName && p.size === newSize;
                                });
                                if (matchingProduct) {
                                  setBulkProductId(matchingProduct.id);
                                  if (matchingProduct.acabado) {
                                    setBulkFinish(matchingProduct.acabado as Finish);
                                  }
                                }
                              } else {
                                // Si no hay producto seleccionado, buscar cualquier producto que coincida con tamaño + acabado
                                const matchingProduct = labProducts.find(p => {
                                  const matchesSize = p.size === newSize || (!p.size && !newSize);
                                  const matchesFinish = p.acabado === bulkFinish || (!p.acabado && bulkFinish === "BRILLO");
                                  return matchesSize && matchesFinish;
                                });
                                if (matchingProduct) {
                                  setBulkProductId(matchingProduct.id);
                                  setBulkProductName(matchingProduct.name.split(' - ')[0].trim());
                                  if (matchingProduct.acabado) {
                                    setBulkFinish(matchingProduct.acabado as Finish);
                                  }
                                }
                              }
                            }
                          }}
                        >
                          {pricingLoaded && labPricing.basePrices.length > 0 ? (
                            labPricing.basePrices.map((bp) => (
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
                          onChange={(e) => {
                            const newFinish = e.target.value as Finish;
                            setBulkFinish(newFinish);
                            
                            // Buscar producto que coincida con tamaño + acabado
                            if (labProducts.length > 0 && bulkSize) {
                              // Si hay un producto seleccionado, buscar el producto que tenga ese nombre + tamaño + acabado
                              if (bulkProductName) {
                                const matchingProduct = labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  const matchesSize = p.size === bulkSize;
                                  const matchesFinish = p.acabado === newFinish || (!p.acabado && newFinish === "BRILLO");
                                  return pName === bulkProductName && matchesSize && matchesFinish;
                                }) || labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === bulkProductName && p.size === bulkSize;
                                });
                                if (matchingProduct) {
                                  setBulkProductId(matchingProduct.id);
                                }
                              } else {
                                // Si no hay producto seleccionado, buscar cualquier producto que coincida con tamaño + acabado
                                const matchingProduct = labProducts.find(p => {
                                  const matchesSize = p.size === bulkSize || (!p.size && !bulkSize);
                                  const matchesFinish = p.acabado === newFinish || (!p.acabado && newFinish === "BRILLO");
                                  return matchesSize && matchesFinish;
                                });
                                if (matchingProduct) {
                                  setBulkProductId(matchingProduct.id);
                                  setBulkProductName(matchingProduct.name.split(' - ')[0].trim());
                                }
                              }
                            }
                          }}
                        >
                          {(() => {
                            // Obtener acabados disponibles para el producto+tamaño seleccionado
                            const availableFinishes: string[] = [];
                            if (bulkProductName && bulkSize && labProducts.length > 0) {
                              const finishes = labProducts
                                .filter(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === bulkProductName && p.size === bulkSize && p.acabado;
                                })
                                .map(p => p.acabado!)
                                .filter((f, i, arr) => arr.indexOf(f) === i)
                                .sort();
                              availableFinishes.push(...finishes);
                            }
                            
                            const finishesToShow = availableFinishes.length > 0 
                              ? availableFinishes 
                              : ["Brillo", "Mate"];
                            
                            return finishesToShow.map((f) => (
                              <option key={f} value={f === "Brillo" ? "BRILLO" : f === "Mate" ? "MATE" : f}>
                                {f === "BRILLO" ? "Brillo" : f === "MATE" ? "Mate" : f}
                              </option>
                            ));
                          })()}
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
                    <div className="flex flex-wrap gap-3 justify-end">
                      <Button
                        variant="primary"
                        onClick={applyBulkToAll}
                        className="text-sm px-4 py-2"
                        accentColor={tertiaryColor}
                        style={{
                          backgroundColor: tertiaryColor,
                          borderColor: tertiaryColor,
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
                    />
                  </details>

                  {/* Lista de items */}
                  <div className="space-y-6">
                    {items.map((item, index) => {
                      // Si hay un producto seleccionado, buscar el precio del producto específico
                      let basePrice = 0;
                      if ((item.productId || item.productName) && labProducts.length > 0) {
                        // Buscar el producto que tenga el nombre + tamaño + acabado actual
                        const productName = item.productName || (item.productId 
                          ? (() => {
                              const prod = labProducts.find(pr => pr.id === item.productId);
                              return prod ? prod.name.split(' - ')[0].trim() : null;
                            })()
                          : null);
                        
                        const selectedProduct = productName 
                          ? labProducts.find(p => {
                              const pName = p.name.split(' - ')[0].trim();
                              const matchesSize = p.size === item.size || (!p.size && !item.size);
                              const matchesFinish = p.acabado === item.finish || (!p.acabado && !item.finish);
                              return pName === productName && matchesSize && matchesFinish;
                            }) || labProducts.find(p => {
                              // Fallback: buscar solo por nombre + tamaño si no hay match con acabado
                              const pName = p.name.split(' - ')[0].trim();
                              return pName === productName && p.size === item.size;
                            })
                          : null;
                        
                        if (selectedProduct) {
                          // Usar precio retail (público) para esta página del laboratorio
                          basePrice = selectedProduct.retailPrice > 0 
                            ? selectedProduct.retailPrice 
                            : selectedProduct.photographerPrice;
                        } else {
                          // Fallback a precio por tamaño
                          basePrice = getBasePrice(item.size, labPricing);
                        }
                      } else {
                        // Si no hay producto seleccionado, usar precio por tamaño
                        basePrice = getBasePrice(item.size, labPricing);
                      }
                      
                      const sizeQty = qtyBySize.get(item.size) ?? item.quantity;
                      const discountPercent = getDiscountPercent(item.size, sizeQty, labPricing);
                      // Calcular precio final con descuento
                      const discountedPrice = basePrice * (1 - discountPercent / 100);
                      const finalUnitPrice = Math.round(discountedPrice);
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
                          size={item.size}
                          finish={item.finish}
                          quantity={item.quantity}
                          basePrice={basePrice}
                          discountPercent={Math.round(discountPercent)}
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
                            // Cuando cambia el tamaño, buscar el producto que tenga ese nombre + tamaño
                            if (item.productName && labProducts.length > 0) {
                              const matchingProduct = labProducts.find(p => {
                                const pName = p.name.split(' - ')[0].trim();
                                return pName === item.productName && p.size === size;
                              });
                              if (matchingProduct) {
                                updateItem(index, { size, productId: matchingProduct.id, productName: item.productName });
                              } else {
                                updateItem(index, { size });
                              }
                            } else if (item.productId && labProducts.length > 0) {
                              const currentProduct = labProducts.find(p => p.id === item.productId);
                              if (currentProduct) {
                                const productName = currentProduct.name.split(' - ')[0].trim();
                                const matchingProduct = labProducts.find(p => {
                                  const pName = p.name.split(' - ')[0].trim();
                                  return pName === productName && p.size === size;
                                });
                                if (matchingProduct) {
                                  updateItem(index, { size, productId: matchingProduct.id, productName });
                                } else {
                                  updateItem(index, { size });
                                }
                              } else {
                                updateItem(index, { size });
                              }
                            } else {
                              updateItem(index, { size });
                            }
                          }}
                          onFinishChange={(finish) => {
                            const newFinish = finish as Finish;
                            // Cuando cambia el acabado, buscar el producto que tenga ese nombre + tamaño + acabado
                            if (item.productName && labProducts.length > 0) {
                              const matchingProduct = labProducts.find(p => {
                                const pName = p.name.split(' - ')[0].trim();
                                const matchesSize = p.size === item.size;
                                const matchesFinish = p.acabado === newFinish || (!p.acabado && newFinish === "BRILLO");
                                return pName === item.productName && matchesSize && matchesFinish;
                              }) || labProducts.find(p => {
                                // Fallback: buscar solo por nombre + tamaño
                                const pName = p.name.split(' - ')[0].trim();
                                return pName === item.productName && p.size === item.size;
                              });
                              if (matchingProduct) {
                                updateItem(index, { finish: newFinish, productId: matchingProduct.id, productName: item.productName });
                              } else {
                                updateItem(index, { finish: newFinish });
                              }
                            } else {
                              updateItem(index, { finish: newFinish });
                            }
                          }}
                          onQuantityChange={(quantity) => updateItem(index, { quantity })}
                          tipo="impresa"
                          availableSizes={pricingLoaded ? labPricing.basePrices : undefined}
                          availableProducts={productsLoaded && labProducts.length > 0 ? labProducts.filter(p => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim())).map(p => ({ id: p.id, name: p.name, size: p.size, acabado: p.acabado })) : undefined}
                          productId={item.productId || null}
                          productName={item.productName || null}
                          showProductInHeader
                          showPrintType
                          onProductChange={(productId, productName) => {
                            if (!productId) {
                              updateItem(index, { productId: null, productName: null });
                              return;
                            }
                            const selectedProduct = labProducts.find(p => p.id === productId);
                            if (selectedProduct) {
                              // Obtener el nombre del producto sin tamaño
                              const prodName = productName || selectedProduct.name.split(' - ')[0].trim();
                              // Buscar el primer producto con ese nombre que tenga el tamaño actual o el primero disponible
                              const matchingProduct = labProducts.find(p => {
                                const pName = p.name.split(' - ')[0].trim();
                                return pName === prodName && (p.size === item.size || !item.size);
                              }) || labProducts.find(p => {
                                const pName = p.name.split(' - ')[0].trim();
                                return pName === prodName;
                              });
                              
                              updateItem(index, { 
                                productId: matchingProduct?.id || productId,
                                productName: prodName,
                                // Si el producto tiene un tamaño específico y es diferente al actual, actualizarlo
                                ...(matchingProduct?.size && matchingProduct.size !== item.size ? { size: matchingProduct.size } : {})
                              });
                            }
                          }}
                          tertiaryColor={tertiaryColor}
                        />
                      );
                    })}
                  </div>

                  {/* Resumen de precios */}
                  {pricingLoaded && labPricing.basePrices.length > 0 && (
                    <Card className="space-y-4">
                      <h2 className="text-xl font-medium" style={{ color: fontColor }}>Resumen de tu pedido</h2>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[#6b7280]">Precio base</span>
                          <span style={{ color: fontColor }}>{formatARS(totals.totalBase)}</span>
                        </div>
                        {totals.totalDiscount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-medium" style={{ color: fontColor }}>
                              Total descuento
                            </span>
                            <span className="text-xl font-normal text-[#10b981]">
                              -{formatARS(totals.totalDiscount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-[#6b7280]">Fee de plataforma</span>
                          <span className="text-[#c27b3d]">{formatARS(totals.totalFee)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-[#e5e7eb] gap-2">
                        <span className="text-lg sm:text-xl font-medium" style={{ color: fontColor }}>Total de tu pedido</span>
                        <span className="text-2xl sm:text-3xl font-normal" style={{ color: fontColor }}>
                          {formatARS(totals.totalFinal)}
                        </span>
                      </div>
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

                  <div className="flex justify-end pt-6">
                    <Button
                      variant="primary"
                      onClick={handleContinue}
                      disabled={!pricingLoaded || labPricing.basePrices.length === 0 || totals.totalFinal === 0}
                      accentColor={tertiaryColor}
                      style={{
                        backgroundColor: tertiaryColor,
                        borderColor: tertiaryColor,
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
      <LabPublicFooter lab={lab} />

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

            const productsGrouped = labProducts.reduce((acc, p) => {
              const name = p.name.split(" - ")[0].trim();
              if (isCarnetOrPolaroidProduct(name)) return acc;
              if (!acc[name]) acc[name] = [];
              acc[name].push(p);
              return acc;
            }, {} as Record<string, LabProduct[]>);

            const sizes = item.productName
              ? Array.from(
                  new Set(
                    labProducts
                      .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size)
                      .map((p) => p.size as string)
                  )
                )
              : Array.from(new Set(labPricing.basePrices.map((bp) => bp.size)));

            const finishes = item.productName && item.size
              ? Array.from(
                  new Set(
                    labProducts
                      .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size === item.size && p.acabado)
                      .map((p) => p.acabado as string)
                  )
                )
              : ["Brillo", "Mate"];

            return (
              <div className="grid grid-cols-4 gap-2 items-end">
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
                    {Object.keys(productsGrouped).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Tamaño</label>
                  <Select
                    className="text-[11px] py-1 px-1.5 !min-w-0 bg-white text-[#1a1a1a]"
                    value={item.size}
                    onChange={(e) => updateItem(index, { size: e.target.value })}
                  >
                    {sizes.map((s) => (
                      <option key={s} value={s}>
                        {s} cm
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
                    {(finishes.length ? finishes : ["Brillo", "Mate"]).map((f) => (
                      <option key={f} value={f === "Brillo" ? "BRILLO" : f === "Mate" ? "MATE" : f}>
                        {f}
                      </option>
                    ))}
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
