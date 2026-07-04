"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import LandHeader from "@/components/land/LandHeader";
import { isPhotographerPath } from "@/lib/photographer-slugs";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  
  // Si estamos en una ruta del fotógrafo, laboratorio público (/l/[handler]), 
  // rutas de álbum (/a/[id]), rutas del laboratorio (/lab/*), panel del fotógrafo (/fotografo/*),
  // o panel dashboard (/dashboard/*), NO renderizar Header/Footer (esas páginas usan su propio layout).
  // La barra blanca (Header) es solo para el Home y páginas públicas.
  const isPhotographerRoute = isPhotographerPath(pathname);
  const isLabPublicRoute = pathname?.startsWith("/l/");
  const isAlbumRoute = pathname?.startsWith("/a/");
  const isLabRoute = pathname?.startsWith("/lab/");
  const isFotografoPanelRoute = pathname?.startsWith("/fotografo/");
  const isDashboardPanelRoute = pathname?.startsWith("/dashboard/");
  const isOrganizadorPanelRoute = pathname?.startsWith("/organizador/");
  const isAdminRoute = pathname?.startsWith("/admin/");
  /** Showroom DS (misma lógica que FotoRank /design-system-test): pantalla completa sin Header/Footer del sitio. */
  const isDesignSystemShowroom = pathname?.startsWith("/design-system-test");

  useEffect(() => {
    let active = true;
    async function fetchConfig() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setMaintenanceMode(Boolean(data?.maintenanceMode));
        }
      } catch (err) {
        console.error("Error cargando config general:", err);
      }
    }
    fetchConfig();
    return () => {
      active = false;
    };
  }, []);

  if (
    isPhotographerRoute ||
    isLabPublicRoute ||
    isAlbumRoute ||
    isLabRoute ||
    isFotografoPanelRoute ||
    isDashboardPanelRoute ||
    isOrganizadorPanelRoute ||
    isDesignSystemShowroom
  ) {
    return <>{children}</>;
  }

  const isLandPage = pathname?.startsWith("/land");

  if (maintenanceMode && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 text-center">
        <div className="w-full max-w-2xl min-w-[min(100%,320px)] space-y-6">
          <img src="/watermark.png" alt="ComprameLaFoto" className="w-40 h-40 mx-auto opacity-80" />
          <h1 className="text-3xl font-semibold text-[#1a1a1a]">Estamos realizando mejoras</h1>
          <p className="text-lg text-[#4b5563]">
            El sitio está momentáneamente en reparación. Volvé en unos minutos o contactá al
            organizador si necesitás asistencia urgente.
          </p>
          <p className="text-sm text-[#9ca3af]">
            Gracias por tu paciencia. Si sos fotógrafo podés continuar con el panel de admin para seguir configurando tus álbumes.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col w-full min-w-0">
      {isLandPage ? <LandHeader /> : <Header />}
      <main className="flex-1 w-full min-w-0">{children}</main>
      {!isLandPage && <Footer />}
    </div>
  );
}
