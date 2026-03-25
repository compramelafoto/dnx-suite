"use client";

import { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import PanelLayout from "./PanelLayout";
import PhotographerSidebar, { PhotographerSidebarTopBar } from "./PhotographerSidebar";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { UploadProgressProvider } from "@/contexts/UploadProgressContext";
import FloatingUploadBar from "@/components/photo/FloatingUploadBar";

/** Rutas públicas bajo /fotografo/* sin panel lateral (login, registro). */
const FOTOGRAFO_AUTH_ONLY = new Set(["/fotografo/login", "/fotografo/registro"]);

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

function FotografoPanelWithSidebar({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFetched, setLogoFetched] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = await ensurePhotographerSession();
      if (!active || !session?.photographerId) {
        if (active) setLogoFetched(true);
        return;
      }
      try {
        const res = await fetch(`/api/fotografo/${session.photographerId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setLogoUrl(data?.logoUrl ?? null);
            setLogoFetched(true);
          }
        } else {
          if (active) setLogoFetched(true);
        }
      } catch {
        if (active) setLogoFetched(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <UploadProgressProvider>
      <PanelLayout
        topBar2={<PhotographerSidebarTopBar logoUrl={logoUrl} logoFetched={logoFetched} />}
        sidebar={<PhotographerSidebar showHeader={false} />}
      >
        {children}
      </PanelLayout>
      <FloatingUploadBar />
    </UploadProgressProvider>
  );
}

function FotografoLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && FOTOGRAFO_AUTH_ONLY.has(pathname)) {
    return <>{children}</>;
  }
  return <FotografoPanelWithSidebar>{children}</FotografoPanelWithSidebar>;
}

export default function FotografoLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <FotografoLayoutInner>{children}</FotografoLayoutInner>
    </Suspense>
  );
}
