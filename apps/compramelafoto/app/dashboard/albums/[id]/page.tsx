"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import UploadZone from "@/components/photo/UploadZone";
import { useUploadProgress } from "@/contexts/UploadProgressContext";
import PhotoGrid from "@/components/photo/PhotoGrid";
import Cropper, { Area, Point } from "react-easy-crop";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Tabs from "@/components/ui/Tabs";

function buildQrUrl(url: string) {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encoded}`;
}

function buildOriginalUrl(originalKey?: string | null): string {
  if (!originalKey) return "";
  if (originalKey.startsWith("http://") || originalKey.startsWith("https://")) {
    return originalKey;
  }
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    "";
  if (!publicBase) return originalKey;
  const cleanKey = originalKey.replace(/^\//, "");
  return `${publicBase.replace(/\/$/, "")}/${cleanKey}`;
}

type Photo = {
  id: number;
  previewUrl: string;
  originalKey: string;
  createdAt: string;
  canDelete?: boolean;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

type AlbumProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  mockupUrl: string | null;
  minFotos: number;
  maxFotos: number;
  requiresDesign: boolean;
  suggestionText: string | null;
};

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  publicSlug: string;
  coverPhotoId: number | null;
  createdAt: string;
  expirationExtensionDays?: number | null;
  isOwner?: boolean;
  digitalPhotoPriceCents?: number | null;
  photographerHandler?: string | null;
  hiddenPhotosEnabled?: boolean;
  hiddenSelfieRetentionDays?: number | null;
  preCompraCloseAt?: string | null;
  requireClientApproval?: boolean;
  photos: Photo[];
};

export default function DashboardAlbumDetailPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params?.id ? parseInt(String(params.id)) : null;

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [failedFiles, setFailedFiles] = useState<Array<{ file: File; error: string }>>([]);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);

  // Estados para editar álbum
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [digitalPhotoPrice, setDigitalPhotoPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [minDigitalPhotoPrice, setMinDigitalPhotoPrice] = useState<number | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [showCoverCrop, setShowCoverCrop] = useState(false);
  const [coverCropPhoto, setCoverCropPhoto] = useState<Photo | null>(null);
  const [coverCrop, setCoverCrop] = useState<Point>({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedArea, setCoverCroppedArea] = useState<Area | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [interestedList, setInterestedList] = useState<Array<{ id: number; email: string; name?: string | null; lastName?: string | null; whatsapp?: string | null; createdAt: string; hasBiometric: boolean; hasSelfie: boolean }>>([]);
  const [interestedLoading, setInterestedLoading] = useState(false);
  const [albumSales, setAlbumSales] = useState<{ inheritFromPhotographer: boolean; allowedCapabilities: string[]; disabledCapabilities: string[] } | null>(null);
  const [albumSalesLoading, setAlbumSalesLoading] = useState(false);
  const [albumSalesSaving, setAlbumSalesSaving] = useState(false);
  // Pre-venta
  const [precompraProducts, setPrecompraProducts] = useState<AlbumProduct[]>([]);
  const [precompraProductsLoading, setPrecompraProductsLoading] = useState(false);
  const [precompraCloseAt, setPrecompraCloseAt] = useState<string>("");
  const [precompraRequireApproval, setPrecompraRequireApproval] = useState(false);
  const [precompraSaving, setPrecompraSaving] = useState(false);
  const [showPrecompraProductModal, setShowPrecompraProductModal] = useState(false);
  const [editingPrecompraProduct, setEditingPrecompraProduct] = useState<AlbumProduct | null>(null);
  const [precompraProductForm, setPrecompraProductForm] = useState({ name: "", description: "", price: "", minFotos: "1", maxFotos: "1", requiresDesign: false, suggestionText: "", mockupUrl: "" });
  const [precompraProductSaving, setPrecompraProductSaving] = useState(false);
  const [mockupUploading, setMockupUploading] = useState(false);
  const mockupFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [configTab, setConfigTab] = useState<"fotos" | "ventas" | "preventa">("fotos");

  const uploadProgress = useUploadProgress();

  const ALBUM_CAPABILITIES = ["DIGITAL_SALES", "PRINT_SALES", "RETOUCH_PRO", "EXPRESS_DELIVERY", "STORAGE_EXTEND"] as const;
  const CAP_LABELS: Record<string, string> = {
    DIGITAL_SALES: "Ventas digitales",
    PRINT_SALES: "Impresiones",
    RETOUCH_PRO: "Retoque pro",
    EXPRESS_DELIVERY: "Entrega express",
    STORAGE_EXTEND: "Extensión de almacenamiento",
  };
  const CAP_DESCRIPTIONS: Record<string, string> = {
    DIGITAL_SALES: "El cliente puede comprar la foto en formato digital (descarga).",
    PRINT_SALES: "El cliente puede pedir impresiones por tamaño; se usa tu lista de precios y opción de entrega.",
    RETOUCH_PRO: "Se ofrece retoque profesional como add-on por foto al comprar digital o impresa.",
    EXPRESS_DELIVERY: "Cobro extra por envío o entrega prioritario en pedidos de impresiones.",
    STORAGE_EXTEND: "El cliente puede pagar por más tiempo de disponibilidad del álbum (cuando tiene vencimiento).",
  };

  const shareLink = useMemo(() => {
    if (shareUrl) return shareUrl;
    if (album?.publicSlug) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}/a/${album.publicSlug}`;
    }
    return "";
  }, [shareUrl, album?.publicSlug]);

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const albumPublicUrl = album?.publicSlug ? `${appBaseUrl}/a/${album.publicSlug}` : "";
  const photographerUrl = album?.photographerHandler ? `${appBaseUrl}/${album.photographerHandler}` : "";
  const albumBuyUrl = album ? `${appBaseUrl}/a/${album.id}/comprar` : "";

  useEffect(() => {
    if (!albumId || isNaN(albumId)) {
      setError("ID de álbum inválido");
      setLoading(false);
      return;
    }
    
    // Verificar si hay un link de álbum nuevo guardado
    const newAlbumUrl = sessionStorage.getItem("newAlbumUrl");
    const newAlbumTitle = sessionStorage.getItem("newAlbumTitle");
    if (newAlbumUrl) {
      setShareUrl(newAlbumUrl);
      setShowShareModal(true);
      sessionStorage.removeItem("newAlbumUrl");
      sessionStorage.removeItem("newAlbumTitle");
    }
    
    loadAlbum();
  }, [albumId]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (typeof data?.minDigitalPhotoPrice === "number") {
          setMinDigitalPhotoPrice(data.minDigitalPhotoPrice);
        }
      } catch (err) {
        console.warn("Error cargando configuración:", err);
      }
    }
    loadConfig();
  }, []);

  async function loadPrecompraProducts() {
    if (!albumId) return;
    setPrecompraProductsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/precompra-products`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.products)) setPrecompraProducts(data.products);
    } finally {
      setPrecompraProductsLoading(false);
    }
  }

  useEffect(() => {
    if (!albumId || isNaN(albumId)) return;
    loadPrecompraProducts();
  }, [albumId]);

  async function savePrecompraSettings() {
    if (!albumId) return;
    setPrecompraSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preCompraCloseAt: precompraCloseAt ? new Date(precompraCloseAt).toISOString() : null,
          requireClientApproval: precompraRequireApproval,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "Error al guardar");
      }
      const data = await res.json();
      setAlbum((a) => (a ? { ...a, preCompraCloseAt: data.preCompraCloseAt ?? a.preCompraCloseAt, requireClientApproval: data.requireClientApproval ?? a.requireClientApproval } : a));
    } catch (err: any) {
      setError(err?.message || "Error al guardar pre-venta");
    } finally {
      setPrecompraSaving(false);
    }
  }

  function openAddPrecompraProduct() {
    setEditingPrecompraProduct(null);
    setPrecompraProductForm({ name: "", description: "", price: "0", minFotos: "1", maxFotos: "1", requiresDesign: false, suggestionText: "", mockupUrl: "" });
    setShowPrecompraProductModal(true);
  }

  function openEditPrecompraProduct(p: AlbumProduct) {
    setEditingPrecompraProduct(p);
    setPrecompraProductForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      minFotos: String(p.minFotos),
      maxFotos: String(p.maxFotos),
      requiresDesign: p.requiresDesign,
      suggestionText: p.suggestionText || "",
      mockupUrl: p.mockupUrl || "",
    });
    setShowPrecompraProductModal(true);
  }

  async function savePrecompraProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!albumId) return;
    const name = precompraProductForm.name.trim();
    if (!name) {
      setError("El nombre del producto es obligatorio");
      return;
    }
    setPrecompraProductSaving(true);
    setError(null);
    try {
      if (editingPrecompraProduct) {
        const res = await fetch(`/api/dashboard/albums/${albumId}/precompra-products/${editingPrecompraProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: precompraProductForm.description.trim() || null,
            price: Math.max(0, Math.round(Number(precompraProductForm.price) || 0)),
            minFotos: Math.max(0, Math.min(100, Number(precompraProductForm.minFotos) ?? 1)),
            maxFotos: Math.max(1, Math.min(100, Number(precompraProductForm.maxFotos) ?? 1)),
            requiresDesign: precompraProductForm.requiresDesign,
            suggestionText: precompraProductForm.suggestionText.trim() || null,
            mockupUrl: precompraProductForm.mockupUrl.trim() || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d?.error || "Error al actualizar");
        }
        const data = await res.json();
        setPrecompraProducts((list) => list.map((x) => (x.id === editingPrecompraProduct.id ? data.product : x)));
      } else {
        const res = await fetch(`/api/dashboard/albums/${albumId}/precompra-products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: precompraProductForm.description.trim() || null,
            price: Math.max(0, Math.round(Number(precompraProductForm.price) || 0)),
            minFotos: Math.max(0, Math.min(100, Number(precompraProductForm.minFotos) ?? 1)),
            maxFotos: Math.max(1, Math.min(100, Number(precompraProductForm.maxFotos) ?? 1)),
            requiresDesign: precompraProductForm.requiresDesign,
            suggestionText: precompraProductForm.suggestionText.trim() || null,
            mockupUrl: precompraProductForm.mockupUrl.trim() || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          const msg = d?.detail ? `${d.error ?? "Error al crear"}: ${d.detail}` : (d?.error || "Error al crear");
          throw new Error(msg);
        }
        const data = await res.json();
        setPrecompraProducts((list) => [...list, data.product]);
      }
      setShowPrecompraProductModal(false);
      setEditingPrecompraProduct(null);
    } catch (err: any) {
      setError(err?.message || "Error al guardar producto");
    } finally {
      setPrecompraProductSaving(false);
    }
  }

  async function deletePrecompraProduct(productId: number) {
    if (!albumId || !confirm("¿Eliminar este producto de pre-venta? Los pedidos ya hechos no se modifican.")) return;
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/precompra-products/${productId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "Error al eliminar");
      }
      setPrecompraProducts((list) => list.filter((x) => x.id !== productId));
    } catch (err: any) {
      setError(err?.message || "Error al eliminar");
    }
  }

  useEffect(() => {
    if (!albumId || isNaN(albumId)) return;
    let cancelled = false;
    setAlbumSalesLoading(true);
    fetch(`/api/dashboard/albums/${albumId}/sales-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAlbumSales({ inheritFromPhotographer: data.inheritFromPhotographer !== false, allowedCapabilities: data.allowedCapabilities ?? [], disabledCapabilities: data.disabledCapabilities ?? [] });
      })
      .catch(() => { if (!cancelled) setAlbumSales(null); })
      .finally(() => { if (!cancelled) setAlbumSalesLoading(false); });
    return () => { cancelled = true; };
  }, [albumId]);

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showRetryModal) {
          handleCancelRetry();
        }
        if (showShareModal) {
          setShowShareModal(false);
        }
        if (showCoverCrop && !coverSaving) {
          setShowCoverCrop(false);
          setCoverCropPhoto(null);
        }
      }
    }
    if (showRetryModal || showShareModal || showCoverCrop) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showRetryModal, showShareModal, showCoverCrop, coverSaving]);

  useEffect(() => {
    async function loadMpStatus() {
      try {
        const res = await fetch("/api/dashboard/photographer", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (typeof data?.mpConnected === "boolean") {
          setMpConnected(data.mpConnected);
        }
      } catch (err) {
        console.warn("Error cargando estado de Mercado Pago:", err);
      }
    }
    loadMpStatus();
  }, []);

  async function loadInterested() {
    if (!albumId) return;
    setInterestedLoading(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/interested`, { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setInterestedList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Error cargando interesados:", err);
    } finally {
      setInterestedLoading(false);
    }
  }

  async function loadAlbum() {
    if (!albumId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setError("Álbum no encontrado");
          setLoading(false);
          return;
        }
        throw new Error(data?.error || data?.detail || "Error cargando álbum");
      }
      setAlbum(data);
      setSelectedPhotoIds(new Set());
      // Inicializar valores de edición
      setTitle(data.title || "");
      setLocation(data.location || "");
      setEventDate(data.eventDate ? new Date(data.eventDate).toISOString().split("T")[0] : "");
      setDigitalPhotoPrice(data.digitalPhotoPriceCents != null ? String(data.digitalPhotoPriceCents) : "");
      setPrecompraCloseAt(data.preCompraCloseAt ? new Date(data.preCompraCloseAt).toISOString().slice(0, 16) : "");
      setPrecompraRequireApproval(Boolean(data.requireClientApproval));
      // Establecer shareUrl si no está ya establecido
      if (!shareUrl && data.publicSlug) {
        setShareUrl(`${typeof window !== "undefined" ? window.location.origin : ""}/a/${data.publicSlug}`);
      }
      loadInterested();
    } catch (err: any) {
      console.error("Error cargando álbum:", err);
      setError(err.message || "Error cargando álbum");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!albumId) return;

    if (!confirm("¿Estás seguro de que querés eliminar esta foto?")) {
      return;
    }
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error eliminando foto");
      }

      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      await loadAlbum();
    } catch (err: any) {
      console.error("Error eliminando foto:", err);
      setError(err.message || "Error eliminando foto");
    }
  }

  function handlePhotoSelect(photoId: string, canDelete?: boolean) {
    if (canDelete === false) return;
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!albumId || !album || selectedPhotoIds.size === 0) return;
    const toDelete = Array.from(selectedPhotoIds).filter((id) => {
      const p = album.photos.find((ph) => String(ph.id) === id);
      return p && p.canDelete !== false;
    });
    if (toDelete.length === 0) {
      setError("Ninguna de las fotos seleccionadas se puede eliminar.");
      return;
    }
    if (!confirm(`¿Eliminar ${toDelete.length} foto${toDelete.length !== 1 ? "s" : ""} seleccionada${toDelete.length !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingSelected(true);
    setError(null);
    try {
      for (const id of toDelete) {
        const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error eliminando foto");
        }
      }
      setSelectedPhotoIds(new Set());
      await loadAlbum();
    } catch (err: any) {
      console.error("Error eliminando fotos:", err);
      setError(err?.message || "Error eliminando fotos");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handlePhotoSellOptionChange(photoId: string, field: "sellDigital" | "sellPrint", value: boolean) {
    if (!albumId || !album) return;
    const id = parseInt(photoId, 10);
    if (isNaN(id)) return;
    const prev = album.photos.find((p) => p.id === id);
    if (!prev) return;
    const newDigital = field === "sellDigital" ? value : (prev.sellDigital ?? true);
    const newPrint = field === "sellPrint" ? value : (prev.sellPrint ?? true);
      if (!newDigital && !newPrint) {
      setError("Al menos una opción (Digital o Impresa) debe estar habilitada para cada foto. Si no deseás vender esta fotografía en ningún formato, por favor eliminála del álbum.");
      return;
    }
    setAlbum((a) =>
      !a
        ? a
        : {
            ...a,
            photos: a.photos.map((p) =>
              p.id === id ? { ...p, sellDigital: newDigital, sellPrint: newPrint } : p
            ),
          }
    );
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellDigital: newDigital, sellPrint: newPrint }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }
    } catch (err: any) {
      setAlbum((a) =>
        !a
          ? a
          : {
              ...a,
              photos: a.photos.map((p) =>
                p.id === id ? { ...p, sellDigital: prev.sellDigital ?? true, sellPrint: prev.sellPrint ?? true } : p
              ),
            }
      );
      setError(err?.message || "Error al guardar opción de venta");
    }
  }

  async function handleSetCover(photoId: string) {
    if (!albumId || !album) return;
    const photo = album.photos.find((p) => String(p.id) === String(photoId));
    if (!photo) return;
    setCoverCropPhoto(photo);
    setCoverCrop({ x: 0, y: 0 });
    setCoverZoom(1);
    setCoverCroppedArea(null);
    setShowCoverCrop(true);
  }

  const handleCoverCropComplete = useCallback((croppedArea: Area) => {
    setCoverCroppedArea(croppedArea);
  }, []);

  async function handleSaveCoverCrop() {
    if (!albumId || !coverCropPhoto) return;
    if (!coverCroppedArea) {
      setError("Ajustá el recorte antes de guardar la portada.");
      return;
    }
    setCoverSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/cover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: coverCropPhoto.id,
          crop: coverCrop,
          zoom: coverZoom,
          aspect: 1,
          cropArea: coverCroppedArea,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error estableciendo portada");
      }

      // Recargar el álbum
      await loadAlbum();
      setShowCoverCrop(false);
      setCoverCropPhoto(null);
    } catch (err: any) {
      console.error("Error estableciendo portada:", err);
      setError(err.message || "Error estableciendo portada");
    } finally {
      setCoverSaving(false);
    }
  }

  // Función auxiliar para crear un identificador único de archivo
  function getFileId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  // Pequeña pausa entre subidas para no saturar servidor/conexión (evita timeouts tras 5-6 fotos)
  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Función para subir un archivo individual (3 pasos: init → PUT a R2 → complete). Retorna el ID de la foto creada.
  async function uploadSingleFile(file: File): Promise<number> {
    if (!albumId) throw new Error("No hay álbum seleccionado");

    let initData: { uploadUrl?: string; key?: string; error?: string } = {};

    try {
      const initRes = await fetch(
        `/api/dashboard/albums/${albumId}/photos/direct-upload/init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        }
      );
      initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        throw new Error(initData?.error || "No se pudo iniciar la subida");
      }
    } catch (e: any) {
      if (e?.message && e.message !== "Failed to fetch") throw e;
      throw new Error(
        "Paso 1 (iniciar subida): error de red. Revisá tu conexión o que la app esté respondiendo."
      );
    }

    try {
      const uploadRes = await fetch(initData.uploadUrl!, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("No se pudo subir el archivo a almacenamiento");
      }
    } catch (e: any) {
      if (e?.message && !e.message.includes("Paso ") && e.message !== "Failed to fetch") throw e;
      const isNetwork = !e?.message || e.message === "Failed to fetch" || (e?.name === "TypeError" && String(e?.message).toLowerCase().includes("fetch"));
      if (isNetwork) {
        throw new Error(
          "Paso 2 (subir a almacenamiento): falló la conexión. Suele ser CORS del bucket R2: en Cloudflare R2 → tu bucket → CORS, permití tu origen y método PUT."
        );
      }
      throw e;
    }

    try {
      const completeRes = await fetch(
        `/api/dashboard/albums/${albumId}/photos/direct-upload/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: initData.key,
            originalName: file.name,
          }),
        }
      );
      const completeData = await completeRes.json().catch(() => ({})) as { photo?: { id: number }; error?: string };
      if (!completeRes.ok) {
        throw new Error(completeData?.error || "Error procesando foto");
      }
      return completeData.photo?.id ?? 0;
    } catch (e: any) {
      if (e?.message && !e.message.includes("Paso ") && e.message !== "Failed to fetch") throw e;
      const isNetwork = !e?.message || e.message === "Failed to fetch" || (e?.name === "TypeError" && String(e?.message).toLowerCase().includes("fetch"));
      if (isNetwork) {
        throw new Error(
          "Paso 3 (procesar foto en el servidor): error de red o timeout. Probá de nuevo; si sigue, el servidor puede estar tardando mucho."
        );
      }
      throw e;
    }
  }

  // Función para eliminar fotos del álbum (rollback en caso de error)
  async function deletePhotosById(photoIds: number[]): Promise<void> {
    if (!albumId) return;
    for (const photoId of photoIds) {
      try {
        await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, { method: "DELETE" });
      } catch (e) {
        console.warn("No se pudo eliminar foto al hacer rollback:", photoId, e);
      }
    }
  }

  // Función principal de subida: sube una por una. Si alguna falla, se guardan las que sí subieron
  // y se ofrece reintentar las fallidas (evita perder todo por timeout en foto 6).
  async function handleFilesSelected(files: FileList, retryFailed: boolean = false) {
    if (!albumId) return;
    if (mpConnected === false) {
      setError("Debés conectar Mercado Pago para subir fotos.");
      return;
    }

    setError(null);

    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
    const maxBytes = maxMb * 1024 * 1024;

    const fileList = retryFailed ? failedFiles.map((f) => f.file) : Array.from(files);
    if (fileList.length === 0) {
      if (retryFailed) {
        setFailedFiles([]);
        setShowRetryModal(false);
      }
      return;
    }

    // 1. Validar tamaño ANTES de iniciar: si alguna supera 10MB, rechazar todas y no subir ninguna
    const tooLarge = fileList.filter((f) => f.size > maxBytes);
    if (tooLarge.length > 0) {
      const names = tooLarge.map((f) => f.name).join(", ");
      setError(
        `Una o más fotos superan el límite de ${maxMb} MB y no se subió ninguna: ${names}`
      );
      if (retryFailed) {
        setFailedFiles([]);
        setShowRetryModal(false);
      }
      return;
    }

    setUploading(true);
    setUploadTotal(fileList.length);
    setUploadDone(0);
    uploadProgress?.startUpload(fileList.length, album?.title ?? null);

    let newFailed: Array<{ file: File; error: string }> = [];
    let successCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        // Pausa entre subidas para no saturar (reduce timeouts tras varias fotos)
        if (i > 0) await delay(400);

        let lastError: string | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const photoId = await uploadSingleFile(file);
            if (photoId) successCount++;
            lastError = null;
            break;
          } catch (error: any) {
            lastError =
              error?.message === "Failed to fetch" ||
              (error?.name === "TypeError" && String(error?.message || "").toLowerCase().includes("fetch"))
                ? "Error de red. Revisá tu conexión."
                : error?.message || "Error desconocido al subir archivo";
            if (attempt === 0) await delay(800); // Pausa antes de reintentar
          }
        }
        if (lastError) {
          newFailed.push({ file, error: lastError });
        }
        setUploadDone(i + 1);
        uploadProgress?.updateProgress(i + 1);
      }

      if (newFailed.length > 0) {
        setFailedFiles(newFailed);
        setShowRetryModal(true);
        setError(
          successCount > 0
            ? `Se subieron ${successCount} foto(s). ${newFailed.length} no se pudieron subir. Podés reintentarlas.`
            : `No se pudo subir ninguna foto. ${newFailed[0]?.error || ""}`
        );
      } else {
        setFailedFiles([]);
        setShowRetryModal(false);
        setError(null);
        if (uploadSessionId && albumId) {
          sessionStorage.removeItem(`upload-success-${albumId}-${uploadSessionId}`);
        }
        setUploadSessionId(null);
      }

      await loadAlbum();
    } catch (err: any) {
      console.error("Error subiendo fotos:", err);
      setError(err?.message || "Error subiendo fotos.");
      if (newFailed.length > 0) {
        setFailedFiles(newFailed);
        setShowRetryModal(true);
      }
    } finally {
      setUploading(false);
      uploadProgress?.finishUpload();
    }
  }

  // Función para reintentar archivos fallidos
  async function handleRetryFailed() {
    if (failedFiles.length === 0) return;
    const filesToRetry = failedFiles.map(f => f.file);
    setShowRetryModal(false);
    setFailedFiles([]);
    // Crear un FileList simulado desde los archivos fallidos
    const dataTransfer = new DataTransfer();
    filesToRetry.forEach(file => dataTransfer.items.add(file));
    await handleFilesSelected(dataTransfer.files, true);
  }

  // Función para cancelar retry y limpiar estado
  function handleCancelRetry() {
    setShowRetryModal(false);
    setFailedFiles([]);
    if (uploadSessionId && albumId) {
      const storageKey = `upload-success-${albumId}-${uploadSessionId}`;
      sessionStorage.removeItem(storageKey);
    }
    setUploadSessionId(null);
  }

  async function handleSaveAlbum() {
    if (!albumId) return;

    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }

    const minPrice = minDigitalPhotoPrice ? minDigitalPhotoPrice : 0;
    if (
      digitalPhotoPrice &&
      !isNaN(parseFloat(digitalPhotoPrice)) &&
      parseFloat(digitalPhotoPrice) < minPrice
    ) {
      setError(`El precio digital debe ser mayor o igual a $${minPrice.toFixed(2)}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          location: location.trim() || null,
          eventDate: eventDate || null,
          digitalPhotoPriceCents: digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice))
            ? Math.round(parseFloat(digitalPhotoPrice) * 100)
            : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error guardando cambios");
      }

      // Mantener las fotos actuales (con sellDigital/sellPrint y previewUrl); el PATCH solo devuelve photos: [{ id }]
      setAlbum((prev) => ({
        ...data,
        photos: prev?.photos ?? data.photos ?? [],
      }));
      setEditing(false);
      setError(null);
    } catch (err: any) {
      console.error("Error guardando álbum:", err);
      setError(err.message || "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando álbum...</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!album) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto">
              <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                <p className="text-[#ef4444]">{error || "Álbum no encontrado"}</p>
              </Card>
              <div className="mt-4 text-center">
                <Link href="/dashboard/albums" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline">
                  ← Volver a Mis Álbumes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const extensionDays = album.expirationExtensionDays ?? 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const photoTimes = album.photos
    .map((photo) => new Date(photo.createdAt).getTime())
    .filter((time) => Number.isFinite(time));
  const earliestPhotoTime = photoTimes.length > 0 ? Math.min(...photoTimes) : null;
  const baseDate = earliestPhotoTime !== null
    ? new Date(earliestPhotoTime)
    : new Date(album.createdAt);
  const visibleUntil = new Date(baseDate.getTime() + (30 + extensionDays) * dayMs);

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
            {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              {editing ? (
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-2xl font-medium mb-2"
                  disabled={saving}
                />
              ) : (
                <h1
                  style={{
                    fontSize: "clamp(24px, 5vw, 32px)",
                    fontWeight: "normal",
                    color: "#1a1a1a",
                    marginBottom: "8px",
                  }}
                >
                  {album.title}
                </h1>
              )}
              {!editing && (
                <div className="text-[#6b7280] text-sm space-y-1">
                  {album.location && <p>📍 {album.location}</p>}
                  {album.eventDate && (
                    <p>📅 {new Date(album.eventDate).toLocaleDateString("es-AR")}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Botón de editar con icono de lápiz - redirige a la lista con modal abierto */}
              <button
                type="button"
                onClick={() => router.push(`/dashboard/albums?edit=${album.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f8f9fa] hover:text-[#1a1a1a] transition-colors"
                title="Editar álbum (configuración completa)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Editar álbum</span>
              </button>
              {/* Link a vista del cliente */}
              <div className="flex items-center gap-3 ml-2 pl-3 border-l border-[#e5e7eb]">
                <a
                  href={`/a/${album.publicSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#c27b3d] hover:text-[#a6692f] hover:bg-[#c27b3d]/10 rounded-lg transition-colors"
                  title="Ver cómo se ve el álbum para el cliente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Vista del cliente</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? `${window.location.origin}/a/${album.publicSlug}` : "";
                    setShareUrl(url);
                    setShowShareModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#6b7280] hover:text-[#1a1a1a] hover:bg-[#f8f9fa] rounded-lg transition-colors"
                  title="Copiar enlace del álbum"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copiar enlace</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs de configuración del álbum */}
          <Tabs
            tabs={[
              { id: "fotos", label: "Fotos" },
              { id: "ventas", label: "Ventas" },
              { id: "preventa", label: "Pre-venta" },
            ]}
            activeTab={configTab}
            onTabChange={(id) => setConfigTab(id as "fotos" | "ventas" | "preventa")}
          >
            {configTab === "fotos" && null}
            {configTab === "ventas" && album && albumSalesLoading && (
              <p className="text-sm text-[#6b7280] py-4">Cargando configuración de ventas…</p>
            )}
            {configTab === "ventas" && album && !albumSalesLoading && (
              <Card className="space-y-3">
                <h2 className="text-lg font-medium text-[#1a1a1a]">Ventas en este álbum</h2>
                <p className="text-sm text-[#6b7280]">
                  Por defecto se hereda tu configuración general. Podés personalizar o desactivar tipos de venta solo en este álbum.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="album-sales-mode"
                      checked={albumSales?.inheritFromPhotographer !== false}
                      onChange={() => {
                        setAlbumSales((prev) => prev ? { ...prev, inheritFromPhotographer: true, disabledCapabilities: prev.disabledCapabilities } : { inheritFromPhotographer: true, allowedCapabilities: [], disabledCapabilities: [] });
                      }}
                    />
                    <span className="text-sm">Heredar de mi configuración general</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="album-sales-mode"
                      checked={albumSales?.inheritFromPhotographer === false}
                      onChange={() => {
                        setAlbumSales((prev) => prev ? { ...prev, inheritFromPhotographer: false, allowedCapabilities: prev.allowedCapabilities.length ? prev.allowedCapabilities : [...ALBUM_CAPABILITIES] } : { inheritFromPhotographer: false, allowedCapabilities: [...ALBUM_CAPABILITIES], disabledCapabilities: [] });
                      }}
                    />
                    <span className="text-sm">Personalizar para este álbum</span>
                  </label>
                </div>
                {albumSales?.inheritFromPhotographer === true && (
                  <div className="pl-4 border-l-2 border-[#e5e7eb] space-y-3">
                    <p className="text-xs text-[#6b7280] mb-2">Desactivar en este álbum:</p>
                    {ALBUM_CAPABILITIES.map((cap) => (
                      <label key={cap} className="flex gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={albumSales.disabledCapabilities.includes(cap)}
                          onChange={(e) => {
                            setAlbumSales((prev) => {
                              if (!prev) return prev;
                              const next = e.target.checked ? [...prev.disabledCapabilities, cap] : prev.disabledCapabilities.filter((c) => c !== cap);
                              return { ...prev, disabledCapabilities: next };
                            });
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <span className="text-sm font-medium text-[#1a1a1a]">{CAP_LABELS[cap] ?? cap}</span>
                          <p className="text-xs text-[#6b7280] mt-0.5">{CAP_DESCRIPTIONS[cap] ?? ""}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {albumSales?.inheritFromPhotographer === false && (
                  <div className="pl-4 border-l-2 border-[#e5e7eb] space-y-3">
                    <p className="text-xs text-[#6b7280] mb-2">Permitir en este álbum:</p>
                    {ALBUM_CAPABILITIES.map((cap) => (
                      <label key={cap} className="flex gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={albumSales.allowedCapabilities.includes(cap)}
                          onChange={(e) => {
                            setAlbumSales((prev) => {
                              if (!prev) return prev;
                              const next = e.target.checked ? [...prev.allowedCapabilities, cap] : prev.allowedCapabilities.filter((c) => c !== cap);
                              return { ...prev, allowedCapabilities: next };
                            });
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <span className="text-sm font-medium text-[#1a1a1a]">{CAP_LABELS[cap] ?? cap}</span>
                          <p className="text-xs text-[#6b7280] mt-0.5">{CAP_DESCRIPTIONS[cap] ?? ""}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={albumSalesSaving || !albumSales}
                  onClick={async () => {
                    if (!albumId || !albumSales) return;
                    setAlbumSalesSaving(true);
                    try {
                      const res = await fetch(`/api/dashboard/albums/${albumId}/sales-settings`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(albumSales),
                      });
                      if (res.ok) setAlbumSales(await res.json());
                    } finally {
                      setAlbumSalesSaving(false);
                    }
                  }}
                >
                  {albumSalesSaving ? "Guardando…" : "Guardar ventas del álbum"}
                </Button>
              </Card>
            )}
            {configTab === "preventa" && album && (
              <Card className="space-y-4">
                <h2 className="text-lg font-medium text-[#1a1a1a]">Pre-venta</h2>
                <p className="text-sm text-[#6b7280]">
                  Los clientes eligen productos del catálogo (ej. pack de fotos, fotolibro) y cargan la selfie de cada niño. Podés definir fecha de cierre y si querés aprobar cada pedido antes de producirlo.
                </p>
                <p className="text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Link
                    href="/admin/plantillas/disenador"
                    className="text-[#c27b3d] hover:underline font-medium"
                  >
                    Ir al Diseñador de plantillas →
                  </Link>
                </p>
                <div className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[#1a1a1a]">Fecha de cierre (dejar vacío = pre-venta desactivada)</span>
                    <Input
                      type="datetime-local"
                      value={precompraCloseAt}
                      onChange={(e) => setPrecompraCloseAt(e.target.value)}
                      className="max-w-xs"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={precompraRequireApproval}
                      onChange={(e) => setPrecompraRequireApproval(e.target.checked)}
                    />
                    <span className="text-sm">Requerir aprobación del cliente antes de producir (ej. que elija sus fotos)</span>
                  </label>
                  <Button variant="secondary" size="sm" disabled={precompraSaving} onClick={savePrecompraSettings}>
                    {precompraSaving ? "Guardando…" : "Guardar configuración"}
                  </Button>
                </div>
                {precompraCloseAt && album.publicSlug && (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6b7280] mb-1">Link del catálogo para compartir con clientes</p>
                      <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/album/${album.publicSlug}/preventa`} target="_blank" rel="noreferrer" className="text-sm text-[#c27b3d] hover:underline break-all">
                        /album/{album.publicSlug}/preventa
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/album/${album.publicSlug}/preventa`;
                        navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="shrink-0 px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb]"
                    >
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#1a1a1a]">Productos del catálogo</span>
                    <Button variant="secondary" size="sm" onClick={openAddPrecompraProduct}>
                      Agregar producto
                    </Button>
                  </div>
                  {precompraProductsLoading ? (
                    <p className="text-sm text-[#6b7280] py-2">Cargando productos…</p>
                  ) : precompraProducts.length === 0 ? (
                    <p className="text-sm text-[#6b7280] py-2">No hay productos. Agregá al menos uno para que el catálogo esté disponible.</p>
                  ) : (
                    <ul className="space-y-2">
                      {precompraProducts.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-4 py-2 px-3 border border-[#e5e7eb] rounded-lg">
                          <div className="min-w-0">
                            <span className="font-medium text-[#1a1a1a]">{p.name}</span>
                            <span className="text-sm text-[#6b7280] ml-2">${p.price.toLocaleString("es-AR")}</span>
                            {p.requiresDesign && <span className="text-xs text-amber-700 ml-2">(con diseño)</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => openEditPrecompraProduct(p)} className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline">
                              Editar
                            </button>
                            <button type="button" onClick={() => deletePrecompraProduct(p.id)} className="text-sm text-red-600 hover:text-red-700 underline">
                              Eliminar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )}
          </Tabs>

          {/* Contenido tab Fotos */}
          {configTab === "fotos" && (
            <>
          {editing && (
            <Card className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Ubicación
                </label>
                <Input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Buenos Aires, Argentina"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Fecha del evento
                </label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Precio por foto digital (opcional, ARS)
                </label>
                <Input
                  type="number"
                  min={minDigitalPhotoPrice ? minDigitalPhotoPrice : 0}
                  step="0.01"
                  placeholder={minDigitalPhotoPrice ? `Mínimo: $${minDigitalPhotoPrice.toFixed(2)}` : "Ej: 500"}
                  value={digitalPhotoPrice}
                  onChange={(e) => setDigitalPhotoPrice(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-[#6b7280] mt-1">
                  Si no lo configurás, los clientes solo podrán comprar impresas.
                </p>
                {minDigitalPhotoPrice && (
                  <p className="text-xs text-[#6b7280] mt-1">
                    Precio mínimo: ${minDigitalPhotoPrice.toFixed(2)}
                  </p>
                )}
              </div>
            </Card>
          )}

          {error && (
            <Card className="w-full min-w-0 bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444] text-sm break-words">{error}</p>
            </Card>
          )}

          {/* Barra de progreso en la sección de fotos */}
          {uploading && uploadTotal > 0 && (
            <Card className="border-2 border-[#c27b3d]/30 bg-[#fef7f3]">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <p className="text-base font-semibold text-[#1a1a1a]">
                    Subiendo {uploadDone} de {uploadTotal} fotos
                  </p>
                  <span className="text-sm font-medium text-[#6b7280] shrink-0">
                    {Math.min(100, Math.round((uploadDone / uploadTotal) * 100))}% · {uploadTotal - uploadDone} restante{uploadTotal - uploadDone !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Barra de progreso horizontal grande y visible */}
                <div className="h-6 w-full rounded-full bg-[#e5e7eb] overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.min(100, Math.round((uploadDone / uploadTotal) * 100))}%`,
                      backgroundColor: "#c27b3d",
                    }}
                  >
                    {/* Efecto de brillo animado */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      style={{ 
                        animation: "shimmer 1.5s infinite",
                        backgroundSize: "200% 100%",
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Zona de subida */}
          <Card className="border-2 border-dashed border-[#e5e7eb]">
            <UploadZone
              onFilesSelected={handleFilesSelected}
              uploading={uploading}
              uploadedCount={uploadDone}
              totalCount={uploadTotal}
              disabled={mpConnected === false}
            />
            <p className="text-xs text-[#6b7280] mt-4 text-center">
              Las fotos se muestran con marca de agua dinámica para protección.
              La versión en alta calidad sin marca de agua se entrega cuando el cliente compra.
            </p>
            {mpConnected === false && (
              <p className="text-xs text-amber-700 mt-2 text-center">
                Conectá Mercado Pago para habilitar la carga de fotos.
              </p>
            )}
          </Card>

          {/* Grid de fotos */}
          {album.photos.length > 0 ? (
            (() => {
              const gridPhotos = album.photos
                .map((p) => ({
                  id: String(p.id),
                  src: `/api/photos/${p.id}/view?albumId=${album.id}&mode=preview`,
                  alt: `Foto #${p.id}`,
                  canDelete: p.canDelete,
                  sellDigital: p.sellDigital ?? true,
                  sellPrint: p.sellPrint ?? true,
                  selected: selectedPhotoIds.has(String(p.id)),
                  isCover: album.coverPhotoId === p.id,
                }))
                .filter((p) => p.src);

              if (gridPhotos.length === 0) {
                return (
                  <Card>
                    <div className="text-center py-12 text-[#6b7280]">
                      <p>No se pudieron cargar las vistas previas.</p>
                      <p className="text-sm mt-2">Verificá `NEXT_PUBLIC_R2_PUBLIC_URL` en tu `.env.local`.</p>
                    </div>
                  </Card>
                );
              }

              const canDeleteAny = album.photos.some((p) => p.canDelete !== false);
              const deletablePhotoIds = album.photos
                .filter((p) => p.canDelete !== false)
                .map((p) => String(p.id));
              const allDeletableSelected =
                deletablePhotoIds.length > 0 && deletablePhotoIds.every((id) => selectedPhotoIds.has(id));

              return (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-xl font-medium text-[#1a1a1a]">
                      Fotos ({gridPhotos.length})
                    </h2>
                    {canDeleteAny && (
                      <div className="flex items-center gap-2">
                        {!allDeletableSelected && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedPhotoIds(new Set(deletablePhotoIds))}
                            disabled={deletingSelected}
                          >
                            Seleccionar todas
                          </Button>
                        )}
                        {selectedPhotoIds.size > 0 ? (
                          <>
                            <span className="text-sm text-[#6b7280]">
                              {selectedPhotoIds.size} seleccionada{selectedPhotoIds.size !== 1 ? "s" : ""}
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedPhotoIds(new Set())}
                              disabled={deletingSelected}
                            >
                              Deseleccionar
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleDeleteSelected}
                              disabled={deletingSelected}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingSelected ? "Eliminando..." : `Eliminar seleccionadas (${selectedPhotoIds.size})`}
                            </Button>
                          </>
                        ) : (
                          !allDeletableSelected && (
                            <span className="text-sm text-[#6b7280]">
                              Hacé clic en las fotos para seleccionarlas y eliminarlas en lote
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <PhotoGrid
                    photos={gridPhotos}
                    onPhotoSelect={canDeleteAny ? (id) => handlePhotoSelect(id, album.photos.find((p) => String(p.id) === id)?.canDelete) : undefined}
                    onPhotoRemove={handleDeletePhoto}
                    onPhotoSetCover={album.isOwner ? handleSetCover : undefined}
                    onPhotoSellOptionChange={album.isOwner ? handlePhotoSellOptionChange : undefined}
                  />
                </div>
              );
            })()
          ) : (
            <Card>
              <div className="text-center py-12 text-[#6b7280]">
                <p>No hay fotos en este álbum todavía.</p>
                <p className="text-sm mt-2">Arrastrá fotos o hacé click en la zona de arriba para comenzar.</p>
              </div>
            </Card>
          )}

          {/* QR y links útiles */}
          {album && (
            <Card className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[#1a1a1a]">QR y links útiles</h2>
                <p className="text-sm text-[#6b7280]">
                  Compartí el álbum, tu landing y el link directo a compra.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {albumPublicUrl && (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center gap-3">
                    <img src={buildQrUrl(albumPublicUrl)} alt="QR álbum público" className="w-40 h-40" />
                    <p className="text-xs text-[#6b7280] text-center">Álbum público</p>
                    <a className="text-xs text-[#c27b3d] hover:underline" href={albumPublicUrl} target="_blank" rel="noreferrer">
                      {albumPublicUrl}
                    </a>
                  </div>
                )}
                {photographerUrl ? (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center gap-3">
                    <img src={buildQrUrl(photographerUrl)} alt="QR landing fotógrafo" className="w-40 h-40" />
                    <p className="text-xs text-[#6b7280] text-center">Landing fotógrafo</p>
                    <a className="text-xs text-[#c27b3d] hover:underline" href={photographerUrl} target="_blank" rel="noreferrer">
                      {photographerUrl}
                    </a>
                  </div>
                ) : (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center justify-center text-center text-xs text-[#6b7280]">
                    No hay landing configurada
                  </div>
                )}
                {albumBuyUrl && (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center gap-3">
                    <img src={buildQrUrl(albumBuyUrl)} alt="QR compra de fotos" className="w-40 h-40" />
                    <p className="text-xs text-[#6b7280] text-center">Compra de fotos</p>
                    <a className="text-xs text-[#c27b3d] hover:underline" href={albumBuyUrl} target="_blank" rel="noreferrer">
                      {albumBuyUrl}
                    </a>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Interesados */}
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Interesados</h2>
            <p className="text-sm text-[#6b7280]">
              Personas que se registraron para recibir avisos. Enviá el link del álbum por WhatsApp si no vieron el email.
            </p>
            {interestedLoading ? (
              <p className="text-[#6b7280] py-4">Cargando interesados...</p>
            ) : interestedList.length === 0 ? (
              <p className="text-[#6b7280] py-4">No hay interesados registrados en este álbum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Nombre</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Email</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">WhatsApp</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Acciones</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestedList.map((i) => (
                      <tr key={i.id} className="border-b border-[#e5e7eb] hover:bg-[#f9fafb]">
                        <td className="py-2 px-2">
                          {[i.name, i.lastName].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="py-2 px-2">{i.email}</td>
                        <td className="py-2 px-2">{i.whatsapp || "-"}</td>
                        <td className="py-2 px-2">
                          <a
                            href={i.whatsapp
                              ? (() => {
                                  const c = (i.whatsapp || "").replace(/\D/g, "");
                                  const n = c.startsWith("0") ? "54" + c.slice(1) : c.startsWith("54") ? c : "54" + c.replace(/^0/, "");
                                  return `https://wa.me/${n}?text=${encodeURIComponent(`Hola! Las fotos de tu álbum ya están listas. Podés verlas acá: ${albumPublicUrl || ""}`)}`;
                                })()
                              : "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                              i.whatsapp
                                ? "border-green-200 bg-green-50 hover:bg-green-100 text-green-700"
                                : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed pointer-events-none"
                            }`}
                            title={i.whatsapp ? "Enviar link del álbum por WhatsApp" : "Sin WhatsApp"}
                            aria-disabled={!i.whatsapp}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </a>
                        </td>
                        <td className="py-2 px-2 text-[#6b7280]">
                          {new Date(i.createdAt).toLocaleDateString("es-AR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          </>
          )}

          {/* Modal producto pre-venta */}
          {showPrecompraProductModal && (
            <>
              <div className="fixed inset-0 bg-black/60 z-40" onClick={() => !precompraProductSaving && setShowPrecompraProductModal(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl min-w-[min(100%,28rem)] space-y-4 max-h-[90vh] overflow-y-auto">
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">
                    {editingPrecompraProduct ? "Editar producto" : "Nuevo producto"}
                  </h2>
                  <form onSubmit={savePrecompraProduct} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Nombre *</label>
                      <Input
                        value={precompraProductForm.name}
                        onChange={(e) => setPrecompraProductForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ej: Pack 10 fotos 10×15"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Descripción (opcional)</label>
                      <textarea
                        value={precompraProductForm.description}
                        onChange={(e) => setPrecompraProductForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Breve descripción para el cliente"
                        className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm min-h-[80px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Precio (ARS)</label>
                        <Input
                          type="number"
                          min={0}
                          value={precompraProductForm.price}
                          onChange={(e) => setPrecompraProductForm((f) => ({ ...f, price: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Min / max fotos</label>
                        <div className="flex flex-row gap-2 items-center">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={precompraProductForm.minFotos}
                            onChange={(e) => setPrecompraProductForm((f) => ({ ...f, minFotos: e.target.value }))}
                            className="w-16 shrink-0"
                          />
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={precompraProductForm.maxFotos}
                            onChange={(e) => setPrecompraProductForm((f) => ({ ...f, maxFotos: e.target.value }))}
                            className="w-16 shrink-0"
                          />
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={precompraProductForm.requiresDesign}
                        onChange={(e) => setPrecompraProductForm((f) => ({ ...f, requiresDesign: e.target.checked }))}
                      />
                      <span className="text-sm">Requiere diseño (fotolibro, díptico, etc.)</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Texto sugerido / instrucciones (opcional)</label>
                      <Input
                        value={precompraProductForm.suggestionText}
                        onChange={(e) => setPrecompraProductForm((f) => ({ ...f, suggestionText: e.target.value }))}
                        placeholder="Ej: Elegí las fotos para la tapa"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Imagen descriptiva (opcional)</label>
                      <p className="text-xs text-[#6b7280] mb-2">
                        Se muestra en el catálogo de pre-venta. Se guarda hasta 30 días después del cierre de la pre-venta.
                      </p>
                      {precompraProductForm.mockupUrl ? (
                        <div className="flex items-start gap-3">
                          <img
                            src={precompraProductForm.mockupUrl}
                            alt="Vista previa"
                            className="w-24 h-24 rounded-lg object-cover border border-[#e5e7eb]"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => mockupFileInputRef.current?.click()}
                              disabled={mockupUploading}
                              className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline text-left"
                            >
                              {mockupUploading ? "Subiendo…" : "Cambiar imagen"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrecompraProductForm((f) => ({ ...f, mockupUrl: "" }))}
                              disabled={mockupUploading}
                              className="text-sm text-red-600 hover:text-red-700 underline text-left"
                            >
                              Quitar imagen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            ref={mockupFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !albumId) return;
                              setMockupUploading(true);
                              setError(null);
                              try {
                                const form = new FormData();
                                form.set("file", file);
                                const res = await fetch(`/api/dashboard/albums/${albumId}/precompra-products/upload-mockup`, { method: "POST", body: form });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data?.error || "Error al subir");
                                setPrecompraProductForm((f) => ({ ...f, mockupUrl: data.mockupUrl }));
                              } catch (err: any) {
                                setError(err?.message || "Error al subir la imagen");
                              } finally {
                                setMockupUploading(false);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={mockupUploading}
                            onClick={() => mockupFileInputRef.current?.click()}
                          >
                            {mockupUploading ? "Subiendo…" : "Subir imagen"}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e7eb]">
                      <Button type="button" variant="secondary" onClick={() => !precompraProductSaving && setShowPrecompraProductModal(false)} disabled={precompraProductSaving}>
                        Cancelar
                      </Button>
                      <Button type="submit" variant="primary" disabled={precompraProductSaving}>
                        {precompraProductSaving ? "Guardando…" : editingPrecompraProduct ? "Guardar cambios" : "Crear producto"}
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            </>
          )}

          {/* Modal de recorte de portada */}
          {showCoverCrop && coverCropPhoto && album && (
            <>
              <div
                className="fixed inset-0 bg-black/60 z-40"
                onClick={() => {
                  if (!coverSaving) {
                    setShowCoverCrop(false);
                    setCoverCropPhoto(null);
                  }
                }}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-5xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">Recortar portada</h2>
                    <button
                      onClick={() => {
                        if (!coverSaving) {
                          setShowCoverCrop(false);
                          setCoverCropPhoto(null);
                        }
                      }}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative w-full h-[420px] bg-black/90 rounded-lg overflow-hidden">
                    <Cropper
                      image={buildOriginalUrl(coverCropPhoto.originalKey)}
                      crop={coverCrop}
                      zoom={coverZoom}
                      aspect={1}
                      onCropChange={setCoverCrop}
                      onZoomChange={setCoverZoom}
                      onCropComplete={handleCoverCropComplete}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-[#6b7280]">Zoom</label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={coverZoom}
                      onChange={(e) => setCoverZoom(Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e7eb]">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!coverSaving) {
                          setShowCoverCrop(false);
                          setCoverCropPhoto(null);
                        }
                      }}
                      disabled={coverSaving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveCoverCrop}
                      disabled={coverSaving}
                    >
                      {coverSaving ? "Guardando..." : "Guardar portada"}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Modal para compartir link */}
          {showShareModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowShareModal(false)}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-2xl min-w-[min(100%,20rem)] mx-auto">
                  <Card className="w-full space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-[#1a1a1a]">
                      {shareUrl && shareUrl.includes("newAlbumUrl") ? "¡Álbum creado!" : "Compartir álbum"}
                    </h2>
                    <button
                      onClick={() => setShowShareModal(false)}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {/* Vista previa del álbum */}
                    {album && album.photos && album.photos.length > 0 && (
                      <div className="w-full mb-4">
                        {(() => {
                          // Buscar la foto de portada o usar la primera foto
                          const coverPhoto = album.coverPhotoId 
                            ? album.photos.find((p: Photo) => p.id === album.coverPhotoId)
                            : null;
                          const displayPhoto = coverPhoto || album.photos[0];
                          const photoUrl = `/api/photos/${displayPhoto.id}/view?albumId=${album.id}&mode=preview`;
                          if (!photoUrl) {
                            return (
                              <div className="w-full h-64 md:h-96 bg-[#f3f4f6] rounded-lg flex items-center justify-center text-[#6b7280] text-sm">
                                No se pudo cargar la vista previa
                              </div>
                            );
                          }

                          return (
                            <div className="w-full h-64 md:h-96 bg-[#f3f4f6] rounded-lg overflow-hidden flex items-center justify-center">
                              <img
                                src={photoUrl}
                                alt={album.title || "Vista previa del álbum"}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <p className="text-sm text-[#6b7280]">
                      {shareUrl && shareUrl.includes("newAlbumUrl") 
                        ? "¡Tu álbum fue creado exitosamente! Copiá este link para compartirlo:"
                        : "Copiá este link para compartir el álbum con tus clientes:"}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        onClick={async () => {
                          const urlToCopy = shareLink;
                          if (urlToCopy && navigator.clipboard) {
                            try {
                              await navigator.clipboard.writeText(urlToCopy);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            } catch (err) {
                              console.error("Error copiando link:", err);
                            }
                          }
                        }}
                        variant="primary"
                        className="whitespace-nowrap"
                      >
                        {copied ? "✓ Copiado" : "Copiar"}
                      </Button>
                    </div>
                    {shareLink && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-[200px,1fr] gap-4 items-center">
                        <div className="w-[200px] h-[200px] mx-auto rounded-lg border border-[#e5e7eb] bg-white flex items-center justify-center">
                          <img
                            src={buildQrUrl(shareLink)}
                            alt="QR del álbum"
                            className="w-[180px] h-[180px]"
                          />
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm text-[#6b7280]">
                            Descargá el QR y compartí el álbum en cualquier diseño.
                          </p>
                          <a href={buildQrUrl(shareLink)} download="qr-album.png">
                            <Button variant="primary" className="text-sm">
                              Descargar QR
                            </Button>
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#e5e7eb]">
                      <a
                        href={shareLink || (album ? `/a/${album.publicSlug}` : "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#c27b3d] hover:underline"
                      >
                        Abrir álbum en nueva pestaña →
                      </a>
                    </div>
                  </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* Modal de error para archivos fallidos */}
          {showRetryModal && failedFiles.length > 0 && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={handleCancelRetry}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-3xl min-w-[min(100%,20rem)] mx-auto">
                  <Card className="w-full min-w-0 space-y-4 max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start border-b border-[#e5e7eb] pb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-[#1a1a1a]">
                          Error en la subida
                        </h2>
                        <p className="text-sm text-[#6b7280] mt-1">
                          {failedFiles.length} archivo(s) no se pudieron subir. Podés reintentar la carga.
                        </p>
                      </div>
                      <button
                        onClick={handleCancelRetry}
                        className="text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                        aria-label="Cerrar"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {failedFiles.map((failedFile, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border border-red-200 bg-red-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">
                                {failedFile.file.name}
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                {failedFile.error}
                              </p>
                              <p className="text-xs text-[#6b7280] mt-1">
                                Tamaño: {(failedFile.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-[#e5e7eb]">
                      <p className="text-xs text-[#6b7280]">
                        💡 Tip: Podés seleccionar los archivos faltantes manualmente desde tu computadora
                      </p>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={handleCancelRetry}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleRetryFailed}
                          disabled={uploading}
                        >
                          {uploading ? "Reintentando..." : `Reintentar ${failedFiles.length} archivo(s)`}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
    </>
  );
}
