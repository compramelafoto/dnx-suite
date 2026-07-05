"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SessionTransitionOverlay from "./SessionTransitionOverlay";

type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
  organizers: number;
} | null;

type UserInfo = {
  type: string;
  name: string;
  id: number;
  role?: string;
};

const ROLE_LABELS: Record<string, string> = {
  photographer: "Fotógraf@",
  client: "Cliente",
  lab: "Laboratorio",
  admin: "Administrador",
  organizer: "Organizador",
};

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [directoryCounts, setDirectoryCounts] = useState<DirectoryCounts>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authAbortRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const AUTH_CHECK_TIMEOUT_MS = 4000;

  const checkAuth = useCallback(async () => {
    authAbortRef.current?.abort();
    const controller = new AbortController();
    authAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      authAbortRef.current = null;

      if (!response.ok) {
        setUser(null);
        setLoading(false);
        return;
      }

      const data = await response.json().catch(() => ({ user: null }));

      if (data?.user) {
        const role = data.user.role;
        let userType = "user";
        if (role === "PHOTOGRAPHER") userType = "photographer";
        else if (role === "CUSTOMER") userType = "client";
        else if (role === "LAB" || role === "LAB_PHOTOGRAPHER") userType = "lab";
        else if (role === "ADMIN") userType = "admin";
        else if (role === "ORGANIZER") userType = "organizer";

        setUser({
          type: userType,
          name: data.user.name || data.user.email,
          id: data.user.id,
          role: role,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      authAbortRef.current = null;
      const isAbortError =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (!isAbortError) {
        console.error("Error verificando autenticación:", error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    return () => {
      authAbortRef.current?.abort();
    };
  }, [checkAuth]);

  useEffect(() => {
    fetch("/api/public/directory/counts")
      .then((r) => r.json())
      .then((data) => {
        if (data?.photographers !== undefined && data?.labs !== undefined) {
          setDirectoryCounts({
            photographers: data.photographers,
            labs: data.labs,
            photographerServices: data.photographerServices ?? 0,
            eventVendors: data.eventVendors ?? 0,
            organizers: data.organizers ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Revalidar sesión al recuperar foco (p. ej. usuario inició sesión en otra pestaña)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !loading) {
        checkAuth();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [checkAuth, loading]);

  async function handleLogout() {
    setLoggingOut(true);
    // Breve transición con logo antes de cerrar sesión
    await new Promise((r) => setTimeout(r, 1200));
    try {
      sessionStorage.removeItem("photographer");
      sessionStorage.removeItem("photographerId");
      sessionStorage.removeItem("client");
      sessionStorage.removeItem("clientId");
      sessionStorage.removeItem("labId");
      sessionStorage.removeItem("lab");
      sessionStorage.removeItem("organizer");
      sessionStorage.removeItem("organizerId");
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      setUser(null);
      router.push("/login?logout=success");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
      router.push("/login?logout=success");
    } finally {
      setLoggingOut(false);
    }
  }

  function handleLoginClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.shiftKey) {
      e.preventDefault();
      router.push("/admin/login");
    }
  }

  function handleLoginTouchStart() {
    longPressTimerRef.current = setTimeout(() => {
      router.push("/admin/login");
    }, 3000);
  }

  function handleLoginTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleLoginTouchMove() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const roleLabel = user ? ROLE_LABELS[user.type] ?? "Sesión" : null;

  return (
    <>
      {loggingOut && (
        <SessionTransitionOverlay message="Cerrando sesión..." variant="logout" />
      )}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Image
                  src="/watermark.png"
                  alt="ComprameLaFoto"
                  width={66}
                  height={66}
                  className="h-[2.75rem] w-[2.75rem] rounded-full ring-1 ring-black/10"
                  priority
                />
                <div className="ml-3 hidden md:block">
                  <p className="text-xs uppercase tracking-widest text-black/40">
                    ComprameLaFoto
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {/* Menú Comunidad CLF */}
              {(directoryCounts === null ||
                directoryCounts.photographers > 0 ||
                directoryCounts.labs > 0 ||
                directoryCounts.photographerServices > 0 ||
                directoryCounts.eventVendors > 0 ||
                directoryCounts.organizers > 0) ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-black/5 text-black/70 hover:text-black transition-colors text-sm font-medium"
                  >
                    Comunidad CLF
                    <svg
                      className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 min-w-[220px] bg-white rounded-xl border border-black/10 shadow-lg z-50">
                      <Link
                        href="/directorio/fotografos"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#f7f5f2] transition-colors ${
                          (directoryCounts?.photographers ?? 0) > 0 ? "text-[#1a1a1a]" : "text-[#6b7280]"
                        }`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{"\u{1F4F7}"}</span>
                        <span className="flex flex-col">
                          <span className="font-medium text-sm">Fotógrafos</span>
                          {directoryCounts !== null && (
                            <span className="text-xs text-[#6b7280]">
                              {directoryCounts.photographers} {directoryCounts.photographers === 1 ? "perfil" : "perfiles"}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link
                        href="/directorio/laboratorios"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#f7f5f2] transition-colors border-t border-black/5 ${
                          (directoryCounts?.labs ?? 0) > 0 ? "text-[#1a1a1a]" : "text-[#6b7280]"
                        }`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{"\u{1F5A8}\uFE0F"}</span>
                        <span className="flex flex-col">
                          <span className="font-medium text-sm">Laboratorios</span>
                          {directoryCounts !== null && (
                            <span className="text-xs text-[#6b7280]">
                              {directoryCounts.labs} {directoryCounts.labs === 1 ? "perfil" : "perfiles"}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link
                        href="/directorio/servicios-para-fotografos"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#f7f5f2] transition-colors border-t border-black/5 ${
                          (directoryCounts?.photographerServices ?? 0) > 0 ? "text-[#1a1a1a]" : "text-[#6b7280]"
                        }`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{"\u{2728}"}</span>
                        <span className="flex flex-col">
                          <span className="font-medium text-sm">Servicios para Fotógrafos</span>
                          {directoryCounts !== null && (
                            <span className="text-xs text-[#6b7280]">
                              {directoryCounts.photographerServices} {directoryCounts.photographerServices === 1 ? "perfil" : "perfiles"}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link
                        href="/directorio/servicios-de-eventos"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#f7f5f2] transition-colors border-t border-black/5 ${
                          (directoryCounts?.eventVendors ?? 0) > 0 ? "text-[#1a1a1a]" : "text-[#6b7280]"
                        }`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{"\u{1F389}"}</span>
                        <span className="flex flex-col">
                          <span className="font-medium text-sm">Servicios de Eventos</span>
                          {directoryCounts !== null && (
                            <span className="text-xs text-[#6b7280]">
                              {directoryCounts.eventVendors} {directoryCounts.eventVendors === 1 ? "perfil" : "perfiles"}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link
                        href="/directorio/organizadores"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#f7f5f2] transition-colors border-t border-black/5 ${
                          (directoryCounts?.organizers ?? 0) > 0 ? "text-[#1a1a1a]" : "text-[#6b7280]"
                        }`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{"\u{1F3DB}\uFE0F"}</span>
                        <span className="flex flex-col">
                          <span className="font-medium text-sm">Organizadores</span>
                          {directoryCounts !== null && (
                            <span className="text-xs text-[#6b7280]">
                              {directoryCounts.organizers}{" "}
                              {directoryCounts.organizers === 1 ? "perfil" : "perfiles"}
                            </span>
                          )}
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-black/40">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
                  Verificando sesión...
                </div>
              ) : user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link href="/blog">
                    <Button
                      variant="secondary"
                      className="text-xs px-3 py-1.5 border-black/10 text-black/70 hover:text-black"
                    >
                      Blog
                    </Button>
                  </Link>
                  <Link href="/tutoriales">
                    <Button
                      variant="secondary"
                      className="text-xs px-3 py-1.5 border-black/10 text-black/70 hover:text-black"
                    >
                      Tutoriales
                    </Button>
                  </Link>
                  {/* Indicador claro de sesión activa y rol */}
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">
                      Sesión activa
                    </span>
                    <span className="text-sm font-medium text-black/80">
                      {user.name}
                    </span>
                    {roleLabel && (
                      <span className="text-xs text-black/50">{roleLabel}</span>
                    )}
                  </div>
                  <div className="flex sm:hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-800">
                      {roleLabel}
                    </span>
                  </div>
                  {user.type === "photographer" && (
                    <Link
                      href="/fotografo/dashboard"
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                      title="Inicio"
                    >
                      <svg
                        className="w-5 h-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Inicio
                      </span>
                    </Link>
                  )}
                  {user.type === "client" && (
                    <Link
                      href="/cliente/pedidos"
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                      title="Mis Pedidos"
                    >
                      <svg
                        className="w-5 h-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Mis Pedidos
                      </span>
                    </Link>
                  )}
                  {user.type === "lab" && (
                    <Link
                      href="/lab/dashboard"
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                      title="Panel Laboratorio"
                    >
                      <svg
                        className="w-5 h-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Panel Laboratorio
                      </span>
                    </Link>
                  )}
                  {user.type === "admin" && (
                    <Link
                      href="/admin"
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                      title="Admin"
                    >
                      <svg
                        className="w-5 h-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Admin
                      </span>
                    </Link>
                  )}
                  <Link
                    href="/cuenta/cambiar-contrasena"
                    className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                    title="Cambiar contraseña"
                  >
                    <svg
                      className="w-5 h-5 text-black/70"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                      Cambiar contraseña
                    </span>
                  </Link>
                  {user.type === "organizer" && (
                    <Link
                      href="/organizador/dashboard"
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors group relative"
                      title="Panel Organizador"
                    >
                      <svg
                        className="w-5 h-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Panel Organizador
                      </span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors group relative text-black/70 hover:text-red-600 disabled:opacity-50"
                    title="Cerrar sesión"
                  >
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
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                      Cerrar sesión
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  <Link href="/blog">
                    <Button
                      variant="secondary"
                      className="text-xs px-3 py-1.5 border-black/10 text-black/70 hover:text-black"
                    >
                      Blog
                    </Button>
                  </Link>
                  <Link href="/tutoriales">
                    <Button
                      variant="secondary"
                      className="text-xs px-3 py-1.5 border-black/10 text-black/70 hover:text-black"
                    >
                      Tutoriales
                    </Button>
                  </Link>
                  <Link
                    href="/login"
                    onClick={handleLoginClick}
                    onTouchStart={handleLoginTouchStart}
                    onTouchEnd={handleLoginTouchEnd}
                    onTouchMove={handleLoginTouchMove}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-sm border-black/10 text-black/70 hover:text-black"
                    >
                      Iniciar sesión
                    </Button>
                  </Link>
                  <Link href="/registro">
                    <Button variant="primary" size="sm" className="text-sm">
                      Registrate
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
