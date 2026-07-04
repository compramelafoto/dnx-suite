"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePanelHeaderRight } from "@/components/panels/PanelHeaderRightContext";

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

/** Iconografía estilo FotoRank (botón circular ~44px) con paleta ComprameLaFoto. */
const iconClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-[#c27b3d] transition-colors hover:bg-[#c27b3d]/10 hover:text-[#a86a33] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40";
const tooltipClass = "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity";

export default function PhotographerDashboardHeader({ photographer }: { photographer: Photographer | null }) {
  const setHeaderRight = usePanelHeaderRight()?.setHeaderRight;
  const [isPublicPageEnabled, setIsPublicPageEnabled] = useState(false);
  const [publicPageHandler, setPublicPageHandler] = useState<string | null>(null);
  const [status, setStatus] = useState<{ preferredLabId?: number | null; mpConnected?: boolean } | null>(null);

  useEffect(() => {
    if (photographer?.id) {
      fetch(`/api/fotografo/${photographer.id}`)
        .then((res) => res.json())
        .then((data) => {
          setIsPublicPageEnabled(data.isPublicPageEnabled || false);
          setPublicPageHandler(data.publicPageHandler || null);
        })
        .catch(() => {});
    }
  }, [photographer]);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      try {
        const res = await fetch("/api/dashboard/photographer", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        setStatus({
          preferredLabId: data?.preferredLabId ?? null,
          mpConnected: Boolean(data?.mpConnected),
        });
      } catch {}
    }
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem("photographer");
    sessionStorage.removeItem("photographerId");
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    window.location.assign("/login?logout=success");
  }, []);

  // Inyectar iconos en la barra gris del layout (misma barra que hamburger + Menú)
  useEffect(() => {
    if (!setHeaderRight) return;
    setHeaderRight(
      <>
        {/* Desktop: ojito (ver landing), Configuración y Cerrar sesión */}
        <nav className="hidden md:flex items-center gap-3">
          {isPublicPageEnabled && publicPageHandler && (
            <a href={`/f/${publicPageHandler}`} target="_blank" rel="noopener noreferrer" className={`${iconClass} group relative`} title="Ver mi página pública">
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className={tooltipClass}>Ver mi página</span>
            </a>
          )}
          <Link href="/fotografo/configuracion?tab=datos" className={`${iconClass} group relative`} title="Configuración">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={tooltipClass}>Configuración</span>
          </Link>
          <button type="button" onClick={handleLogout} className={`${iconClass} group relative`} title="Cerrar sesión">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={tooltipClass}>Cerrar sesión</span>
          </button>
        </nav>
        {/* Móvil: ojito (si tiene página) y Cerrar sesión */}
        <nav className="flex md:hidden items-center gap-3">
          {isPublicPageEnabled && publicPageHandler && (
            <a href={`/f/${publicPageHandler}`} target="_blank" rel="noopener noreferrer" className={iconClass} title="Ver mi página pública" aria-label="Ver mi página pública">
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </a>
          )}
          <button type="button" onClick={handleLogout} className={iconClass} title="Cerrar sesión" aria-label="Cerrar sesión">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </nav>
      </>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isPublicPageEnabled, publicPageHandler, handleLogout]);

  return null;
}
