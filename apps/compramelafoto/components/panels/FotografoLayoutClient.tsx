"use client";

import { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import PanelLayout from "./PanelLayout";
import PhotographerSidebar, { PhotographerSidebarTopBar } from "./PhotographerSidebar";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { UploadProgressProvider } from "@/contexts/UploadProgressContext";
import FloatingUploadBar from "@/components/photo/FloatingUploadBar";
import PhotographerWorkLocationPromptGate from "@/components/photographer/PhotographerWorkLocationPromptGate";

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

/** Editor de plantilla V2: una versión concreta (sin listado). */
function isTemplateV2EditorPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/fotografo\/diseno\/plantillas\/v2\/[^/]+\/[^/]+\/?$/.test(pathname);
}

function FotografoLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const templateV2EditorFullscreen = isTemplateV2EditorPath(pathname);
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
        hideShell={templateV2EditorFullscreen}
        topBar2={
          templateV2EditorFullscreen ? undefined : (
            <PhotographerSidebarTopBar logoUrl={logoUrl} logoFetched={logoFetched} />
          )
        }
        sidebar={templateV2EditorFullscreen ? null : <PhotographerSidebar showHeader={false} />}
      >
        {children}
      </PanelLayout>
      <FloatingUploadBar />
      <PhotographerWorkLocationPromptGate variant="clf" />
    </UploadProgressProvider>
  );
}

export default function FotografoLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <FotografoLayoutInner>{children}</FotografoLayoutInner>
    </Suspense>
  );
}
