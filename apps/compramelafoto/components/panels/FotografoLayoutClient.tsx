"use client";

import { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import PanelLayout from "./PanelLayout";
import PhotographerSidebar, { PhotographerSidebarTopBar } from "./PhotographerSidebar";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { DnxBotBubble } from "@repo/dnx-bot/ui";
import { RUTAS_PERMITIDAS_BOT } from "@/lib/bot/rutas-panel";
import { UploadProgressProvider, useUploadProgress } from "@/contexts/UploadProgressContext";
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

/** La burbuja sube por encima de la barra de subida sólo mientras hay una subida en curso. */
function BotBubbleMount() {
  const upload = useUploadProgress();
  const uploading = Boolean(upload?.state.uploading && upload.state.total > 0);
  return <DnxBotBubble basePath="/api/bot" mascotSrc="/dnx-bot/mascota.webp" mascotSpriteSrc="/dnx-bot/mascota-foto.webp" bottomOffsetPx={uploading ? 96 : 24} rutasPermitidas={RUTAS_PERMITIDAS_BOT} />;
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
      <BotBubbleMount />
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
