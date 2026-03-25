"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import OrderItem from "@/components/order/OrderItem";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import { isCarnetOrPolaroidProduct } from "@/lib/print-products";

type UploadedFile = {
  fileKey: string;
  url: string;
  originalName: string;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

type Finish = "BRILLO" | "MATE";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: Finish;
  quantity: number;
  tipo?: "digital" | "impresa";
  productId?: number | null;
  productName?: string | null;
  uploaderId?: number | null;
  uploaderDigitalPriceCents?: number | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

type AlbumPricing = {
  digitalPhotoPriceCents: number | null;
  preferredLabId?: number | null;
  selectedLabId?: number | null;
  profitMarginPercent: number;
  pickupBy?: "CLIENT" | "PHOTOGRAPHER";
  enablePrintedPhotos?: boolean;
  enableDigitalPhotos?: boolean;
  includeDigitalWithPrint?: boolean;
  digitalWithPrintDiscountPercent?: number;
  allowClientLabSelection?: boolean | null;
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

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  secondaryColor: string | null;
  tertiaryColor?: string | null;
  publicPageHandler: string;
} | null;

type OrderPhotosResponse = {
  files: UploadedFile[];
  pricing: AlbumPricing & { photographerId?: number | null };
  photographer: Photographer;
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

// Función para calcular precio unitario final (incluye fee de plataforma para que el cliente vea el precio final)
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

export default function ComprarClient() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const albumId = params.id as string;
  
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [albumPricing, setAlbumPricing] = useState<AlbumPricing | null>(null);
  const [photographer, setPhotographer] = useState<Photographer>(null);
  const [showSlide, setShowSlide] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  // Precios del laboratorio
  const [labPricing, setLabPricing] = useState<LabPricing>({
    basePrices: [],
    discounts: [],
  });
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [labProducts, setLabProducts] = useState<LabProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [usePhotographerPrice, setUsePhotographerPrice] = useState(false);
  const [pricingByUploader, setPricingByUploader] = useState<Record<number, LabPricing>>({});

  // Laboratorio seleccionado por el cliente
  const [clientSelectedLabId, setClientSelectedLabId] = useState<number | null>(null);
  const [availableLabs, setAvailableLabs] = useState<Array<{ id: number; name: string; city?: string | null; province?: string | null; address?: string | null }>>([]);
  const [labSearch, setLabSearch] = useState("");
  const [showLabDropdown, setShowLabDropdown] = useState(false);

  // Configuración masiva
  const [bulkSize, setBulkSize] = useState<string>("");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkProductId, setBulkProductId] = useState<number | null>(null);
  const [bulkProductName, setBulkProductName] = useState<string | null>(null);

  const selectedLab = useMemo(() => {
    if (!clientSelectedLabId) return null;
    return availableLabs.find((lab) => lab.id === clientSelectedLabId) || null;
  }, [availableLabs, clientSelectedLabId]);

  function formatLabInline(lab: { city?: string | null; province?: string | null; address?: string | null }) {
    const parts = [lab.city, lab.province, lab.address].filter(Boolean);
    return parts.length > 0 ? ` — ${parts.join(" - ")}` : "";
  }

  function pickDefaultProduct(currentSize?: string, products: LabProduct[] = labProducts) {
    const filtered = products.filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()));
    if (filtered.length === 0) return null;
    const first = filtered.find((p) => p.isActive) || filtered[0];
    if (!first) return null;
    if (currentSize) {
      const match = filtered.find((p) => {
        const name = p.name.split(" - ")[0].trim();
        const firstName = first.name.split(" - ")[0].trim();
        return name === firstName && p.size === currentSize;
      });
      return match || first;
    }
    return first;
  }

  function normalizeProductName(name: string) {
    return name.split(" - ")[0].trim();
  }

  function findProductForItem(item: Item, products: LabProduct[] = labProducts) {
    if (item.productId) {
      const byId = products.find((p) => p.id === item.productId);
      if (byId) return byId;
    }
    if (item.productName) {
      const normalized = item.productName.trim();
      const finish = item.finish || null;
      const size = item.size || null;
      return (
        products.find((p) => {
          return normalizeProductName(p.name) === normalized &&
            (p.size || null) === size &&
            (p.acabado || null) === finish;
        }) ||
        products.find((p) => {
          return normalizeProductName(p.name) === normalized &&
            (p.size || null) === size;
        }) ||
        products.find((p) => normalizeProductName(p.name) === normalized)
      );
    }
    return undefined;
  }

  function getProductUnitPrice(product?: LabProduct | null) {
    if (!product) return null;
    const retail = product.retailPrice || 0;
    return retail > 0 ? retail : null;
  }

  function getPricingForItem(item: Item) {
    if (item.uploaderId && pricingByUploader[item.uploaderId]) {
      return pricingByUploader[item.uploaderId];
    }
    return labPricing;
  }

  function getItemBasePrice(item: Item) {
    const pricing = getPricingForItem(item);
    const product = findProductForItem(item, pricing.products || []);
    const productPrice = getProductUnitPrice(product);
    if (productPrice && productPrice > 0) return productPrice;
    return getBasePrice(item.size, pricing);
  }

  // Actualizar bulkSize cuando se carguen los precios del laboratorio
  useEffect(() => {
    if (pricingLoaded && labPricing.basePrices.length > 0 && !bulkSize) {
      setBulkSize(labPricing.basePrices[0].size);
    }
  }, [pricingLoaded, labPricing.basePrices, bulkSize]);

  // Calcular cantidad total por tamaño
  const qtyBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const tipo = it.tipo || "digital";
      if (tipo !== "digital" && it.size && it.size !== "DIGITAL") {
        map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
      }
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

  // Calcular totales (impresas: lab + margen fotógrafo; digitales: precio del álbum)
  const totals = useMemo(() => {
    let totalBase = 0;
    let totalFinal = 0;
    const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
    const fallbackDigital = albumPricing?.digitalPhotoPriceCents ?? 0;

    for (const item of items) {
      const tipo = item.tipo || "digital";
      const pricing = getPricingForItem(item);
      const platformFeePct = pricing.platformCommissionPercent ?? 0;
      if (tipo === "digital") {
        const digitalPrice = ((item.uploaderDigitalPriceCents ?? null) != null
          ? Number(item.uploaderDigitalPriceCents)
          : fallbackDigital) || 0;
        totalFinal += totalFromBase(Math.round(digitalPrice), platformFeePct);
        continue;
      }
      if (!item.size || item.size === "DIGITAL" || !pricingLoaded) continue;
      const basePrice = getItemBasePrice(item);
      if (basePrice === 0) continue; // Si el tamaño no existe en el lab, saltar
      const withMargin = Math.round(basePrice * (1 + margin));
      const withFee = totalFromBase(Math.round(withMargin), platformFeePct);
      const qty = Number(item.quantity) || 1;
      totalBase += basePrice * qty;
      totalFinal += withFee * qty;
    }

    const extensionSurchargePercent = albumPricing?.extensionSurchargePercent ?? 0;
    const extensionSurcharge = albumPricing?.extensionPricingActive
      ? Math.round(totalFinal * (extensionSurchargePercent / 100))
      : 0;

    return {
      totalBase,
      totalFinal,
      totalDiscount: 0,
      extensionSurcharge,
      totalWithSurcharge: totalFinal + extensionSurcharge,
    };
  }, [items, qtyBySize, pricingLoaded, albumPricing, labProducts, pricingByUploader]);

  // Cargar fotos del álbum y precios
  useEffect(() => {
    const photoIds = searchParams.get("photoIds");
    if (!photoIds) {
      setError("No se especificaron fotos para comprar");
      return;
    }

    async function loadAlbumPhotos() {
      try {
        const ids = (photoIds ?? "")
          .split(",")
          .map((value) => parseInt(value.trim(), 10))
          .filter(Number.isFinite);
        const res = await fetch(`/api/a/${albumId}/order-photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData?.error || "Error cargando fotos del álbum");
          }
          const text = await res.text();
          throw new Error(text || "Error cargando fotos del álbum");
        }
        const data = (await res.json()) as OrderPhotosResponse;
        
        const files = Array.isArray(data?.files) ? data.files : [];
        if (!files.length) {
          setError("No se encontraron fotos para comprar");
          return;
        }

        // Solo incluir fotos que tengan al menos un formato habilitado (Digital o Impresa)
        const purchasableFiles = files.filter(
          (f) => (f.sellDigital ?? true) || (f.sellPrint ?? true)
        );
        if (!purchasableFiles.length) {
          setError("Ninguna de las fotos seleccionadas está disponible para compra. El fotógrafo debe habilitar al menos Digital o Impresa por foto.");
          return;
        }
        setPhotos(purchasableFiles);

        const uploaderIds = Array.from(
          new Set<number>(
            purchasableFiles
              .map((f) => Number(f.uploaderId))
              .filter((id) => Number.isFinite(id))
          )
        );
        if (uploaderIds.length > 0) {
          try {
            const entries: Array<[number, LabPricing]> = await Promise.all(
              uploaderIds.map(async (id) => {
                const res = await fetch(`/api/public/lab-pricing?photographerId=${id}`, { cache: "no-store" });
                if (!res.ok) {
                  return [
                    id,
                    { basePrices: [], discounts: [], platformCommissionPercent: 0, products: [] },
                  ] as [number, LabPricing];
                }
                const pricing = await res.json();
                return [
                  id,
                  {
                    basePrices: Array.isArray(pricing.basePrices) ? pricing.basePrices : [],
                    discounts: Array.isArray(pricing.discounts) ? pricing.discounts : [],
                    platformCommissionPercent: Number(pricing.platformCommissionPercent ?? 0) || 0,
                    products: Array.isArray(pricing.products)
                      ? pricing.products.filter((p: LabProduct) => p.isActive !== false)
                      : [],
                  },
                ] as [number, LabPricing];
              })
            );
            const map: Record<number, LabPricing> = {};
            entries.forEach(([id, pricing]) => {
              map[id] = pricing;
            });
            setPricingByUploader(map);
            const photographerId = Number(data?.pricing?.photographerId);
            const fallbackId = uploaderIds[0];
            const defaultPricing =
              (Number.isFinite(photographerId) && map[photographerId]) ||
              (Number.isFinite(fallbackId) ? map[fallbackId] : undefined);
            if (defaultPricing) {
              setLabPricing(defaultPricing);
              setLabProducts(defaultPricing.products || []);
              setProductsLoaded(true);
            }
          } catch (e) {
            console.error("Error cargando precios por fotógrafo:", e);
          }
        }
        
        // Guardar información del fotógrafo si está disponible
        if (data?.photographer) {
          setPhotographer(data.photographer);
          sessionStorage.setItem(`album_${albumId}_photographer`, JSON.stringify(data.photographer));
        }
        
        if (data?.pricing) {
          setAlbumPricing(data.pricing);
          sessionStorage.setItem(`album_${albumId}_pricing`, JSON.stringify(data.pricing));
          
          // Cargar lista de laboratorios disponibles
          try {
            const labsRes = await fetch("/api/labs");
            if (labsRes.ok) {
              const labsData = await labsRes.json();
              setAvailableLabs(Array.isArray(labsData) ? labsData : []);
            }
          } catch (e) {
            console.error("Error cargando laboratorios:", e);
          }
          
          setPricingLoaded(true);
        } else {
          setAlbumPricing(null);
          setPricingLoaded(true);
        }
      } catch (e: any) {
        console.error("Error cargando fotos del álbum:", e);
        setError(e?.message || "No se pudieron cargar las fotos del álbum.");
      }
    }

    loadAlbumPhotos();
  }, [albumId, searchParams]);

  // Restaurar fotógrafo desde sessionStorage si existe
  useEffect(() => {
    const savedPhotographer = sessionStorage.getItem(`album_${albumId}_photographer`);
    if (savedPhotographer) {
      try {
        const photographerData = JSON.parse(savedPhotographer);
        setPhotographer(photographerData);
      } catch (e) {
        // Ignorar errores de parsing
      }
    }
  }, [albumId]);

  // Restaurar laboratorio seleccionado desde sessionStorage si existe y está permitido
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    // Solo restaurar si allowClientLabSelection está habilitado
    if (albumPricing?.allowClientLabSelection) {
      const savedLabId = sessionStorage.getItem(`album_${albumId}_clientLabId`);
      if (savedLabId) {
        const labId = Number(savedLabId);
        if (Number.isFinite(labId)) {
          setClientSelectedLabId(labId);
        }
      }
    } else if (albumPricing?.selectedLabId || albumPricing?.preferredLabId) {
      // Si no está permitido, usar siempre el laboratorio del álbum
      const labId = albumPricing.selectedLabId || albumPricing.preferredLabId;
      if (labId) {
        setClientSelectedLabId(labId);
        sessionStorage.setItem(`album_${albumId}_clientLabId`, labId.toString());
      }
    }
  }, [albumId, albumPricing]);

  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!albumPricing) return;
    if (albumPricing.allowClientLabSelection) {
      setUsePhotographerPrice(false);
      return;
    }
    const photographerId = sessionStorage.getItem("photographerId");
    setUsePhotographerPrice(!!photographerId);
  }, [albumPricing]);

  // Cargar precios cuando el cliente cambia el laboratorio seleccionado
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!clientSelectedLabId) return;

    async function loadLabPricing() {
      setPricingLoaded(false);
      try {
        // El cliente siempre usa precio retail (no es fotógrafo)
        const labRes = await fetch(`/api/lab/pricing?labId=${clientSelectedLabId}&isPhotographer=false`, { cache: "no-store" });
        if (labRes.ok) {
          const labData = await labRes.json();
          setLabPricing({
            basePrices: Array.isArray(labData.basePrices) ? labData.basePrices : [],
            discounts: Array.isArray(labData.discounts) ? labData.discounts : [],
          });
          setPricingLoaded(true);
        } else {
          setPricingLoaded(true);
        }
      } catch (e) {
        console.error("Error cargando precios del laboratorio:", e);
        setPricingLoaded(true);
      }
    }

    loadLabPricing();
  }, [clientSelectedLabId]);

  // Cargar productos cuando cambia el laboratorio
  useEffect(() => {
    if (Object.keys(pricingByUploader).length > 0) return;
    if (!clientSelectedLabId) {
      setLabProducts([]);
      setProductsLoaded(false);
      return;
    }
    async function loadProducts() {
      try {
        const res = await fetch(`/api/lab/products?labId=${clientSelectedLabId}`, { cache: "no-store" });
        if (!res.ok) {
          setLabProducts([]);
          setProductsLoaded(true);
          return;
        }
        const data = await res.json();
        const products = Array.isArray(data) ? data.filter((p: LabProduct) => p.isActive) : [];
        setLabProducts(products);
        setProductsLoaded(true);
        if (products.length > 0) {
          setItems((prev) => {
            const updated = prev.map((item) => {
              if ((item.tipo || "digital") === "impresa" && !item.productName) {
                const pick = pickDefaultProduct(item.size, products);
                if (pick) {
                  return {
                    ...item,
                    productId: pick.id,
                    productName: pick.name.split(" - ")[0].trim(),
                    ...(pick.size && pick.size !== item.size ? { size: pick.size } : {}),
                    ...(pick.acabado ? { finish: pick.acabado as Finish } : {}),
                  };
                }
              }
              return item;
            });
            sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (e) {
        console.error("Error cargando productos del laboratorio:", e);
        setLabProducts([]);
        setProductsLoaded(true);
      }
    }
    loadProducts();
  }, [clientSelectedLabId]);

  // Restaurar items guardados o crear desde fotos
  useEffect(() => {
    if (photos.length === 0) return;

    const savedItems = sessionStorage.getItem(`album_${albumId}_items`);
    const defaultSize = labPricing.basePrices.length > 0 ? labPricing.basePrices[0].size : "10x15";
    let defaultTipo: "digital" | "impresa" = "digital";
    if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
      defaultTipo = "digital";
    } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
      defaultTipo = "impresa";
    } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
      defaultTipo = "digital"; // Por defecto digital; el cliente puede cambiar a impresa si quiere
    }

    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems) as Item[];
        const availableKeys = new Set(photos.map((p) => p.fileKey));
        const savedMap = new Map(
          parsed.filter((it: any) => availableKeys.has(it.fileKey)).map((it: any) => [it.fileKey, it])
        );
        const merged = photos.map((photo) => {
          const existing = savedMap.get(photo.fileKey);
          const sd = photo.sellDigital ?? true;
          const sp = photo.sellPrint ?? true;
          let tipo = (existing?.tipo || defaultTipo) as "digital" | "impresa";
          if (tipo === "digital" && !sd) tipo = "impresa";
          if (tipo === "impresa" && !sp) tipo = "digital";
          if (tipo === "digital" && !sd && sp) tipo = "impresa";
          if (tipo === "impresa" && !sp && sd) tipo = "digital";
          const size = tipo === "digital"
            ? "DIGITAL"
            : (existing?.size || defaultSize);
          return {
            fileKey: photo.fileKey,
            previewUrl: photo.url,
            originalName: photo.originalName,
            size,
            finish: (existing?.finish || "BRILLO") as Finish,
            quantity: existing?.quantity ?? 1,
            tipo,
            productId: existing?.productId ?? null,
            productName: existing?.productName ?? null,
            uploaderId: existing?.uploaderId ?? photo.uploaderId ?? null,
            uploaderDigitalPriceCents: existing?.uploaderDigitalPriceCents ?? photo.uploaderDigitalPriceCents ?? null,
            sellDigital: sd,
            sellPrint: sp,
          };
        });
        if (merged.length > 0) {
          setItems(merged);
          return;
        }
      } catch {}
    }

    // Esperar a que se carguen los precios del laboratorio antes de crear items
    if (!pricingLoaded) return;

    // Crear items desde fotos (default según configuración; por foto: sellDigital/sellPrint)
    if (!pricingLoaded) return;
    const fallbackTipo = defaultTipo || "digital";
    const newItems: Item[] = photos.map((photo) => {
      const sd = photo.sellDigital ?? true;
      const sp = photo.sellPrint ?? true;
      let tipo: "digital" | "impresa" = fallbackTipo;
      if (sd && !sp) tipo = "digital";
      else if (!sd && sp) tipo = "impresa";
      return {
        fileKey: photo.fileKey,
        previewUrl: photo.url,
        originalName: photo.originalName,
        size: tipo === "digital" ? "DIGITAL" : defaultSize,
        finish: "BRILLO",
        quantity: 1,
        tipo,
        productId: null,
        productName: null,
        uploaderId: photo.uploaderId ?? null,
        uploaderDigitalPriceCents: photo.uploaderDigitalPriceCents ?? null,
        sellDigital: sd,
        sellPrint: sp,
      };
    });
    setItems(newItems);
  }, [photos, albumId, pricingLoaded, labPricing.basePrices, albumPricing]);

  // Guardar items en sessionStorage cuando cambien
  useEffect(() => {
    if (items.length > 0 && typeof window !== "undefined") {
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(items));
    }
  }, [items, albumId]);

  function handleRemovePhoto(fileKey: string) {
    setItems((prev) => {
      const updated = prev.filter((i) => i.fileKey !== fileKey);
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });

    setSelectedItems((prev) => {
      const index = items.findIndex((i) => i.fileKey === fileKey);
      if (index !== -1) {
        const newSet = new Set(prev);
        newSet.delete(index);
        const adjusted = new Set<number>();
        newSet.forEach((idx) => {
          if (idx < index) adjusted.add(idx);
          else if (idx > index) adjusted.add(idx - 1);
        });
        return adjusted;
      }
      return prev;
    });
  }

  function updateItem(index: number, updates: Partial<Item>) {
    setItems((prev) => {
      const updated = prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });
  }

  function handleDuplicatePhoto(index: number) {
    setItems((prev) => {
      const itemToDuplicate = prev[index];
      if (!itemToDuplicate) return prev;
      
      // Crear una copia del item con un nuevo fileKey único
      const duplicatedItem: Item = {
        ...itemToDuplicate,
        fileKey: `${itemToDuplicate.fileKey}_copy_${Date.now()}`,
      };
      
      // Insertar después del item original
      const updated = [...prev];
      updated.splice(index + 1, 0, duplicatedItem);
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      return updated;
    });
  }

  function toggleItemSelection(index: number) {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  }

  // Calcular precio estimado para configuración masiva (solo impresas)
  const bulkPriceEstimate = useMemo(() => {
    if (!pricingLoaded || labPricing.basePrices.length === 0 || !bulkSize) return { base: 0, discount: 0, final: 0 };
    const impresaCount = items.filter((it) => (it.tipo || "digital") !== "digital").length;
    const selImpresaCount = selectedItems.size > 0
      ? [...selectedItems].filter((idx) => (items[idx]?.tipo || "digital") !== "digital").length
      : 0;
    const bulkProduct =
      bulkProductId ? labProducts.find((p) => p.id === bulkProductId) : undefined;
    const base = getProductUnitPrice(bulkProduct) || getBasePrice(bulkSize, labPricing);
    const estimatedQty = selectedItems.size > 0
      ? bulkQuantity * Math.max(selImpresaCount, 1)
      : bulkQuantity * Math.max(impresaCount, 1);
    const discount = getDiscountPercent(bulkSize, estimatedQty, labPricing);
    const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
    const final = Math.round(base * (1 - discount / 100) * (1 + margin));
    return { base, discount, final };
  }, [bulkSize, bulkQuantity, selectedItems, items, labPricing, pricingLoaded, albumPricing, labProducts, usePhotographerPrice, bulkProductId]);

  function applyBulkToSelected() {
    if (selectedItems.size === 0) {
      setError("Seleccioná al menos una foto para aplicar la configuración");
      return;
    }
    setItems((prev) => {
      const updated = prev.map((item, i) =>
        selectedItems.has(i) && (item.tipo || "digital") !== "digital"
          ? { ...item, productId: bulkProductId, productName: bulkProductName, size: bulkSize, finish: bulkFinish, quantity: bulkQuantity }
          : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      setError(null);
      return updated;
    });
  }

  function applyBulkToAll() {
    setItems((prev) => {
      const updated = prev.map((item) =>
        (item.tipo || "digital") !== "digital"
          ? { ...item, productId: bulkProductId, productName: bulkProductName, size: bulkSize, finish: bulkFinish, quantity: bulkQuantity }
          : item
      );
      sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(updated));
      setError(null);
      return updated;
    });
  }

  function handleVolverAlAlbum() {
    router.push(`/a/${albumId}`);
  }

  function handleContinue() {
    if (items.length === 0) {
      setError("No hay fotos configuradas para comprar");
      return;
    }

    // Preparar items para enviar
    const itemsToSend: any[] = [];
    items.forEach((it) => {
      const t = it.tipo || "digital";

      if (t === "impresa" && albumPricing?.includeDigitalWithPrint && albumPricing?.enableDigitalPhotos) {
        itemsToSend.push({
          fileKey: it.fileKey,
          originalName: it.originalName,
          size: "DIGITAL",
          acabado: "DIGITAL",
          quantity: 1,
          tipo: "digital",
          priceCents: 0,
          includedWithPrint: true,
        });
      }

      itemsToSend.push({
        fileKey: it.fileKey,
        originalName: it.originalName,
        size: t === "digital" ? "DIGITAL" : it.size,
        acabado: t === "digital" ? "DIGITAL" : it.finish,
        quantity: t === "digital" ? 1 : it.quantity,
        tipo: t,
        priceCents: t === "digital" 
          ? Math.round((albumPricing?.digitalPhotoPriceCents ?? 0))
          : (() => {
              if (!it.size || it.size === "DIGITAL" || !pricingLoaded || labPricing.basePrices.length === 0) {
                return 0;
              }
              const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
              const sizeQty = qtyBySize.get(it.size) ?? it.quantity;
              const basePrice = getItemBasePrice(it);
              if (!basePrice) return 0;
              const discountPercent = getDiscountPercent(it.size, sizeQty, labPricing);
              const labUnit = Math.round(basePrice * (1 - discountPercent / 100));
              return Math.round(labUnit * (1 + margin)) * it.quantity;
            })(),
      });
    });

    // Guardar en sessionStorage
    sessionStorage.setItem(`album_${albumId}_items`, JSON.stringify(items));
    sessionStorage.setItem(`album_${albumId}_itemsToSend`, JSON.stringify(itemsToSend));
    if (albumPricing) {
      sessionStorage.setItem(`album_${albumId}_pricing`, JSON.stringify(albumPricing));
    }
    router.push(`/a/${albumId}/comprar/resumen`);
  }

  const slidePhotos = useMemo(() => {
    return items.map((item, index) => ({
      id: item.fileKey,
      src: item.previewUrl,
      alt: item.originalName,
      selected: selectedItems.has(index),
    }));
  }, [items, selectedItems]);

  const itemIndexById = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, index) => {
      map.set(item.fileKey, index);
    });
    return map;
  }, [items]);

  function handleOpenSlide() {
    const firstSelected = selectedItems.size > 0 ? Math.min(...Array.from(selectedItems)) : 0;
    setSlideIndex(Number.isFinite(firstSelected) ? firstSelected : 0);
    setShowSlide(true);
  }

  const albumIdNum = albumId ? parseInt(albumId, 10) : undefined;

  return (
    <ProtectedAlbumWrapper enableProtection={true} albumId={Number.isFinite(albumIdNum) ? albumIdNum : undefined}>
      <>
        {photographer ? (
          <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
        ) : null}
        <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center px-4">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#1a1a1a] mb-2">
              Configurá tu pedido
            </h1>
            <p className="text-[#6b7280] mb-4">
              Elegí tamaño, acabado y cantidad para cada foto. El precio se calcula automáticamente.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleVolverAlAlbum} className="text-sm">
                ← Volver al álbum para modificar selección
              </Button>
              <Button variant="primary" onClick={handleOpenSlide} className="text-sm">
                Ver en modo slide
              </Button>
            </div>
          </div>

          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{error}</p>
            </Card>
          )}

          {albumPricing?.extensionPricingActive && (
            <Card className="bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                ⏱ Este álbum está en período de extensión. Los productos tienen un recargo especial durante estos días.
              </p>
            </Card>
          )}

          {/* Paso 1: selector de laboratorio */}
          {albumPricing?.enablePrintedPhotos && albumPricing?.allowClientLabSelection && (
            <Card className="bg-blue-100 border border-blue-300 ring-2 ring-blue-200 shadow-sm overflow-visible">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-700 text-white">
                    Paso 1
                  </span>
                  <h2 className="text-lg font-semibold text-[#0f172a]">
                    Elegí el laboratorio donde deseas imprimir
                  </h2>
                </div>
                <p className="text-sm text-[#1f2937]">
                  Este paso es obligatorio para calcular precios de impresión y tiempos de entrega.
                </p>
                <div className="relative space-y-2">
                  <div className="relative">
                    <label className="sr-only">Buscar laboratorio</label>
                    <Input
                      type="text"
                      placeholder="Buscar por nombre, ciudad, provincia..."
                      value={labSearch}
                      onChange={(e) => {
                        const search = e.target.value;
                        setLabSearch(search);
                        setShowLabDropdown(true);
                        // Cargar laboratorios: todos si está vacío, filtrados si hay 3+ caracteres
                        const url = search.trim().length >= 3
                          ? `/api/labs?search=${encodeURIComponent(search.trim())}`
                          : "/api/labs";
                        fetch(url)
                          .then((r) => r.json())
                          .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                          .catch(() => {});
                      }}
                      className="w-full"
                      aria-label="Buscar laboratorio"
                      onFocus={() => {
                        setShowLabDropdown(true);
                        if (!labSearch.trim()) {
                          fetch("/api/labs")
                            .then((r) => r.json())
                            .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                            .catch(() => {});
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowLabDropdown(false), 150);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowLabDropdown((prev) => !prev);
                        if (!labSearch.trim()) {
                          fetch("/api/labs")
                            .then((r) => r.json())
                            .then((data) => setAvailableLabs(Array.isArray(data) ? data : []))
                            .catch(() => {});
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280]"
                      aria-label="Mostrar laboratorios"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {showLabDropdown && availableLabs.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-72 overflow-auto rounded-2xl border border-[#eef2f7] bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
                        {availableLabs.map((lab) => (
                          <button
                            key={lab.id}
                            type="button"
                            onClick={() => {
                              setClientSelectedLabId(lab.id);
                              setLabSearch(lab.name);
                              sessionStorage.setItem(`album_${albumId}_clientLabId`, String(lab.id));
                              setShowLabDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                              clientSelectedLabId === lab.id ? "bg-[#fdecec]" : "hover:bg-[#f8fafc]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fdecec] text-[#c27b3d]">
                                🏭
                              </span>
                              <div>
                                <div className="font-medium text-[#1a1a1a]">{lab.name}</div>
                                {formatLabInline(lab) && (
                                  <div className="text-xs text-[#6b7280]">{formatLabInline(lab)}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showLabDropdown && labSearch.trim() && availableLabs.length === 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-[#e5e7eb] bg-white shadow-lg px-3 py-2 text-sm text-[#6b7280]">
                        No se encontraron laboratorios.
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#1f2937]">
                  {clientSelectedLabId
                    ? "Los precios se calcularán según el laboratorio seleccionado."
                    : "Seleccioná un laboratorio para ver los precios de impresión."}
                </p>
                {selectedLab && (
                  <div className="mt-2 text-xs text-[#374151]">
                    <div className="font-medium text-[#1a1a1a]">{selectedLab.name}</div>
                    <div className="mt-1 space-y-1">
                      {(selectedLab.city || selectedLab.province) && (
                        <div>📍 {selectedLab.city || ""}{selectedLab.city && selectedLab.province ? ", " : ""}{selectedLab.province || ""}</div>
                      )}
                      {selectedLab.address && (
                        <div>🏠 {selectedLab.address}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="pt-2">
            <h3 className="text-sm font-semibold text-[#111827]">Consejos de compra</h3>
          </div>

          {/* Tip de ahorro */}
          {pricingLoaded && (maxDiscounts.d50 > 0 || maxDiscounts.d100 > 0) && (
            <Card className="bg-[#fafafa] border-[#eee]">
              <p className="text-sm text-[#374151]">
                <span className="font-medium">💡 Tip de ahorro:</span>{" "}
                {maxDiscounts.d50 > 0 && maxDiscounts.d100 > 0 ? (
                  <>
                    con este laboratorio, si pedís 50+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d50}% OFF</strong>. Y si pedís 100+ copias del mismo
                    tamaño, tenés hasta <strong>{maxDiscounts.d100}% OFF</strong>.
                  </>
                ) : maxDiscounts.d50 > 0 ? (
                  <>
                    con este laboratorio, si pedís 50+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d50}% OFF</strong>.
                  </>
                ) : (
                  <>
                    con este laboratorio, si pedís 100+ copias del mismo tamaño tenés hasta{" "}
                    <strong>{maxDiscounts.d100}% OFF</strong>.
                  </>
                )}
              </p>
            </Card>
          )}

          {albumPricing?.includeDigitalWithPrint && (
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

          {albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos && (
            <Card className="bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-900">
                🔥 Recomendado: elegí <strong>Impresas</strong> para tener tus fotos en papel. Podés combinar con digital si querés.
              </p>
            </Card>
          )}

          {items.length > 0 && (
            <>
              {albumPricing?.enablePrintedPhotos && selectedItems.size <= 1 && (
                <p className="text-sm text-[#6b7280]">
                  Seleccioná más de una fotografía para hacer una configuración masiva.
                </p>
              )}
              {albumPricing?.enablePrintedPhotos && selectedItems.size > 1 && (
                <Card className="bg-[#f6f6f6] border border-[#e5e5e5]">
                  <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">
                    Configuración rápida
                  </h2>
                  <p className="text-sm text-[#6b7280] mb-4">
                    Aplicá producto, tamaño, acabado y cantidad de forma masiva.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {productsLoaded && labProducts.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
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
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Tamaño
                      </label>
                      <Select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)} disabled={!pricingLoaded || labPricing.basePrices.length === 0}>
                        {pricingLoaded && labPricing.basePrices.length > 0 ? (
                          labPricing.basePrices.map((bp) => (
                            <option key={bp.size} value={bp.size}>
                              {bp.size} cm
                            </option>
                          ))
                        ) : (
                          <option value="">Cargando...</option>
                        )}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
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
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
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
                </Card>
              )}

              <p className="text-sm text-[#6b7280]">
                Hacé clic en cada foto para incluirla o excluirla de tu pedido. Las que lleven el distintivo «Incluida en el pedido» forman parte del pedido y podés aplicar la configuración masiva a esas.
              </p>

              <div className="space-y-6">
                {items.map((item, index) => {
                  // Determinar tipo inicial basado en configuraciones del álbum
                  let tipo = item.tipo;
                  if (!tipo) {
                    if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
                      tipo = "digital";
                    } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
                      tipo = "impresa";
                    } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
                      tipo = "impresa";
                    } else {
                      tipo = "digital"; // Default
                    }
                  }
                  const pricingForItem = getPricingForItem(item);
                  const margin = (albumPricing?.profitMarginPercent ?? 0) / 100;
                  const platformFeePctItem = pricingForItem.platformCommissionPercent ?? 0;
                  const digitalUnit = ((item.uploaderDigitalPriceCents ?? null) != null
                    ? Number(item.uploaderDigitalPriceCents)
                    : (albumPricing?.digitalPhotoPriceCents ?? 0));
                  const showTipoChoice =
                    ((item.sellDigital ?? true) || (item.sellPrint ?? true)) &&
                    (albumPricing?.enableDigitalPhotos || albumPricing?.enablePrintedPhotos) &&
                    ((albumPricing?.digitalPhotoPriceCents ?? 0) > 0 || albumPricing?.enablePrintedPhotos);

                  let basePrice = 0;
                  let finalUnitPrice = 0;
                  let subtotal = 0;
                  let qty = Number(item.quantity) || 1;

                  if (tipo === "digital") {
                    finalUnitPrice = digitalUnit > 0 ? totalFromBase(digitalUnit, platformFeePctItem) : 0;
                    subtotal = finalUnitPrice * 1;
                    qty = 1;
                  } else {
                    if (pricingLoaded && item.size && item.size !== "DIGITAL") {
                      basePrice = getItemBasePrice(item);
                      if (basePrice > 0) {
                        const withMargin = Math.round(basePrice * (1 + margin));
                        finalUnitPrice = totalFromBase(Math.round(withMargin), platformFeePctItem);
                        subtotal = (Number.isFinite(finalUnitPrice) && Number.isFinite(qty) ? finalUnitPrice * qty : 0);
                      } else {
                        finalUnitPrice = 0;
                        subtotal = 0;
                      }
                    } else {
                      finalUnitPrice = 0;
                      subtotal = 0;
                    }
                  }

                  return (
                    <OrderItem
                      key={item.fileKey}
                      id={item.fileKey}
                      previewUrl={item.previewUrl}
                      originalName={item.originalName}
                      size={item.size}
                      finish={item.finish}
                      quantity={tipo === "digital" ? 1 : item.quantity}
                      basePrice={basePrice}
                      discountPercent={0}
                      finalUnitPrice={finalUnitPrice}
                      subtotal={subtotal}
                      selected={selectedItems.has(index)}
                      onSelect={() => toggleItemSelection(index)}
                      onRemove={() => handleRemovePhoto(item.fileKey)}
                      onDuplicate={() => handleDuplicatePhoto(index)}
                      onOpenSlide={() => {
                        setSlideIndex(index);
                        setShowSlide(true);
                      }}
                      onSizeChange={(size) => updateItem(index, { size })}
                      onFinishChange={(finish) => updateItem(index, { finish: finish as Finish })}
                      onQuantityChange={(q) => updateItem(index, { quantity: q })}
                      tipo={tipo}
                      sellDigital={item.sellDigital ?? true}
                      sellPrint={item.sellPrint ?? true}
                      onTipoChange={showTipoChoice ? (t) => {
                        if (t === "digital" && (item.sellDigital ?? true)) {
                          updateItem(index, { tipo: "digital", quantity: 1 });
                        } else if (t === "impresa" && (item.sellPrint ?? true)) {
                          let validSize = item.size && item.size !== "DIGITAL" ? item.size : "10x15";
                          if (pricingLoaded && pricingForItem.basePrices.length > 0) {
                            const sizeExists = pricingForItem.basePrices.find((bp) => bp.size === validSize);
                            if (!sizeExists) {
                              validSize = pricingForItem.basePrices[0].size;
                            }
                          }
                          const pick = pickDefaultProduct(validSize);
                          updateItem(index, {
                            tipo: "impresa",
                            size: pick?.size || validSize,
                            ...(pick?.acabado ? { finish: pick.acabado as Finish } : {}),
                            ...(pick ? { productId: pick.id, productName: pick.name.split(" - ")[0].trim() } : {}),
                          });
                        }
                      } : undefined}
                      availableSizes={pricingLoaded ? pricingForItem.basePrices : undefined}
                      availableProducts={pricingForItem.products && pricingForItem.products.length > 0
                        ? pricingForItem.products
                            .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                            .map((p) => ({ id: p.id, name: p.name, size: p.size, acabado: p.acabado }))
                        : undefined}
                      productId={item.productId || null}
                      productName={item.productName || null}
                      showProductInHeader
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
                      tertiaryColor={photographer?.tertiaryColor}
                    />
                  );
                })}
              </div>

              {/* Mensaje de retiro de fotos impresas */}
              {albumPricing?.pickupInfo && items.some((item) => (item.tipo || "digital") === "impresa") && (
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
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-[#e5e7eb] gap-2">
                    <span className="text-lg sm:text-xl font-medium text-[#1a1a1a]">Total de tu pedido</span>
                    <span className="text-2xl sm:text-3xl font-normal text-[#1a1a1a]">
                      {formatARS(totals.totalWithSurcharge)}
                    </span>
                  </div>
                  {albumPricing?.extensionPricingActive && totals.extensionSurcharge > 0 && (
                    <div className="flex justify-between items-center text-sm text-amber-700">
                      <span>Recargo por extensión de álbum</span>
                      <span className="font-medium">+{formatARS(totals.extensionSurcharge)}</span>
                    </div>
                  )}
                </div>
              </Card>

              <div className="flex justify-between items-center pt-6">
                <Button variant="secondary" onClick={handleVolverAlAlbum}>
                  ← Volver al álbum
                </Button>
                <Button variant="primary" onClick={handleContinue}>
                  Continuar al resumen
                </Button>
              </div>
            </>
          )}

          {items.length === 0 && !error && (
            <Card>
              <p className="text-[#6b7280] text-center">Cargando fotos...</p>
            </Card>
          )}
        </div>
      </div>
    </section>
    {showSlide && slidePhotos.length > 0 && (
      <PhotoSlideViewer
        photos={slidePhotos}
        initialIndex={slideIndex}
        onClose={() => setShowSlide(false)}
        onPhotoSelect={(id) => {
          const index = itemIndexById.get(id);
          if (index !== undefined) {
            toggleItemSelection(index);
          }
        }}
        renderControls={(_, index) => {
          const item = items[index];
          if (!item) return null;

          let tipo = item.tipo;
          if (!tipo) {
            const sd = item.sellDigital ?? true;
            const sp = item.sellPrint ?? true;
            if (sd && !sp) tipo = "digital";
            else if (!sd && sp) tipo = "impresa";
            else if (albumPricing?.enableDigitalPhotos && !albumPricing?.enablePrintedPhotos) {
              tipo = "digital";
            } else if (albumPricing?.enablePrintedPhotos && !albumPricing?.enableDigitalPhotos) {
              tipo = "impresa";
            } else if (albumPricing?.enablePrintedPhotos && albumPricing?.enableDigitalPhotos) {
              tipo = "digital"; // Por defecto digital
            } else {
              tipo = "digital";
            }
          }

          const showTipoChoice =
            ((item.sellDigital ?? true) || (item.sellPrint ?? true)) &&
            (albumPricing?.enableDigitalPhotos || albumPricing?.enablePrintedPhotos) &&
            ((albumPricing?.digitalPhotoPriceCents ?? 0) > 0 || albumPricing?.enablePrintedPhotos);

          const productNames = Array.from(
            new Set(
              labProducts
                .filter((p) => !isCarnetOrPolaroidProduct(p.name.split(" - ")[0].trim()))
                .map((p) => p.name.split(" - ")[0].trim())
            )
          );

          const sizes = labProducts.length > 0 && item.productName
            ? Array.from(
                new Set(
                  labProducts
                    .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size)
                    .map((p) => p.size as string)
                )
              )
            : Array.from(new Set(labPricing.basePrices.map((bp) => bp.size)));

          const finishes = labProducts.length > 0 && item.productName && item.size
            ? Array.from(
                new Set(
                  labProducts
                    .filter((p) => p.name.split(" - ")[0].trim() === item.productName && p.size === item.size && p.acabado)
                    .map((p) => p.acabado as string)
                )
              )
            : ["BRILLO", "MATE"];

          return (
            <div className="grid grid-cols-4 gap-2 items-end text-black">
              {labProducts.length > 0 && (
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
                    <option value="">Seleccionar producto</option>
                    {productNames.map((name) => (
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
                  disabled={tipo === "digital"}
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
                  disabled={tipo === "digital"}
                >
                  {finishes.map((f) => (
                    <option key={f} value={f}>
                      {f === "BRILLO" ? "Brillo" : f === "MATE" ? "Mate" : f}
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
                  disabled={tipo === "digital"}
                />
              </div>
              {showTipoChoice && (
                <div className="col-span-4 flex items-center justify-end gap-2 mt-1">
                  <span className="text-[11px] text-[#6b7280]">Formato:</span>
                  {(item.sellPrint ?? true) && albumPricing?.enablePrintedPhotos && (
                    <button
                      className={`px-2 py-1 rounded-md text-[11px] ${tipo === "impresa" ? "bg-[#c27b3d] text-white" : "bg-white text-[#374151]"}`}
                      onClick={() => updateItem(index, { tipo: "impresa" })}
                    >
                      Impresa
                    </button>
                  )}
                  {(item.sellDigital ?? true) && albumPricing?.enableDigitalPhotos && (
                    <button
                      className={`px-2 py-1 rounded-md text-[11px] ${tipo === "digital" ? "bg-[#111827] text-white" : "bg-white text-[#374151]"}`}
                      onClick={() => updateItem(index, { tipo: "digital", quantity: 1 })}
                    >
                      Digital
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    )}
        {photographer ? (
          <PhotographerFooter photographer={photographer} />
        ) : null}
      </>
    </ProtectedAlbumWrapper>
  );
}
