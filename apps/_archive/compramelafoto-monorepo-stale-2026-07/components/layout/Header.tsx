"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { PublicMarketingHeader } from "@repo/design-system/components/layout";
import { appShellHeader } from "@repo/design-system/tokens";
import SessionTransitionOverlay from "./SessionTransitionOverlay";
import ComprameLaFotoFullscreenMenu from "./ComprameLaFotoFullscreenMenu";

type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
} | null;

type UserInfo = {
  type: string;
  name: string;
  id: number;
  role?: string;
};

const shell = appShellHeader.comprameLaFotoPublic;

/** Misma lógica que FotoRank `appShellHeader` + iconos circulares terracota. */
const sessionIconBtnClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-[#c27b3d] transition-colors hover:bg-[#c27b3d]/10 hover:text-[#a86a33] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40";

function getPanelHref(user: UserInfo | null): string | null {
  if (!user) return null;
  switch (user.type) {
    case "photographer":
      return "/fotografo/configuracion";
    case "client":
      return "/cliente/pedidos";
    case "lab":
      return "/lab/dashboard";
    case "admin":
      return "/admin";
    case "organizer":
      return "/organizador/dashboard";
    default:
      return "/dashboard";
  }
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [directoryCounts, setDirectoryCounts] = useState<DirectoryCounts>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authAbortRef = useRef<AbortController | null>(null);

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
      const isTimeout = error instanceof Error && error.name === "AbortError";
      if (isTimeout) {
        console.warn("Verificación de sesión: tiempo agotado");
      } else {
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
          });
        }
      })
      .catch(() => {});
  }, []);

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
      window.location.assign("/login?logout=success");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
      window.location.assign("/login?logout=success");
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

  const panelHref = getPanelHref(user);

  const logoStyle: React.CSSProperties = {
    display: "block",
    height: shell.logoMaxHeight,
    width: "auto",
    maxWidth: shell.logoMaxWidth,
    objectFit: "contain",
    objectPosition: "left center",
  };

  return (
    <>
      {loggingOut && (
        <SessionTransitionOverlay message="Cerrando sesión..." variant="logout" />
      )}
      <PublicMarketingHeader
        LinkComponent={Link}
        variant="comprameLaFotoLight"
        position="sticky"
        logo={
          <Link href="/" className="flex min-w-0 items-center justify-start" aria-label="ComprameLaFoto">
            <Image
              src="/LOGO CLF.png"
              alt="ComprameLaFoto"
              width={1024}
              height={220}
              style={logoStyle}
              priority
            />
          </Link>
        }
        showDashboardLink={Boolean(user && panelHref)}
        dashboardHref={panelHref ?? "/"}
        dashboardAriaLabel="Ir al panel"
        sessionControl={
          loading ? (
            <div className="flex size-11 items-center justify-center" aria-hidden>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#c27b3d]/25 border-t-[#c27b3d]" />
            </div>
          ) : user ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={`${sessionIconBtnClass} disabled:opacity-50`}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="size-6" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <Link
              href="/login"
              onClick={handleLoginClick}
              onTouchStart={handleLoginTouchStart}
              onTouchEnd={handleLoginTouchEnd}
              onTouchMove={handleLoginTouchMove}
              className={sessionIconBtnClass}
              aria-label="Iniciar sesión"
              title="Iniciar sesión (Mayús+clic: acceso admin)"
            >
              <LogIn className="size-6" strokeWidth={2} aria-hidden />
            </Link>
          )
        }
        onMenuOpen={() => setMenuOpen(true)}
        menuAriaLabel="Abrir menú"
      />

      <ComprameLaFotoFullscreenMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        directoryCounts={directoryCounts}
        user={user}
        loading={loading}
      />
    </>
  );
}
