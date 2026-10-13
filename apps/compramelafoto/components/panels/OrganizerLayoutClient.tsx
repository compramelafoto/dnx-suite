"use client";

import { Suspense } from "react";
import PanelLayout from "./PanelLayout";
import { DnxBotBubble } from "@repo/dnx-bot/ui";
import { RUTAS_PERMITIDAS_BOT } from "@/lib/bot/rutas-panel";
import OrganizerSidebar, { OrganizerSidebarTopBar } from "./OrganizerSidebar";

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

export default function OrganizerLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <PanelLayout topBar2={<OrganizerSidebarTopBar />} sidebar={<OrganizerSidebar showHeader={false} />}>
        {children}
      </PanelLayout>
      <DnxBotBubble basePath="/api/bot" mascotSrc="/dnx-bot/mascota.webp" mascotSpriteSrc="/dnx-bot/mascota-foto.webp" rutasPermitidas={RUTAS_PERMITIDAS_BOT} />
    </Suspense>
  );
}
