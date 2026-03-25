"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { PanelHeaderRightContext } from "./PanelHeaderRightContext";

const STORAGE_KEY = "panel-sidebar-open";

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Segunda barra superior (logo + título), de punta a punta. Si se pasa, el sidebar no muestra logo/título. */
  topBar2?: React.ReactNode;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isMobile;
}

export default function PanelLayout({ sidebar, children, topBar2 }: Props) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerRight, setHeaderRight] = useState<React.ReactNode>(null);

  // Desktop: por defecto abierto; leer preferencia guardada. Móvil: cerrado por defecto
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setSidebarOpen(stored !== null ? JSON.parse(stored) : true);
      } catch {
        setSidebarOpen(true);
      }
    }
  }, []);

  // Persistir preferencia en desktop
  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sidebarOpen));
    } catch {}
  }, [sidebarOpen, isMobile]);

  // Al navegar: en móvil cerrar el menú para ver el contenido; en desktop dejarlo abierto
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [pathname, isMobile]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <PanelHeaderRightContext.Provider value={{ setHeaderRight }}>
    <div className="min-h-screen bg-gray-50 flex flex-col w-full">
      {/* Las dos barras juntas arriba (de punta a punta); debajo arranca el menú */}
      <div className="sticky top-0 z-50 flex-shrink-0 w-full min-w-full flex flex-col">
        {/* Barra 1: gris — hamburger + Menú a la izquierda; iconos (inyectados por contexto) a la derecha */}
        <header className="w-full h-12 md:h-14 bg-gray-800 border-b border-gray-600 flex items-center justify-between px-3 md:px-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center justify-center w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg text-gray-300 hover:bg-white/10 hover:text-white active:bg-white/15 transition-colors flex-shrink-0 touch-manipulation"
              aria-label="Menú"
            >
              {sidebarOpen ? (
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
          {headerRight != null && (
            <div className="flex items-center gap-1 flex-shrink-0 text-gray-300">
              {headerRight}
            </div>
          )}
        </header>
        {/* Barra 2: logo + título (pegada a la barra 1) */}
        {topBar2 && (
          <div className="w-full bg-white border-b border-gray-200 px-4 py-3">
            {topBar2}
          </div>
        )}
      </div>

      {/* Debajo de las dos barras arranca el menú lateral y el contenido */}
      <div className="flex-1 flex min-h-0 overflow-hidden w-full">
        {isMobile && sidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeSidebar}
            className="fixed inset-0 z-[35] bg-black/50 md:hidden touch-manipulation"
          />
        )}

        {/* Sidebar (logo + menú): se oculta/muestra con animación al usar el botón Menú */}
        <aside
          className={`
            flex flex-col bg-white border-r border-gray-200 flex-shrink-0
            w-[280px] max-w-[85vw] md:w-[240px]
            h-full
            transition-[transform,width,opacity] duration-300 ease-in-out
            ${isMobile
              ? `fixed left-0 z-40 bottom-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : `md:!translate-x-0 ${sidebarOpen ? "md:w-[240px] md:opacity-100" : "md:w-0 md:min-w-0 md:overflow-hidden md:border-r-0 md:opacity-0"}`
            }
          `}
          style={isMobile ? { top: "7rem" } : undefined}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex-1 flex flex-col min-h-0 w-[280px] max-w-[85vw] md:w-[240px]">
            {sidebar}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
    </PanelHeaderRightContext.Provider>
  );
}
