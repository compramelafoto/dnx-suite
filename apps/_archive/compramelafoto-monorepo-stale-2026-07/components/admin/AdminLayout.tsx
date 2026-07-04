"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";

export const dynamic = 'force-dynamic';

interface AdminLayoutProps {
  children: React.ReactNode;
}

type MenuGroup = { title: string; items: { id: string; label: string; path: string }[] };

const menuGroups: MenuGroup[] = [
  {
    title: "Vista general",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/admin" },
      { id: "pedidos", label: "Pedidos", path: "/admin/pedidos" },
    ],
  },
  {
    title: "Diseños",
    items: [
      { id: "plantillas", label: "Plantillas", path: "/admin/plantillas" },
      { id: "plantillas-disenador", label: "Diseñador de plantillas", path: "/admin/plantillas/disenador" },
    ],
  },
  {
    title: "Proyectos",
    items: [
      { id: "proyectos", label: "Proyectos", path: "/admin/proyectos" },
    ],
  },
  {
    title: "Álbumes y contenido",
    items: [
      { id: "albums-public", label: "Álbumes públicos", path: "/admin/albums?visibility=public" },
      { id: "albums-private", label: "Álbumes privados", path: "/admin/albums?visibility=private" },
      { id: "interesados", label: "Clientes interesados", path: "/admin/interesados" },
    ],
  },
  {
    title: "Usuarios y partners",
    items: [
      { id: "usuarios", label: "Usuarios", path: "/admin/usuarios" },
      { id: "recomendados", label: "Laboratorios recomendados", path: "/admin/recomendados" },
    ],
  },
  {
    title: "Comunidad / Directorio",
    items: [
      { id: "comunidad-para-fotografos", label: "Para fotógrafos", path: "/admin/comunidad/para-fotografos" },
      { id: "comunidad-proveedores", label: "Proveedores", path: "/admin/comunidad/proveedores" },
    ],
  },
  {
    title: "Comunicación",
    items: [
      { id: "mensajes", label: "Mensajes", path: "/admin/mensajes" },
      { id: "emails", label: "Emails", path: "/admin/emails" },
      { id: "email-marketing", label: "Email Marketing", path: "/admin/email-marketing" },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { id: "finanzas", label: "Finanzas", path: "/admin/finanzas" },
      { id: "referral-payouts", label: "Cobros referidos", path: "/admin/referral-payouts" },
      { id: "referral-stats", label: "Estadísticas referidos", path: "/admin/referral-stats" },
    ],
  },
  {
    title: "Soporte y calidad",
    items: [
      { id: "soporte", label: "Soporte / Incidencias", path: "/admin/soporte" },
      { id: "testimonios", label: "Testimonios", path: "/admin/testimonios" },
      { id: "ia", label: "IA / Reconocimiento", path: "/admin/ia" },
      { id: "auditoria", label: "Auditoría", path: "/admin/auditoria" },
      { id: "antifraude", label: "Antifraude", path: "/admin/antifraude" },
      { id: "auditoria-selfies", label: "Auditoría Selfies", path: "/admin/auditoria-selfies" },
      { id: "r2", label: "R2 / Almacenamiento", path: "/admin/r2" },
    ],
  },
  {
    title: "Privacidad y cumplimiento",
    items: [
      { id: "solicitudes-privacidad", label: "Solicitudes ARCO", path: "/admin/privacidad/solicitudes" },
    ],
  },
  {
    title: "Configuración de plataforma",
    items: [
      { id: "configuracion", label: "Configuración", path: "/admin/configuracion" },
      { id: "cambiar-contrasena", label: "Cambiar contraseña", path: "/cuenta/cambiar-contraseña" },
      { id: "upselling", label: "Upselling", path: "/admin/upselling" },
      { id: "banner", label: "Banner del home", path: "/admin/banner" },
      { id: "tutoriales", label: "Tutoriales", path: "/admin/tutoriales" },
    ],
  },
];

function getActiveMenuId(pathname: string | null, searchParams: URLSearchParams | null): string {
  const visibility = searchParams?.get("visibility");
  if (pathname === "/admin/albums" && visibility === "private") return "albums-private";
  if (pathname === "/admin/albums" && (visibility === "public" || !visibility)) return "albums-public";
  if (pathname?.startsWith("/admin/plantillas/disenador")) return "plantillas-disenador";
  if (pathname?.startsWith("/admin/email-marketing")) return "email-marketing";
  if (pathname?.startsWith("/admin/testimonios")) return "testimonios";
  if (pathname?.startsWith("/admin/proyectos")) return "proyectos";
  if (pathname?.startsWith("/admin/antifraude")) return "antifraude";
  for (const group of menuGroups) {
    for (const item of group.items) {
      const pathBase = item.path.split("?")[0];
      if (pathname === item.path || pathname === pathBase || (pathBase && pathname?.startsWith(pathBase + "/"))) return item.id;
    }
  }
  return "dashboard";
}

const BRAND_ORANGE = "#c27b3d";

const iconClass = "w-4 h-4 shrink-0 opacity-80";

function GroupIcon({ name }: { name: string }) {
  switch (name) {
    case "Vista general":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "Diseños":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case "Proyectos":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "Álbumes y contenido":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "Usuarios y partners":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Comunidad / Directorio":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "Comunicación":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "Finanzas":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "Privacidad y cumplimiento":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "Soporte y calidad":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
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

  const activeMenuId = getActiveMenuId(pathname ?? null, searchParams);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

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
    const activeGroup = menuGroups.find((g) => g.items.some((i) => i.id === activeMenuId));
    if (activeGroup) {
      setExpandedGroups((prev) => new Set(prev).add(activeGroup.title));
    }
  }, [activeMenuId]);

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
      <header className="bg-black border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Botón menú + Logo y distintivo Admin */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="flex items-center justify-center w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
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
              <Link href="/admin" className="flex items-center gap-3">
                <Image
                  src="/LOGO CLF.png"
                  alt="ComprameLaFoto"
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
                <span className="text-white text-xs font-semibold px-2 py-1 rounded border border-white/30">
                  Admin
                </span>
              </Link>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-4">
              <Link href="/admin/emails" className="relative">
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
                <span className="text-sm text-white/80">{userEmail}</span>
              )}
              <Button variant="secondary" onClick={handleLogout} className="text-sm bg-white/10 text-white border-white/20 hover:bg-white/20">
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar ADMIN: se puede ocultar con el botón superior izquierdo */}
        <aside
          className={`min-h-[calc(100vh-4rem)] sticky top-16 flex flex-col border-r shrink-0 transition-[width,opacity] duration-300 ease-out ${
            sidebarOpen ? "w-64 opacity-100" : "w-0 min-w-0 overflow-hidden opacity-0 border-r-0"
          }`}
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
          <nav className="p-2 flex-1 overflow-y-auto">
            {menuGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.title);
              return (
                <div key={group.title} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon name={group.title} />
                      {group.title}
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
                          const active = activeMenuId === item.id;
                          return (
                            <li key={item.id}>
                              <Link
                                href={item.path}
                                className={`block pl-6 pr-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
        <main className={`flex-1 min-w-0 overflow-x-hidden ${pathname?.startsWith("/admin/plantillas/disenador") ? "p-0" : "p-6"}`}>
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
