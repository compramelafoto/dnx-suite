"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import StatusOverlay from "@/components/layout/StatusOverlay";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { feeFromBase } from "@/lib/pricing/fee-formula";
import MercadoPagoIntegration from "@/components/mercadopago/MercadoPagoIntegration";
import ReferidosTab from "@/components/referrals/ReferidosTab";
import dynamic from "next/dynamic";

const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch").then((m) => m.default),
  { ssr: false }
);
const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap").then((m) => m.default),
  { ssr: false, loading: () => <div className="rounded-lg bg-gray-200 h-[200px] flex items-center justify-center text-gray-500 text-sm">Cargando mapa…</div> }
);

type PhotographerData = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tertiaryColor?: string | null;
  fontColor?: string | null;
  headerBackgroundColor?: string | null;
  footerBackgroundColor?: string | null;
  heroBackgroundColor?: string | null;
  pageBackgroundColor?: string | null;
  preferredLabId?: number | null;
  profitMarginPercent?: number | null;
  isPublicPageEnabled?: boolean;
  publicPageHandler?: string | null;
  enableAlbumsPage?: boolean;
  enablePrintPage?: boolean;
  showCarnetPrints?: boolean;
  showPolaroidPrints?: boolean;
  preferredLab?: { id: number; name: string } | null;
  mpAccessToken?: string | null;
  mpUserId?: string | null;
  mpConnectedAt?: string | null;
};

type Lab = {
  id: number;
  name: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

type UpsellStrategyRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  requiredCapabilitiesLabels: string[];
  available: boolean;
  enabledByUser: boolean;
  missingReason: string | null;
};

function UpsellingTab() {
  const [strategies, setStrategies] = useState<UpsellStrategyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/upsell-strategies", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.strategies)) setStrategies(data.strategies);
      } catch (_e) {
        if (!cancelled) setStrategies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">Upselling</h2>
      <p className="text-sm text-[#6b7280] mb-4">
        Las estrategias de venta adicional se muestran a tus clientes según lo que tengas activado en &quot;Qué ofrecés&quot;.
      </p>
      <p className="text-sm text-[#6b7280] mb-4">
        <Link href="/dashboard/sales-settings" className="text-[#c27b3d] hover:underline font-medium">
          Configurar qué ofrecés →
        </Link>
      </p>
      {loading && <p className="text-sm text-[#6b7280]">Cargando estrategias…</p>}
      {!loading && strategies.length === 0 && (
        <p className="text-sm text-[#6b7280]">No hay estrategias disponibles por el momento.</p>
      )}
      {!loading && strategies.length > 0 && (
        <ul className="space-y-3">
          {strategies.map((s) => (
            <li key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-[#111827]/10 bg-[#f9fafb]">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#1a1a1a]">{s.name}</div>
                {s.description && <p className="text-sm text-[#6b7280] mt-0.5">{s.description}</p>}
                {s.requiredCapabilitiesLabels?.length > 0 && (
                  <p className="text-xs text-[#6b7280] mt-1">
                    Requiere: {s.requiredCapabilitiesLabels.join(", ")}
                  </p>
                )}
              </div>
              {s.available ? (
                <span className="text-green-600 text-sm shrink-0">Disponible</span>
              ) : (
                <span
                  className="text-amber-600 text-sm shrink-0 cursor-help border-b border-dotted border-amber-600"
                  title={s.missingReason ?? "Falta configuración"}
                >
                  Bloqueado
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ConfiguracionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [photographer, setPhotographer] = useState<PhotographerData | null>(null);
  const [activeTab, setActiveTab] = useState("datos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusOverlay, setStatusOverlay] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);

  // Estados de formularios
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyOwner, setCompanyOwner] = useState("");
  const [cuit, setCuit] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [tertiaryColor, setTertiaryColor] = useState("");
  const [fontColor, setFontColor] = useState("");
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState("");
  const [footerBackgroundColor, setFooterBackgroundColor] = useState("");
  const [heroBackgroundColor, setHeroBackgroundColor] = useState("");
  const [pageBackgroundColor, setPageBackgroundColor] = useState("");
  const [preferredLabId, setPreferredLabId] = useState<number | null>(null);
  const [profitMarginPercent, setProfitMarginPercent] = useState("");
  const [defaultDigitalPhotoPrice, setDefaultDigitalPhotoPrice] = useState("");
  const [digitalDiscountsEnabled, setDigitalDiscountsEnabled] = useState(false);
  const [digitalDiscount5Plus, setDigitalDiscount5Plus] = useState("");
  const [digitalDiscount10Plus, setDigitalDiscount10Plus] = useState("");
  const [digitalDiscount20Plus, setDigitalDiscount20Plus] = useState("");
  const [isPublicPageEnabled, setIsPublicPageEnabled] = useState(false);
  const [publicPageHandler, setPublicPageHandler] = useState("");
  const [enableAlbumsPage, setEnableAlbumsPage] = useState(false);
  const [enablePrintPage, setEnablePrintPage] = useState(false);
  const [showCarnetPrints, setShowCarnetPrints] = useState(false);
  const [showPolaroidPrints, setShowPolaroidPrints] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  
  // Estados para búsqueda de laboratorios y modal
  const [labSearch, setLabSearch] = useState("");
  const [filteredLabs, setFilteredLabs] = useState<Lab[]>([]);
  const [showLabDropdown, setShowLabDropdown] = useState(false);
  const [showLabModal, setShowLabModal] = useState(false);
  const [selectedLabForView, setSelectedLabForView] = useState<Lab | null>(null);
  const [selectedLabPricing, setSelectedLabPricing] = useState<any>(null);
  
  // Estados para la calculadora
  const [systemSettings, setSystemSettings] = useState<{
    minDigitalPhotoPrice?: number;
    platformCommissionPercent?: number;
  }>({});
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState<number | null>(null);
  const [pricingSource, setPricingSource] = useState<"LAB" | "PHOTOGRAPHER" | null>(null);
  const [labPricing, setLabPricing] = useState<any>(null);
  const [calculatorType, setCalculatorType] = useState<"printed" | "digital">("printed");
  const [calculatorSize, setCalculatorSize] = useState("10x15");
  const [calculatorQuantity, setCalculatorQuantity] = useState(1);
  const [calculatorDigitalPrice, setCalculatorDigitalPrice] = useState("");
  const [products, setProducts] = useState<
    Array<{
      id?: number;
      name: string;
      size: string | null;
      acabado: string | null;
      retailPrice: number;
      currency: string;
      isActive: boolean;
    }>
  >([]);

  const normalizeProductName = (name: string) => name.trim().toLowerCase();
  const isCarnetProduct = (product: { name: string }) => {
    const normalized = normalizeProductName(product.name || "");
    return normalized === "fotos carnet" || normalized === "foto carnet";
  };
  const isPolaroidProduct = (product: { name: string }) => {
    const normalized = normalizeProductName(product.name || "");
    return normalized === "polaroid" || normalized === "polaroids";
  };

  const orderedProducts = useMemo(() => {
    const shouldPinCarnet = showCarnetPrints;
    const shouldPinPolaroid = showPolaroidPrints;
    return products
      .map((product, index) => ({ product, index }))
      .sort((a, b) => {
        const aRank = isCarnetProduct(a.product) && shouldPinCarnet
          ? 0
          : isPolaroidProduct(a.product) && shouldPinPolaroid
            ? 1
            : 2;
        const bRank = isCarnetProduct(b.product) && shouldPinCarnet
          ? 0
          : isPolaroidProduct(b.product) && shouldPinPolaroid
            ? 1
            : 2;
        if (aRank !== bRank) return aRank - bRank;
        return a.index - b.index;
      });
  }, [products, showCarnetPrints, showPolaroidPrints]);

  const getCarnetProduct = (product: { name: string }) => isCarnetProduct(product);
  const getPolaroidProduct = (product: { name: string }) => isPolaroidProduct(product);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>("");
  

  // Estado para conteo de solicitudes pendientes
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number>(0);

  useEffect(() => {
    if (!success) return;
    setStatusOverlay({ message: success, variant: "success" });
    const t = setTimeout(() => setStatusOverlay(null), 1400);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    setStatusOverlay({ message: error, variant: "error" });
    const t = setTimeout(() => setStatusOverlay(null), 2200);
    return () => clearTimeout(t);
  }, [error]);

  // Mantener marketing y reconocimiento facial siempre activos (sin opción de desactivar)
  useEffect(() => {
    if (!photographer?.id || marketingOptIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me/marketing-opt-in", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingOptIn: true, source: "profile" }),
        });
        if (res.ok && !cancelled) setMarketingOptIn(true);
      } catch (_err) {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [photographer?.id, marketingOptIn]);

  useEffect(() => {
    // Verificar si hay datos en query params (de Google OAuth)
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get("user");
    const tabParam = urlParams.get("tab");
    const mpConnected = urlParams.get("mp_connected");
    const mpError = urlParams.get("mp_error");
    
    // Si hay un tab en los query params, activarlo (se hace en el otro useEffect con la lista de tabs válidos)
    
    // Manejar resultado de conexión con Mercado Pago
    if (mpConnected === "true") {
      setSuccess("¡Conexión con Mercado Pago exitosa!");
      setTimeout(() => {
        setSuccess(null);
        window.history.replaceState({}, "", window.location.pathname);
        // Recargar datos del fotógrafo para obtener el estado de conexión
        if (photographer?.id) {
          loadPhotographerData(photographer.id);
        }
      }, 3000);
    }
    
    if (mpError) {
      setError(`Error conectando con Mercado Pago: ${mpError}`);
      setTimeout(() => {
        setError(null);
        window.history.replaceState({}, "", window.location.pathname);
      }, 5000);
    }
    
    if (userParam) {
      try {
        const data = JSON.parse(decodeURIComponent(userParam));
        loadPhotographerData(data.id);
        sessionStorage.setItem("photographer", JSON.stringify(data));
        sessionStorage.setItem("photographerId", data.id.toString());
        window.history.replaceState({}, "", window.location.pathname);
        return;
      } catch (e) {
        console.error("Error parsing user param:", e);
      }
    }

    async function ensureSession() {
      const session = await ensurePhotographerSession();
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      loadPhotographerData(session.photographerId);
    }
    ensureSession();

    // Cargar laboratorios
    loadLabs();
  }, [router]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    async function loadSystemSettings() {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setSystemSettings({
          minDigitalPhotoPrice: data?.minDigitalPhotoPrice ?? 5000,
          platformCommissionPercent: data?.platformCommissionPercent ?? 10,
        });
      } catch (err) {
        console.warn("Error cargando configuración del sistema:", err);
      }
    }
    loadSystemSettings();
  }, []);

  async function loadLabs(search?: string) {
    try {
      const url = search ? `/api/labs?search=${encodeURIComponent(search)}` : "/api/labs";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLabs(data as Lab[]);
          setFilteredLabs(data as Lab[]);
        }
      }
    } catch (err) {
      console.error("Error cargando laboratorios:", err);
    }
  }

  async function loadProducts() {
    setProductsLoading(true);
    setProductsError("");
    try {
      const res = await fetch("/api/fotografo/products");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.products) ? data.products : [];
        setProducts(
          list.map((p: any) => ({
            id: p.id,
            name: p.name || "",
            size: p.size || null,
            acabado: p.acabado || null,
            retailPrice: Number(p.retailPrice ?? 0),
            currency: p.currency || "ARS",
            isActive: p.isActive !== false,
          }))
        );
      } else {
        const error = await res.json().catch(() => ({ error: "Error desconocido" }));
        setProductsError(error.error || "Error cargando productos");
      }
    } catch (err: any) {
      console.error("Error cargando productos:", err);
      setProductsError(err?.message || "Error cargando productos");
    } finally {
      setProductsLoading(false);
    }
  }

  function updateProduct(index: number, key: string, value: any) {
    setProducts((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function duplicateProduct(index: number) {
    setProducts((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const clone = { ...current, id: undefined };
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
    });
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function loadPhotographerPricing(photographerId: number) {
    try {
      const res = await fetch(`/api/lab/pricing?photographerId=${photographerId}`);
      if (res.ok) {
        const data = await res.json();
        setLabPricing(data);
        setPricingSource("PHOTOGRAPHER");
        const percent = Number(data?.platformCommissionPercent);
        setPlatformCommissionPercent(Number.isFinite(percent) ? percent : null);
        return data;
      }
    } catch (err) {
      console.error("Error cargando pricing del fotógrafo:", err);
    }
    return null;
  }

  async function loadLabPricing(labId: number, photographerId?: number | null) {
    try {
      const params = new URLSearchParams({ labId: String(labId) });
      if (photographerId && Number.isFinite(photographerId)) {
        params.set("photographerId", String(photographerId));
      }
      const res = await fetch(`/api/public/lab-pricing?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLabPricing(data);
        setPricingSource("LAB");
        const percent = Number(data?.platformCommissionPercent);
        setPlatformCommissionPercent(Number.isFinite(percent) ? percent : null);
        return data;
      }
    } catch (err) {
      console.error("Error cargando precios del laboratorio:", err);
    }
    return null;
  }


  async function handleViewLabPrices(labId: number) {
    const lab = labs.find((l) => l.id === labId);
    if (!lab) return;
    
    setSelectedLabForView(lab);
    const pricing = await loadLabPricing(labId, photographer?.id ?? null);
    setSelectedLabPricing(pricing);
    setShowLabModal(true);
  }


  // Cerrar modal de laboratorio con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && showLabModal) {
        setShowLabModal(false);
      }
    }
    if (showLabModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showLabModal]);

  // Cargar conteo de solicitudes pendientes
  useEffect(() => {
    if (photographer?.id) {
      loadPendingRemovalCount(photographer.id);
      // Recargar cada 30 segundos para mantener actualizado
      const interval = setInterval(() => {
        loadPendingRemovalCount(photographer.id);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [photographer?.id]);

  async function loadPendingRemovalCount(photographerId: number) {
    try {
      const params = new URLSearchParams({
        photographerId: photographerId.toString(),
        status: "PENDING",
      });
      const res = await fetch(`/api/dashboard/removal-requests?${params}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPendingRemovalCount(data.length);
      }
    } catch (err) {
      // Silenciar errores, no es crítico
      console.warn("Error cargando conteo de solicitudes pendientes:", err);
    }
  }

  useEffect(() => {
    // Escuchar eventos de actualización de solicitudes
    const handleUpdate = () => {
      if (photographer?.id) {
        loadPendingRemovalCount(photographer.id);
      }
    };
    window.addEventListener('removalRequestUpdated', handleUpdate);
    return () => window.removeEventListener('removalRequestUpdated', handleUpdate);
  }, [photographer?.id]);

  // Manejar parámetro tab de la URL
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab && ["datos", "diseno", "laboratorio", "productos", "mercadopago", "referidos", "upselling"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  async function loadPhotographerData(id: number) {
    try {
      const res = await fetch(`/api/fotografo/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPhotographer(data);
        setName(data.name || "");
        setLogoUrl(data.logoUrl || null);
        setPrimaryColor(data.primaryColor || "");
        setSecondaryColor(data.secondaryColor || "");
        setTertiaryColor(data.tertiaryColor || "");
        setFontColor(data.fontColor || "");
        setHeaderBackgroundColor(data.headerBackgroundColor || "");
        setFooterBackgroundColor(data.footerBackgroundColor || "");
        setHeroBackgroundColor(data.heroBackgroundColor || "");
        setPageBackgroundColor(data.pageBackgroundColor || "");
        setName(data.name || "");
        setPhone(data.phone || "");
        setCity(data.city || "");
        setProvince(data.province || "");
        setCountry(data.country || "");
        setAddress(data.address || "");
        setLatitude(data.latitude != null ? String(data.latitude) : "");
        setLongitude(data.longitude != null ? String(data.longitude) : "");
        setBirthDate(data.birthDate ? new Date(data.birthDate).toISOString().split('T')[0] : "");
        setCompanyName(data.companyName || "");
        setCompanyOwner(data.companyOwner || "");
        setCuit(data.cuit || "");
        setCompanyAddress(data.companyAddress || "");
        setWebsite(data.website || "");
        setInstagram(data.instagram || "");
        setTiktok(data.tiktok || "");
        setFacebook(data.facebook || "");
        setWhatsapp(data.whatsapp || "");
        setPreferredLabId(data.preferredLabId || null);
        setProfitMarginPercent(data.profitMarginPercent?.toString() || "");
        setDefaultDigitalPhotoPrice(data.defaultDigitalPhotoPrice ? String(data.defaultDigitalPhotoPrice) : "");
        setDigitalDiscountsEnabled(data.digitalDiscountsEnabled || false);
        setDigitalDiscount5Plus(data.digitalDiscount5Plus?.toString() || "");
        setDigitalDiscount10Plus(data.digitalDiscount10Plus?.toString() || "");
        setDigitalDiscount20Plus(data.digitalDiscount20Plus?.toString() || "");
        setIsPublicPageEnabled(data.isPublicPageEnabled || false);
        setPublicPageHandler(data.publicPageHandler || "");
        setEnableAlbumsPage(data.enableAlbumsPage ?? false);
        setEnablePrintPage(data.enablePrintPage ?? false);
        setShowCarnetPrints(data.showCarnetPrints ?? false);
        setShowPolaroidPrints(data.showPolaroidPrints ?? false);
        setMarketingOptIn(data.marketingOptIn ?? false);
        
        // Cargar pricing para la calculadora
        if (data.preferredLabId) {
          loadLabPricing(data.preferredLabId, data.id);
        } else {
          loadPhotographerPricing(data.id);
        }
        
      } else {
        // Si no existe la API, usar datos de sessionStorage
        const saved = sessionStorage.getItem("photographer");
        if (saved) {
          const data = JSON.parse(saved);
          setPhotographer(data);
          setName(data.name || "");
        }
      }
    } catch (err) {
      console.error("Error cargando datos del fotógrafo:", err);
      const saved = sessionStorage.getItem("photographer");
      if (saved) {
        const data = JSON.parse(saved);
        setPhotographer(data);
        setName(data.name || "");
      }
    }
  }

  async function handleLogoUpload() {
    if (!logoFile) {
      setError("No se seleccionó ningún archivo");
      return;
    }

    if (!photographer) {
      setError("No hay datos del fotógrafo cargados");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append("photographerId", photographer.id.toString());

      console.log("Subiendo logo para fotógrafo:", photographer.id);

      const res = await fetch("/api/fotografo/upload-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        console.error("Error en respuesta de upload:", data);
        throw new Error(data?.error || data?.detail || "Error subiendo logo");
      }

      setLogoUrl(data.logoUrl);
      setLogoFile(null);
      setSuccess("Logo subido correctamente");
      setTimeout(() => setSuccess(null), 3000);
      
      // Actualizar el estado del fotógrafo con la nueva URL del logo
      if (photographer) {
        setPhotographer({ ...photographer, logoUrl: data.logoUrl });
      }
    } catch (err: any) {
      console.error("Error en handleLogoUpload:", err);
      setError(err?.message || "Error subiendo logo. Verifica la consola para más detalles.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!photographer) {
      setError("No hay datos del fotógrafo cargados");
      return;
    }

    const minPrice = systemSettings.minDigitalPhotoPrice
      ? systemSettings.minDigitalPhotoPrice
      : 0;
    if (
      defaultDigitalPhotoPrice &&
      !isNaN(parseFloat(defaultDigitalPhotoPrice)) &&
      parseFloat(defaultDigitalPhotoPrice) < minPrice
    ) {
      setError(`El precio digital debe ser mayor o igual a $${minPrice.toFixed(2)}`);
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const updateData: any = {
        photographerId: photographer.id,
        name: name.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        country: country.trim() || null,
        address: address.trim() || null,
        latitude: latitude ? (parseFloat(latitude) || null) : null,
        longitude: longitude ? (parseFloat(longitude) || null) : null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        companyName: companyName.trim() || null,
        companyOwner: companyOwner.trim() || null,
        cuit: cuit.trim() || null,
        companyAddress: companyAddress.trim() || null,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        tiktok: tiktok.trim() || null,
        facebook: facebook.trim() || null,
        whatsapp: whatsapp.trim() || null,
        primaryColor: primaryColor?.trim() || null,
        secondaryColor: secondaryColor?.trim() || null,
        tertiaryColor: tertiaryColor?.trim() || null,
        fontColor: fontColor?.trim() || null,
        headerBackgroundColor: headerBackgroundColor?.trim() || null,
        footerBackgroundColor: footerBackgroundColor?.trim() || null,
        heroBackgroundColor: heroBackgroundColor?.trim() || null,
        pageBackgroundColor: pageBackgroundColor?.trim() || null,
        preferredLabId: preferredLabId || null,
        profitMarginPercent: profitMarginPercent ? Number(profitMarginPercent) : null,
        defaultDigitalPhotoPrice: defaultDigitalPhotoPrice && !isNaN(parseFloat(defaultDigitalPhotoPrice)) ? Math.round(parseFloat(defaultDigitalPhotoPrice)) : null,
        digitalDiscountsEnabled,
        digitalDiscount5Plus: digitalDiscount5Plus && !isNaN(parseFloat(digitalDiscount5Plus)) ? parseFloat(digitalDiscount5Plus) : null,
        digitalDiscount10Plus: digitalDiscount10Plus && !isNaN(parseFloat(digitalDiscount10Plus)) ? parseFloat(digitalDiscount10Plus) : null,
        digitalDiscount20Plus: digitalDiscount20Plus && !isNaN(parseFloat(digitalDiscount20Plus)) ? parseFloat(digitalDiscount20Plus) : null,
        isPublicPageEnabled,
        publicPageHandler: publicPageHandler.trim() || null,
        enableAlbumsPage,
        enablePrintPage,
        showCarnetPrints,
        showPolaroidPrints,
      };

      console.log("Enviando datos de actualización:", updateData);

      const res = await fetch("/api/fotografo/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      
      if (!res.ok) {
        console.error("Error en respuesta:", data);
        throw new Error(data?.error || data?.detail || "Error guardando datos");
      }

      setPhotographer(data);
      setSuccess("Datos guardados correctamente");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error en handleSave:", err);
      setError(err?.message || "Error al guardar. Verifica la consola para más detalles.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    // Limpiar sessionStorage
    sessionStorage.removeItem("photographer");
    sessionStorage.removeItem("photographerId");
    
    // Llamar al endpoint de logout para limpiar cookies
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }

    window.location.assign("/login?logout=success");
  }

  const tabs = useMemo(
    () => [
      { id: "datos", label: "Datos personales" },
      { id: "diseno", label: "Diseño" },
      { id: "laboratorio", label: "Laboratorio y márgenes" },
      { id: "mercadopago", label: "Mercado Pago" },
      { id: "productos", label: "Productos" },
      { id: "upselling", label: "Upselling" },
      { id: "referidos", label: "Referidos" },
    ],
    []
  );

  useEffect(() => {
    const requestedTab = searchParams?.get("tab");
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams, tabs]);

  if (!photographer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={null} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {statusOverlay && (
        <StatusOverlay message={statusOverlay.message} variant={statusOverlay.variant} />
      )}
      <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer ? {
        id: photographer.id,
        name: photographer.name,
        logoUrl: photographer.logoUrl ?? null,
        primaryColor: photographer.primaryColor ?? null,
        secondaryColor: photographer.secondaryColor ?? null,
      } : null} />
      <div className="container-custom py-8">
        <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Panel de configuración
            </h1>
            <p className="text-gray-600">
              Configurá tus datos personales, diseño visual, conexiones con Mercado Pago y preferencias de operación desde este panel centralizado.
            </p>
          </div>

          {/* Mensajes */}
          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{error}</p>
            </Card>
          )}

          {success && (
            <Card className="bg-[#10b981]/10 border-[#10b981]">
              <p className="text-[#10b981]">{success}</p>
            </Card>
          )}

          {/* Contenido según ?tab= (se accede desde el menú lateral) */}
            {/* Tab: Datos Personales */}
            {activeTab === "datos" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Datos personales</h2>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={photographer.email}
                    disabled
                    className="bg-[#f3f4f6] cursor-not-allowed"
                  />
                  <p className="text-xs text-[#6b7280] mt-1">
                    El email no se puede modificar
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Nombre
                  </label>
                  <Input
                    type="text"
                    placeholder="Tu nombre completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Teléfono
                  </label>
                  <Input
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Ciudad
                    </label>
                    <Input
                      type="text"
                      placeholder="Ciudad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Provincia
                    </label>
                    <Input
                      type="text"
                      placeholder="Provincia"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      País
                    </label>
                    <Input
                      type="text"
                      placeholder="País"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Domicilio
                  </label>
                  <Input
                    type="text"
                    placeholder="Dirección completa"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Ubicación en el mapa (domicilio georeferenciado)
                  </label>
                  <p className="text-xs text-[#6b7280] mb-2">
                    Buscá tu dirección para guardar las coordenadas. Así tu perfil muestra tu ubicación y podés recibir invitaciones a eventos cercanos.
                  </p>
                  <EventLocationSearch
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    onSelect={(lat, lon, displayName) => {
                      setLatitude(String(lat));
                      setLongitude(String(lon));
                      setAddress(displayName);
                      const parts = displayName.split(",").map((s) => s.trim()).filter(Boolean);
                      if (parts.length >= 2) setCity(parts[1]);
                      else if (parts.length === 1) setCity(parts[0]);
                    }}
                  />
                  {latitude && longitude && (parseFloat(latitude) !== 0 || parseFloat(longitude) !== 0) && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200" style={{ height: "200px" }}>
                      <EventLocationMap
                        latitude={parseFloat(latitude)}
                        longitude={parseFloat(longitude)}
                        editable={false}
                        height="200px"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Fecha de nacimiento
                  </label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div className="pt-4 border-t border-[#e5e7eb]">
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Datos de la empresa</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Nombre de la empresa
                      </label>
                      <Input
                        type="text"
                        placeholder="Nombre de la empresa o estudio"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Nombre del titular
                      </label>
                      <Input
                        type="text"
                        placeholder="Nombre completo del titular"
                        value={companyOwner}
                        onChange={(e) => setCompanyOwner(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        CUIT
                      </label>
                      <Input
                        type="text"
                        placeholder="XX-XXXXXXXX-X"
                        value={cuit}
                        onChange={(e) => setCuit(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Domicilio de la empresa
                      </label>
                      <Input
                        type="text"
                        placeholder="Ej: Av. Corrientes 1234, CABA"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Redes sociales y contacto */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">
                    Redes Sociales y Contacto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Página Web
                      </label>
                      <Input
                        type="url"
                        placeholder="https://www.tusitio.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Instagram
                      </label>
                      <Input
                        type="text"
                        placeholder="@tuinstagram o https://instagram.com/tuinstagram"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        TikTok
                      </label>
                      <Input
                        type="text"
                        placeholder="@tutiktok o https://tiktok.com/@tutiktok"
                        value={tiktok}
                        onChange={(e) => setTiktok(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Facebook
                      </label>
                      <Input
                        type="text"
                        placeholder="https://facebook.com/tupagina"
                        value={facebook}
                        onChange={(e) => setFacebook(e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        WhatsApp
                      </label>
                      <Input
                        type="tel"
                        placeholder="Ej: +5491123456789"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                      <p className="text-xs text-[#6b7280] mt-1">
                        Incluí el código de país (ej: +54 para Argentina)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Tab: Diseño */}
            {activeTab === "diseno" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Diseño de tu landing page</h2>
                <p className="text-sm text-[#6b7280]">
                  Personalizá todos los colores de tu página pública: barra superior, pie de página, botones, textos, tarjetas y enlaces. Cada color se aplica en varias partes de tu landing para que puedas darle tu identidad visual.
                </p>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Logo (PNG)
                  </label>
                  <p className="text-xs text-[#6b7280] mb-3">
                    Subí tu logo en formato PNG. Se mostrará en el borde superior izquierdo de tu página personalizada.
                    Dimensiones recomendadas: 180x54px (igual que el logo de ComprameLaFoto).
                  </p>
                  {logoUrl && (
                    <div className="mb-4 p-4 border border-[#e5e7eb] rounded-lg bg-[#f8f9fa]">
                      <Image
                        src={logoUrl}
                        alt="Logo actual"
                        width={180}
                        height={54}
                        className="h-12 w-auto object-contain"
                      />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <Input
                      type="file"
                      accept="image/png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "image/png") {
                            setError("El archivo debe ser PNG");
                            return;
                          }
                          setLogoFile(file);
                        }
                      }}
                      className="py-2"
                    />
                    {logoFile && (
                      <Button
                        variant="primary"
                        onClick={handleLogoUpload}
                        disabled={loading}
                      >
                        {loading ? "Subiendo..." : "Subir logo"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Colores */}
                <h3 className="text-base font-medium text-[#1a1a1a] pt-2">Colores de tu landing page</h3>
                <p className="text-xs text-[#6b7280] -mt-1">
                  Estos colores se aplican en toda tu página pública (inicio, álbumes, impresión, compra). Usá el selector o ingresá un código hex (ej: #c27b3d).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Color principal
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={primaryColor || "#c27b3d"}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#c27b3d"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Se usa en: botones principales, enlaces, íconos destacados y fondos suaves de bloques en tu landing.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Color secundario (respaldo y secciones)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={secondaryColor || "#2d2d2d"}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#2d2d2d"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Se usa como respaldo de header, footer, hero y fondo de página si no definís los colores específicos abajo; y en fondos suaves de secciones.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Color terciario (tarjetas y botones secundarios)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={tertiaryColor || "#c27b3d"}
                        onChange={(e) => setTertiaryColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#c27b3d"
                        value={tertiaryColor}
                        onChange={(e) => setTertiaryColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Se usa en: bordes de tarjetas, botones de acción (Imprimir, Comprar fotos), íconos en círculos y recuadros destacados.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Color de texto
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={fontColor || "#1a1a1a"}
                        onChange={(e) => setFontColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#1a1a1a"
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Se usa en: títulos, párrafos y textos generales de toda la landing (inicio, álbumes, impresión y compra).
                    </p>
                  </div>
                </div>

                <h3 className="text-base font-medium text-[#1a1a1a] pt-4">Colores de fondo (header, footer, título y página)</h3>
                <p className="text-xs text-[#6b7280] -mt-1 mb-2">
                  Opcionales. El header público usa por defecto fondo blanco (mejor contraste con el logo). El hero y otros bloques pueden usar el color secundario si no definís un color propio.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Fondo del header (barra superior)</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={headerBackgroundColor || "#ffffff"}
                        onChange={(e) => setHeaderBackgroundColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#ffffff"
                        value={headerBackgroundColor}
                        onChange={(e) => setHeaderBackgroundColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Vacío = blanco en la web pública para que el logo se distinga. Podés poner un color de marca si preferís.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Fondo del footer (pie de página)</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={footerBackgroundColor || "#2d2d2d"}
                        onChange={(e) => setFooterBackgroundColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#2d2d2d"
                        value={footerBackgroundColor}
                        onChange={(e) => setFooterBackgroundColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Color de fondo del pie de página de tu landing.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Fondo del título superior (hero)</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={heroBackgroundColor || "#2d2d2d"}
                        onChange={(e) => setHeroBackgroundColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#2d2d2d"
                        value={heroBackgroundColor}
                        onChange={(e) => setHeroBackgroundColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Color de fondo del bloque principal con el mensaje de bienvenida (hero) en la parte superior.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Fondo de la página (secciones)</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={pageBackgroundColor || "#ffffff"}
                        onChange={(e) => setPageBackgroundColor(e.target.value)}
                        className="w-20 h-12 p-1"
                      />
                      <Input
                        type="text"
                        placeholder="#ffffff"
                        value={pageBackgroundColor}
                        onChange={(e) => setPageBackgroundColor(e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Color de fondo de las secciones del contenido (álbumes, impresión, etc.). Suele ser blanco o un gris muy suave.
                    </p>
                  </div>
                </div>

                {/* Sección: Página Pública */}
                <div className="pt-6 border-t border-[#e5e7eb]">
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Página pública personalizada</h3>

                  <div>
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={isPublicPageEnabled}
                        onChange={(e) => setIsPublicPageEnabled(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-[#1a1a1a]">
                        Habilitar página de venta personalizada
                      </span>
                    </label>
                    <p className="text-xs text-[#6b7280] mb-4">
                      Al habilitar esta opción, tus clientes podrán acceder a tu página personalizada con tu logo y colores.
                    </p>
                  </div>

                  {isPublicPageEnabled && (
                    <>
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                          Handler (URL personalizada)
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6b7280]">compramelafoto.com/f/</span>
                          <Input
                            type="text"
                            placeholder="juanfoto"
                            value={publicPageHandler}
                            onChange={(e) => setPublicPageHandler(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            pattern="^[a-z0-9-]+$"
                          />
                        </div>
                        <p className="text-xs text-[#6b7280] mt-1">
                          Solo letras minúsculas, números y guiones. Ejemplo: juanfoto, estudio-fotografia
                        </p>
                        {publicPageHandler && (
                          <div className="mt-2 space-y-4">
                            <div className="p-3 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-[#1a1a1a]">
                                  Tu página estará disponible en:{" "}
                                  <span className="font-mono text-[#c27b3d]">
                                    {typeof window !== "undefined" ? window.location.origin : ""}/{publicPageHandler}
                                  </span>
                                </p>
                                <button
                                  onClick={async () => {
                                    const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${publicPageHandler}`;
                                    try {
                                      await navigator.clipboard.writeText(fullUrl);
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    } catch (err) {
                                      console.error("Error copiando URL:", err);
                                      const textArea = document.createElement("textarea");
                                      textArea.value = fullUrl;
                                      textArea.style.position = "fixed";
                                      textArea.style.opacity = "0";
                                      document.body.appendChild(textArea);
                                      textArea.select();
                                      try {
                                        document.execCommand("copy");
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                      } catch (e) {
                                        console.error("Error copiando URL:", e);
                                      }
                                      document.body.removeChild(textArea);
                                    }
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#6b7280] hover:text-[#1a1a1a] hover:bg-white rounded-lg border border-[#e5e7eb] transition-colors"
                                  title="Copiar URL"
                                >
                                  {copied ? (
                                    <>
                                      <svg className="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-[#10b981]">Copiado</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      <span>Copiar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                              {/* Código HTML para incrustar */}
                              <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d]">
                                <p className="text-sm font-medium text-white mb-2">
                                  Código HTML para insertar en tu web
                                </p>
                                <p className="text-xs text-gray-400 mb-3">
                                  Copiá este código y pegálo en tu sitio web. La versión incrustada no muestra logo (ideal para tu web).
                                </p>
                                <pre className="text-xs text-gray-300 overflow-x-auto p-3 bg-black/30 rounded border border-[#333] font-mono whitespace-pre-wrap break-all">
{`<iframe src="${typeof window !== "undefined" ? window.location.origin : "https://compramelafoto.com"}/${publicPageHandler}?embed=1" width="100%" height="800" frameborder="0" style="border: none; min-height: 800px;"></iframe>`}
                                </pre>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://compramelafoto.com";
                                    const html = `<iframe src="${baseUrl}/${publicPageHandler}?embed=1" width="100%" height="800" frameborder="0" style="border: none; min-height: 800px;"></iframe>`;
                                    try {
                                      await navigator.clipboard.writeText(html);
                                      setCopiedHtml(true);
                                      setTimeout(() => setCopiedHtml(false), 2000);
                                    } catch (err) {
                                      const textArea = document.createElement("textarea");
                                      textArea.value = html;
                                      textArea.style.position = "fixed";
                                      textArea.style.opacity = "0";
                                      document.body.appendChild(textArea);
                                      textArea.select();
                                      try {
                                        document.execCommand("copy");
                                        setCopiedHtml(true);
                                        setTimeout(() => setCopiedHtml(false), 2000);
                                      } catch (e) {
                                        console.error("Error copiando HTML:", e);
                                      }
                                      document.body.removeChild(textArea);
                                    }
                                  }}
                                  className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                  title="Copiar código HTML"
                                >
                                  {copiedHtml ? (
                                    <>
                                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-green-400">Código copiado</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      <span>Copiar código HTML</span>
                                    </>
                                  )}
                                </button>
                              </div>
                          </div>
                        )}
                      </div>

                      {/* Opciones de páginas habilitadas */}
                      <div className="space-y-4 mb-6">
                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={enableAlbumsPage}
                              onChange={(e) => setEnableAlbumsPage(e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              Habilitar página de "Mis albums"
                            </span>
                          </label>
                          <p className="text-xs text-[#6b7280] ml-6">
                            Los clientes podrán ver y acceder a tus álbumes desde la página principal.
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={enablePrintPage}
                              onChange={(e) => setEnablePrintPage(e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              Habilitar página de "Imprimir"
                            </span>
                          </label>
                          <p className="text-xs text-[#6b7280] ml-6">
                            Los clientes podrán subir y imprimir sus propias fotos desde la página principal.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#e5e7eb]">
                          <p className="text-xs uppercase tracking-wide text-[#6b7280] mb-3">
                            Opciones de impresión
                          </p>
                          <div className="space-y-3">
                            <div>
                              <label className="flex items-center gap-2 mb-1">
                                <input
                                  type="checkbox"
                                  checked={showCarnetPrints}
                                  onChange={(e) => setShowCarnetPrints(e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm font-medium text-[#1a1a1a]">
                                  Mostrar Fotos Carnet
                                </span>
                              </label>
                              <p className="text-xs text-[#6b7280] ml-6">
                                Habilita el flujo de foto carnet dentro de Imprimir fotos.
                              </p>
                            </div>

                            <div>
                              <label className="flex items-center gap-2 mb-1">
                                <input
                                  type="checkbox"
                                  checked={showPolaroidPrints}
                                  onChange={(e) => setShowPolaroidPrints(e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm font-medium text-[#1a1a1a]">
                                  Mostrar Polaroids
                                </span>
                              </label>
                              <p className="text-xs text-[#6b7280] ml-6">
                                Habilita el flujo de polaroids dentro de Imprimir fotos.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                        <p className="text-sm text-[#1a1a1a] font-medium mb-2">
                          📋 Características de tu página personalizada:
                        </p>
                        <ul className="text-sm text-[#6b7280] space-y-1 list-disc list-inside">
                          <li>Home con botones para acceder a tus álbumes y/o imprimir fotos (según lo que habilites)</li>
                          <li>Encabezado con tu logo PNG (mismas dimensiones que el logo de ComprameLaFoto)</li>
                          <li>Colores personalizados aplicados a toda la interfaz</li>
                          <li>Footer con enlace "Trabajar con ComprameLaFoto"</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Tab: Laboratorio y Márgenes */}
            {activeTab === "laboratorio" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Laboratorio y márgenes</h2>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Laboratorio preferido/recomendado
                  </label>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                    <p className="text-sm text-amber-800 font-medium">
                      ⚠️ Próximamente vas a poder definir tu laboratorio preferido para que tus clientes hagan el pedido directo ahí.
                      Si sos fotógrafo freelancer, los precios y cálculos se van a aplicar automáticamente según ese laboratorio.
                    </p>
                  </div>
                  <div className="relative space-y-3">
                    <div className="relative">
                      <label className="sr-only">Buscar laboratorio</label>
                      <Input
                        type="text"
                        placeholder="Buscar por nombre, ciudad, provincia, teléfono, domicilio..."
                        value={labSearch}
                        onChange={(e) => {
                          const search = e.target.value;
                          setLabSearch(search);
                          if (search.trim().length >= 3) {
                            loadLabs(search);
                          } else {
                            loadLabs();
                          }
                        }}
                        className="w-full"
                        aria-label="Buscar laboratorio"
                        disabled
                        onFocus={() => {
                          setShowLabDropdown(true);
                          if (!labSearch.trim()) {
                            loadLabs();
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
                            loadLabs();
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280]"
                        aria-label="Mostrar laboratorios"
                        disabled
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
                      {showLabDropdown && filteredLabs.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-72 overflow-auto rounded-2xl border border-[#eef2f7] bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
                          {filteredLabs.map((lab) => (
                            <button
                              key={lab.id}
                              type="button"
                              onClick={() => {
                                setPreferredLabId(lab.id);
                                setLabSearch(lab.name);
                                loadLabPricing(lab.id, photographer?.id ?? null);
                                setShowLabDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                preferredLabId === lab.id ? "bg-[#fdecec]" : "hover:bg-[#f8fafc]"
                              }`}
                              disabled
                            >
                              <div className="flex items-center gap-3">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fdecec] text-[#c27b3d]">
                                  🏭
                                </span>
                                <div>
                                  <div className="font-medium text-[#1a1a1a]">{lab.name}</div>
                                  {(lab.city || lab.province) && (
                                    <div className="text-xs text-[#6b7280]">
                                      {lab.city || ""}{lab.city && lab.province ? ", " : ""}{lab.province || ""}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {showLabDropdown && labSearch.trim() && filteredLabs.length === 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-[#e5e7eb] bg-white shadow-lg px-3 py-2 text-sm text-[#6b7280]">
                          No se encontraron laboratorios.
                        </div>
                      )}
                    </div>
                    {preferredLabId && (
                      <div className="flex">
                        <Button
                          variant="secondary"
                          onClick={() => handleViewLabPrices(preferredLabId)}
                          className="whitespace-nowrap"
                          disabled
                        >
                          Ver precios
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Este será el laboratorio por defecto para tus pedidos de impresión. Buscá por nombre, ciudad, provincia, teléfono o domicilio.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Margen de ganancia (%)
                  </label>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
                    Esta opción se habilitará próximamente para pedidos a laboratorio.
                  </p>
                  <Input
                    type="number"
                    placeholder="0"
                    value={profitMarginPercent}
                    onChange={(e) => setProfitMarginPercent(e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled
                  />
                  <p className="text-xs text-[#6b7280] mt-1">
                    Margen de ganancia sobre el precio de venta del laboratorio para impresiones de fotos.
                    Este margen se aplicará automáticamente a los precios mostrados a tus clientes en la sección donde los clientes suben sus fotografías y solicitan la impresión.
                  </p>
                </div>

                {/* Precio por defecto de foto digital */}
                <div className="pt-6 border-t border-[#e5e7eb]">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Precio por defecto de foto digital (ARS)
                  </label>
                  <Input
                    type="number"
                    min={systemSettings.minDigitalPhotoPrice ? systemSettings.minDigitalPhotoPrice : 0}
                    step="0.01"
                    placeholder={systemSettings.minDigitalPhotoPrice ? `Mínimo: $${systemSettings.minDigitalPhotoPrice.toFixed(2)}` : "0.00"}
                    value={defaultDigitalPhotoPrice}
                    onChange={(e) => setDefaultDigitalPhotoPrice(e.target.value)}
                  />
                  {systemSettings.minDigitalPhotoPrice && (
                    <p className="text-xs text-[#6b7280] mt-1">
                      Precio mínimo configurado por el sistema: ${systemSettings.minDigitalPhotoPrice.toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-[#6b7280] mt-1">
                    <strong>Nota:</strong> Este precio es solo para la calculadora y como sugerencia. Los precios reales de las fotos digitales se configuran en cada álbum al crearlo o editarlo.
                  </p>
                </div>

                {/* Configuración de descuentos por cantidad de fotos digitales */}
                <div className="pt-6 border-t border-[#e5e7eb]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-[#1a1a1a]">
                        Descuentos por cantidad de fotos digitales
                      </h3>
                      <p className="text-xs text-[#6b7280] mt-1">
                        Configurá descuentos que se aplicarán automáticamente cuando un cliente compre múltiples fotos digitales.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={digitalDiscountsEnabled}
                        onChange={(e) => setDigitalDiscountsEnabled(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#1a1a1a] font-medium">Habilitar descuentos</span>
                    </label>
                  </div>

                  {digitalDiscountsEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                          Descuento 5+ fotos (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={digitalDiscount5Plus}
                          onChange={(e) => setDigitalDiscount5Plus(e.target.value)}
                          className="!w-[120px] !min-w-0"
                        />
                        <p className="text-xs text-[#6b7280] mt-1">
                          Se aplica al comprar 5 o más fotos digitales
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                          Descuento 10+ fotos (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={digitalDiscount10Plus}
                          onChange={(e) => setDigitalDiscount10Plus(e.target.value)}
                          className="!w-[120px] !min-w-0"
                        />
                        <p className="text-xs text-[#6b7280] mt-1">
                          Se aplica al comprar 10 o más fotos digitales
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                          Descuento 20+ fotos (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={digitalDiscount20Plus}
                          onChange={(e) => setDigitalDiscount20Plus(e.target.value)}
                          className="!w-[120px] !min-w-0"
                        />
                        <p className="text-xs text-[#6b7280] mt-1">
                          Se aplica al comprar 20 o más fotos digitales
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Calculadora/Simuladora de Costos y Ganancias */}
                <div className="pt-6 border-t border-[#e5e7eb]">
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">
                    Calculadora de Costos y Ganancias
                  </h3>
                  <p className="text-xs text-[#6b7280] mb-4">
                    <strong>Importante:</strong> Los precios configurados arriba (margen de ganancia y precio de foto digital) son para la venta de fotografías en la sección donde los clientes suben sus fotografías y solicitan la impresión. Los precios de las fotos digitales se configuran según cada álbum al crearlo o editarlo.
                  </p>
                  
                  {/* Tipo de foto */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Tipo de foto
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="printed"
                          checked={calculatorType === "printed"}
                          onChange={(e) => setCalculatorType(e.target.value as "printed" | "digital")}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[#1a1a1a]">Fotos Impresas</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="digital"
                          checked={calculatorType === "digital"}
                          onChange={(e) => setCalculatorType(e.target.value as "printed" | "digital")}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[#1a1a1a]">Fotos Digitales</span>
                      </label>
                    </div>
                  </div>

                  {calculatorType === "printed" ? (
                    <>
                      {/* Calculadora para Fotos Impresas */}
                      <div className="space-y-4 p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                        {pricingSource && (
                          <p className="text-xs text-[#6b7280]">
                            Usando lista de precios de:{" "}
                            <span className="font-medium text-[#1a1a1a]">
                              {pricingSource === "LAB" ? "laboratorio seleccionado" : "fotógrafo"}
                            </span>
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                              Tamaño
                            </label>
                            <Select
                              value={calculatorSize}
                              onChange={(e) => setCalculatorSize(e.target.value)}
                              disabled={!labPricing}
                            >
                              <option value="">Seleccionar tamaño</option>
                              {labPricing?.basePrices?.map((bp: any) => (
                                <option key={bp.size} value={bp.size}>
                                  {bp.size}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                              Cantidad
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={calculatorQuantity}
                              onChange={(e) => setCalculatorQuantity(Number(e.target.value) || 1)}
                              disabled={!labPricing}
                            />
                          </div>
                        </div>

                        {labPricing && calculatorSize && (() => {
                          // Calcular costos y ganancias
                          const basePrice = labPricing.basePrices?.find((bp: any) => bp.size === calculatorSize)?.unitPrice || 0;
                          const discount = labPricing.discounts?.find((d: any) => d.size === calculatorSize && d.minQty <= calculatorQuantity);
                          const discountPercent = discount?.discountPercent || 0;
                          const labPriceAfterDiscount = basePrice * (1 - discountPercent / 100);
                          
                          const commissionPercent = Number.isFinite(labPricing?.platformCommissionPercent)
                            ? Number(labPricing?.platformCommissionPercent)
                            : (platformCommissionPercent ?? systemSettings.platformCommissionPercent ?? 0);
                          const appTax = feeFromBase(Math.round(labPriceAfterDiscount * 100), commissionPercent) / 100;
                          
                          const photographerMarginPercent = parseFloat(profitMarginPercent) || 0;
                          const photographerMargin = labPriceAfterDiscount * (photographerMarginPercent / 100);
                          
                          const finalPrice = labPriceAfterDiscount + appTax + photographerMargin;
                          const totalForQuantity = finalPrice * calculatorQuantity;
                          
                          // Totales para la cantidad
                          const totalBaseCost = basePrice * calculatorQuantity;
                          const totalDiscount = (basePrice * discountPercent / 100) * calculatorQuantity;
                          const totalLabCost = labPriceAfterDiscount * calculatorQuantity;
                          const totalAppTax = appTax * calculatorQuantity;
                          const totalPhotographerMargin = photographerMargin * calculatorQuantity;
                          
                          return (
                            <div className="mt-4 space-y-2 p-4 bg-white rounded-lg border border-[#e5e7eb]">
                              <div className="flex justify-between text-sm">
                                <span className="text-[#6b7280]">Costo base del laboratorio:</span>
                                <span className="font-medium text-[#1a1a1a]">${basePrice.toFixed(2)}</span>
                              </div>
                              {discountPercent > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Descuento por cantidad ({discountPercent.toFixed(1)}%):</span>
                                  <span className="font-medium text-[#10b981]">-${(basePrice * discountPercent / 100).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-[#6b7280]">Precio del laboratorio (después de descuento):</span>
                                <span className="font-medium text-[#1a1a1a]">${labPriceAfterDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-[#6b7280]">Comisión de la plataforma ({commissionPercent.toFixed(1)}%):</span>
                                <span className="font-medium text-[#c27b3d]">+${appTax.toFixed(2)}</span>
                              </div>
                              {photographerMarginPercent > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Tu margen de ganancia ({photographerMarginPercent.toFixed(1)}%):</span>
                                  <span className="font-medium text-[#10b981]">+${photographerMargin.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                <span className="font-medium text-[#1a1a1a]">Precio final por unidad:</span>
                                <span className="font-semibold text-lg text-[#1a1a1a]">${finalPrice.toFixed(2)}</span>
                              </div>
                              
                              {/* Totales para la cantidad */}
                              <div className="pt-4 mt-4 border-t-2 border-[#e5e7eb] space-y-3">
                                <h4 className="text-sm font-semibold text-[#1a1a1a] mb-2">
                                  Totales para {calculatorQuantity} {calculatorQuantity === 1 ? "unidad" : "unidades"}:
                                </h4>
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Total de costo:</span>
                                  <span className="font-medium text-[#1a1a1a]">${totalBaseCost.toFixed(2)}</span>
                                </div>
                                {totalDiscount > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total bonificado (descuento):</span>
                                    <span className="font-medium text-[#10b981]">-${totalDiscount.toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Total de comisión de la plataforma:</span>
                                  <span className="font-medium text-[#c27b3d]">${totalAppTax.toFixed(2)}</span>
                                </div>
                                {totalPhotographerMargin > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total de ganancia del fotógrafo:</span>
                                    <span className="font-medium text-[#10b981]">${totalPhotographerMargin.toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                  <span className="font-medium text-[#1a1a1a]">Total para {calculatorQuantity} {calculatorQuantity === 1 ? "unidad" : "unidades"}:</span>
                                  <span className="font-semibold text-xl text-[#c27b3d]">${totalForQuantity.toFixed(2)}</span>
                                </div>
                              </div>
                              
                              {/* Leyenda sobre impuestos adicionales */}
                              <div className="pt-4 mt-4 border-t border-[#e5e7eb]">
                                <p className="text-xs text-[#6b7280] leading-relaxed" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
                                  <strong className="text-[#1a1a1a]">Nota:</strong> Los precios mostrados son estimativos y pueden verse afectados por impuestos adicionales ajenos a la plataforma. Según el medio de pago implementado, los días de depósito requeridos y la situación fiscal de cada profesional, pueden aplicarse diferentes impuestos y cargos adicionales que no están incluidos en este cálculo.
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {!labPricing && (
                          <p className="text-sm text-[#6b7280] italic mt-4">
                            {preferredLabId
                              ? "Cargando precios del laboratorio seleccionado..."
                              : "Cargando precios del fotógrafo para la calculadora."}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Calculadora para Fotos Digitales */}
                      <div className="space-y-4 p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Cantidad de fotos digitales
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={calculatorQuantity}
                            onChange={(e) => setCalculatorQuantity(Number(e.target.value) || 1)}
                          />
                          <p className="text-xs text-[#6b7280] mt-1">
                            Simulá una venta de múltiples fotos digitales usando el precio configurado arriba.
                          </p>
                        </div>

                        {(() => {
                          // Usar el precio por defecto si está configurado, sino el precio mínimo del sistema
                          const defaultPrice = defaultDigitalPhotoPrice && parseFloat(defaultDigitalPhotoPrice) > 0 
                            ? parseFloat(defaultDigitalPhotoPrice) 
                            : (systemSettings.minDigitalPhotoPrice ? systemSettings.minDigitalPhotoPrice : 0);
                          
                          if (defaultPrice <= 0) {
                            return (
                              <p className="text-sm text-[#6b7280] italic mt-4">
                                Configurá el precio por defecto de foto digital arriba para usar la calculadora.
                              </p>
                            );
                          }
                          
                          const basePrice = defaultPrice;
                          const minPrice = systemSettings.minDigitalPhotoPrice ? systemSettings.minDigitalPhotoPrice : 0;
                          const isValid = basePrice >= minPrice;
                          const quantity = calculatorQuantity || 1;
                          
                          // Calcular descuento según cantidad
                          let discountPercent = 0;
                          if (digitalDiscountsEnabled && quantity >= 20 && digitalDiscount20Plus) {
                            discountPercent = parseFloat(digitalDiscount20Plus) || 0;
                          } else if (digitalDiscountsEnabled && quantity >= 10 && digitalDiscount10Plus) {
                            discountPercent = parseFloat(digitalDiscount10Plus) || 0;
                          } else if (digitalDiscountsEnabled && quantity >= 5 && digitalDiscount5Plus) {
                            discountPercent = parseFloat(digitalDiscount5Plus) || 0;
                          }
                          
                          const priceAfterDiscount = basePrice * (1 - discountPercent / 100);
                          const commissionPercent = platformCommissionPercent ?? systemSettings.platformCommissionPercent ?? 0;
                          const appTax = feeFromBase(Math.round(priceAfterDiscount * 100), commissionPercent) / 100;
                          const finalPrice = priceAfterDiscount + appTax;
                          const photographerEarning = priceAfterDiscount;
                          
                          // Totales para la cantidad
                          const totalBasePrice = basePrice * quantity;
                          const totalDiscount = (basePrice * discountPercent / 100) * quantity;
                          const totalAfterDiscount = priceAfterDiscount * quantity;
                          const totalAppTax = appTax * quantity;
                          const totalPhotographerEarning = photographerEarning * quantity;
                          const totalFinal = finalPrice * quantity;
                          const totalSavings = (basePrice - priceAfterDiscount) * (1 + commissionPercent / 100) * quantity;
                          
                          return (
                            <div className="mt-4 p-4 bg-white rounded-lg border border-[#e5e7eb]">
                              {!isValid && (
                                <div className="mb-3 p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg">
                                  <p className="text-sm text-[#dc2626] font-medium">
                                    ⚠️ El precio debe ser mayor o igual al precio mínimo de ${minPrice.toFixed(2)}
                                  </p>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Precio base por foto digital:</span>
                                  <span className="font-medium text-[#1a1a1a]">${basePrice.toFixed(2)}</span>
                                </div>
                                
                                {discountPercent > 0 && (
                                  <>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-[#6b7280]">Descuento por cantidad ({discountPercent.toFixed(1)}%):</span>
                                      <span className="font-medium text-[#10b981]">-${(basePrice * discountPercent / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-[#6b7280]">Precio después de descuento:</span>
                                      <span className="font-medium text-[#1a1a1a]">${priceAfterDiscount.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                                
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Comisión de la plataforma ({commissionPercent.toFixed(1)}%):</span>
                                  <span className="font-medium text-[#c27b3d]">+${appTax.toFixed(2)}</span>
                                </div>
                                
                                <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                  <span className="font-medium text-[#1a1a1a]">Precio final por foto (con fee):</span>
                                  <span className="font-semibold text-lg text-[#1a1a1a]">${finalPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#6b7280]">Tu ganancia por foto:</span>
                                  <span className="font-medium text-[#10b981]">${photographerEarning.toFixed(2)}</span>
                                </div>
                              </div>
                              
                              {/* Totales para la cantidad */}
                              {quantity > 1 && (
                                <div className="pt-4 mt-4 border-t-2 border-[#e5e7eb] space-y-3">
                                  <h4 className="text-sm font-semibold text-[#1a1a1a] mb-2">
                                    Totales para {quantity} {quantity === 1 ? "foto" : "fotos"} digitales:
                                  </h4>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total precio base:</span>
                                    <span className="font-medium text-[#1a1a1a]">${totalBasePrice.toFixed(2)}</span>
                                  </div>
                                  {totalDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-[#6b7280]">Total descuento aplicado:</span>
                                      <span className="font-medium text-[#10b981]">-${totalDiscount.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total después de descuento:</span>
                                    <span className="font-medium text-[#1a1a1a]">${totalAfterDiscount.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total comisión de la plataforma:</span>
                                    <span className="font-medium text-[#c27b3d]">${totalAppTax.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[#6b7280]">Total de tu ganancia:</span>
                                    <span className="font-medium text-[#10b981]">${totalPhotographerEarning.toFixed(2)}</span>
                                  </div>
                                  {totalSavings > 0 && (
                                    <div className="flex justify-between text-sm pt-2 border-t border-[#e5e7eb]">
                                      <span className="text-[#6b7280] font-medium">Total ahorrado por el cliente:</span>
                                      <span className="font-semibold text-[#10b981]">${totalSavings.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="pt-2 border-t border-[#e5e7eb] flex justify-between">
                                    <span className="font-medium text-[#1a1a1a]">Total a cobrar al cliente:</span>
                                    <span className="font-semibold text-xl text-[#c27b3d]">${totalFinal.toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                              
                              <div className="pt-4 mt-4 border-t border-[#e5e7eb]">
                                <p className="text-xs text-[#6b7280]">
                                  Este precio se aplicará a todas las fotos digitales del álbum. 
                                  Los clientes podrán comprar fotos individuales a este precio.
                                  {digitalDiscountsEnabled && quantity >= 5 && (
                                    <span className="block mt-1 text-[#10b981] font-medium">
                                      ✓ Descuento por cantidad aplicado
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Tab: Mercado Pago */}
            {activeTab === "mercadopago" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Mercado Pago</h2>
                <MercadoPagoIntegration
                  ownerType="USER"
                  mpAccessToken={photographer?.mpAccessToken}
                  mpUserId={photographer?.mpUserId}
                  mpConnectedAt={photographer?.mpConnectedAt}
                  showWarning
                  securityUrl="/ayuda/mercadopago/seguridad"
                  onReload={() => loadPhotographerData(photographer.id)}
                  onError={setError}
                  onSuccess={setSuccess}
                />
              </Card>
            )}

            {/* Tab: Upselling */}
            {activeTab === "upselling" && <UpsellingTab />}

            {/* Tab: Referidos */}
            {activeTab === "referidos" && <ReferidosTab />}

            {/* Tab: Términos y condiciones (única sección legal en Configuración) */}
            {activeTab === "productos" && (
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-medium text-[#1a1a1a]">Productos y precios</h2>
                    <p className="text-sm text-[#6b7280]">
                      Definí tu lista de precios al público. En cada álbum podrás aplicar un margen adicional.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={async () => {
                      try {
                        const res = await fetch("/api/fotografo/catalog/export");
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `catalogo-productos-${new Date().toISOString().split("T")[0]}.xlsx`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }
                      } catch (err) {
                        console.error("Error exportando catálogo:", err);
                      }
                    }}>
                      📤 Exportar Catálogo
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".xlsx,.xls";
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;

                          setProductsLoading(true);
                          setProductsError("");

                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/fotografo/catalog/import", {
                              method: "POST",
                              body: formData,
                            });

                            if (res.ok) {
                              const data = await res.json();
                              setProductsError("");
                              await loadProducts();
                              alert(`✅ Importación exitosa: ${data.created || 0} creados, ${data.updated || 0} actualizados`);
                            } else {
                              const errorData = await res.json().catch(() => ({ error: "Error desconocido" }));
                              if (errorData.validationErrors && Array.isArray(errorData.validationErrors)) {
                                setProductsError(`Errores de validación:\n${errorData.validationErrors.map((e: any) => `- ${e.message || e}`).join("\n")}`);
                              } else {
                                setProductsError(errorData.error || "Error importando catálogo");
                              }
                            }
                          } catch (err: any) {
                            console.error("Error importando catálogo:", err);
                            setProductsError(err?.message || "Error importando catálogo");
                          } finally {
                            setProductsLoading(false);
                          }
                        };
                        input.click();
                      }}
                    >
                      📥 Importar/Actualizar
                    </Button>
                    <Button variant="primary" onClick={() => {
                      setProducts([
                        ...products,
                        {
                          name: "",
                          size: null,
                          acabado: null,
                          retailPrice: 0,
                          currency: "ARS",
                          isActive: true,
                        },
                      ]);
                    }}>
                      + Agregar Producto
                    </Button>
                  </div>
                </div>

                {productsError && (
                  <div className="p-4 border-2 border-red-400 bg-red-50 rounded-lg mb-4">
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{productsError}</p>
                  </div>
                )}

                {productsLoading && !products.length && (
                  <div className="text-center py-8">
                    <p className="text-[#6b7280]">Cargando productos...</p>
                  </div>
                )}

                {products.length > 0 && (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full border-collapse bg-white min-w-[700px] sm:min-w-0">
                      <thead>
                        <tr className="bg-[#f8f9fa]">
                          <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Nombre</th>
                          <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Tamaño</th>
                          <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Acabado</th>
                          <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Precio al Público (ARS)</th>
                          <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Activo</th>
                          <th className="text-center py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedProducts.map(({ product, index }) => {
                          const isCarnet = getCarnetProduct(product);
                          const isPolaroid = getPolaroidProduct(product);
                          return (
                          <tr key={product.id ?? index} className="hover:bg-[#f9fafb] transition-colors">
                            <td className="py-3 px-4 border-b border-[#e5e7eb]">
                              <input
                                className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                                type="text"
                                placeholder="Ej: Foto Impresa, Cuadro Canvas..."
                                value={isCarnet ? "Fotos Carnet" : isPolaroid ? "Polaroid" : product.name}
                                onChange={(e) => updateProduct(index, "name", e.target.value)}
                                disabled={isCarnet || isPolaroid}
                              />
                            </td>
                            <td className="py-3 px-4 border-b border-[#e5e7eb]">
                              <input
                                className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                                type="text"
                                placeholder="Ej: 10x15, 15x20..."
                                value={isCarnet ? "10x15" : product.size || ""}
                                onChange={(e) => updateProduct(index, "size", e.target.value.trim() || null)}
                                disabled={isCarnet || isPolaroid}
                              />
                            </td>
                            <td className="py-3 px-4 border-b border-[#e5e7eb]">
                              <input
                                className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                                type="text"
                                placeholder="Ej: Brillo, Mate, Satinado..."
                                value={isCarnet ? "BRILLO" : product.acabado || ""}
                                onChange={(e) => updateProduct(index, "acabado", e.target.value.trim() || null)}
                                disabled={isCarnet}
                              />
                            </td>
                            <td className="py-3 px-4 border-b border-[#e5e7eb]">
                              <input
                                className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={product.retailPrice || ""}
                                onChange={(e) => updateProduct(index, "retailPrice", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="py-3 px-4 border-b border-[#e5e7eb]">
                              <input
                                type="checkbox"
                                checked={product.isActive}
                                onChange={(e) => updateProduct(index, "isActive", e.target.checked)}
                                className="w-5 h-5"
                              />
                            </td>
                            <td className="py-3 px-4 border-b border-[#e5e7eb] text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => duplicateProduct(index)}
                                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                  title="Duplicar producto"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => removeProduct(index)}
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                                  title="Eliminar producto"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {products.length === 0 && !productsLoading && (
                  <div className="text-center py-8 text-[#6b7280]">
                    <p>No hay productos cargados. Hacé clic en "Agregar Producto" para comenzar.</p>
                  </div>
                )}

                {products.length > 0 && (
                  <div className="flex justify-end pt-4 border-t border-[#e5e7eb] mt-6">
                    <Button
                      variant="primary"
                      onClick={async () => {
                        setProductsLoading(true);
                        setProductsError("");
                        try {
                          const res = await fetch("/api/fotografo/products", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              products: products
                                .map((product) => {
                                  if (getCarnetProduct(product)) {
                                    return {
                                      ...product,
                                      name: "Fotos Carnet",
                                      size: "10x15",
                                      acabado: "BRILLO",
                                    };
                                  }
                                  if (getPolaroidProduct(product)) {
                                    return {
                                      ...product,
                                      name: "Polaroid",
                                    };
                                  }
                                  return product;
                                })
                                .filter((p) => p.name.trim()),
                            }),
                          });
                          if (res.ok) {
                            await loadProducts();
                            alert("✅ Productos guardados exitosamente");
                          } else {
                            const error = await res.json().catch(() => ({ error: "Error desconocido" }));
                            setProductsError(error.error || "Error guardando productos");
                          }
                        } catch (err: any) {
                          console.error("Error guardando productos:", err);
                          setProductsError(err?.message || "Error guardando productos");
                        } finally {
                          setProductsLoading(false);
                        }
                      }}
                      disabled={productsLoading}
                    >
                      Guardar productos
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Tab: Clientes */}
        </div>
      </div>

      {/* Modal de precios del laboratorio */}
      {showLabModal && selectedLabForView && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[80]"
            onClick={() => setShowLabModal(false)}
          />
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            onClick={() => setShowLabModal(false)}
          >
            <Card
              className="bg-white max-w-[800px] w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
              }}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-start border-b border-[#e5e7eb] pb-4">
                  <div>
                    <h2 className="text-2xl font-medium text-[#1a1a1a] mb-2">
                      {selectedLabForView.name}
                    </h2>
                    <div className="space-y-1 text-sm text-[#6b7280]">
                      {selectedLabForView.city && (
                        <p>📍 {selectedLabForView.city}{selectedLabForView.province ? `, ${selectedLabForView.province}` : ""}{selectedLabForView.country ? `, ${selectedLabForView.country}` : ""}</p>
                      )}
                      {selectedLabForView.address && (
                        <p>🏠 {selectedLabForView.address}</p>
                      )}
                      {selectedLabForView.phone && (
                        <p>📞 {selectedLabForView.phone}</p>
                      )}
                      {selectedLabForView.email && (
                        <p>✉️ {selectedLabForView.email}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLabModal(false)}
                    className="text-[#6b7280] hover:text-[#1a1a1a] text-2xl"
                  >
                    ×
                  </button>
                </div>

                {selectedLabPricing ? (
                  <div className="space-y-6">
                    {/* Precios base */}
                    <div>
                      <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Precios base</h3>
                      <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full border-collapse min-w-[320px] sm:min-w-0">
                          <thead>
                            <tr className="border-b border-[#e5e7eb]">
                              <th className="text-left py-2 px-4 text-sm font-medium text-[#1a1a1a]">Tamaño</th>
                              <th className="text-right py-2 px-4 text-sm font-medium text-[#1a1a1a]">Precio unitario</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLabPricing.basePrices?.map((bp: any) => (
                              <tr key={bp.size} className="border-b border-[#e5e7eb]">
                                <td className="py-2 px-4 text-sm text-[#6b7280]">{bp.size}</td>
                                <td className="py-2 px-4 text-sm text-right font-medium text-[#1a1a1a]">
                                  ${bp.unitPrice.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Descuentos por cantidad */}
                    {selectedLabPricing.discounts && selectedLabPricing.discounts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Descuentos por cantidad</h3>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <table className="w-full border-collapse min-w-[420px] sm:min-w-0">
                            <thead>
                              <tr className="border-b border-[#e5e7eb]">
                                <th className="text-left py-2 px-4 text-sm font-medium text-[#1a1a1a]">Tamaño</th>
                                <th className="text-right py-2 px-4 text-sm font-medium text-[#1a1a1a]">Cantidad mínima</th>
                                <th className="text-right py-2 px-4 text-sm font-medium text-[#1a1a1a]">Descuento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedLabPricing.discounts.map((d: any, idx: number) => (
                                <tr key={idx} className="border-b border-[#e5e7eb]">
                                  <td className="py-2 px-4 text-sm text-[#6b7280]">{d.size}</td>
                                  <td className="py-2 px-4 text-sm text-right text-[#6b7280]">{d.minQty} unidades</td>
                                  <td className="py-2 px-4 text-sm text-right font-medium text-[#10b981]">
                                    {d.discountPercent.toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[#6b7280]">Cargando precios...</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
    </>
  );
}
