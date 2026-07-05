"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePanelHeaderRight } from "@/components/panels/PanelHeaderRightContext";

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

const iconClass = "p-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-gray-300";
const tooltipClass = "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity";

export default function PhotographerDashboardHeader({ photographer }: { photographer: Photographer | null }) {
  const router = useRouter();
  const setHeaderRight = usePanelHeaderRight()?.setHeaderRight;
  const [isPublicPageEnabled, setIsPublicPageEnabled] = useState(false);
  const [publicPageHandler, setPublicPageHandler] = useState<string | null>(null);

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

  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem("photographer");
    sessionStorage.removeItem("photographerId");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    router.push("/login?logout=success");
  }, [router]);

  // Inyectar iconos en la barra gris del layout (misma barra que hamburger + Menú)
  useEffect(() => {
    if (!setHeaderRight) return;
    setHeaderRight(
      <>
        <nav className="hidden md:flex items-center gap-1">
          {isPublicPageEnabled && publicPageHandler && (
            <a href={`/f/${publicPageHandler}`} target="_blank" rel="noopener noreferrer" className={`${iconClass} group relative`} title="Ver mi página pública">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className={tooltipClass}>Ver mi página</span>
            </a>
          )}
          <button type="button" onClick={handleLogout} className={`${iconClass} group relative`} title="Cerrar sesión">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={tooltipClass}>Cerrar sesión</span>
          </button>
        </nav>
        {/* Móvil: ojito (si tiene página) y Cerrar sesión */}
        <nav className="flex md:hidden items-center gap-1">
          {isPublicPageEnabled && publicPageHandler && (
            <a href={`/f/${publicPageHandler}`} target="_blank" rel="noopener noreferrer" className={iconClass} title="Ver mi página pública" aria-label="Ver mi página pública">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </a>
          )}
          <button type="button" onClick={handleLogout} className={iconClass} title="Cerrar sesión" aria-label="Cerrar sesión">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
