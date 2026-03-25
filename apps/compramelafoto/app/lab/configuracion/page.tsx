 "use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import LabHeader from "@/components/lab/LabDashboardHeader";
import StatusOverlay from "@/components/layout/StatusOverlay";
import { ensureLabSession } from "@/lib/lab-session-client";
import MercadoPagoIntegration from "@/components/mercadopago/MercadoPagoIntegration";
import ReferidosTab from "@/components/referrals/ReferidosTab";
import dynamic from "next/dynamic";
// Las funcionalidades de negocio (pedidos, clientes, productos) ahora están en /lab/negocio

const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch").then((m) => m.default),
  { ssr: false }
);
const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap").then((m) => m.default),
  { ssr: false, loading: () => <div className="rounded-lg bg-gray-200 h-[200px] flex items-center justify-center text-gray-500 text-sm">Cargando mapa…</div> }
);

type OrderRow = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  photographerId: number | null;
  photographerName: string | null;
  pickupBy: string;
  createdAtText: string;
  statusUpdatedAtText: string;
  itemsCount: number;
  currency: string;
  total: number;
  status: string;
};

type BasePriceRow = { size: string; unitPrice: number; currency?: string };
type DiscountRow = { size: string; minQty: number; discountPercent: number };
type LabProduct = {
  id?: number;
  name: string;
  size: string | null;
  acabado: string | null;
  photographerPrice: number;
  retailPrice: number;
  currency?: string;
  isActive: boolean;
};
type LabData = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude?: number | null;
  longitude?: number | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor?: string | null;
  fontColor?: string | null;
  isPublicPageEnabled: boolean;
  publicPageHandler: string | null;
  showCarnetPrints?: boolean;
  showPolaroidPrints?: boolean;
  mpAccessToken?: string | null;
  mpRefreshToken?: string | null;
  mpUserId?: string | null;
  mpConnectedAt?: string | null;
  radiusKm?: number | null;
  shippingEnabled?: boolean;
  fulfillmentMode?: "PICKUP_ONLY" | "SHIP_ONLY" | "BOTH";
  defaultSlaDays?: number | null;
  soyFotografo?: boolean;
  usePriceForPhotographerOrders?: "AUTO" | "RETAIL" | "WHOLESALE";
};

function BulkDiscountBar({
  selectedCount,
  onApply,
  onDeselect,
  thresholds,
}: {
  selectedCount: number;
  onApply: (vals: Record<number, number>) => void;
  onDeselect: () => void;
  thresholds: readonly number[];
}) {
  const handleApply = () => {
    const vals: Record<number, number> = {};
    thresholds.forEach((qty) => {
      const el = document.getElementById(`bulk-input-${qty}`) as HTMLInputElement | null;
      vals[qty] = el ? Number(el.value) || 0 : 0;
    });
    onApply(vals);
    thresholds.forEach((qty) => {
      const el = document.getElementById(`bulk-input-${qty}`) as HTMLInputElement | null;
      if (el) el.value = "";
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-[#eff6ff] rounded-lg border border-[#93c5fd]">
      <span className="text-sm font-medium text-[#1e40af]">
        {selectedCount} fila{selectedCount > 1 ? "s" : ""} seleccionada{selectedCount > 1 ? "s" : ""}
      </span>
      <div className="flex flex-wrap gap-2 items-center">
        {thresholds.map((qty) => (
          <div key={qty} className="flex items-center gap-1">
            <label className="text-xs text-[#374151]">{qty}+</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              placeholder="—"
              id={`bulk-input-${qty}`}
              className="!min-w-0 w-10 py-1 px-1 text-center text-sm"
            />
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={handleApply} className="py-1.5 px-3 text-sm">
        Aplicar a seleccionadas
      </Button>
      <button type="button" onClick={onDeselect} className="text-xs text-[#6b7280] hover:text-[#1a1a1a]">
        Deseleccionar
      </button>
    </div>
  );
}

export function LabConfigPageContent({ section: sectionProp }: { section?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(sectionProp || "datos");
  const isStandalonePage = Boolean(sectionProp);

  // Estados para Pedidos
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Estados para Clientes
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Estados para Descuentos (PROFESSIONAL = fotógrafo, PUBLIC = público)
  type DiscountData = {
    global: { 10: number; 30: number; 50: number; 80: number; 100: number };
    bySize: Record<string, { 10: number; 30: number; 50: number; 80: number; 100: number }>;
  };
  const emptyDiscounts = (): DiscountData => ({
    global: { 10: 0, 30: 0, 50: 0, 80: 0, 100: 0 },
    bySize: {},
  });
  const [discountSubTab, setDiscountSubTab] = useState<"PROFESSIONAL" | "PUBLIC">("PROFESSIONAL");
  const [discountsByType, setDiscountsByType] = useState<Record<"PROFESSIONAL" | "PUBLIC", DiscountData>>({
    PROFESSIONAL: emptyDiscounts(),
    PUBLIC: emptyDiscounts(),
  });
  const [discountSizes, setDiscountSizes] = useState<string[]>([]);
  const [discountProducts, setDiscountProducts] = useState<LabProduct[]>([]);
  const [selectedDiscountRows, setSelectedDiscountRows] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [calcSize, setCalcSize] = useState<string>("");
  const [calcQty, setCalcQty] = useState<number>(1);

  // Estados para Productos
  const [products, setProducts] = useState<LabProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>("");

  // Estados para Lab (Autenticación y Datos)
  const [labId, setLabId] = useState<number | null>(null);
  const [lab, setLab] = useState<LabData | null>(null);
  const [labLoading, setLabLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [tertiaryColor, setTertiaryColor] = useState("");
  const [fontColor, setFontColor] = useState("");
  const [isPublicPageEnabled, setIsPublicPageEnabled] = useState(false);
  const [publicPageHandler, setPublicPageHandler] = useState("");
  const [showCarnetPrints, setShowCarnetPrints] = useState(false);
  const [showPolaroidPrints, setShowPolaroidPrints] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [statusOverlay, setStatusOverlay] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  
  // Estados para datos del laboratorio (similar al fotógrafo)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<"PICKUP_ONLY" | "SHIP_ONLY" | "BOTH">("PICKUP_ONLY");
  const [defaultSlaDays, setDefaultSlaDays] = useState("");
  const [albumsEnabled, setAlbumsEnabled] = useState(false);
  const [landingPriceMode, setLandingPriceMode] = useState<"AUTO" | "RETAIL" | "WHOLESALE">("AUTO");

  // Estados para bloqueos y requisitos
  const [userRole, setUserRole] = useState<"LAB" | "LAB_PHOTOGRAPHER" | null>(null);
  const [canOperate, setCanOperate] = useState(false);
  const [needsMpConnection, setNeedsMpConnection] = useState(false);
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>("");
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  
  // Manejar query params de Mercado Pago (se ejecuta primero)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mpConnected = urlParams.get("mp_connected");
    const mpError = urlParams.get("mp_error");
    
    if (mpConnected === "true") {
      setSaveSuccess("¡Conexión con Mercado Pago exitosa!");
      setTimeout(() => {
        setSaveSuccess(null);
        window.history.replaceState({}, "", window.location.pathname);
        if (labId) {
          loadLab();
        }
      }, 3000);
    }
    
    if (mpError) {
      setSaveError(`Error conectando con Mercado Pago: ${mpError}`);
      setTimeout(() => {
        setSaveError(null);
        window.history.replaceState({}, "", window.location.pathname);
      }, 5000);
    }
  }, [labId]);

  useEffect(() => {
    if (!saveSuccess) return;
    setStatusOverlay({ message: saveSuccess, variant: "success" });
    const t = setTimeout(() => setStatusOverlay(null), 1400);
    return () => clearTimeout(t);
  }, [saveSuccess]);

  useEffect(() => {
    const message = saveError || errorMsg;
    if (!message) return;
    setStatusOverlay({ message, variant: "error" });
    const t = setTimeout(() => setStatusOverlay(null), 2200);
    return () => clearTimeout(t);
  }, [saveError, errorMsg]);

  // Cargar pedidos
  async function loadOrders() {
    if (!labId) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/print-orders?labId=${labId}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        const rows = data.map((o: any) => ({
          id: o.id,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          photographerId: o.photographerId,
          photographerName: o.photographer?.name || null,
          pickupBy: o.pickupBy,
          createdAtText: new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "medium",
          }).format(new Date(o.createdAt)),
          statusUpdatedAtText: new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "medium",
          }).format(new Date(o.statusUpdatedAt)),
          itemsCount: o.items?.length || 0,
          currency: o.currency,
          total: o.total,
          status: o.status,
        }));
        setOrders(rows);
      }
    } catch (err) {
      console.error("Error cargando pedidos:", err);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  // Cargar clientes
  async function loadClients() {
    if (!labId) return;
    setClientsLoading(true);
    try {
      const url = `/api/lab/clientes?labId=${labId}${clientSearch ? `&search=${encodeURIComponent(clientSearch)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error cargando clientes:", err);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }

  const THRESHOLDS = [10, 30, 50, 80, 100] as const;

  // Cargar descuentos globales y por tamaño (ambos tipos)
  async function loadGlobalDiscounts() {
    if (!labId) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const [proRes, pubRes, productsRes] = await Promise.all([
        fetch(`/api/lab/pricing?labId=${labId}&priceType=PROFESSIONAL`, { cache: "no-store" }),
        fetch(`/api/lab/pricing?labId=${labId}&priceType=PUBLIC`, { cache: "no-store" }),
        fetch(`/api/lab/products?labId=${labId}`, { cache: "no-store" }),
      ]);
      const prods = productsRes.ok ? await productsRes.json() : [];
      setDiscountProducts(Array.isArray(prods) ? prods : []);
      const sizesFromProducts = [...new Set((prods || []).map((p: LabProduct) => p.size ?? "").filter((s: string | undefined): s is string => s !== undefined))];

      function parseDiscounts(data: { discounts?: DiscountRow[] }) {
        const disc = (minQty: number, size?: string) =>
          data.discounts?.find((d: DiscountRow) => (size ? d.size === size : d.size === "GLOBAL") && d.minQty === minQty);
        const sizesFromApi = [...new Set((data.discounts || []).map((d: { size?: string }) => d.size).filter((s: string | undefined): s is string => Boolean(s) && s !== "GLOBAL"))];
        const sizes = [...new Set([...sizesFromProducts, ...sizesFromApi])].sort() as string[];
        const bySize: Record<string, { 10: number; 30: number; 50: number; 80: number; 100: number }> = {};
        for (const sz of sizes) {
          bySize[sz] = {
            10: disc(10, sz)?.discountPercent || 0,
            30: disc(30, sz)?.discountPercent || 0,
            50: disc(50, sz)?.discountPercent || 0,
            80: disc(80, sz)?.discountPercent || 0,
            100: disc(100, sz)?.discountPercent || 0,
          };
        }
        return {
          global: {
            10: disc(10)?.discountPercent || 0,
            30: disc(30)?.discountPercent || 0,
            50: disc(50)?.discountPercent || 0,
            80: disc(80)?.discountPercent || 0,
            100: disc(100)?.discountPercent || 0,
          },
          bySize,
        };
      }

      const dataPro = proRes.ok ? await proRes.json() : { discounts: [] };
      const dataPub = pubRes.ok ? await pubRes.json() : { discounts: [] };
      const allSizes = [...new Set([...sizesFromProducts, ...(dataPro.discounts || []).map((d: { size?: string }) => d.size).filter(Boolean), ...(dataPub.discounts || []).map((d: { size?: string }) => d.size).filter(Boolean)])].filter((s): s is string => Boolean(s) && s !== "GLOBAL").sort() as string[];
      setDiscountSizes(allSizes);
      setDiscountsByType({
        PROFESSIONAL: parseDiscounts(dataPro),
        PUBLIC: parseDiscounts(dataPub),
      });
    } catch (e: any) {
      console.error(e);
      setErrorMsg("No se pudieron cargar los descuentos. Mirá la consola.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGlobalDiscounts() {
    if (!labId) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const d = discountsByType[discountSubTab];
      const discounts: DiscountRow[] = [
        { size: "GLOBAL", minQty: 10, discountPercent: d.global[10] },
        { size: "GLOBAL", minQty: 30, discountPercent: d.global[30] },
        { size: "GLOBAL", minQty: 50, discountPercent: d.global[50] },
        { size: "GLOBAL", minQty: 80, discountPercent: d.global[80] },
        { size: "GLOBAL", minQty: 100, discountPercent: d.global[100] },
      ];
      const sizesToSave = new Set([...discountSizes, ...Object.keys(d.bySize)]);
      for (const sz of sizesToSave) {
        if (sz === "GLOBAL") continue;
        const bySz = d.bySize[sz] || { 10: 0, 30: 0, 50: 0, 80: 0, 100: 0 };
        THRESHOLDS.forEach((qty) => discounts.push({ size: sz, minQty: qty, discountPercent: bySz[qty] }));
      }
      const res = await fetch(`/api/lab/pricing?labId=${labId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePrices: [], discounts, priceType: discountSubTab }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadGlobalDiscounts();
      setErrorMsg("");
      setSaveSuccess("Descuentos guardados correctamente");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Error guardando descuentos. Mirá la consola.");
    } finally {
      setBusy(false);
    }
  }

  function setDiscountValue(type: "global" | "size", key: string | number, qty: 10 | 30 | 50 | 80 | 100, val: number) {
    setDiscountsByType((prev) => {
      const next = { ...prev };
      const current = { ...next[discountSubTab] };
      if (type === "global") {
        current.global = { ...current.global, [qty]: val };
      } else {
        current.bySize = { ...current.bySize, [key as string]: { ...(current.bySize[key as string] || { 10: 0, 30: 0, 50: 0, 80: 0, 100: 0 }), [qty]: val } };
      }
      next[discountSubTab] = current;
      return next;
    });
  }


  // Verificar autenticación al montar
  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      setLabId(session.labId);
      setAuthLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  // Cargar lab al montar para obtener soyFotografo
  useEffect(() => {
    if (labId && !lab) {
      loadLab();
    }
  }, [labId]);

  // Cargar datos del lab
  async function loadLab() {
    if (!labId) return;
    
    setLabLoading(true);
    try {
      const res = await fetch(`/api/lab/${labId}`);
      if (res.ok) {
        const data = await res.json();
        setLab(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setCity(data.city || "");
        setProvince(data.province || "");
        setCountry(data.country || "Argentina");
        setAddress(data.address || "");
        setLatitude(data.latitude != null ? String(data.latitude) : "");
        setLongitude(data.longitude != null ? String(data.longitude) : "");
        setLogoUrl(data.logoUrl || null);
        setPrimaryColor(data.primaryColor || "");
        setSecondaryColor(data.secondaryColor || "");
        setTertiaryColor(data.tertiaryColor || "");
        setFontColor(data.fontColor || "");
        setIsPublicPageEnabled(data.isPublicPageEnabled || false);
        setPublicPageHandler(data.publicPageHandler || "");
        setShowCarnetPrints(data.showCarnetPrints ?? false);
        setShowPolaroidPrints(data.showPolaroidPrints ?? false);
        setRadiusKm(data.radiusKm?.toString() || "");
        setShippingEnabled(data.shippingEnabled || false);
        setFulfillmentMode(data.fulfillmentMode || "PICKUP_ONLY");
        setDefaultSlaDays(data.defaultSlaDays?.toString() || "");
        setAlbumsEnabled(data.soyFotografo || false);
        setLandingPriceMode(data.usePriceForPhotographerOrders || "AUTO");
        // Cargar redes sociales del User asociado
        if (data.user) {
          setWebsite(data.user.website || "");
          setInstagram(data.user.instagram || "");
          setFacebook(data.user.facebook || "");
          setWhatsapp(data.user.whatsapp || "");
        }
      }
    } catch (err) {
      console.error("Error cargando datos del laboratorio:", err);
    } finally {
      setLabLoading(false);
    }
  }

  // Manejar query params de Mercado Pago y tabs
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mpConnected = urlParams.get("mp_connected");
    const mpError = urlParams.get("mp_error");
    const tabParam = urlParams.get("tab");
    
    if (tabParam && ["datos", "diseno", "mercadopago", "descuentos", "referidos", "upselling"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    if (mpConnected === "true") {
      setSaveSuccess("¡Conexión con Mercado Pago exitosa!");
      setTimeout(() => {
        setSaveSuccess(null);
        window.history.replaceState({}, "", window.location.pathname);
        if (labId) {
          loadLab();
        }
      }, 3000);
    }
    
    if (mpError) {
      setSaveError(`Error conectando con Mercado Pago: ${mpError}`);
      setTimeout(() => {
        setSaveError(null);
        window.history.replaceState({}, "", window.location.pathname);
      }, 5000);
    }
  }, [labId]);

  // Cargar descuentos al entrar a la solapa Descuentos
  useEffect(() => {
    if (labId && activeTab === "descuentos") {
      loadGlobalDiscounts();
    }
  }, [labId, activeTab]);

  // Cargar productos
  async function loadProducts() {
    if (!labId) {
      console.warn("loadProducts: labId no disponible", { labId });
      setProductsError("No hay datos del laboratorio cargados");
      return;
    }
    
    setProductsLoading(true);
    setProductsError("");
    try {
      console.log("Cargando productos para labId:", labId);
      const res = await fetch(`/api/lab/products?labId=${labId}`, { 
        cache: "no-store",
        credentials: "include"
      });
      
      console.log("Respuesta de productos:", { 
        status: res.status, 
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries())
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Productos recibidos:", data);
        setProducts(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length === 0) {
          setProductsError(""); // No hay error si la lista está vacía
        }
      } else {
        let errorData: any = {};
        try {
          const text = await res.text();
          console.error("Error response text:", text);
          errorData = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Error parseando respuesta de error:", e);
        }
        
        const errorMsg = errorData?.error || errorData?.detail || `Error ${res.status}: ${res.statusText || "Error desconocido"}`;
        console.error("Error cargando productos:", {
          status: res.status,
          statusText: res.statusText,
          errorData,
          errorMsg
        });
        setProductsError(`Error cargando productos: ${errorMsg}`);
        setProducts([]);
      }
    } catch (err: any) {
      console.error("Error cargando productos (catch):", err);
      setProductsError(`Error cargando productos: ${err?.message || "Error de conexión"}`);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  // Cargar álbumes
  async function loadAlbums() {
    if (!labId) return;
    setAlbumsLoading(true);
    try {
      const res = await fetch("/api/dashboard/albums");
      if (res.ok) {
        const data = await res.json();
        setAlbums(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error cargando álbumes:", err);
    } finally {
      setAlbumsLoading(false);
    }
  }

  const tabsConfiguracion = useMemo(
    () => [
      { id: "datos", label: "Datos del Laboratorio" },
      { id: "diseno", label: "Diseño" },
      { id: "mercadopago", label: "Mercado Pago" },
      { id: "descuentos", label: "Descuentos" },
      { id: "referidos", label: "Referidos" },
      { id: "upselling", label: "Upselling" },
    ],
    []
  );

  useEffect(() => {
    if (sectionProp) {
      setActiveTab(sectionProp);
      return;
    }
    const requestedTab = searchParams?.get("tab");
    if (requestedTab && tabsConfiguracion.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams, tabsConfiguracion, sectionProp]);


  // Cargar datos según la solapa activa
  useEffect(() => {
    // Cargar datos según la tab activa (solo configuración)
    if (activeTab === "datos") {
      if (!lab && labId) {
        loadLab();
      }
    } else if (activeTab === "diseno" || activeTab === "mercadopago" || activeTab === "descuentos" || activeTab === "referidos" || activeTab === "upselling") {
      if (!lab && labId) {
        loadLab();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, labId]);

  // Cargar lab al montar para obtener soyFotografo
  useEffect(() => {
    if (labId && !lab) {
      loadLab();
    }
  }, [labId]);

  // Las funcionalidades de negocio ahora están en /lab/negocio

  // Funciones para productos
  function addProduct() {
    setProducts([
      ...products,
      {
        name: "",
        size: null,
        acabado: null,
        photographerPrice: 0,
        retailPrice: 0,
        currency: "ARS",
        isActive: true,
      },
    ]);
  }

  function updateProduct(index: number, field: keyof LabProduct, value: any) {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  }

  function removeProduct(index: number) {
    setProducts(products.filter((_, i) => i !== index));
  }

  function duplicateProduct(index: number) {
    const productToDuplicate = products[index];
    const newProduct = {
      ...productToDuplicate,
      id: undefined, // Nuevo producto sin ID para que se cree como nuevo
    };
    // Insertar después del producto actual
    const updated = [...products];
    updated.splice(index + 1, 0, newProduct);
    setProducts(updated);
  }

  async function saveProducts() {
    if (!labId) {
      setProductsError("No hay datos del laboratorio cargados");
      return;
    }
    
    setProductsLoading(true);
    setProductsError("");
    try {
      const res = await fetch("/api/lab/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: labId,
          products: products.filter((p) => p.name.trim()),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error guardando productos");
      }
      await loadProducts();
    } catch (err: any) {
      console.error("Error guardando productos:", err);
      setProductsError(err.message || "Error guardando productos");
    } finally {
      setProductsLoading(false);
    }
  }

  // Funciones para diseño y página pública
  async function handleLogoUpload() {
    if (!logoFile) {
      setSaveError("No se seleccionó ningún archivo");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      if (!labId) {
        setSaveError("No hay datos del laboratorio cargados");
        return;
      }

      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append("labId", labId.toString());

      const res = await fetch("/api/lab/upload-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || "Error subiendo logo");
      }

      setLogoUrl(data.logoUrl);
      setLogoFile(null);
      setSaveSuccess("Logo subido correctamente");
      setTimeout(() => setSaveSuccess(null), 3000);
      await loadLab();
    } catch (err: any) {
      console.error("Error subiendo logo:", err);
      setSaveError(err?.message || "Error subiendo logo");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveLab() {
    if (!lab) {
      setSaveError("No hay datos del laboratorio cargados");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);

    try {
      if (!labId) {
        setSaveError("No hay datos del laboratorio cargados");
        return;
      }

      const updateData: any = {
        name: name.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        country: country.trim() || "Argentina",
        latitude: latitude ? (parseFloat(latitude) || null) : null,
        longitude: longitude ? (parseFloat(longitude) || null) : null,
        primaryColor: primaryColor.trim() || null,
        secondaryColor: secondaryColor.trim() || null,
        tertiaryColor: tertiaryColor.trim() || null,
        fontColor: fontColor.trim() || null,
        isPublicPageEnabled,
        publicPageHandler: publicPageHandler.trim() || null,
        showCarnetPrints,
        showPolaroidPrints,
        radiusKm: radiusKm ? parseInt(radiusKm) : null,
        shippingEnabled,
        fulfillmentMode,
        defaultSlaDays: defaultSlaDays ? parseInt(defaultSlaDays) : null,
        soyFotografo: albumsEnabled,
        usePriceForPhotographerOrders: landingPriceMode,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        whatsapp: whatsapp.trim() || null,
      };

      const res = await fetch(`/api/lab/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data?.error || data?.detail || "Error guardando datos";
        console.error("Error del servidor:", {
          status: res.status,
          error: errorMessage,
          data: data
        });
        throw new Error(errorMessage);
      }

      setLab(data);
      setSaveSuccess("Datos guardados correctamente");
      setTimeout(() => setSaveSuccess(null), 3000);
      await loadLab();
    } catch (err: any) {
      console.error("Error guardando datos:", err);
      const errorMessage = err?.message || "Error al guardar. Verificá la consola para más detalles.";
      setSaveError(errorMessage);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaveLoading(false);
    }
  }
  
  async function handleSaveDatos() {
    await handleSaveLab();
  }

  function copyPublicUrl() {
    if (publicPageHandler) {
      const url = `${window.location.origin}/l/${publicPageHandler}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Estados para Álbumes (solo si soyFotografo)
  const [albums, setAlbums] = useState<any[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  // Mostrar loading mientras verifica autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LabHeader lab={lab} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Verificando autenticación...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Si no hay labId, no mostrar nada (ya se redirigió)
  if (!labId) {
    return null;
  }

  return (
    <>
      {statusOverlay && (
        <StatusOverlay message={statusOverlay.message} variant={statusOverlay.variant} />
      )}
      <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
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
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Panel de configuración
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
              Configurá tus datos personales, diseño visual, conexiones con Mercado Pago y preferencias de operación desde este panel centralizado.
            </p>
          </div>



          {/* Mensajes */}
          {saveError && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{saveError}</p>
            </Card>
          )}

          {saveSuccess && (
            <Card className="bg-[#10b981]/10 border-[#10b981]">
              <p className="text-[#10b981]">{saveSuccess}</p>
            </Card>
          )}

          {/* REGLA 1 y 2: Banners de bloqueo por MP y T&C */}
          {(!canOperate || needsMpConnection || needsTermsAcceptance) && (
            <div className="space-y-3">
              {needsMpConnection && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-orange-800 mb-1">
                        Mercado Pago no conectado
                      </h3>
                      <p className="text-sm text-orange-700 mb-2">
                        Es obligatorio conectar tu cuenta de Mercado Pago para recibir pedidos y cobrar comisiones. Sin conexión, no podés operar.
                      </p>
                      <p className="text-xs text-orange-600">
                        Podés completar tu perfil y configurar tu catálogo, pero no recibirás pedidos hasta conectar Mercado Pago.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {needsTermsAcceptance && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-800 mb-1">
                        Términos y Condiciones pendientes
                      </h3>
                      <p className="text-sm text-blue-700 mb-2">
                        {termsVersion ? `Debés aceptar los Términos y Condiciones versión ${termsVersion} para operar.` : "Debés aceptar los Términos y Condiciones para operar."}
                      </p>
                      <p className="text-xs text-blue-600">
                        Sin aceptar los T&C, no podés recibir pedidos ni conectar Mercado Pago.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabs de Configuración (ocultos cuando cada sección es página propia) */}
          <div className="w-full" data-tabs-container>
            {!isStandalonePage && (
            <div className="border-b border-[#e5e7eb]">
              <div className="flex gap-0 overflow-x-auto">
                {tabsConfiguracion.map((tab, index) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border border-[#e5e7eb] border-b-0 rounded-t-lg whitespace-nowrap relative ${
                      activeTab === tab.id
                        ? "bg-white text-[#1a1a1a] border-[#c27b3d] border-b-2 border-b-[#c27b3d]"
                        : "bg-[#f8f9fa] text-[#6b7280] hover:bg-[#f3f4f6]"
                    }`}
                    style={{
                      marginBottom: activeTab === tab.id ? "-1px" : "0",
                      marginLeft: index === 0 ? "0" : "-1px",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Tab Content */}
            <div className="mt-6">
            {/* Solapa: Datos del Laboratorio */}
            {activeTab === "datos" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Datos del laboratorio</h2>

                {saveError && (
                  <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                    <p className="text-[#ef4444] text-sm">{saveError}</p>
                  </div>
                )}

                {saveSuccess && (
                  <div className="bg-[#10b981]/10 border border-[#10b981] rounded-lg p-4">
                    <p className="text-[#10b981] text-sm">{saveSuccess}</p>
                  </div>
                )}

                {labLoading ? (
                  <div className="text-center py-8">
                    <p className="text-[#6b7280]">Cargando datos...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={lab?.email || ""}
                        disabled
                        className="bg-[#f3f4f6] cursor-not-allowed"
                      />
                      <p className="text-xs text-[#6b7280] mt-1">
                        El email no se puede modificar
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Nombre del laboratorio
                      </label>
                      <Input
                        type="text"
                        placeholder="Nombre comercial del laboratorio"
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
                        placeholder="Dirección completa para retiro"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                      <p className="text-xs text-[#6b7280] mt-1">
                        Dirección donde los clientes pueden retirar sus pedidos
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Ubicación en el mapa (domicilio georeferenciado)
                      </label>
                      <p className="text-xs text-[#6b7280] mb-2">
                        Buscá la dirección del laboratorio para guardar las coordenadas. Así tu perfil muestra la ubicación para retiro y eventos cercanos.
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

                    {/* Configuración de cobertura y envíos */}
                    <div className="pt-4 border-t border-[#e5e7eb]">
                      <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Cobertura y envíos</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Radio de cobertura (km)
                          </label>
                          <Input
                            type="number"
                            placeholder="Ej: 50"
                            value={radiusKm}
                            onChange={(e) => setRadiusKm(e.target.value)}
                            min="0"
                          />
                          <p className="text-xs text-[#6b7280] mt-1">
                            Radio en kilómetros desde tu ubicación para mostrar eventos cercanos
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={shippingEnabled}
                              onChange={(e) => setShippingEnabled(e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              ¿Hace envíos al resto del país?
                            </span>
                          </label>
                          <p className="text-xs text-[#6b7280] ml-6">
                            Si está habilitado, los clientes de otras provincias podrán comprar y coordinar envío contigo
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Método de entrega
                          </label>
                          <Select
                            value={fulfillmentMode}
                            onChange={(e) => setFulfillmentMode(e.target.value as "PICKUP_ONLY" | "SHIP_ONLY" | "BOTH")}
                          >
                            <option value="PICKUP_ONLY">Solo retiro en laboratorio</option>
                            <option value="SHIP_ONLY">Solo envíos</option>
                            <option value="BOTH">Retiro y envíos</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            SLA por defecto (días)
                          </label>
                          <Input
                            type="number"
                            placeholder="Ej: 5"
                            value={defaultSlaDays}
                            onChange={(e) => setDefaultSlaDays(e.target.value)}
                            min="0"
                          />
                          <p className="text-xs text-[#6b7280] mt-1">
                            Tiempo de producción por defecto en días (se puede personalizar por producto)
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={albumsEnabled}
                              onChange={(e) => setAlbumsEnabled(e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              Habilitar gestión de álbumes
                            </span>
                          </label>
                          <p className="text-xs text-[#6b7280] ml-6">
                            Si está habilitado, podrás crear y gestionar álbumes de fotos como un fotógrafo. Esto habilita la funcionalidad de álbumes en el panel.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Precios en landing de impresión
                          </label>
                          <Select
                            value={landingPriceMode}
                            onChange={(e) => setLandingPriceMode(e.target.value as "AUTO" | "RETAIL" | "WHOLESALE")}
                          >
                            <option value="RETAIL">Usar precio base (público)</option>
                            <option value="WHOLESALE">Usar precio profesional</option>
                            <option value="AUTO">Automático (por defecto: base)</option>
                          </Select>
                          <p className="text-xs text-[#6b7280] mt-1">
                            Define qué precios se muestran en tu página pública de impresión (l/[tu-handler]/imprimir). Base = retail; Profesional = mayorista.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Redes sociales y contacto */}
                    <div className="pt-6 border-t border-[#e5e7eb]">
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
                        onClick={handleSaveDatos}
                        disabled={saveLoading}
                      >
                        {saveLoading ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Las funcionalidades de negocio (pedidos, clientes, productos, álbumes) ahora están en /lab/negocio */}

            {/* Solapa: Mercado Pago */}
            {activeTab === "mercadopago" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Mercado Pago</h2>

                {saveError && (
                  <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                    <p className="text-[#ef4444] text-sm">{saveError}</p>
                  </div>
                )}

                {saveSuccess && (
                  <div className="bg-[#10b981]/10 border border-[#10b981] rounded-lg p-4">
                    <p className="text-[#10b981] text-sm">{saveSuccess}</p>
                  </div>
                )}

                {labLoading ? (
                  <div className="text-center py-8">
                    <p className="text-[#6b7280]">Cargando...</p>
                  </div>
                ) : (
                  <MercadoPagoIntegration
                    ownerType="LAB"
                    mpAccessToken={lab?.mpAccessToken}
                    mpUserId={lab?.mpUserId}
                    mpConnectedAt={lab?.mpConnectedAt}
                    showWarning
                    securityUrl="/ayuda/mercadopago/seguridad"
                    onReload={loadLab}
                    onError={setSaveError}
                    onSuccess={setSaveSuccess}
                  />
                )}
              </Card>
            )}

            {/* Solapa: Descuentos (reglas por cantidad) - PASO 4 */}
            {activeTab === "descuentos" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Descuentos por cantidad</h2>
                <p className="text-sm text-[#6b7280]">
                  Configurá reglas de descuento por cantidad (10, 30, 50, 80, 100 unidades). Los descuentos globales aplican a todos los productos; los por tamaño solo al tamaño indicado.
                </p>

                {/* Sub-tabs: Profesionales vs Público */}
                <div className="flex gap-0 border-b border-[#e5e7eb]">
                  <button
                    type="button"
                    onClick={() => setDiscountSubTab("PROFESSIONAL")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      discountSubTab === "PROFESSIONAL"
                        ? "border-[#c27b3d] text-[#c27b3d]"
                        : "border-transparent text-[#6b7280] hover:text-[#1a1a1a]"
                    }`}
                  >
                    Precios profesionales (fotógrafo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountSubTab("PUBLIC")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      discountSubTab === "PUBLIC"
                        ? "border-[#c27b3d] text-[#c27b3d]"
                        : "border-transparent text-[#6b7280] hover:text-[#1a1a1a]"
                    }`}
                  >
                    Precios del público (retail)
                  </button>
                </div>
                <p className="text-xs text-[#6b7280]">
                  {discountSubTab === "PROFESSIONAL"
                    ? "Estos descuentos se aplican sobre el precio mayorista (fotógrafo)."
                    : "Estos descuentos se aplican sobre el precio al público (retail)."}
                </p>

                {discountSizes.length === 0 && discountProducts.length === 0 ? (
                  <p className="text-sm text-[#6b7280] italic">
                    No hay productos cargados. Agregá productos en Productos para configurar descuentos por tamaño o producto.
                  </p>
                ) : (
                  <>
                    {/* Barra de edición masiva */}
                    {selectedDiscountRows.size > 0 && (
                      <BulkDiscountBar
                        selectedCount={selectedDiscountRows.size}
                        onApply={(vals) => {
                          selectedDiscountRows.forEach((key) => {
                            if (key === "GLOBAL") {
                              THRESHOLDS.forEach((qty) => setDiscountValue("global", "", qty, vals[qty]));
                            } else {
                              THRESHOLDS.forEach((qty) => setDiscountValue("size", key, qty, vals[qty]));
                            }
                          });
                        }}
                        onDeselect={() => setSelectedDiscountRows(new Set())}
                        thresholds={THRESHOLDS}
                      />
                    )}

                    {/* Tabla editable de descuentos */}
                    <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                            <th className="w-10 py-2 px-2">
                              <input
                                type="checkbox"
                                checked={
                                  (() => {
                                    const allKeys = new Set(["GLOBAL", ...discountSizes, ...Object.keys(discountsByType[discountSubTab].bySize)]);
                                    return selectedDiscountRows.size === allKeys.size && allKeys.size > 0;
                                  })()
                                }
                                onChange={(e) => {
                                  const allKeys = new Set(["GLOBAL", ...discountSizes, ...Object.keys(discountsByType[discountSubTab].bySize)]);
                                  setSelectedDiscountRows(e.target.checked ? allKeys : new Set());
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="text-center py-2 px-2 font-medium text-[#374151]">Alcance</th>
                            <th className="text-center py-2 px-1 font-medium text-[#374151]">10+</th>
                            <th className="text-center py-2 px-1 font-medium text-[#374151]">30+</th>
                            <th className="text-center py-2 px-1 font-medium text-[#374151]">50+</th>
                            <th className="text-center py-2 px-1 font-medium text-[#374151]">80+</th>
                            <th className="text-center py-2 px-1 font-medium text-[#374151]">100+</th>
                            <th className="w-10 py-2 px-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const d = discountsByType[discountSubTab];
                            return (
                          <>
                          <tr className={`border-b border-[#e5e7eb] hover:bg-[#f9fafb] ${selectedDiscountRows.has("GLOBAL") ? "bg-[#eff6ff]" : ""}`}>
                            <td className="py-1 px-2">
                              <input
                                type="checkbox"
                                checked={selectedDiscountRows.has("GLOBAL")}
                                onChange={(e) => {
                                  setSelectedDiscountRows((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add("GLOBAL");
                                    else next.delete("GLOBAL");
                                    return next;
                                  });
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="py-1 px-2 text-center text-[#1a1a1a] font-medium">Todos los productos</td>
                            <td className="py-1 px-1 text-center">
                              <Input type="number" min={0} max={100} step={0.5} value={d.global[10] || ""} onChange={(e) => setDiscountValue("global", "", 10, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" />
                            </td>
                            <td className="py-1 px-1 text-center">
                              <Input type="number" min={0} max={100} step={0.5} value={d.global[30] || ""} onChange={(e) => setDiscountValue("global", "", 30, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" />
                            </td>
                            <td className="py-1 px-1 text-center">
                              <Input type="number" min={0} max={100} step={0.5} value={d.global[50] || ""} onChange={(e) => setDiscountValue("global", "", 50, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" />
                            </td>
                            <td className="py-1 px-1 text-center">
                              <Input type="number" min={0} max={100} step={0.5} value={d.global[80] || ""} onChange={(e) => setDiscountValue("global", "", 80, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" />
                            </td>
                            <td className="py-1 px-1 text-center">
                              <Input type="number" min={0} max={100} step={0.5} value={d.global[100] || ""} onChange={(e) => setDiscountValue("global", "", 100, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" />
                            </td>
                            <td className="py-1 px-2">
                              <button type="button" onClick={() => THRESHOLDS.forEach((qty) => setDiscountValue("global", "", qty, 0))} className="p-1.5 text-[#6b7280] hover:text-red-600 hover:bg-red-50 rounded" title="Borrar fila">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                          {[...new Set([...discountSizes, ...Object.keys(d.bySize)])]
                            .filter((sz) => sz !== "GLOBAL")
                            .sort()
                            .map((size) => {
                              const bySz = d.bySize[size] || { 10: 0, 30: 0, 50: 0, 80: 0, 100: 0 };
                              return (
                                <tr key={size} className={`border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb] ${selectedDiscountRows.has(size) ? "bg-[#eff6ff]" : ""}`}>
                                  <td className="py-1 px-2"><input type="checkbox" checked={selectedDiscountRows.has(size)} onChange={(e) => { setSelectedDiscountRows((prev) => { const next = new Set(prev); if (e.target.checked) next.add(size); else next.delete(size); return next; }); }} className="rounded" /></td>
                                  <td className="py-1 px-2 text-center text-[#1a1a1a]">{size || <span className="text-[#6b7280] italic">Sin tamaño</span>}</td>
                                  <td className="py-1 px-1 text-center"><Input type="number" min={0} max={100} step={0.5} value={bySz[10] || ""} onChange={(e) => setDiscountValue("size", size, 10, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" /></td>
                                  <td className="py-1 px-1 text-center"><Input type="number" min={0} max={100} step={0.5} value={bySz[30] || ""} onChange={(e) => setDiscountValue("size", size, 30, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" /></td>
                                  <td className="py-1 px-1 text-center"><Input type="number" min={0} max={100} step={0.5} value={bySz[50] || ""} onChange={(e) => setDiscountValue("size", size, 50, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" /></td>
                                  <td className="py-1 px-1 text-center"><Input type="number" min={0} max={100} step={0.5} value={bySz[80] || ""} onChange={(e) => setDiscountValue("size", size, 80, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" /></td>
                                  <td className="py-1 px-1 text-center"><Input type="number" min={0} max={100} step={0.5} value={bySz[100] || ""} onChange={(e) => setDiscountValue("size", size, 100, Number(e.target.value) || 0)} className="!min-w-0 w-10 py-1 px-1 text-center text-sm" /></td>
                                  <td className="py-1 px-2">
                                    <button type="button" onClick={() => THRESHOLDS.forEach((qty) => setDiscountValue("size", size, qty, 0))} className="p-1.5 text-[#6b7280] hover:text-red-600 hover:bg-red-50 rounded" title="Borrar fila">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {errorMsg && <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">{errorMsg}</div>}
                <div className="flex gap-3">
                  <Button variant="primary" onClick={saveGlobalDiscounts} disabled={busy}>
                    {busy ? "Guardando..." : "Guardar Descuentos"}
                  </Button>
                  <Button variant="secondary" onClick={loadGlobalDiscounts} disabled={busy}>
                    Recargar
                  </Button>
                </div>

                {/* Calculadora de precios según solapa activa */}
                <div className="mt-6 p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                  <h3 className="text-sm font-medium text-[#374151] mb-3">
                    Calculadora de precios ({discountSubTab === "PROFESSIONAL" ? "precios profesionales" : "precios del público"})
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-xs text-[#6b7280] mb-1">Tamaño</label>
                      <Select
                        value={calcSize}
                        onChange={(e) => setCalcSize(e.target.value)}
                        className="min-w-[120px]"
                      >
                        <option value="">Seleccionar</option>
                        {[...new Set([...discountSizes, ...discountProducts.map((p) => p.size ?? "").filter(Boolean)])].sort().map((s) => (
                          <option key={s} value={s}>{s || "Sin tamaño"}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6b7280] mb-1">Cantidad</label>
                      <Input
                        type="number"
                        min={1}
                        value={calcQty}
                        onChange={(e) => setCalcQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20"
                      />
                    </div>
                  </div>
                  {(() => {
                    const prod = discountProducts.find((p) => (p.size ?? "") === calcSize);
                    const basePrice = discountSubTab === "PROFESSIONAL" ? (prod?.photographerPrice ?? 0) : (prod?.retailPrice ?? 0);
                    const d = discountsByType[discountSubTab];
                    const tiers = [100, 80, 50, 30, 10] as const;
                    const tier = tiers.find((t) => calcQty >= t);
                    const bySz = d.bySize[calcSize];
                    const discountPct = tier ? ((bySz && bySz[tier] > 0) ? bySz[tier] : d.global[tier]) : 0;
                    const finalPrice = basePrice * (1 - discountPct / 100);
                    const total = finalPrice * calcQty;
                    return (
                      <div className="mt-3 text-sm space-y-1">
                        {prod ? (
                          <>
                            <p className="text-[#6b7280]">
                              Precio base: <span className="font-medium text-[#1a1a1a]">${basePrice.toLocaleString("es-AR")}</span> por unidad
                            </p>
                            {tier && discountPct > 0 && (
                              <p className="text-[#6b7280]">
                                Descuento {tier}+: <span className="font-medium text-[#059669]">{discountPct}%</span>
                              </p>
                            )}
                            <p className="text-[#6b7280]">
                              Precio por unidad: <span className="font-medium text-[#1a1a1a]">${finalPrice.toLocaleString("es-AR")}</span>
                            </p>
                            <p className="font-medium text-[#1a1a1a]">
                              Total ({calcQty} unidades): <span className="text-[#059669]">${total.toLocaleString("es-AR")}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-[#6b7280] italic">Seleccioná un tamaño con producto cargado para ver el cálculo.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </Card>
            )}

            {/* Solapa: Referidos - PASO 5 */}
            {activeTab === "referidos" && (
              <ReferidosTab mercadopagoLink="/lab/configuracion/mercadopago" />
            )}

            {/* Solapa: Upselling - PASO 6 */}
            {activeTab === "upselling" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Upselling de impresiones</h2>
                <p className="text-sm text-[#6b7280]">
                  Definí sugerencias y promos para aumentar el ticket: combos, descuentos por cantidad, etc. Se mostrarán en la landing del lab y en el flujo de impresión del fotógrafo.
                </p>
                <div className="p-6 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb] text-center text-[#6b7280]">
                  <p>Próximamente: CRUD de upsells con min_qty, beneficio y productos aplicables.</p>
                </div>
              </Card>
            )}

            {/* Solapa: Diseño */}
            {activeTab === "diseno" && (
              <Card className="space-y-6">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Diseño de tu entorno</h2>

                {saveError && (
                  <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                    <p className="text-[#ef4444] text-sm">{saveError}</p>
                  </div>
                )}

                {saveSuccess && (
                  <div className="bg-[#10b981]/10 border border-[#10b981] rounded-lg p-4">
                    <p className="text-[#10b981] text-sm">{saveSuccess}</p>
                  </div>
                )}

                {labLoading ? (
                  <div className="text-center py-8">
                    <p className="text-[#6b7280]">Cargando...</p>
                  </div>
                ) : (
                  <>

                    {saveError && (
                      <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-red-700">
                        {saveError}
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="p-3 border border-green-300 bg-green-50 rounded-lg text-green-700">
                        {saveSuccess}
                      </div>
                    )}

                    {/* Logo */}
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                        Logo (PNG)
                      </label>
                      <p className="text-xs text-[#6b7280] mb-3">
                        Subí tu logo en formato PNG. Se mostrará en el borde superior izquierdo de tu página personalizada.
                        Dimensiones recomendadas: 180x54px.
                      </p>
                      {logoUrl ? (
                        <div className="mb-4 p-4 border border-[#e5e7eb] rounded-lg bg-[#f8f9fa]">
                          <Image
                            src={logoUrl}
                            alt="Logo actual"
                            width={180}
                            height={54}
                            className="h-12 w-auto object-contain"
                            unoptimized
                            onError={(e) => {
                              console.error("Error cargando logo:", logoUrl);
                              // Si falla, intentar mostrar como img normal
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="mb-4 p-4 border border-[#e5e7eb] rounded-lg bg-[#f8f9fa] text-center text-[#6b7280] text-sm">
                          No hay logo cargado
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
                                setSaveError("El archivo debe ser PNG");
                                return;
                              }
                              setLogoFile(file);
                            }
                          }}
                        />
                        <Button
                          variant="primary"
                          onClick={handleLogoUpload}
                          disabled={!logoFile || saveLoading}
                        >
                          {saveLoading ? "Subiendo..." : "Subir Logo"}
                        </Button>
                      </div>
                    </div>

                    {/* Colores - igual que panel del fotógrafo */}
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
                          Se usa en: barra superior (header), pie de página (footer), hero y fondos suaves de secciones.
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
                              <span className="text-[#6b7280]">compramelafoto.com/l/</span>
                              <Input
                                type="text"
                                placeholder="dnxestudio"
                                value={publicPageHandler}
                                onChange={(e) => setPublicPageHandler(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                pattern="^[a-z0-9-]+$"
                              />
                            </div>
                            <p className="text-xs text-[#6b7280] mt-1">
                              Solo letras minúsculas, números y guiones. Ejemplo: dnxestudio, laboratorio-foto
                            </p>
                            {publicPageHandler && (
                              <div className="mt-2 space-y-4">
                                <div className="p-3 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-[#1a1a1a]">
                                      Tu página estará disponible en:{" "}
                                      <span className="font-mono text-[#c27b3d]">
                                        {typeof window !== "undefined" ? window.location.origin : ""}/l/{publicPageHandler}
                                      </span>
                                    </p>
                                    <button
                                      onClick={async () => {
                                        const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/l/${publicPageHandler}`;
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
                              </div>
                            )}
                          </div>

                          <div className="pb-6 border-b border-[#e5e7eb]">
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

                          {publicPageHandler && (
                            <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb] mb-6">
                              <p className="text-sm text-[#1a1a1a] font-medium mb-2">
                                📋 Características de tu página personalizada:
                              </p>
                              <ul className="text-sm text-[#6b7280] space-y-1 list-disc list-inside">
                                <li>Home con información de tu laboratorio y productos</li>
                                <li>Encabezado con tu logo PNG (mismas dimensiones que el logo de ComprameLaFoto)</li>
                                <li>Colores personalizados aplicados a toda la interfaz</li>
                                <li>Footer con enlace "Trabajar con ComprameLaFoto"</li>
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                      <Button
                        variant="primary"
                        onClick={handleSaveLab}
                        disabled={saveLoading}
                      >
                        {saveLoading ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}

            </div>
          </div>

          {/* Footer con link de vuelta */}
          <div className="mt-8 text-center">
            <Link href="/" className="text-[#6b7280] hover:text-[#1a1a1a] underline">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
      </section>
    </div>
    </>
  );
}

/**
 * /lab/configuracion redirige a /lab/configuracion/datos.
 * Cada sección (datos, diseño, mercadopago, etc.) es ahora una página propia.
 */
export default function LabConfigPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lab/configuracion/datos");
  }, [router]);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-[#6b7280]">Redirigiendo...</p>
    </div>
  );
}
