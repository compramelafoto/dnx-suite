"use client";

import { Suspense } from "react";
import PanelLayout from "./PanelLayout";
import ClientSidebar, { ClientSidebarTopBar } from "./ClientSidebar";

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

export default function ClienteLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <PanelLayout topBar2={<ClientSidebarTopBar />} sidebar={<ClientSidebar showHeader={false} />}>
        {children}
      </PanelLayout>
    </Suspense>
  );
}
