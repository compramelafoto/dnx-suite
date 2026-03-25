"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch").then((m) => m.default),
  { ssr: false }
);
import Tabs from "@/components/ui/Tabs";
import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";
import { TERMS_VERSION, TERMS_TEXT } from "@/lib/terms/photographerTerms";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  publicSlug: string;
  createdAt: string;
  photosCount: number;
  coverPhotoUrl?: string | null;
  showComingSoonMessage?: boolean;
  firstPhotoDate?: string | null;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
  digitalWithPrintDiscountPercent?: number | null;
  hiddenPhotosEnabled?: boolean;
  hiddenSelfieRetentionDays?: number | null;
};

export default function DashboardAlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Estado para crear/editar álbum
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [modalTab, setModalTab] = useState<"datos" | "digital" | "impresiones" | "preventa">("datos");
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [digitalPhotoPrice, setDigitalPhotoPrice] = useState("");
  const [foundAlbums, setFoundAlbums] = useState<any[]>([]);
  const [searchingAlbums, setSearchingAlbums] = useState(false);
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [albumMatchChoice, setAlbumMatchChoice] = useState("");
  
  // Estado para calculadora de precios
  const [photographer, setPhotographer] = useState<{
    preferredLabId: number | null;
    profitMarginPercent: number | null;
    mpConnected?: boolean;
  } | null>(null);
  const [labPricing, setLabPricing] = useState<{
    basePrices: Array<{ size: string; unitPrice: number }>;
    discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
    products?: Array<{
      id: number;
      name: string;
      size: string | null;
      acabado: string | null;
      retailPrice: number;
      isActive: boolean;
    }>;
  } | null>(null);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [calculatorSize, setCalculatorSize] = useState("");
  const [calculatorQuantity, setCalculatorQuantity] = useState(1);
  const [calculatorCopyMode, setCalculatorCopyMode] = useState<"SAME_PHOTO" | "DIFFERENT_PHOTOS">("SAME_PHOTO");
  const [systemConfig, setSystemConfig] = useState<{
    minDigitalPhotoPrice: number;
    platformCommissionPercent: number;
  } | null>(null);
  
  // Estado para configuración del álbum
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [printPricingSource, setPrintPricingSource] = useState<"PHOTOGRAPHER" | "LAB_PREFERRED">("PHOTOGRAPHER");
  const [albumProfitMarginPercent, setAlbumProfitMarginPercent] = useState("");
  const [pickupBy, setPickupBy] = useState<"CLIENT" | "PHOTOGRAPHER">("CLIENT");
  const [photographerProducts, setPhotographerProducts] = useState<Array<{ id: number; name: string; size: string | null; acabado: string | null; retailPrice: number; isActive?: boolean }>>([]);
  const [calculatorProductId, setCalculatorProductId] = useState<string>("");
  const [enablePrintedPhotos, setEnablePrintedPhotos] = useState(true);
  const [enableDigitalPhotos, setEnableDigitalPhotos] = useState(true);
  const [includeDigitalWithPrint, setIncludeDigitalWithPrint] = useState(false);
  const [digitalWithPrintDiscountPercent, setDigitalWithPrintDiscountPercent] = useState("");
  const [showComingSoonMessage, setShowComingSoonMessage] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [hiddenPhotosEnabled, setHiddenPhotosEnabled] = useState(false);
  const [hiddenSelfieRetentionDays, setHiddenSelfieRetentionDays] = useState("");
  const [labs, setLabs] = useState<Array<{ id: number; name: string; city?: string | null; province?: string | null }>>([]);
  const [labSearch, setLabSearch] = useState("");
  const [showLabDropdown, setShowLabDropdown] = useState(false);
  
  // Estado para términos y condiciones
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(true);
  
  // Estado para descuentos por cantidad de fotos digitales
  const [digitalDiscount5Plus, setDigitalDiscount5Plus] = useState("");
  const [digitalDiscount10Plus, setDigitalDiscount10Plus] = useState("");
  const [digitalDiscount20Plus, setDigitalDiscount20Plus] = useState("");
  const [digitalCalculatorQuantity, setDigitalCalculatorQuantity] = useState(1);
  // Pre-venta (solo al editar álbum existente)
  const [precompraCloseAt, setPrecompraCloseAt] = useState("");
  const [precompraRequireApproval, setPrecompraRequireApproval] = useState(false);
  const [precompraProducts, setPrecompraProducts] = useState<Array<{ id: number; name: string; description: string | null; price: number; minFotos: number; maxFotos: number; requiresDesign: boolean; suggestionText: string | null; mockupUrl: string | null }>>([]);
  const [precompraProductsLoading, setPrecompraProductsLoading] = useState(false);
  const [precompraSaving, setPrecompraSaving] = useState(false);
  const [showPrecompraProductModal, setShowPrecompraProductModal] = useState(false);
  const [editingPrecompraProduct, setEditingPrecompraProduct] = useState<{ id: number; name: string; description: string | null; price: number; minFotos: number; maxFotos: number; requiresDesign: boolean; suggestionText: string | null; mockupUrl: string | null } | null>(null);
  const [precompraProductForm, setPrecompraProductForm] = useState({ name: "", description: "", price: "0", minFotos: "1", maxFotos: "1", requiresDesign: false, suggestionText: "", mockupUrl: "" });
  const [precompraProductSaving, setPrecompraProductSaving] = useState(false);
  const [mockupUploading, setMockupUploading] = useState(false);
  const mockupFileInputRef = useRef<HTMLInputElement>(null);
  const hasPrintProducts =
    printPricingSource === "PHOTOGRAPHER"
      ? photographerProducts.length > 0
      : Boolean(labPricing?.products && labPricing.products.length > 0);

  // Invitaciones a álbum (integrado en el mismo modal de edición)
  const [inviteEmailsInput, setInviteEmailsInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteResults, setInviteResults] = useState<Record<string, string>>({});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteListLoading, setInviteListLoading] = useState(false);
  const [inviteAccesses, setInviteAccesses] = useState<Array<{ email: string; status: string }>>([]);
  const [invitePending, setInvitePending] = useState<Array<{ email: string; status: string; expiresAt?: string | null }>>([]);
  const [albumDataLoading, setAlbumDataLoading] = useState(false);
  const loadedFormSnapshot = useRef<{ hiddenPhotosEnabled: boolean; isPublic: boolean; showComingSoonMessage: boolean } | null>(null);

  // Buscar álbumes existentes cuando cambia el título
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (title.trim().length >= 3 && !editingAlbumId) {
        setSearchingAlbums(true);
        try {
          const res = await fetch(`/api/dashboard/albums/search?title=${encodeURIComponent(title.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setFoundAlbums(data.albums || []);
            setShowJoinOptions(data.albums && data.albums.length > 0);
          }
        } catch (err) {
          console.error("Error buscando álbumes:", err);
        } finally {
          setSearchingAlbums(false);
        }
      } else {
        setFoundAlbums([]);
        setShowJoinOptions(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(searchTimeout);
  }, [title, editingAlbumId]);

  useEffect(() => {
    loadAlbums();
    
    // Verificar si hay un parámetro de edición en la URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId && !isNaN(Number(editId))) {
        const albumId = Number(editId);
        // Buscar el álbum en la lista y abrir el modal de edición
        setTimeout(() => {
          const albumToEdit = albums.find((a: any) => a.id === albumId);
          if (albumToEdit) {
            handleEditAlbum(albumToEdit);
            // Limpiar el parámetro de la URL
            window.history.replaceState({}, "", "/dashboard/albums");
          }
        }, 100);
      }
    }
  }, [albums.length]);

  const handleRequestCloseModalRef = useRef(handleRequestCloseModal);
  handleRequestCloseModalRef.current = handleRequestCloseModal;

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showTermsModal) {
          setShowTermsModal(false);
          setNeedsTermsAcceptance(true);
        }
        if (showCreateModal) {
          handleRequestCloseModalRef.current();
        }
      }
    }
    if (showCreateModal || showTermsModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showCreateModal, showTermsModal]);

  // Cargar datos del fotógrafo y configuración del sistema cuando se abre el modal
  useEffect(() => {
    if (showCreateModal && editingAlbumId) {
      // Cargar datos del álbum para edición
      setAlbumDataLoading(true);
      async function loadAlbumData() {
        try {
          const res = await fetch(`/api/dashboard/albums/${editingAlbumId}`, { cache: "no-store" });
          if (res.ok) {
            const album = await res.json();
            setTitle(album.title || "");
            setLocation(album.location || "");
            setEventDate(album.eventDate ? new Date(album.eventDate).toISOString().split('T')[0] : "");
            setDigitalPhotoPrice(album.digitalPhotoPriceCents != null ? String(album.digitalPhotoPriceCents) : "");
            setSelectedLabId(album.selectedLabId || null);
            setAlbumProfitMarginPercent(album.albumProfitMarginPercent ? album.albumProfitMarginPercent.toString() : "");
            setPrintPricingSource(album.printPricingSource === "LAB_PREFERRED" ? "LAB_PREFERRED" : "PHOTOGRAPHER");
            setPickupBy(album.pickupBy || "CLIENT");
            setEnablePrintedPhotos(album.enablePrintedPhotos !== undefined ? album.enablePrintedPhotos : true);
            setEnableDigitalPhotos(album.enableDigitalPhotos !== undefined ? album.enableDigitalPhotos : true);
            setIncludeDigitalWithPrint(album.includeDigitalWithPrint || false);
            setDigitalWithPrintDiscountPercent(
              album.digitalWithPrintDiscountPercent != null
                ? String(album.digitalWithPrintDiscountPercent)
                : ""
            );
            setIsPublic(album.isPublic !== undefined ? album.isPublic : true);
            setHiddenPhotosEnabled(Boolean(album.hiddenPhotosEnabled));
            setHiddenSelfieRetentionDays(album.hiddenSelfieRetentionDays != null ? String(album.hiddenSelfieRetentionDays) : "");
            loadedFormSnapshot.current = {
              hiddenPhotosEnabled: Boolean(album.hiddenPhotosEnabled),
              isPublic: album.isPublic !== false,
              showComingSoonMessage: Boolean(album.showComingSoonMessage),
            };

            await loadInviteData();
            
            // Inicializar descuentos por cantidad
            setDigitalDiscount5Plus(album.digitalDiscount5Plus ? album.digitalDiscount5Plus.toString() : "");
            setDigitalDiscount10Plus(album.digitalDiscount10Plus ? album.digitalDiscount10Plus.toString() : "");
            setDigitalDiscount20Plus(album.digitalDiscount20Plus ? album.digitalDiscount20Plus.toString() : "");

            // Pre-venta
            setPrecompraCloseAt(album.preCompraCloseAt ? new Date(album.preCompraCloseAt).toISOString().slice(0, 16) : "");
            setPrecompraRequireApproval(Boolean(album.requireClientApproval));
            setPrecompraProductsLoading(true);
            try {
              const prodRes = await fetch(`/api/dashboard/albums/${editingAlbumId}/precompra-products`, { cache: "no-store" });
              if (prodRes.ok) {
                const data = await prodRes.json();
                const prods = data?.products ?? data;
                setPrecompraProducts(Array.isArray(prods) ? prods : []);
              }
            } catch {
              setPrecompraProducts([]);
            } finally {
              setPrecompraProductsLoading(false);
            }
            
            // Inicializar aceptación de términos según el álbum
            const hasAcceptedTerms = album.termsAcceptedAt && album.termsVersion === TERMS_VERSION;
            const needsAcceptance = !hasAcceptedTerms;
            setNeedsTermsAcceptance(needsAcceptance);
            setTermsAccepted(hasAcceptedTerms || false);
            setTermsError(null);
            
            // Cargar precios del laboratorio si hay uno seleccionado
            if (album.selectedLabId) {
              const labRes = await fetch(`/api/lab/pricing?labId=${album.selectedLabId}`, { cache: "no-store" });
              if (labRes.ok) {
                const pricing = await labRes.json();
                setLabPricing({
                  basePrices: Array.isArray(pricing.basePrices) ? pricing.basePrices : [],
                  discounts: Array.isArray(pricing.discounts) ? pricing.discounts : [],
                  products: Array.isArray(pricing.products) ? pricing.products : [],
                });
                setPricingLoaded(true);
                if (pricing.basePrices.length > 0) {
                  setCalculatorSize(pricing.basePrices[0].size);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error cargando datos del álbum:", err);
        } finally {
          setAlbumDataLoading(false);
        }
      }
      loadAlbumData();
    } else {
      setAlbumDataLoading(false);
    }
  }, [showCreateModal, editingAlbumId]);

  // Cargar datos del fotógrafo y configuración del sistema cuando se abre el modal
  useEffect(() => {
    if (showCreateModal) {
      async function loadData() {
        // Cargar lista de laboratorios (todos cuando está vacío)
        async function loadLabs(search?: string) {
          try {
            const url = search && search.trim() ? `/api/labs?search=${encodeURIComponent(search.trim())}` : "/api/labs";
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              setLabs(Array.isArray(data) ? data : []);
            } else {
              // Si hay error, mostrar array vacío para que aparezca el mensaje
              setLabs([]);
              console.error("Error cargando laboratorios:", res.status, res.statusText);
            }
          } catch (err) {
            console.error("Error cargando laboratorios:", err);
            setLabs([]); // Mostrar array vacío para que aparezca el mensaje
          }
        }
        await loadLabs(); // Cargar todos los laboratorios al abrir el modal

        // Cargar datos del fotógrafo
        try {
          const res = await fetch("/api/dashboard/photographer");
          if (res.ok) {
            const data = await res.json();
            setPhotographer({
              preferredLabId: data.preferredLabId,
              profitMarginPercent: data.profitMarginPercent,
              mpConnected: Boolean(data.mpConnected),
            });
            // Establecer valores por defecto
            if (data.preferredLabId) {
              setSelectedLabId(data.preferredLabId);
              // Cargar precios del laboratorio preferido (dashboard de fotógrafo, usar precio profesional)
              const labRes = await fetch(`/api/lab/pricing?labId=${data.preferredLabId}&isPhotographer=true`, { cache: "no-store" });
              if (labRes.ok) {
                const labData = await labRes.json();
                setLabPricing({
                  basePrices: Array.isArray(labData.basePrices) ? labData.basePrices : [],
                  discounts: Array.isArray(labData.discounts) ? labData.discounts : [],
                  products: Array.isArray(labData.products) ? labData.products : [],
                });
                if (labData.basePrices?.length > 0) {
                  setCalculatorSize(labData.basePrices[0].size);
                }
                setPricingLoaded(true);
              }
            }
            // Establecer margen de ganancia por defecto
            if (data.profitMarginPercent) {
              setAlbumProfitMarginPercent(data.profitMarginPercent.toString());
            }
          }
        } catch (err) {
          console.error("Error cargando datos del fotógrafo:", err);
        }

        // Cargar configuración del sistema
        try {
          const configRes = await fetch("/api/config");
          if (configRes.ok) {
            const configData = await configRes.json();
            setSystemConfig({
            minDigitalPhotoPrice: configData.minDigitalPhotoPrice || 5000,
              platformCommissionPercent: configData.platformCommissionPercent || 10,
            });
            // Establecer precio por defecto si no hay álbum en edición
            if (!editingAlbumId && !digitalPhotoPrice) {
              const baseMin = configData.minDigitalPhotoPrice ?? 5000;
              setDigitalPhotoPrice(String(baseMin));
            }
          }
        } catch (err) {
          console.error("Error cargando configuración:", err);
          // Valores por defecto
          setSystemConfig({
            minDigitalPhotoPrice: 5000,
            platformCommissionPercent: 10,
          });
          // Establecer precio por defecto si no hay álbum en edición
          if (!editingAlbumId && !digitalPhotoPrice) {
            setDigitalPhotoPrice("5000");
          }
        }

        // Cargar productos del fotógrafo (para calculadora PHOTOGRAPHER)
        try {
          const prodRes = await fetch("/api/fotografo/products", { cache: "no-store" });
          if (prodRes.ok) {
            const prodData = await prodRes.json();
            const list = Array.isArray(prodData.products) ? prodData.products : [];
            setPhotographerProducts(list.filter((p: { isActive?: boolean }) => p.isActive !== false));
            if (list.length > 0 && !calculatorProductId) {
              setCalculatorProductId(String(list[0].id));
            }
          }
        } catch (err) {
          console.error("Error cargando productos del fotógrafo:", err);
        }
      }
      loadData();
    } else {
      // Limpiar estados al cerrar el modal
      setSelectedLabId(null);
      setPrintPricingSource("PHOTOGRAPHER");
      setAlbumProfitMarginPercent("");
      setPickupBy("CLIENT");
      setEnablePrintedPhotos(true);
      setEnableDigitalPhotos(true);
      setIncludeDigitalWithPrint(false);
      setLabSearch("");
      setLabPricing(null);
      setPhotographerProducts([]);
      setPricingLoaded(false);
      setCalculatorSize("");
      setCalculatorProductId("");
      setCalculatorQuantity(1);
      setTermsAccepted(false);
      setTermsError(null);
      setShowTermsModal(false);
      setNeedsTermsAcceptance(true);
      setDigitalDiscount5Plus("");
      setDigitalDiscount10Plus("");
      setDigitalDiscount20Plus("");
      setDigitalCalculatorQuantity(1);
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showCreateModal && editingAlbumId) {
      loadInviteData();
    }
  }, [showCreateModal, editingAlbumId]);

  // Cargar precios cuando cambia el laboratorio seleccionado
  useEffect(() => {
    if (selectedLabId) {
      async function loadLabPricing() {
        try {
          const labRes = await fetch(`/api/lab/pricing?labId=${selectedLabId}&isPhotographer=true`, { cache: "no-store" });
          if (labRes.ok) {
            const labData = await labRes.json();
            setLabPricing({
              basePrices: Array.isArray(labData.basePrices) ? labData.basePrices : [],
              discounts: Array.isArray(labData.discounts) ? labData.discounts : [],
              products: Array.isArray(labData.products) ? labData.products : [],
            });
            if (labData.basePrices?.length > 0) {
              setCalculatorSize(labData.basePrices[0].size);
            }
            setPricingLoaded(true);
          }
        } catch (err) {
          console.error("Error cargando precios del laboratorio:", err);
        }
      }
      loadLabPricing();
    } else {
      setLabPricing(null);
      setPricingLoaded(false);
    }
  }, [selectedLabId]);

  async function loadAlbums() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/albums");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(data?.error || data?.detail || "Error cargando álbumes");
      }
      setAlbums(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error cargando álbumes:", err);
      setError(err.message || "Error cargando álbumes");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAlbum(album: { id: number; title?: string; hasOtherContributors?: boolean; myPhotosCount?: number; photosCount?: number }) {
    const msg = album.hasOtherContributors
      ? `Este álbum es colaborativo. Solo se eliminarán tus ${album.myPhotosCount ?? 0} fotos. El álbum permanecerá con las de otros fotógrafos. Si sos el creador, la propiedad pasará a otro colaborador. ¿Continuar?`
      : `¿Eliminar el álbum "${album.title ?? ""}" y sus ${album.photosCount ?? 0} fotos? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/dashboard/albums/${album.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error eliminando álbum");
      await loadAlbums();
    } catch (e: any) {
      setError(e?.message || "Error eliminando álbum");
    }
  }

  function doCloseModal() {
    setShowCreateModal(false);
    setEditingAlbumId(null);
    setError(null);
    setTitle("");
    setLocation("");
    setEventDate("");
    setDigitalPhotoPrice("");
    setEnablePrintedPhotos(true);
    setEnableDigitalPhotos(true);
    setFoundAlbums([]);
    setShowJoinOptions(false);
    setIncludeDigitalWithPrint(false);
    setShowComingSoonMessage(false);
    setIsPublic(true);
    setHiddenPhotosEnabled(false);
    setHiddenSelfieRetentionDays("");
    setModalTab("datos");
    setTermsAccepted(false);
    setTermsError(null);
    setShowTermsModal(false);
    setNeedsTermsAcceptance(true);
    loadedFormSnapshot.current = null;
  }

  function handleRequestCloseModal() {
    if (!editingAlbumId || creating) {
      doCloseModal();
      return;
    }
    const loaded = loadedFormSnapshot.current;
    if (!loaded) {
      doCloseModal();
      return;
    }
    const hasChanges =
      hiddenPhotosEnabled !== loaded.hiddenPhotosEnabled ||
      isPublic !== loaded.isPublic ||
      showComingSoonMessage !== loaded.showComingSoonMessage;
    if (!hasChanges) {
      doCloseModal();
      return;
    }
    if (confirm("Tenés cambios sin guardar. ¿Guardar antes de cerrar?\n\n• Sí = guardar y cerrar\n• No = descartar cambios")) {
      handleCreateAlbum();
    } else {
      doCloseModal();
    }
  }

  async function savePrecompraProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAlbumId) return;
    const name = precompraProductForm.name.trim();
    if (!name) {
      setError("El nombre del producto es obligatorio");
      return;
    }
    setPrecompraProductSaving(true);
    setError(null);
    try {
      if (editingPrecompraProduct) {
        const res = await fetch(`/api/dashboard/albums/${editingAlbumId}/precompra-products/${editingPrecompraProduct.id}`, {
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
        const res = await fetch(`/api/dashboard/albums/${editingAlbumId}/precompra-products`, {
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
          throw new Error(d?.error || d?.detail || "Error al crear");
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

  async function handleCreateAlbum() {
    // Título obligatorio para poder guardar
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    // Lugar del evento obligatorio al crear
    if (!editingAlbumId && !location.trim()) {
      setError("El lugar del evento es requerido.");
      return;
    }

    if (!editingAlbumId && foundAlbums.length > 0) {
      if (!albumMatchChoice) {
        setError("Seleccioná si querés unirte a un álbum existente o crear uno nuevo.");
        return;
      }
      if (albumMatchChoice !== "create_new") {
        setCreating(true);
        setError(null);
        try {
          const res = await fetch("/api/dashboard/albums", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              joinAlbumId: Number(albumMatchChoice),
              title: title.trim(),
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setShowCreateModal(false);
            setTitle("");
            setFoundAlbums([]);
            setShowJoinOptions(false);
            setAlbumMatchChoice("");
            await loadAlbums();
            router.push(`/dashboard/albums/${data.id}`);
            return;
          }
          setError(data.error || "Error uniéndose al álbum");
        } catch (err: any) {
          setError(err.message || "Error uniéndose al álbum");
        } finally {
          setCreating(false);
        }
        return;
      }
    }

    setTermsError(null);

    // Si venta digital está habilitada, el precio por foto digital es obligatorio y debe ser >= mínimo
    if (enableDigitalPhotos) {
      const minDigitalCents = systemConfig?.minDigitalPhotoPrice ?? 5000;
      const parsed = digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice))
        ? Math.round(parseFloat(digitalPhotoPrice))
        : null;
      if (parsed === null || parsed < minDigitalCents) {
        setError(
          parsed !== null && parsed < minDigitalCents
            ? `El precio por foto digital debe ser mayor o igual al mínimo ($${Number(minDigitalCents).toFixed(2)}).`
            : "Si habilitás venta digital, tenés que configurar el precio por foto digital."
        );
        return;
      }
    }

    setCreating(true);
    setError(null);

    const isEditing = editingAlbumId !== null;
    const url = isEditing ? `/api/dashboard/albums/${editingAlbumId}` : "/api/dashboard/albums";
    const method = isEditing ? "PUT" : "POST";

    try {
      const minDigitalCents = systemConfig?.minDigitalPhotoPrice ?? 5000;
      const hasDigitalPrice = digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice))
        ? Math.round(parseFloat(digitalPhotoPrice)) >= minDigitalCents
        : false;
      const hasMargin = albumProfitMarginPercent && !isNaN(parseFloat(albumProfitMarginPercent))
        ? parseFloat(albumProfitMarginPercent) >= 0
        : false;
      const hasPrintedConfig =
        (printPricingSource === "PHOTOGRAPHER" && hasMargin && photographerProducts.length > 0) ||
        (printPricingSource === "LAB_PREFERRED" && Boolean(selectedLabId) && hasMargin && Boolean(pickupBy));
      const hasAnySale = enablePrintedPhotos || enableDigitalPhotos;
      const termsOk = !needsTermsAcceptance || termsAccepted;
      const isComplete = hasAnySale
        && (!enablePrintedPhotos || hasPrintedConfig)
        && (!enableDigitalPhotos || hasDigitalPrice)
        && termsOk;

    if (enablePrintedPhotos && (printPricingSource === "LAB_PREFERRED" ? pricingLoaded : true) && !hasPrintProducts) {
      setError(
        printPricingSource === "PHOTOGRAPHER"
          ? "Para habilitar fotos impresas, primero cargá productos en tu lista de precios (Configuración > Productos)."
          : "Para habilitar fotos impresas con laboratorio, seleccioná un laboratorio y cargá precios."
      );
      return;
    }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          location: location.trim() || null,
          eventDate: eventDate || null,
          digitalPhotoPriceCents: digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice))
            ? Math.round(parseFloat(digitalPhotoPrice))
            : null,
          selectedLabId: selectedLabId || null,
          printPricingSource: printPricingSource || "PHOTOGRAPHER",
          albumProfitMarginPercent: albumProfitMarginPercent && !isNaN(parseFloat(albumProfitMarginPercent))
            ? parseFloat(albumProfitMarginPercent)
            : null,
          pickupBy: printPricingSource === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : (pickupBy || "CLIENT"),
          enablePrintedPhotos,
          enableDigitalPhotos,
          includeDigitalWithPrint,
          digitalWithPrintDiscountPercent: digitalWithPrintDiscountPercent && !isNaN(parseFloat(digitalWithPrintDiscountPercent))
            ? parseFloat(digitalWithPrintDiscountPercent)
            : 0,
          allowClientLabSelection: false,
          showComingSoonMessage,
          isPublic,
          hiddenPhotosEnabled,
          hiddenSelfieRetentionDays: hiddenSelfieRetentionDays === "" ? null : (parseInt(hiddenSelfieRetentionDays, 10) || null),
          termsAccepted: termsAccepted === true,
          digitalDiscount5Plus: digitalDiscount5Plus && !isNaN(parseFloat(digitalDiscount5Plus)) ? parseFloat(digitalDiscount5Plus) : null,
          digitalDiscount10Plus: digitalDiscount10Plus && !isNaN(parseFloat(digitalDiscount10Plus)) ? parseFloat(digitalDiscount10Plus) : null,
          digitalDiscount20Plus: digitalDiscount20Plus && !isNaN(parseFloat(digitalDiscount20Plus)) ? parseFloat(digitalDiscount20Plus) : null,
          ...(editingAlbumId ? {
            preCompraCloseAt: precompraCloseAt ? new Date(precompraCloseAt).toISOString() : null,
            requireClientApproval: precompraRequireApproval,
          } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMessage = data.error || data.detail || (isEditing ? "Error actualizando álbum" : "Error creando álbum");
        const fullError = data.detail ? `${errorMessage}. Detalle: ${data.detail}` : errorMessage;
        console.error("Error del servidor:", fullError, "Response status:", res.status, "Data:", data);
        throw new Error(fullError);
      }

      const warningMessage = isEditing && data._warning ? String(data._warning) : null;

      // Cerrar modal y limpiar formulario (mantener aviso de migración si aplica)
      doCloseModal();
      if (warningMessage) setError(warningMessage);

      // Si es creación nueva, guardar el link para mostrarlo después
      if (!isEditing && data.publicSlug) {
        const albumUrl = `${window.location.origin}/a/${data.publicSlug}`;
        // Guardar en sessionStorage para mostrarlo en la página de detalle
        sessionStorage.setItem("newAlbumUrl", albumUrl);
        sessionStorage.setItem("newAlbumTitle", data.title || "");
      }

      // Recargar lista
      await loadAlbums();

      // Solo redirigir si es creación nueva
      if (!isEditing) {
        router.push(`/dashboard/albums/${data.id}`);
      }
    } catch (err: any) {
      console.error(isEditing ? "Error actualizando álbum:" : "Error creando álbum:", err);
      setError(err.message || (isEditing ? "Error actualizando álbum" : "Error creando álbum"));
    } finally {
      setCreating(false);
    }
  }

  function normalizeEmails(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  function addInviteEmailsFromInput() {
    const parsed = normalizeEmails(inviteEmailsInput);
    if (!parsed.length) return;
    setInviteEmails((prev) => Array.from(new Set([...prev, ...parsed])));
    setInviteEmailsInput("");
  }

  async function loadInviteData() {
    if (!editingAlbumId) return;
    setInviteListLoading(true);
    try {
      const res = await fetch(`/api/albums/${editingAlbumId}/invite`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteAccesses([]);
        setInvitePending([]);
        return;
      }
      const accessRows = Array.isArray(data.accesses) ? data.accesses : [];
      const pendingRows = Array.isArray(data.invitations) ? data.invitations : [];
      setInviteAccesses(accessRows);
      setInvitePending(pendingRows);
    } catch {
      setInviteAccesses([]);
      setInvitePending([]);
    } finally {
      setInviteListLoading(false);
    }
  }

  async function handleSendInvites() {
    if (!editingAlbumId) return;
    const emails = Array.from(new Set(inviteEmails.map((e) => e.toLowerCase())));
    if (!emails.length) {
      setError("Agregá al menos un email para invitar.");
      return;
    }
    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${editingAlbumId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error enviando invitaciones");
      }
      const results = Array.isArray(data.results) ? data.results : [];
      const nextResults: Record<string, string> = {};
      results.forEach((r: any) => {
        if (r?.email) {
          nextResults[String(r.email).toLowerCase()] = r?.status || "invited";
        }
      });
      setInviteResults(nextResults);
      setInviteEmails([]);
      await loadInviteData();
    } catch (err: any) {
      setError(err?.message || "Error enviando invitaciones");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleEditAlbum(album: Album) {
    setEditingAlbumId(album.id);
    setShowCreateModal(true);
    // Asegurar que ambas solapas estén disponibles
    setModalTab("datos");
    // Inicializar términos según el álbum
    const hasAcceptedTerms = album.termsAcceptedAt && album.termsVersion === TERMS_VERSION;
    setNeedsTermsAcceptance(!hasAcceptedTerms);
    setTermsAccepted(hasAcceptedTerms || false);
  }

  // Funciones helper para calculadora de precios
  function formatARS(n: number): string {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }

  function getBasePrice(size: string): number {
    if (!labPricing || !labPricing.basePrices) return 0;
    const bp = labPricing.basePrices.find((p) => p.size === size);
    return bp?.unitPrice ?? 0;
  }

  function getDiscountPercent(size: string, qty: number): number {
    if (!labPricing || !labPricing.discounts) return 0;
    const sizeDiscounts = labPricing.discounts.filter((d) => d.size === size);
    const d50 = sizeDiscounts.find((d) => d.minQty === 50)?.discountPercent;
    const d100 = sizeDiscounts.find((d) => d.minQty === 100)?.discountPercent;
    if (qty >= 100) return d100 ?? 0;
    if (qty >= 50) return d50 ?? 0;
    return 0;
  }

  // Fórmula única impresiones: base → margen álbum → fee plataforma (desglose)
  function computePrintBreakdown(params: {
    baseUnitPrice: number;
    albumMarginPercent: number;
    platformFeePercent: number;
    quantity: number;
  }) {
    const base = Math.round(params.baseUnitPrice || 0);
    const marginPct = params.albumMarginPercent || 0;
    const feePct = params.platformFeePercent || 0;
    const qty = Math.max(1, Math.round(params.quantity || 1));
    const priceAfterAlbumMargin = Math.round(base * (1 + marginPct / 100));
    const finalUnitPrice = Math.round(priceAfterAlbumMargin * (1 + feePct / 100));
    const platformFeeAmountPerUnit = finalUnitPrice - priceAfterAlbumMargin;
    const subtotal = finalUnitPrice * qty;
    const priceAfterAlbumMarginTotal = priceAfterAlbumMargin * qty;
    const platformFeeTotal = subtotal - priceAfterAlbumMarginTotal;
    return {
      baseUnitPrice: base,
      albumMarginPercent: marginPct,
      priceAfterAlbumMargin,
      platformFeePercent: feePct,
      platformFeeAmountPerUnit,
      finalUnitPrice,
      quantity: qty,
      subtotal,
      priceAfterAlbumMarginTotal,
      platformFeeTotal,
    };
  }

  // Calcular precios de impresas (desglose con fórmula única)
  const printBreakdown = useMemo(() => {
    const marginPct = albumProfitMarginPercent && !isNaN(parseFloat(albumProfitMarginPercent))
      ? parseFloat(albumProfitMarginPercent)
      : 0;
    const platformFeePct = systemConfig?.platformCommissionPercent ?? 10;
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
      const basePrice = getBasePrice(calculatorSize);
      if (basePrice <= 0) return null;
      const discountPercent = getDiscountPercent(calculatorSize, calculatorQuantity);
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
    calculatorCopyMode,
    labPricing,
    pricingLoaded,
    albumProfitMarginPercent,
    systemConfig,
  ]);

  const printDigitalAddon = useMemo(() => {
    if (!includeDigitalWithPrint || !enableDigitalPhotos) {
      return {
        active: false,
        quantity: 0,
        unitPrice: 0,
        total: 0,
        basePrice: 0,
        discountPercent: 0,
        discountedBase: 0,
        feePerUnit: 0,
        platformFeePercent: 0,
      };
    }
    const price = digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice))
      ? Math.round(parseFloat(digitalPhotoPrice))
      : 0;
    if (!price) {
      return {
        active: false,
        quantity: 0,
        unitPrice: 0,
        total: 0,
        basePrice: 0,
        discountPercent: 0,
        discountedBase: 0,
        feePerUnit: 0,
        platformFeePercent: 0,
      };
    }
    const platformFeePct = systemConfig?.platformCommissionPercent ?? 10;
    const discountPct = digitalWithPrintDiscountPercent && !isNaN(parseFloat(digitalWithPrintDiscountPercent))
      ? Math.min(100, Math.max(0, parseFloat(digitalWithPrintDiscountPercent)))
      : 0;
    const discountedBase = Math.round(price * (1 - discountPct / 100));
    const unitPriceWithFee = totalFromBase(discountedBase, platformFeePct);
    const feePerUnit = feeFromBase(discountedBase, platformFeePct);
    const qty = calculatorCopyMode === "DIFFERENT_PHOTOS"
      ? Math.max(1, calculatorQuantity)
      : 1;
    return {
      active: true,
      quantity: qty,
      unitPrice: unitPriceWithFee,
      total: unitPriceWithFee * qty,
      basePrice: price,
      discountPercent: discountPct,
      discountedBase,
      feePerUnit,
      platformFeePercent: platformFeePct,
    };
  }, [
    includeDigitalWithPrint,
    enableDigitalPhotos,
    digitalPhotoPrice,
    calculatorCopyMode,
    calculatorQuantity,
    systemConfig,
    digitalWithPrintDiscountPercent,
  ]);

  // Legacy printedPriceCalc para compatibilidad con UI de lab (si se usa en otro lugar)
  const printedPriceCalc = useMemo(() => {
    if (printPricingSource !== "LAB_PREFERRED" || !pricingLoaded || !labPricing || !calculatorSize) {
      return null;
    }
    const basePrice = getBasePrice(calculatorSize);
    if (basePrice === 0) return null;
    const discountPercent = getDiscountPercent(calculatorSize, calculatorQuantity);
    const labPriceAfterDiscount = basePrice * (1 - discountPercent / 100);
    const marginPercent = albumProfitMarginPercent && !isNaN(parseFloat(albumProfitMarginPercent))
      ? parseFloat(albumProfitMarginPercent)
      : (photographer?.profitMarginPercent ?? 0);
    const photographerMargin = labPriceAfterDiscount * (marginPercent / 100);
    const platformFeePct = systemConfig?.platformCommissionPercent ?? 10;
    const baseFinalPrice = labPriceAfterDiscount + photographerMargin;
    const finalPrice = totalFromBase(Math.round(baseFinalPrice), platformFeePct);
    const totalForQuantity = finalPrice * calculatorQuantity;
    return {
      basePrice,
      discountPercent,
      labPriceAfterDiscount,
      photographerMarginPercent: marginPercent,
      photographerMargin,
      finalPrice,
      totalForQuantity,
    };
  }, [calculatorSize, calculatorQuantity, labPricing, pricingLoaded, photographer, systemConfig, albumProfitMarginPercent, printPricingSource]);

  // Calcular descuento por cantidad de fotos digitales
  function getDigitalDiscountPercent(qty: number): number {
    if (qty >= 20 && digitalDiscount20Plus && !isNaN(parseFloat(digitalDiscount20Plus))) {
      return parseFloat(digitalDiscount20Plus);
    }
    if (qty >= 10 && digitalDiscount10Plus && !isNaN(parseFloat(digitalDiscount10Plus))) {
      return parseFloat(digitalDiscount10Plus);
    }
    if (qty >= 5 && digitalDiscount5Plus && !isNaN(parseFloat(digitalDiscount5Plus))) {
      return parseFloat(digitalDiscount5Plus);
    }
    return 0;
  }

  // Calcular precios de digitales
  const digitalPriceCalc = useMemo(() => {
    if (!digitalPhotoPrice || isNaN(parseFloat(digitalPhotoPrice))) return null;
    const price = parseFloat(digitalPhotoPrice);
    const minPrice = systemConfig?.minDigitalPhotoPrice ? systemConfig.minDigitalPhotoPrice : 5000;
    const platformFeePct = systemConfig?.platformCommissionPercent ?? 10;
    const isValid = price >= minPrice;
    // Calcular descuento por cantidad
    const discountPercent = getDigitalDiscountPercent(digitalCalculatorQuantity);
    const priceAfterDiscount = price * (1 - discountPercent / 100);
    const feePerUnit = feeFromBase(Math.round(priceAfterDiscount), platformFeePct);
    const priceWithFee = totalFromBase(price, platformFeePct);
    const priceAfterDiscountWithFee = totalFromBase(Math.round(priceAfterDiscount), platformFeePct);
    const totalForQuantity = priceAfterDiscountWithFee * digitalCalculatorQuantity;
    const totalSavings = (priceWithFee - priceAfterDiscountWithFee) * digitalCalculatorQuantity;

    return {
      price,
      minPrice,
      isValid,
      discountPercent,
      priceAfterDiscount,
      platformFeePct,
      feePerUnit,
      priceWithFee,
      priceAfterDiscountWithFee,
      totalForQuantity,
      totalSavings,
      quantity: digitalCalculatorQuantity,
    };
  }, [digitalPhotoPrice, systemConfig, digitalDiscount5Plus, digitalDiscount10Plus, digitalDiscount20Plus, digitalCalculatorQuantity]);

  // Si venta digital está habilitada, el precio debe estar configurado y ser >= mínimo para poder guardar
  const digitalPriceRequiredButInvalid = useMemo(() => {
    if (!enableDigitalPhotos) return false;
    const min = systemConfig?.minDigitalPhotoPrice ?? 5000;
    const p = digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice)) ? Math.round(parseFloat(digitalPhotoPrice)) : null;
    return p === null || p < min;
  }, [enableDigitalPhotos, systemConfig?.minDigitalPhotoPrice, digitalPhotoPrice]);

  if (loading) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando álbumes...</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-[95%] mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
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
              Mis Albums
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                lineHeight: "1.6",
                margin: 0,
                maxWidth: "600px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Creá álbumes y subí tus fotos. Se aplicará marca de agua automáticamente para proteger tus imágenes.
            </p>
          </div>

          <div className="flex justify-end border-b border-[#e5e7eb] pb-3 mb-4">
            <Button 
              variant="primary" 
              onClick={() => {
                setEditingAlbumId(null);
                setShowCreateModal(true);
                setNeedsTermsAcceptance(true);
                setTermsAccepted(false);
              }}
              className="flex items-center gap-2"
              disabled={photographer?.mpConnected === false}
              title={
                photographer?.mpConnected === false
                  ? "Vinculá Mercado Pago para crear álbumes"
                  : undefined
              }
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Crear Nuevo Álbum</span>
            </Button>
          </div>

          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444] text-sm">{error}</p>
            </Card>
          )}

          {/* Lista de álbumes */}
          {albums.length === 0 ? (
            <Card className="border-2 border-dashed border-[#e5e7eb] w-full">
              <div className="text-center py-16 px-4">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">No tenés álbumes creados todavía</h3>
                <p className="text-[#6b7280] mb-6 max-w-4xl mx-auto text-base">
                  Creá tu primer álbum para comenzar a compartir tus fotos con tus clientes. Podrás configurar precios, laboratorios y más.
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    setEditingAlbumId(null);
                    setShowCreateModal(true);
                    setNeedsTermsAcceptance(true);
                    setTermsAccepted(false);
                  }}
                  className="flex items-center gap-2 mx-auto"
                  disabled={photographer?.mpConnected === false}
                  title={
                    photographer?.mpConnected === false
                      ? "Vinculá Mercado Pago para crear álbumes"
                      : undefined
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Crear mi primer álbum</span>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map((album: any) => {
                const baseDate = album.firstPhotoDate ? new Date(album.firstPhotoDate) : new Date(album.createdAt);
                const extensionDays = album.expirationExtensionDays ?? 0;
                const expiresAt = new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000);
                return (
                  <Card key={album.id} className="h-full overflow-hidden relative hover:shadow-lg transition-shadow duration-200">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <a
                        href={`/a/${album.publicSlug || album.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-green-50 text-[#6b7280] hover:text-green-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Ver álbum como cliente"
                        title="Ver álbum como cliente"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const albumUrl = `${window.location.origin}/a/${album.publicSlug || album.id}`;
                          try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              await navigator.clipboard.writeText(albumUrl);
                            } else {
                              // Fallback para navegadores sin clipboard API
                              const textArea = document.createElement("textarea");
                              textArea.value = albumUrl;
                              textArea.style.position = "fixed";
                              textArea.style.opacity = "0";
                              document.body.appendChild(textArea);
                              textArea.select();
                              document.execCommand("copy");
                              document.body.removeChild(textArea);
                            }
                            // Mostrar toast de confirmación
                            setShowCopiedToast(true);
                            setTimeout(() => {
                              setShowCopiedToast(false);
                            }, 3000);
                          } catch (err) {
                            console.error("Error copiando link:", err);
                            alert(`Link del álbum:\n${albumUrl}`);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-purple-50 text-[#6b7280] hover:text-purple-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Compartir álbum"
                        title="Compartir álbum (copiar link)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditAlbum(album); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-blue-50 text-[#6b7280] hover:text-blue-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Editar álbum (configuración completa)"
                        title="Editar álbum"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteAlbum(album); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-red-100 text-[#6b7280] hover:text-red-600 border border-[#e5e7eb] shadow"
                        aria-label="Eliminar álbum"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <Link href={`/dashboard/albums/${album.id}`} className="block">
                      {album.coverPhotoUrl ? (
                        <div className="w-full aspect-square bg-[#f3f4f6] flex items-center justify-center overflow-hidden">
                          <img src={album.coverPhotoUrl} alt={album.title} className="w-full h-full object-cover" />
                        </div>
                      ) : album.photosCount === 0 && album.showComingSoonMessage ? (
                        <div className="w-full aspect-square bg-[#f3f4f6] flex flex-col items-center justify-center gap-2 px-4">
                          <img 
                            src="/watermark.png" 
                            alt="ComprameLaFoto" 
                            className="w-20 h-auto opacity-90"
                          />
                          <p className="text-[#6b7280] text-xs text-center leading-tight">
                            Las fotos serán subidas próximamente
                          </p>
                        </div>
                      ) : (
                        <div className="w-full aspect-square bg-[#f3f4f6] flex items-center justify-center">
                          <p className="text-[#9ca3af] text-sm">Sin foto de portada</p>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-[#1a1a1a] line-clamp-2 flex-1">{album.title}</h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${album.isPublic !== false ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                              {album.isPublic !== false ? "Público" : "Privado"}
                            </span>
                            {(album as any).isCollaborative && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                              🤝 Colaborativo
                            </span>
                          )}
                            {(album as any).hasOtherContributors && !(album as any).isCollaborative && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full whitespace-nowrap">
                                👥 Con colaboradores
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 mb-3">
                          {album.location && (
                            <p className="text-sm text-[#6b7280] flex items-center gap-1">
                              <span>📍</span>
                              <span className="truncate">{album.location}</span>
                            </p>
                          )}
                          {album.eventDate && (
                            <p className="text-sm text-[#6b7280] flex items-center gap-1">
                              <span>📅</span>
                              <span>{new Date(album.eventDate).toLocaleDateString("es-AR")}</span>
                            </p>
                          )}
                        </div>
                        <div className="pt-3 border-t border-[#e5e7eb] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              {album.photosCount} {album.photosCount === 1 ? "foto" : "fotos"}
                              {(album as any).myPhotosCount !== undefined && (album as any).myPhotosCount !== album.photosCount && (
                                <span className="text-xs text-[#6b7280] ml-2">
                                  ({((album as any).myPhotosCount || 0)} tuyas)
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-[#6b7280]">
                            Creado: {new Date(album.createdAt).toLocaleDateString("es-AR")}
                          </p>
                          {expiresAt && (
                            <p className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded">
                              ⏱ Eliminación: {expiresAt.toLocaleDateString("es-AR")}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Toast de confirmación de copia */}
          {showCopiedToast && (
            <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#10b981] text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 min-w-[200px]">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium whitespace-nowrap">Link copiado al portapapeles</p>
              </div>
            </div>
          )}

          {/* Modal para crear álbum */}
          {showCreateModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={handleRequestCloseModal}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <Card className="max-w-5xl w-full max-h-[90vh] overflow-visible space-y-6" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-medium text-[#1a1a1a]">
                      {editingAlbumId ? "Editar Álbum" : "Crear Nuevo Álbum"}
                    </h2>
                    <button
                      onClick={handleRequestCloseModal}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {photographer?.mpConnected === false && (
                    <Card className="bg-amber-50 border border-amber-200">
                      <p className="text-sm text-amber-800">
                        ⚠️ Debés vincular tu cuenta de Mercado Pago para crear álbumes y recibir cobros.
                      </p>
                      <Link
                        href="/fotografo/configuracion?tab=laboratorio"
                        className="inline-flex mt-2 text-sm text-amber-900 underline"
                      >
                        Ir a vincular Mercado Pago
                      </Link>
                    </Card>
                  )}

                  <div ref={modalContentRef} className="max-h-[80vh] overflow-y-auto pr-1">
                    <Tabs
                      tabs={[
                        { id: "datos", label: "Paso 1: Datos del álbum" },
                        { id: "digital", label: "Paso 2: Precios Digital" },
                        { id: "impresiones", label: "Paso 3: Precios Impresiones" },
                        ...(editingAlbumId ? [{ id: "preventa" as const, label: "Pre-venta" }] : []),
                      ]}
                      activeTab={modalTab}
                      onTabChange={(tab) => {
                        const t = tab as "datos" | "digital" | "impresiones" | "preventa";
                        setModalTab(t);
                        modalContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {modalTab === "datos" ? (
                        <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Título <span className="text-[#ef4444]">*</span>
                          </label>
                          <Input
                            type="text"
                            placeholder="Ej: Boda de Juan y María"
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              setShowJoinOptions(false);
                              setAlbumMatchChoice("");
                            }}
                            disabled={creating}
                          />
                          {searchingAlbums && (
                            <p className="text-xs text-[#6b7280] mt-1">
                              Buscando álbumes existentes...
                            </p>
                          )}
                          {showJoinOptions && foundAlbums.length > 0 && (
                            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm font-medium text-blue-900 mb-2">
                                📸 Se encontraron {foundAlbums.length} álbum{foundAlbums.length !== 1 ? "es" : ""} con el mismo nombre.
                              </p>
                              <Select
                                value={albumMatchChoice}
                                onChange={(e) => setAlbumMatchChoice(e.target.value)}
                                disabled={creating}
                              >
                                <option value="">Seleccioná una opción...</option>
                                {foundAlbums.map((album) => (
                                  <option
                                    key={album.id}
                                    value={String(album.id)}
                                    disabled={album.hasMyPhotos}
                                  >
                                    Unirme a "{album.title}" #{album.id}
                                  </option>
                                ))}
                                <option value="create_new">Crear un álbum nuevo</option>
                              </Select>
                              {albumMatchChoice && albumMatchChoice !== "create_new" && (
                                <p className="text-xs text-blue-700 mt-2">
                                  Se unirá como colaborador al álbum seleccionado.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Lugar del evento *
                          </label>
                          <EventLocationSearch
                            value={location}
                            onClear={() => setLocation("")}
                            onSelect={(_, __, displayName) => setLocation(displayName)}
                            placeholder="Ej: Teatro Colón, Estadio Monumental"
                            className={creating ? "opacity-60 pointer-events-none" : ""}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Fecha del evento (opcional)
                          </label>
                          <Input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            disabled={creating}
                          />
                        </div>

                        <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showComingSoonMessage}
                              onChange={(e) => setShowComingSoonMessage(e.target.checked)}
                              disabled={creating}
                              className="mt-1 w-4 h-4 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-medium text-[#1a1a1a] mb-1">
                                Mostrar mensaje "Las fotos serán subidas próximamente"
                              </span>
                              <span className="block text-xs text-[#6b7280]">
                                Si el álbum no tiene fotos, se mostrará un mensaje para que los clientes dejen su email y sean notificados cuando las fotos estén disponibles.
                              </span>
                            </div>
                          </label>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isPublic}
                              onChange={(e) => setIsPublic(e.target.checked)}
                              disabled={creating}
                              className="mt-1 w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-semibold text-blue-900 mb-1">
                                🌐 Álbum Público
                              </span>
                              <span className="block text-xs text-blue-800 leading-relaxed">
                                {isPublic ? (
                                  <>
                                    Este álbum aparecerá en las páginas públicas (home de ComprameLaFoto y página del fotógrafo). Cualquiera podrá encontrarlo y acceder a él.
                                  </>
                                ) : (
                                  <>
                                    Este álbum será <strong>privado</strong>. Solo las personas con el link directo podrán acceder a él. No aparecerá en páginas públicas.
                                  </>
                                )}
                              </span>
                            </div>
                          </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
                          <label className={`flex items-start gap-3 ${albumDataLoading ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
                            <input
                              type="checkbox"
                              checked={hiddenPhotosEnabled}
                              onChange={(e) => setHiddenPhotosEnabled(e.target.checked)}
                              disabled={creating || albumDataLoading}
                              className="mt-1 w-5 h-5 text-slate-600 border-slate-300 rounded focus:ring-slate-500 focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-semibold text-slate-800 mb-1">
                                🔒 Fotos ocultas hasta selfie
                              </span>
                              <span className="block text-xs text-slate-700 leading-relaxed">
                                Si está activado, los visitantes solo verán sus fotos después de subir una selfie (reconocimiento facial). Nadie verá todo el álbum sin verificar.
                              </span>
                            </div>
                          </label>
                          {hiddenPhotosEnabled && (
                            <div className="mt-3 pl-8">
                              <label className="block text-xs font-medium text-slate-700 mb-1">Retener selfie (días, opcional)</label>
                              <input
                                type="number"
                                min={0}
                                max={365}
                                placeholder="0 = no guardar"
                                value={hiddenSelfieRetentionDays}
                                onChange={(e) => setHiddenSelfieRetentionDays(e.target.value)}
                                disabled={creating || albumDataLoading}
                                className="w-full max-w-[120px] border border-slate-300 rounded px-2 py-1.5 text-sm"
                              />
                              <span className="block text-xs text-slate-500 mt-1">Ej: 7 o 30 para auditoría; la selfie se borra al cumplir los días.</span>
                            </div>
                          )}
                        </div>

                        {editingAlbumId && (
                          <div className="p-5 bg-gradient-to-br from-[#f8fafc] to-white rounded-xl border border-[#e2e8f0] shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-[#6366f1] rounded-full" />
                              <h3 className="text-sm font-semibold text-[#1a1a1a]">Invitar clientes</h3>
                            </div>
                            <p className="text-xs text-[#64748b] mb-4">
                              Agregá emails y enviá invitaciones para que accedan al álbum. Podés escribir varios separados por coma o Enter.
                            </p>
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="ej: cliente@mail.com, otro@mail.com"
                                  value={inviteEmailsInput}
                                  onChange={(e) => setInviteEmailsInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                      e.preventDefault();
                                      addInviteEmailsFromInput();
                                    }
                                  }}
                                  disabled={inviteLoading}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={addInviteEmailsFromInput}
                                  disabled={inviteLoading || !inviteEmailsInput.trim()}
                                >
                                  Agregar
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2 min-h-[32px]">
                                {inviteEmails.map((email) => (
                                  <span
                                    key={email}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e0e7ff] text-[#4338ca] rounded-lg text-xs font-medium"
                                  >
                                    {email}
                                    <button
                                      type="button"
                                      onClick={() => setInviteEmails((prev) => prev.filter((e) => e !== email))}
                                      className="text-[#6366f1] hover:text-[#3730a3] disabled:opacity-50"
                                      disabled={inviteLoading}
                                      aria-label="Quitar"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                {inviteEmails.length === 0 && (
                                  <span className="text-xs text-[#94a3b8] self-center">Ningún email agregado aún.</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="primary"
                                onClick={handleSendInvites}
                                disabled={inviteLoading || inviteEmails.length === 0}
                                className="w-full sm:w-auto"
                              >
                                {inviteLoading ? "Enviando…" : "Enviar invitaciones"}
                              </Button>
                              {Object.keys(inviteResults).length > 0 && (
                                <div className="pt-3 mt-3 border-t border-[#e2e8f0]">
                                  <p className="text-xs font-medium text-[#475569] mb-2">Último envío</p>
                                  <div className="space-y-1 text-xs">
                                    {Object.entries(inviteResults).map(([email, status]) => (
                                      <div key={email} className="flex items-center justify-between text-[#64748b]">
                                        <span>{email}</span>
                                        <span>
                                          {status === "already_has_access" ? "Ya tenía acceso" : status === "invalid_email" ? "Email inválido" : "Enviado"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {!isPublic && editingAlbumId && (
                          <div className="p-5 bg-gradient-to-br from-[#f8fafc] to-white rounded-xl border border-[#e2e8f0] shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-[#10b981] rounded-full" />
                              <h3 className="text-sm font-semibold text-[#1a1a1a]">Usuarios con acceso</h3>
                            </div>
                            {inviteListLoading ? (
                              <p className="text-xs text-[#64748b]">Cargando…</p>
                            ) : (
                              <div className="space-y-2 text-xs">
                                {inviteAccesses.map((entry) => (
                                  <div key={`access-${entry.email}`} className="flex items-center justify-between py-1">
                                    <span className="text-[#475569]">{entry.email}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${entry.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {entry.status === "ACTIVE" ? "Activo" : "Pendiente"}
                                    </span>
                                  </div>
                                ))}
                                {invitePending.map((entry) => (
                                  <div key={`invite-${entry.email}`} className="flex items-center justify-between py-1">
                                    <span className="text-[#475569]">{entry.email}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                                      Pendiente
                                    </span>
                                  </div>
                                ))}
                                {inviteAccesses.length === 0 && invitePending.length === 0 && (
                                  <p className="text-[#94a3b8] py-1">Aún no hay invitados. Usá el bloque de arriba para invitar.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                          ⏱ Este álbum se eliminará automáticamente en 30 días a partir de que se suban las fotografías.
                        </p>

                        {/* Botones de navegación y guardado */}
                        <div className="pt-4 border-t border-[#e5e7eb] space-y-3">
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => {
                              setModalTab("digital");
                              modalContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-full"
                            disabled={!title.trim()}
                          >
                            Configurar Precios →
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={handleCreateAlbum}
                            className="w-full"
                            disabled={creating || !title.trim() || (needsTermsAcceptance && !termsAccepted) || digitalPriceRequiredButInvalid}
                          >
                            {creating ? (editingAlbumId ? "Guardando..." : "Creando...") : (editingAlbumId ? "Guardar Cambios" : "Guardar Álbum")}
                          </Button>
                          {digitalPriceRequiredButInvalid && (
                            <p className="text-xs text-[#ef4444] mt-2 text-center">
                              Configurá el precio por foto digital (mínimo ${systemConfig?.minDigitalPhotoPrice ? systemConfig.minDigitalPhotoPrice.toFixed(2) : "5000.00"}) para poder guardar.
                            </p>
                          )}
                          {!title.trim() && (
                            <p className="text-xs text-[#ef4444] mt-2 text-center">
                              Completa el título del álbum para continuar
                            </p>
                          )}
                        </div>

                      </div>
                      ) : modalTab === "digital" ? (
                        <div className="space-y-6">
                          {/* Guía para venta digital - Paso 2 */}
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Precios Digital</h4>
                            <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                              <li>Precio por foto digital (mínimo ${systemConfig?.minDigitalPhotoPrice ? systemConfig.minDigitalPhotoPrice.toFixed(2) : "5000.00"})</li>
                              <li>Descuentos opcionales por cantidad (5+, 10+, 20+ fotos)</li>
                              <li>Aceptación de Términos y Condiciones</li>
                            </ul>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-[#f8f9fa] to-white rounded-xl border-2 border-[#e5e7eb] shadow-sm">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={enableDigitalPhotos}
                                onChange={(e) => setEnableDigitalPhotos(e.target.checked)}
                                className="mt-1 w-5 h-5 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                                disabled={creating}
                              />
                              <div className="flex-1">
                                <span className="text-sm font-semibold text-[#1a1a1a] block mb-1">
                                  💾 Habilitar venta digital
                                </span>
                                <span className="text-xs text-[#6b7280] leading-relaxed">
                                  Los clientes podrán comprar archivos digitales de este álbum.
                                </span>
                              </div>
                            </label>
                          </div>

                          {enableDigitalPhotos && (
                            <>
                              <div className="space-y-5 p-5 bg-white rounded-xl border-2 border-[#e5e7eb] shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-1 h-6 bg-[#10b981] rounded-full"></div>
                                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Configuración Digital</h3>
                                </div>
                                <p className="text-xs text-[#6b7280] mb-4 ml-3">
                                  Configurá el precio y descuentos por cantidad para las fotos digitales.
                                </p>

                                <div>
                                  <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                                    💰 Precio por foto digital (ARS) <span className="text-[#ef4444]">*</span> <span className="text-xs font-normal text-[#6b7280]">(Obligatorio)</span>
                                  </label>
                                  <Input
                                    type="number"
                                    min={systemConfig?.minDigitalPhotoPrice ?? 0}
                                    step="1"
                                    placeholder={systemConfig?.minDigitalPhotoPrice ? `Mínimo ${systemConfig.minDigitalPhotoPrice}` : "Ej: 5000"}
                                    value={digitalPhotoPrice}
                                    onChange={(e) => setDigitalPhotoPrice(e.target.value)}
                                    disabled={creating}
                                    className="w-full"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  <div>
                                    <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Descuento 5+ fotos (%)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      placeholder="0"
                                      value={digitalDiscount5Plus}
                                      onChange={(e) => setDigitalDiscount5Plus(e.target.value)}
                                      disabled={creating}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Descuento 10+ fotos (%)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      placeholder="0"
                                      value={digitalDiscount10Plus}
                                      onChange={(e) => setDigitalDiscount10Plus(e.target.value)}
                                      disabled={creating}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Descuento 20+ fotos (%)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      placeholder="0"
                                      value={digitalDiscount20Plus}
                                      onChange={(e) => setDigitalDiscount20Plus(e.target.value)}
                                      disabled={creating}
                                    />
                                  </div>
                                </div>
                              </div>

                              {digitalPhotoPrice && !isNaN(parseFloat(digitalPhotoPrice)) && (
                                <div className="space-y-4 p-5 bg-gradient-to-br from-[#f0f9ff] to-white rounded-xl border-2 border-[#bfdbfe] shadow-sm">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-6 bg-[#3b82f6] rounded-full"></div>
                                    <h3 className="text-lg font-semibold text-[#1a1a1a]">🧮 Calculadora de precios digitales</h3>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Cantidad de fotos</label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={digitalCalculatorQuantity}
                                      onChange={(e) => setDigitalCalculatorQuantity(Math.max(1, Number(e.target.value) || 1))}
                                      className="max-w-[120px]"
                                    />
                                  </div>
                                  {digitalPriceCalc && (
                                    <div className="p-5 bg-white rounded-lg border-2 border-[#e5e7eb] space-y-3 shadow-sm">
                                      {!digitalPriceCalc.isValid && (
                                        <p className="text-amber-700 text-sm">
                                          ⚠️ El precio debe ser mayor o igual al precio mínimo de {formatARS(digitalPriceCalc.minPrice)}
                                        </p>
                                      )}
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[#6b7280]">Precio por foto digital (tu precio):</span>
                                        <span className="font-medium text-[#1a1a1a]">{formatARS(digitalPriceCalc.price)}</span>
                                      </div>
                                      {digitalPriceCalc.discountPercent > 0 && (
                                        <>
                                          <div className="flex justify-between text-sm">
                                            <span className="text-[#6b7280]">Descuento por cantidad ({digitalPriceCalc.discountPercent.toFixed(1)}%):</span>
                                            <span className="font-medium text-[#10b981]">-{formatARS(digitalPriceCalc.totalSavings)}</span>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                            <span className="text-[#6b7280]">Precio con descuento:</span>
                                            <span className="font-medium text-[#1a1a1a]">{formatARS(digitalPriceCalc.priceAfterDiscount)}</span>
                                          </div>
                                        </>
                                      )}
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[#6b7280]">Fee plataforma ({digitalPriceCalc.platformFeePct.toFixed(1)}%):</span>
                                        <span className="font-medium text-[#c27b3d]">{formatARS(digitalPriceCalc.feePerUnit)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[#6b7280]">Precio final por foto (cliente):</span>
                                        <span className="font-medium text-[#1a1a1a]">{formatARS(digitalPriceCalc.priceAfterDiscountWithFee)}</span>
                                      </div>
                                      <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                        <span className="font-medium text-[#1a1a1a]">Total para {digitalPriceCalc.quantity} {digitalPriceCalc.quantity === 1 ? "foto" : "fotos"}:</span>
                                        <span className="font-semibold text-xl text-[#c27b3d]">{formatARS(digitalPriceCalc.totalForQuantity)}</span>
                                      </div>
                                      {digitalPriceCalc.totalSavings > 0 && (
                                        <p className="text-sm text-[#10b981]">
                                          Ahorro del cliente: {formatARS(digitalPriceCalc.totalSavings)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          <div className="pt-4 border-t border-[#e5e7eb]">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                              setModalTab("impresiones");
                              modalContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                              className="w-full"
                            >
                              Siguiente: Precios Impresiones →
                            </Button>
                          </div>
                        </div>
                      ) : modalTab === "impresiones" ? (
                        <div className="space-y-6">
                          {/* Guía para venta de impresiones - Paso 3 */}
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Precios Impresiones</h4>
                            <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                              {enablePrintedPhotos && (
                                <>
                                  <li>Productos cargados en tu lista de precios o laboratorio seleccionado</li>
                                  <li>Laboratorio para impresiones (si aplica)</li>
                                  <li>Margen de ganancia (mínimo 0%)</li>
                                  <li>Dónde retirará el cliente las fotos</li>
                                </>
                              )}
                              <li>Aceptación de Términos y Condiciones</li>
                            </ul>
                          </div>

                          <div className="space-y-6">
                                <div className="p-5 bg-gradient-to-br from-[#f8f9fa] to-white rounded-xl border-2 border-[#e5e7eb] shadow-sm">
                                  <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={enablePrintedPhotos}
                                      onChange={(e) => {
                                        const next = e.target.checked;
                                        if (next && pricingLoaded && !hasPrintProducts) {
                                          setError("Para habilitar fotos impresas, primero cargá productos en tu lista de precios.");
                                          return;
                                        }
                                        setEnablePrintedPhotos(next);
                                      }}
                                      className="mt-1 w-5 h-5 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                                      disabled={creating}
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm font-semibold text-[#1a1a1a] block mb-1">
                                        📷 Habilitar venta de impresiones físicas
                                      </span>
                                      <span className="text-xs text-[#6b7280] leading-relaxed">
                                        Los clientes podrán comprar fotos impresas de este álbum.
                                      </span>
                                      {pricingLoaded && !hasPrintProducts && (
                                        <span className="mt-2 block text-xs text-amber-700">
                                          Para habilitar esta opción, primero cargá productos en tu lista de precios.
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                </div>

                                {enablePrintedPhotos && (
                                  <>
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                                      {printPricingSource === "PHOTOGRAPHER" ? (
                                        <>
                                          Las impresiones se realizan a cargo del fotógrafo. Los precios se toman de tu lista de productos.
                                          <span className="block mt-1 text-[#6b7280]">Selección de laboratorio próximamente (Fase 2).</span>
                                        </>
                                      ) : (
                                        "Los precios se calculan en base al laboratorio seleccionado."
                                      )}
                                    </div>

                                    <div className="space-y-5 p-5 bg-white rounded-xl border-2 border-[#e5e7eb] shadow-sm">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-6 bg-[#3b82f6] rounded-full"></div>
                                        <h3 className="text-lg font-semibold text-[#1a1a1a]">
                                          Configuración de Impresiones
                                        </h3>
                                      </div>
                                      <p className="text-xs text-[#6b7280] mb-4 ml-3">
                                        Origen de precios y opciones de entrega.
                                      </p>

                                      <div>
                                        <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                                          Origen de precios
                                        </label>
                                        <div className="flex gap-4">
                                          <label className="flex items-center gap-2 p-2.5 border border-[#e5e7eb] rounded-lg cursor-pointer hover:bg-[#f8f9fa] transition-colors">
                                            <input
                                              type="radio"
                                              name="printPricingSource"
                                              value="PHOTOGRAPHER"
                                              checked={printPricingSource === "PHOTOGRAPHER"}
                                              onChange={() => setPrintPricingSource("PHOTOGRAPHER")}
                                              disabled={creating}
                                              className="w-4 h-4 text-[#c27b3d]"
                                            />
                                            <span className="text-sm text-[#1a1a1a]">Mi lista (fotógrafo)</span>
                                          </label>
                                          <label className="flex items-center gap-2 p-2.5 border border-[#e5e7eb] rounded-lg cursor-pointer hover:bg-[#f8f9fa] transition-colors">
                                            <input
                                              type="radio"
                                              name="printPricingSource"
                                              value="LAB_PREFERRED"
                                              checked={printPricingSource === "LAB_PREFERRED"}
                                              onChange={() => setPrintPricingSource("LAB_PREFERRED")}
                                              disabled={creating}
                                              className="w-4 h-4 text-[#c27b3d]"
                                            />
                                            <span className="text-sm text-[#1a1a1a]">Laboratorio preferido</span>
                                          </label>
                                        </div>
                                      </div>

                                      {printPricingSource === "LAB_PREFERRED" && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="md:col-span-2">
                                          <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                                            🏭 Laboratorio para este álbum <span className="text-[#ef4444]">*</span> <span className="text-xs font-normal text-[#6b7280]">(Obligatorio)</span>
                                          </label>
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
                                                  const url = search.trim().length >= 3 ? `/api/labs?search=${encodeURIComponent(search.trim())}` : "/api/labs";
                                                  fetch(url)
                                                    .then((r) => (r.ok ? r.json() : []))
                                                    .then((data) => setLabs(Array.isArray(data) ? data : []))
                                                    .catch(() => setLabs([]));
                                                }}
                                                className="w-full"
                                                aria-label="Buscar laboratorio"
                                                onFocus={() => {
                                                  setShowLabDropdown(true);
                                                  if (!labSearch.trim()) {
                                                    fetch("/api/labs")
                                                      .then((r) => r.json())
                                                      .then((data) => setLabs(Array.isArray(data) ? data : []))
                                                      .catch(() => {});
                                                  }
                                                }}
                                                onBlur={() => {
                                                  setTimeout(() => setShowLabDropdown(false), 150);
                                                }}
                                                disabled={creating || enablePrintedPhotos}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setShowLabDropdown((prev) => !prev);
                                                  if (!labSearch.trim()) {
                                                    fetch("/api/labs")
                                                      .then((r) => r.json())
                                                      .then((data) => setLabs(Array.isArray(data) ? data : []))
                                                      .catch(() => {});
                                                  }
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280]"
                                                aria-label="Mostrar laboratorios"
                                                disabled={creating || enablePrintedPhotos}
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
                                              {showLabDropdown && labs.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-72 overflow-auto rounded-2xl border border-[#eef2f7] bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
                                                  {labs.map((lab) => (
                                                    <button
                                                      key={lab.id}
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedLabId(lab.id);
                                                        setLabSearch(lab.name);
                                                        setShowLabDropdown(false);
                                                      }}
                                                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                                        selectedLabId === lab.id ? "bg-[#fdecec]" : "hover:bg-[#f8fafc]"
                                                      }`}
                                                      disabled={creating || enablePrintedPhotos}
                                                    >
                                                      <div className="flex items-center gap-3">
                                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fdecec] text-[#c27b3d]">
                                                          🏭
                                                        </span>
                                                        <div>
                                                          <div className="font-medium text-[#1a1a1a]">
                                                            {lab.name}
                                                          </div>
                                                          {lab.city && (
                                                            <div className="text-xs text-[#6b7280]">
                                                              {lab.city}{lab.province ? `, ${lab.province}` : ""}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                              {showLabDropdown && labs.length === 0 && labSearch.trim() && (
                                                <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-[#e5e7eb] bg-white shadow-lg px-3 py-2 text-sm text-[#6b7280]">
                                                  No se encontraron laboratorios.
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <p className="text-xs text-[#6b7280] mt-2">
                                            Los precios se calculan con el laboratorio seleccionado en el perfil del fotógrafo.
                                          </p>
                                        </div>
                                      </div>
                                      )}

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                          <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                                            💰 Margen de ganancia (%) <span className="text-[#ef4444]">*</span> <span className="text-xs font-normal text-[#6b7280]">(Obligatorio)</span>
                                          </label>
                                          <Input
                                            type="number"
                                            placeholder="Ej: 0"
                                            value={albumProfitMarginPercent}
                                            onChange={(e) => setAlbumProfitMarginPercent(e.target.value)}
                                            min="0"
                                            step="0.1"
                                            disabled={creating}
                                            className="w-full"
                                          />
                                          <p className="text-xs text-[#6b7280] mt-2">
                                            El margen del álbum representa tu derecho de autor / valor de obra.
                                          </p>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                                            📦 Retiro de fotos <span className="text-[#ef4444]">*</span> <span className="text-xs font-normal text-[#6b7280]">(Obligatorio para laboratorio)</span>
                                          </label>
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-2 p-2.5 border border-[#e5e7eb] rounded-lg cursor-pointer hover:bg-[#f8f9fa] transition-colors">
                                              <input
                                                type="radio"
                                                name="pickupBy"
                                                value="CLIENT"
                                                checked={pickupBy === "CLIENT"}
                                                onChange={(e) => setPickupBy(e.target.value as "CLIENT" | "PHOTOGRAPHER")}
                                                disabled={creating}
                                                className="w-4 h-4 text-[#c27b3d]"
                                              />
                                              <span className="text-sm text-[#1a1a1a]">En el laboratorio</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2.5 border border-[#e5e7eb] rounded-lg cursor-pointer hover:bg-[#f8f9fa] transition-colors">
                                              <input
                                                type="radio"
                                                name="pickupBy"
                                                value="PHOTOGRAPHER"
                                                checked={pickupBy === "PHOTOGRAPHER"}
                                                onChange={(e) => setPickupBy(e.target.value as "CLIENT" | "PHOTOGRAPHER")}
                                                disabled={creating}
                                                className="w-4 h-4 text-[#c27b3d]"
                                              />
                                              <span className="text-sm text-[#1a1a1a]">El fotógrafo entrega</span>
                                            </label>
                                          </div>
                                        </div>
                                      </div>

                                      {enablePrintedPhotos && enableDigitalPhotos && (
                                        <div className="mt-4 p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                                          <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={includeDigitalWithPrint}
                                              onChange={(e) => setIncludeDigitalWithPrint(e.target.checked)}
                                              className="mt-1 w-5 h-5 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                                              disabled={creating}
                                            />
                                            <div className="flex-1">
                                              <span className="text-sm font-semibold text-[#1a1a1a] block mb-1">
                                                📎 Incluir archivo digital con foto impresa
                                              </span>
                                              <span className="text-xs text-[#6b7280]">
                                                Al comprar una foto impresa, también se enviará el archivo digital por email con el descuento configurado
                                              </span>
                                            </div>
                                          </label>
                                          {includeDigitalWithPrint && (
                                            <div className="mt-3">
                                              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">
                                                % de descuento sobre la foto digital incluida
                                              </label>
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  step="1"
                                                  value={digitalWithPrintDiscountPercent}
                                                  onChange={(e) => setDigitalWithPrintDiscountPercent(e.target.value)}
                                                  placeholder="0"
                                                  disabled={creating}
                                                  className="max-w-[140px]"
                                                />
                                                <span className="text-xs text-[#6b7280]">0 a 100</span>
                                              </div>
                                              <p className="text-xs text-[#6b7280] mt-2">
                                                Se aplica al precio digital configurado para este álbum.
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {(printPricingSource === "PHOTOGRAPHER" && photographerProducts.length > 0) || (printPricingSource === "LAB_PREFERRED" && labPricing && pricingLoaded && labPricing.basePrices?.length > 0) ? (
                                      <div className="space-y-4 p-5 bg-gradient-to-br from-[#f0f9ff] to-white rounded-xl border-2 border-[#bfdbfe] shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="w-1 h-6 bg-[#3b82f6] rounded-full"></div>
                                          <h3 className="text-lg font-semibold text-[#1a1a1a]">
                                            🧮 Calculadora de impresiones (desglose)
                                          </h3>
                                        </div>
                                        <p className="text-xs text-[#6b7280] mb-4 ml-3">
                                          Simulá el precio final que verán tus clientes. Orden: base → margen obra → fee plataforma.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                          {printPricingSource === "PHOTOGRAPHER" ? (
                                            <div>
                                              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Producto</label>
                                              <Select
                                                value={calculatorProductId}
                                                onChange={(e) => setCalculatorProductId(e.target.value)}
                                              >
                                                {photographerProducts.map((p) => (
                                                  <option key={p.id} value={String(p.id)}>
                                                    {p.name} {p.size ? `(${p.size})` : ""} — {formatARS(p.retailPrice)}
                                                  </option>
                                                ))}
                                              </Select>
                                            </div>
                                          ) : (
                                            <div>
                                              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Tamaño</label>
                                              <Select
                                                value={calculatorSize}
                                                onChange={(e) => setCalculatorSize(e.target.value)}
                                              >
                                                {labPricing?.basePrices?.map((bp: { size: string }) => (
                                                  <option key={bp.size} value={bp.size}>{bp.size} cm</option>
                                                ))}
                                              </Select>
                                            </div>
                                          )}
                                          <div>
                                            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Cantidad</label>
                                            <Input
                                              type="number"
                                              min="1"
                                              value={calculatorQuantity}
                                              onChange={(e) => setCalculatorQuantity(Number(e.target.value) || 1)}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Tipo de copias</label>
                                            <Select
                                              value={calculatorCopyMode}
                                              onChange={(e) => setCalculatorCopyMode(e.target.value as "SAME_PHOTO" | "DIFFERENT_PHOTOS")}
                                            >
                                              <option value="SAME_PHOTO">Múltiples copias de la misma foto</option>
                                              <option value="DIFFERENT_PHOTOS">Copias de diferentes fotos</option>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Margen álbum (%)</label>
                                            <Input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              placeholder="0"
                                              value={albumProfitMarginPercent}
                                              onChange={(e) => setAlbumProfitMarginPercent(e.target.value)}
                                              disabled={creating}
                                            />
                                          </div>
                                        </div>

                                        {printBreakdown && (
                                          <div className="mt-4 p-5 bg-white rounded-lg border-2 border-[#e5e7eb] space-y-3 shadow-sm">
                                            <div className="flex justify-between text-sm">
                                              <span className="text-[#6b7280]">Precio base (según origen):</span>
                                              <span className="font-medium text-[#1a1a1a]">{formatARS(printBreakdown.baseUnitPrice)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-[#6b7280]">% margen obra (álbum):</span>
                                              <span className="font-medium text-[#1a1a1a]">{printBreakdown.albumMarginPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-[#6b7280]">Precio obra:</span>
                                              <span className="font-medium text-[#1a1a1a]">{formatARS(printBreakdown.priceAfterAlbumMargin)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-[#6b7280]">% fee plataforma:</span>
                                              <span className="font-medium text-[#1a1a1a]">{printBreakdown.platformFeePercent}%</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-[#6b7280]">Fee plataforma (total):</span>
                                              <span className="font-medium text-[#1a1a1a]">{formatARS(printBreakdown.platformFeeTotal)}</span>
                                            </div>
                                            <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                              <span className="font-medium text-[#1a1a1a]">Precio final por unidad (cliente):</span>
                                              <span className="font-semibold text-lg text-[#1a1a1a]">{formatARS(printBreakdown.finalUnitPrice)}</span>
                                            </div>
                                            <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                              <span className="font-medium text-[#1a1a1a]">Total cliente ({printBreakdown.quantity} {printBreakdown.quantity === 1 ? "unidad" : "unidades"}):</span>
                                              <span className="font-semibold text-xl text-[#c27b3d]">{formatARS(printBreakdown.subtotal)}</span>
                                            </div>
                                            {printDigitalAddon.active && (
                                              <div className="pt-2 border-t border-[#e5e7eb] space-y-2">
                                                <div className="flex justify-between text-sm">
                                                  <span className="text-[#6b7280]">Precio obra (digital):</span>
                                                  <span className="font-medium text-[#1a1a1a]">{formatARS(printDigitalAddon.basePrice)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span className="text-[#6b7280]">Descuento digital incluido:</span>
                                                  <span className="font-medium text-[#1a1a1a]">{printDigitalAddon.discountPercent.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span className="text-[#6b7280]">Precio digital con descuento:</span>
                                                  <span className="font-medium text-[#1a1a1a]">{formatARS(printDigitalAddon.discountedBase)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span className="text-[#6b7280]">Fee plataforma digital (por unidad):</span>
                                                  <span className="font-medium text-[#1a1a1a]">{formatARS(printDigitalAddon.feePerUnit)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span className="text-[#6b7280]">Digital incluido ({printDigitalAddon.quantity} {printDigitalAddon.quantity === 1 ? "foto" : "fotos"}):</span>
                                                  <span className="font-medium text-[#1a1a1a]">{formatARS(printDigitalAddon.total)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="font-medium text-[#1a1a1a]">Total con digital:</span>
                                                  <span className="font-semibold text-lg text-[#1a1a1a]">{formatARS(printBreakdown.subtotal + printDigitalAddon.total)}</span>
                                                </div>
                                              </div>
                                            )}
                                            <p className="text-xs text-[#6b7280] pt-2 border-t border-[#e5e7eb]">
                                              El margen del álbum representa tu derecho de autor / valor de obra.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                                        <p className="text-sm text-[#6b7280]">
                                          {printPricingSource === "PHOTOGRAPHER"
                                            ? "Cargá productos en Configuración → Productos para ver la calculadora."
                                            : !photographer?.preferredLabId
                                            ? "Configurá un laboratorio preferido en tu panel de configuración para ver los precios de impresiones."
                                            : "Cargando precios del laboratorio..."}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>

                          {!enablePrintedPhotos && !enableDigitalPhotos && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-sm text-amber-800">
                                ⚠️ Debes habilitar al menos un tipo de venta (impresas o digitales) para que los clientes puedan comprar fotos de este álbum.
                              </p>
                            </div>
                          )}

                          {/* Bloque de aceptación de términos */}
                          <div className="pt-6 border-t-2 border-[#e5e7eb]">
                            <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb] space-y-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  id="terms-checkbox"
                                  checked={termsAccepted}
                                  onChange={(e) => {
                                    setTermsAccepted(e.target.checked);
                                    setTermsError(null);
                                  }}
                                  className="mt-1 w-5 h-5 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                                  disabled={creating}
                                />
                                <label htmlFor="terms-checkbox" className="flex-1 cursor-pointer">
                                  <span className="text-sm text-[#1a1a1a]">
                                    Leí y acepto los{" "}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setShowTermsModal(true);
                                      }}
                                      className="text-[#c27b3d] hover:text-[#a0652d] underline font-medium"
                                    >
                                      Términos y Condiciones para fotógrafos
                                    </button>
                                  </span>
                                </label>
                              </div>
                              {termsError && (
                                <p className="text-sm text-[#ef4444] ml-7">{termsError}</p>
                              )}
                            </div>
                          </div>

                          <div className="pt-4">
                            <Button
                              type="button"
                              variant="primary"
                              onClick={handleCreateAlbum}
                              className="w-full"
                              disabled={creating || !title.trim() || (needsTermsAcceptance && !termsAccepted) || digitalPriceRequiredButInvalid}
                            >
                              {creating ? (editingAlbumId ? "Guardando..." : "Creando...") : (editingAlbumId ? "Guardar Cambios" : "Guardar Álbum")}
                            </Button>
                            {digitalPriceRequiredButInvalid && (
                              <p className="text-xs text-[#ef4444] mt-2 text-center">
                                Configurá el precio por foto digital (mínimo ${systemConfig?.minDigitalPhotoPrice ? systemConfig.minDigitalPhotoPrice.toFixed(2) : "5000.00"}) para poder guardar.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : modalTab === "preventa" && editingAlbumId ? (
                        <div className="space-y-6">
                          <h4 className="text-sm font-semibold text-[#1a1a1a]">Pre-venta</h4>
                          <p className="text-sm text-[#6b7280]">
                            Los clientes eligen productos del catálogo (ej. pack de fotos, fotolibro) y cargan la selfie de cada niño. Podés definir fecha de cierre y si querés aprobar cada pedido antes de producirlo.
                          </p>
                          <p className="text-sm">
                            <Link href="/admin/plantillas/disenador" className="text-[#c27b3d] hover:underline font-medium">
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
                                disabled={creating}
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={precompraRequireApproval}
                                onChange={(e) => setPrecompraRequireApproval(e.target.checked)}
                                disabled={creating}
                              />
                              <span className="text-sm">Requerir aprobación del cliente antes de producir (ej. que elija sus fotos)</span>
                            </label>
                          </div>
                          {precompraCloseAt && (
                            <div className="border border-[#e5e7eb] rounded-lg p-4">
                              <p className="text-xs text-[#6b7280] mb-1">Link del catálogo para compartir con clientes</p>
                              <p className="text-sm text-[#c27b3d] break-all">
                                {typeof window !== "undefined" ? `${window.location.origin}/album/[slug]/preventa` : "/album/[slug]/preventa"}
                              </p>
                              <p className="text-xs text-[#6b7280] mt-2">El slug se muestra al guardar. Podés ver el link completo en el detalle del álbum.</p>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-[#1a1a1a]">Productos del catálogo</span>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  setEditingPrecompraProduct(null);
                                  setPrecompraProductForm({ name: "", description: "", price: "0", minFotos: "1", maxFotos: "1", requiresDesign: false, suggestionText: "", mockupUrl: "" });
                                  setShowPrecompraProductModal(true);
                                }}
                                disabled={creating}
                              >
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
                                      <button
                                        type="button"
                                        onClick={() => {
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
                                        }}
                                        className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!editingAlbumId || !confirm("¿Eliminar este producto?")) return;
                                          try {
                                            const res = await fetch(`/api/dashboard/albums/${editingAlbumId}/precompra-products/${p.id}`, { method: "DELETE" });
                                            if (res.ok) setPrecompraProducts((list) => list.filter((x) => x.id !== p.id));
                                            else throw new Error((await res.json())?.error || "Error al eliminar");
                                          } catch (err: any) {
                                            setError(err?.message || "Error al eliminar");
                                          }
                                        }}
                                        className="text-sm text-red-600 hover:text-red-700 underline"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <p className="text-xs text-[#6b7280]">
                            Los cambios de pre-venta se guardan al hacer clic en &quot;Guardar Cambios&quot; al final del modal.
                          </p>
                        </div>
                      ) : null}
                    </Tabs>
                  </div>

                  {error && (
                    <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-3">
                      <p className="text-[#ef4444] text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end pt-4 border-t border-[#e5e7eb]">
                    <Button
                      variant="secondary"
                      onClick={handleRequestCloseModal}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleCreateAlbum} 
                      disabled={creating || !title.trim() || (!editingAlbumId && !location.trim()) || (needsTermsAcceptance && !termsAccepted) || digitalPriceRequiredButInvalid}
                    >
                      {creating ? (editingAlbumId ? "Guardando..." : "Creando...") : (editingAlbumId ? "Guardar Cambios" : "Crear Álbum")}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Modal producto pre-venta */}
          {showPrecompraProductModal && editingAlbumId && (
            <>
              <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => !precompraProductSaving && setShowPrecompraProductModal(false)} />
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Texto sugerido (opcional)</label>
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
                              if (!file || !editingAlbumId) return;
                              setMockupUploading(true);
                              setError(null);
                              try {
                                const form = new FormData();
                                form.set("file", file);
                                const res = await fetch(`/api/dashboard/albums/${editingAlbumId}/precompra-products/upload-mockup`, { method: "POST", body: form });
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

          {/* Modal de términos y condiciones */}
          {showTermsModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowTermsModal(false)}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <Card className="max-w-5xl w-full max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#e5e7eb]">
                    <h2 className="text-xl font-medium text-[#1a1a1a]">
                      Términos y Condiciones – Fotógrafos
                    </h2>
                    <button
                      onClick={() => setShowTermsModal(false)}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-4 mb-4">
                    <div className="text-sm text-[#6b7280] mb-4 pb-4 border-b border-[#e5e7eb]">
                      Versión: {TERMS_VERSION}
                    </div>
                    <div className="prose prose-base max-w-none text-[#1a1a1a] whitespace-pre-line leading-relaxed" style={{ lineHeight: '1.7' }}>
                      {TERMS_TEXT}
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                    <Button variant="primary" onClick={() => setShowTermsModal(false)}>
                      Cerrar
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

        </div>
      </div>
    </section>
    </>
  );
}
