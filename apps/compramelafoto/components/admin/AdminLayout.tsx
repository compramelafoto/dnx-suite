"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import AdminNotificationBell from "@/components/admin/AdminNotificationBell";

export const dynamic = 'force-dynamic';

interface AdminLayoutProps {
  children: React.ReactNode;
}

type MenuLeafItem = { id: string; label: string; path: string };

/** Ítem con link directo o grupo desplegable (solo hijos linkean). */
type MenuItem =
  | MenuLeafItem
  | {
      id: string;
      label: string;
      children: MenuLeafItem[];
    };

type MenuGroup = { title: string; items: MenuItem[] };

function isMenuSubgroup(item: MenuItem): item is { id: string; label: string; children: MenuLeafItem[] } {
  return "children" in item && Array.isArray((item as { children?: unknown }).children);
}

const menuGroups: MenuGroup[] = [
  {
    title: "Inicio",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/admin" },
      { id: "funnel-compra", label: "Funnel de compra", path: "/admin#funnel-compra" },
    ],
  },
  {
    title: "Ventas y pedidos",
    items: [
      { id: "conversion", label: "Conversión checkout", path: "/admin/conversion" },
      { id: "pedidos", label: "Pedidos", path: "/admin/pedidos" },
      { id: "clientes", label: "Clientes", path: "/admin/clientes" },
      { id: "interesados", label: "Interesados", path: "/admin/interesados" },
      {
        id: "fotooffice-interesados",
        label: "FotoOffice interesados",
        path: "/admin/fotooffice-interesados",
      },
      {
        id: "pagos-mp-anomalias",
        label: "Pagos MP / anomalías",
        path: "/admin/pagos-mp-anomalias",
      },
    ],
  },
  {
    title: "Álbumes y eventos",
    items: [
      { id: "albums-public", label: "Álbumes públicos", path: "/admin/albums?visibility=public" },
      { id: "albums-private", label: "Álbumes privados", path: "/admin/albums?visibility=private" },
      { id: "eventos", label: "Eventos", path: "/admin/eventos" },
    ],
  },
  {
    title: "Escolar",
    items: [
      { id: "escuelas", label: "Escuelas", path: "/admin/escuelas" },
      {
        id: "admins-escolares",
        label: "Admins escolares",
        path: "/admin/usuarios?tab=administradores-escuela",
      },
    ],
  },
  {
    title: "Catálogo",
    items: [
      {
        id: "catalog-templates",
        label: "Plantillas de productos",
        path: "/admin/catalog-templates",
      },
      { id: "upselling", label: "Upselling", path: "/admin/upselling" },
    ],
  },
  {
    title: "Diseños",
    items: [
      { id: "plantillas-v2-hub", label: "Plantillas y editor V2", path: "/dashboard/designs" },
      { id: "template-v2-revision", label: "Revisión plantillas V2", path: "/admin/template-v2/revision" },
      { id: "plantillas", label: "Plantillas clásicas (V1)", path: "/admin/plantillas" },
      { id: "plantillas-disenador", label: "Diseñador clásico (V1)", path: "/admin/plantillas/disenador" },
      { id: "proyectos", label: "Proyectos de diseño", path: "/admin/proyectos" },
    ],
  },
  {
    title: "Usuarios y partners",
    items: [
      { id: "usuarios", label: "Usuarios", path: "/admin/usuarios" },
      { id: "fotografos", label: "Fotógrafos", path: "/admin/fotografos" },
      { id: "fotografos-mapa", label: "Mapa fotógrafos", path: "/admin/fotografos/mapa" },
      { id: "laboratorios", label: "Laboratorios", path: "/admin/laboratorios" },
      {
        id: "organizadores",
        label: "Organizadores",
        path: "/admin/usuarios?tab=organizadores",
      },
      { id: "recomendados", label: "Laboratorios recomendados", path: "/admin/recomendados" },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { id: "finanzas", label: "Resumen financiero", path: "/admin/finanzas" },
      { id: "referral-payouts", label: "Cobros referidos", path: "/admin/referral-payouts" },
      { id: "referral-stats", label: "Estadísticas referidos", path: "/admin/referral-stats" },
      {
        id: "organizer-event-withdrawals",
        label: "Retiros organizadores",
        path: "/admin/organizer-commission-withdrawals",
      },
    ],
  },
  {
    title: "Marketing",
    items: [
      { id: "mensajes", label: "Mensajes", path: "/admin/mensajes" },
      { id: "emails", label: "Emails", path: "/admin/emails" },
      { id: "email-marketing", label: "Email marketing", path: "/admin/email-marketing" },
      { id: "charlas", label: "Charlas", path: "/admin/marketing/charlas" },
      {
        id: "marketing-cursos",
        label: "Cursos",
        children: [
          {
            id: "dnx-curso-fotografia-funes",
            label: "Fotografía Básica — Funes",
            path: "/admin/marketing/cursos/fotografia-basica-funes",
          },
        ],
      },
      { id: "banner", label: "Banner del home", path: "/admin/banner" },
      { id: "blog", label: "Blog", path: "/admin/blog" },
      { id: "testimonios", label: "Testimonios", path: "/admin/testimonios" },
      { id: "tutoriales", label: "Tutoriales", path: "/admin/tutoriales" },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { id: "comunidad-para-fotografos", label: "Para fotógrafos", path: "/admin/comunidad/para-fotografos" },
      { id: "comunidad-proveedores", label: "Proveedores", path: "/admin/comunidad/proveedores" },
    ],
  },
  {
    title: "Soporte",
    items: [{ id: "soporte", label: "Incidencias", path: "/admin/soporte" }],
  },
  {
    title: "Seguridad y auditoría",
    items: [
      { id: "auditoria", label: "Auditoría", path: "/admin/auditoria" },
      { id: "antifraude", label: "Antifraude", path: "/admin/antifraude" },
      { id: "auditoria-selfies", label: "Auditoría selfies", path: "/admin/auditoria-selfies" },
      { id: "procesamiento-fotos", label: "Procesamiento fotos", path: "/admin/procesamiento-fotos" },
      { id: "equipos-fotograficos", label: "Equipos fotográficos", path: "/admin/equipos-fotograficos" },
      { id: "ia", label: "IA / Reconocimiento", path: "/admin/ia" },
      {
        id: "solicitudes-privacidad",
        label: "Solicitudes ARCO",
        path: "/admin/privacidad/solicitudes",
      },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { id: "salud-plataforma", label: "Salud de la Plataforma", path: "/admin/salud-plataforma" },
      { id: "configuracion", label: "Configuración general", path: "/admin/configuracion" },
      { id: "r2", label: "Almacenamiento R2", path: "/admin/r2" },
      { id: "cambiar-contrasena", label: "Cambiar contraseña", path: "/cuenta/cambiar-contrasena" },
    ],
  },
];

function getActiveMenuId(
  pathname: string | null,
  searchParams: URLSearchParams | null,
  locationHash?: string
): string {
  const visibility = searchParams?.get("visibility");
  const tab = searchParams?.get("tab");

  if (pathname === "/admin" && locationHash === "#funnel-compra") return "funnel-compra";
  if (pathname === "/admin/albums" && visibility === "private") return "albums-private";
  if (pathname === "/admin/albums" && (visibility === "public" || !visibility)) return "albums-public";
  if (pathname?.startsWith("/admin/eventos")) return "eventos";
  if (pathname?.startsWith("/admin/escuelas")) return "escuelas";
  if (pathname === "/admin/usuarios" && tab === "administradores-escuela") return "admins-escolares";
  if (pathname === "/admin/usuarios" && tab === "organizadores") return "organizadores";
  if (pathname?.startsWith("/admin/fotografos/mapa")) return "fotografos-mapa";
  if (pathname === "/admin/fotografos" || pathname?.startsWith("/admin/fotografos/")) return "fotografos";
  if (pathname?.startsWith("/admin/laboratorios")) return "laboratorios";
  if (pathname?.startsWith("/admin/clientes")) return "clientes";
  if (pathname?.startsWith("/admin/fotooffice-interesados")) return "fotooffice-interesados";
  if (pathname === "/dashboard/designs" || pathname?.startsWith("/dashboard/designs/")) return "plantillas-v2-hub";
  if (pathname?.startsWith("/admin/template-v2")) return "template-v2-revision";
  if (pathname?.startsWith("/admin/plantillas/disenador")) return "plantillas-disenador";
  if (pathname?.startsWith("/admin/email-marketing")) return "email-marketing";
  if (pathname?.startsWith("/admin/marketing/charlas")) return "charlas";
  if (pathname?.startsWith("/admin/catalog-templates")) return "catalog-templates";
  if (pathname?.startsWith("/admin/testimonios")) return "testimonios";
  if (pathname?.startsWith("/admin/proyectos")) return "proyectos";
  if (pathname?.startsWith("/admin/pagos-mp-anomalias")) return "pagos-mp-anomalias";
  if (pathname?.startsWith("/admin/antifraude")) return "antifraude";
  if (pathname?.startsWith("/admin/banner")) return "banner";
  if (pathname?.startsWith("/admin/blog")) return "blog";
  if (pathname?.startsWith("/admin/tutoriales")) return "tutoriales";
  if (pathname?.startsWith("/admin/upselling")) return "upselling";
  for (const group of menuGroups) {
    for (const item of group.items) {
      if (isMenuSubgroup(item)) {
        const sorted = [...item.children].sort(
          (a, b) => (b.path.split("?")[0]?.length ?? 0) - (a.path.split("?")[0]?.length ?? 0)
        );
        for (const child of sorted) {
          const pathBase = child.path.split("?")[0];
          if (
            pathname === child.path ||
            pathname === pathBase ||
            (pathBase && pathname?.startsWith(pathBase + "/"))
          ) {
            return child.id;
          }
        }
      } else {
        const pathBase = item.path.split("?")[0];
        if (pathname === item.path || pathname === pathBase || (pathBase && pathname?.startsWith(pathBase + "/")))
          return item.id;
      }
    }
  }
  return "dashboard";
}

const BRAND_ORANGE = "#c27b3d";

const iconClass = "w-4 h-4 shrink-0 opacity-80";

function GroupIcon({ name }: { name: string }) {
  switch (name) {
    case "Inicio":
    case "Vista general":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "Ventas y pedidos":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case "Diseños":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case "Álbumes y eventos":
    case "Álbumes y contenido":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "Escolar":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      );
    case "Catálogo":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "Usuarios y partners":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Comunidad":
    case "Comunidad / Directorio":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "Marketing":
    case "Comunicación":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    case "Finanzas":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "Soporte":
    case "Soporte y calidad":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Seguridad y auditoría":
    case "Privacidad y cumplimiento":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "Plataforma":
    case "Configuración de plataforma":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

const ADMIN_SIDEBAR_STORAGE_KEY = "admin-sidebar-open";

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [unreadEmailAlerts, setUnreadEmailAlerts] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locationHash, setLocationHash] = useState("");

  const activeMenuId = getActiveMenuId(pathname ?? null, searchParams, locationHash);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncHash = () => setLocationHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
      setSidebarOpen(stored !== null ? JSON.parse(stored) : true);
    } catch {
      setSidebarOpen(true);
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarOpen));
    } catch {}
  }, [sidebarOpen]);

  useEffect(() => {
    const activeGroup = menuGroups.find((g) =>
      g.items.some((i) => (isMenuSubgroup(i) ? i.children.some((c) => c.id === activeMenuId) : i.id === activeMenuId))
    );
    if (activeGroup) {
      setExpandedGroups((prev) => new Set(prev).add(activeGroup.title));
    }
  }, [activeMenuId]);

  // En smartphone, al navegar cerrar el cajón del menú
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    setSidebarOpen(false);
  }, [pathname]);

  // Bloquear scroll de fondo cuando el menú móvil está abierto
  useEffect(() => {
    if (typeof document === "undefined") return;
    const mobileOpen =
      sidebarOpen && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  function toggleGroup(title: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  useEffect(() => {
    // En la página de login no llamar a la API de config (evita 401 en red)
    if (pathname === "/admin/login") {
      setAuthLoading(false);
      setAuthChecked(true);
      return;
    }

    if (authChecked) {
      return;
    }

    let isMounted = true;
    
    const timeout = setTimeout(() => {
      if (isMounted && authLoading) {
        console.warn("Timeout en verificación de autenticación");
        setAuthLoading(false);
        setAuthChecked(true);
      }
    }, 15000);

    checkAuth().finally(() => {
      if (isMounted) {
        setAuthChecked(true);
        clearTimeout(timeout);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/config", {
        credentials: "include", // Asegurar que se envíen las cookies
      });
      
      if (!res.ok) {
        // Solo redirigir al login si es un error de autenticación (401)
        // No redirigir si es un error del servidor (500) u otros errores
        if (res.status === 401) {
          setAuthLoading(false);
          // Verificar si es un problema de rol
          const errorData = await res.json().catch(() => ({}));
          if (errorData.error?.includes("rol ADMIN")) {
            console.error("Tu usuario no tiene rol ADMIN. Ejecutá: fetch('/api/admin/set-admin-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cuart.daniel@gmail.com' }) })");
          }
          router.push("/admin/login");
          return;
        }
        
        // Si es un error 403 (forbidden), puede ser un problema de rol pero no redirigir inmediatamente
        if (res.status === 403) {
          console.warn("Acceso denegado (403), pero continuando - puede ser un problema de rol");
          setAuthLoading(false);
          // Continuar de todas formas, el usuario puede usar el botón para actualizar su rol
          return;
        }
        
        // Si es un error 500 u otro error del servidor, no redirigir
        // Solo mostrar un warning y continuar
        if (res.status >= 500) {
          console.warn("Error del servidor al verificar autenticación, pero continuando:", res.status);
          setAuthLoading(false);
          // Continuar de todas formas, puede ser un error temporal
          return;
        }
        
        // Para otros errores (404, etc), no redirigir automáticamente
        console.warn("Error al verificar autenticación:", res.status);
        setAuthLoading(false);
        return;
      }
      
      // Si la respuesta es ok, obtener email del usuario
      try {
        const userRes = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserEmail(userData.email || null);
        }
      } catch (userErr) {
        // Si falla obtener el email, continuar de todas formas
        console.warn("No se pudo obtener el email del usuario:", userErr);
      }

      try {
        const countRes = await fetch("/api/admin/emails/alerts/unread-count", {
          credentials: "include",
        });
        if (countRes.ok) {
          const countData = await countRes.json();
          setUnreadEmailAlerts(countData.count || 0);
        }
      } catch (countErr) {
        console.warn("No se pudo obtener contador de emails:", countErr);
      }
      
      setAuthLoading(false);
    } catch (err) {
      console.error("Error verificando autenticación:", err);
      // Solo redirigir si es un error de red crítico
      // No redirigir por errores temporales
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        // Error de red, puede ser temporal, no redirigir inmediatamente
        console.warn("Error de red al verificar autenticación, puede ser temporal");
        setAuthLoading(false);
        return;
      }
      setAuthLoading(false);
      // Solo redirigir si es un error crítico que definitivamente indica falta de autenticación
      // router.push("/admin/login");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch (err) {
      router.push("/admin/login");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Verificando autenticación...</p>
      </div>
    );
  }

  // Página de login: solo el contenido, sin header ni menú
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fijo */}
      <header className="bg-black border-b border-gray-700 sticky top-0 z-[60]">
        <div className="max-w-[100vw] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 min-h-14 sm:h-16 py-2 sm:py-0">
            {/* Botón menú + Logo y distintivo Admin */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="flex items-center justify-center w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0 touch-manipulation"
                aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              <Link href="/admin" className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Image
                  src="/LOGO CLF.png"
                  alt="ComprameLaFoto"
                  width={120}
                  height={40}
                  className="h-8 sm:h-10 w-auto max-w-[min(100px,28vw)] object-contain shrink-0"
                />
                <span className="text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-white/30 shrink-0">
                  Admin
                </span>
              </Link>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 shrink-0">
              <AdminNotificationBell />
              <Link href="/admin/emails" className="relative touch-manipulation" aria-label="Emails">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l8.89 5.26c.7.41 1.56.41 2.26 0L23 8m-18 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </span>
                {unreadEmailAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
                    {unreadEmailAlerts}
                  </span>
                )}
              </Link>
              {userEmail && (
                <span className="text-xs sm:text-sm text-white/80 max-w-[40vw] md:max-w-[200px] truncate hidden sm:inline" title={userEmail}>
                  {userEmail}
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={handleLogout} className="text-sm bg-white/10 text-white border-white/20 hover:bg-white/20 touch-manipulation whitespace-nowrap">
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Fondo atenuado: solo móvil, cuando el menú lateral está abierto */}
      <button
        type="button"
        aria-label="Cerrar menú"
        className={`fixed inset-0 top-14 sm:top-16 z-[45] bg-black/50 transition-opacity md:hidden ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="flex relative">
        {/* Sidebar: en &lt;md es un drawer; en md+ ocupa la columna como antes */}
        <aside
          className={[
            "flex flex-col border-r shrink-0 transition-[width,opacity,transform] duration-300 ease-out",
            // Móvil: drawer encima del contenido
            "fixed z-[50] top-14 left-0 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] sm:top-16 w-[min(18rem,88vw)] max-w-[100vw]",
            "shadow-2xl md:shadow-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:translate-x-0 md:relative md:top-16 md:z-auto md:h-auto md:min-h-[calc(100dvh-4rem)] md:sticky",
            sidebarOpen ? "md:w-72 md:opacity-100" : "md:w-0 md:min-w-0 md:overflow-hidden md:opacity-0 md:border-r-0 md:pointer-events-none",
          ].join(" ")}
          style={{ backgroundColor: "#1e3a5f", borderColor: "rgba(255,255,255,0.08)" }}
          aria-hidden={!sidebarOpen}
        >
          <div className="p-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${BRAND_ORANGE}22`, color: BRAND_ORANGE }}
            >
              Panel Admin
            </span>
          </div>
          <nav className="p-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))] touch-pan-y">
            {menuGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.title);
              return (
                <div key={group.title} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-2">
                      <GroupIcon name={group.title} />
                      <span className="min-w-0 break-words leading-snug whitespace-normal">{group.title}</span>
                    </span>
                    <svg
                      className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ul className="space-y-0.5 pt-0.5 pb-2">
                        {group.items.map((item) => {
                          if (isMenuSubgroup(item)) {
                            return (
                              <li key={item.id}>
                                <div
                                  className="pl-6 pr-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                                  style={{ color: "rgba(255,255,255,0.45)" }}
                                >
                                  {item.label}
                                </div>
                                <ul className="space-y-0.5 pb-1">
                                  {item.children.map((child) => {
                                    const active = activeMenuId === child.id;
                                    return (
                                      <li key={child.id}>
                                        <Link
                                          href={child.path}
                                          className={`block pl-10 pr-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-normal leading-snug break-words ${
                                            active
                                              ? "border-l-2 -ml-px pl-[2.35rem]"
                                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                                          }`}
                                          style={
                                            active
                                              ? {
                                                  backgroundColor: `${BRAND_ORANGE}22`,
                                                  color: BRAND_ORANGE,
                                                  borderLeftColor: BRAND_ORANGE,
                                                }
                                              : undefined
                                          }
                                        >
                                          {child.label}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </li>
                            );
                          }
                          const active = activeMenuId === item.id;
                          return (
                            <li key={item.id}>
                              <Link
                                href={item.path}
                                className={`block pl-6 pr-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-normal leading-snug break-words ${
                                  active
                                    ? "border-l-2 -ml-px pl-[1.35rem]"
                                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                                }`}
                                style={
                                  active
                                    ? {
                                        backgroundColor: `${BRAND_ORANGE}22`,
                                        color: BRAND_ORANGE,
                                        borderLeftColor: BRAND_ORANGE,
                                      }
                                    : undefined
                                }
                              >
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Contenido principal: min-w-0 evita overflow horizontal en flex. Sin padding en diseñador (full-bleed). */}
        <main
          className={`flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden box-border ${
            pathname?.startsWith("/admin/plantillas/disenador") ? "p-0" : "p-3 sm:p-4 md:p-6"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Cargando...</p>
      </div>
    }>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
