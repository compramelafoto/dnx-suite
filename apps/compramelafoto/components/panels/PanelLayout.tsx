"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { PanelHeaderRightContext } from "./PanelHeaderRightContext";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "panel-sidebar-open";

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Segunda barra superior (logo + título), de punta a punta. Si se pasa, el sidebar no muestra logo/título. */
  topBar2?: React.ReactNode;
  /**
   * Sin cabeceras ni menú lateral: el contenido ocupa todo el viewport (p. ej. editor de plantillas V2).
   * Mantiene el contexto de cabecera por si algún hijo lo usa.
   */
  hideShell?: boolean;
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

function PanelLayoutFullscreen({ children }: { children: React.ReactNode }) {
  const [, setHeaderRight] = useState<React.ReactNode>(null);
  return (
    <PanelHeaderRightContext.Provider value={{ setHeaderRight }}>
      <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-gray-50">
        <main className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden items-stretch [&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-full">
          {children}
        </main>
      </div>
    </PanelHeaderRightContext.Provider>
  );
}

export default function PanelLayout({ sidebar, children, topBar2, hideShell }: Props) {
  if (hideShell) {
    return <PanelLayoutFullscreen>{children}</PanelLayoutFullscreen>;
  }

  const pathname = usePathname();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerRight, setHeaderRight] = useState<React.ReactNode>(null);
  const headerStackRef = useRef<HTMLDivElement>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);

  useEffect(() => {
    const el = headerStackRef.current;
    if (!el) return;
    const measure = () => setHeaderHeightPx(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topBar2]);

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

  // Bloquear scroll del body cuando el drawer está abierto en móvil
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const mobileDrawerTop = headerHeightPx > 0 ? headerHeightPx : 112;

  return (
    <PanelHeaderRightContext.Provider value={{ setHeaderRight }}>
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col w-full">
        {/* Cabecera fija: altura medida para posicionar el drawer en móvil */}
        <div ref={headerStackRef} className="sticky top-0 z-[60] flex-shrink-0 w-full min-w-full flex flex-col">
          <header className="w-full h-12 md:h-14 bg-gray-800 border-b border-gray-600 flex items-center justify-between px-3 md:px-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex items-center justify-center w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg text-gray-300 hover:bg-white/10 hover:text-white active:bg-white/15 transition-colors flex-shrink-0 touch-manipulation"
                aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={sidebarOpen}
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
              <span className="text-sm font-medium text-gray-200 md:hidden">Menú</span>
            </div>
            {headerRight != null && (
              <div className="flex items-center gap-1 flex-shrink-0 text-gray-300">{headerRight}</div>
            )}
          </header>
          {topBar2 && (
            <div className="w-full bg-white border-b border-gray-200 px-4 py-3">{topBar2}</div>
          )}
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden w-full relative">
          {isMobile && (
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={closeSidebar}
              className={cn(
                "fixed inset-x-0 bottom-0 z-[45] bg-black/50 md:hidden touch-manipulation transition-opacity duration-300",
                sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}
              style={{ top: mobileDrawerTop }}
            />
          )}

          <aside
            className={cn(
              "flex flex-col bg-white border-r border-gray-200 flex-shrink-0 transition-[transform,width,opacity] duration-300 ease-out",
              isMobile &&
                "fixed left-0 z-[50] w-[min(18rem,88vw)] max-w-[92vw] shadow-xl",
              isMobile && (sidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"),
              !isMobile && "md:!translate-x-0 md:relative md:h-auto",
              !isMobile &&
                (sidebarOpen
                  ? "md:w-[280px] md:opacity-100"
                  : "md:w-0 md:min-w-0 md:overflow-hidden md:border-r-0 md:opacity-0 md:pointer-events-none")
            )}
            style={
              isMobile
                ? {
                    top: mobileDrawerTop,
                    height: `calc(100dvh - ${mobileDrawerTop}px)`,
                  }
                : undefined
            }
            aria-hidden={isMobile ? !sidebarOpen : !sidebarOpen}
            inert={isMobile && !sidebarOpen ? true : undefined}
          >
            {isMobile && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">Navegación</span>
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                  aria-label="Cerrar menú"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                isMobile ? "w-full" : "w-[280px]"
              )}
            >
              {sidebar}
            </div>
          </aside>

          <main className="flex flex-1 min-h-0 min-w-0 w-full max-w-full flex-col items-stretch overflow-auto [&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-full">
            {children}
          </main>
        </div>
      </div>
    </PanelHeaderRightContext.Provider>
  );
}
