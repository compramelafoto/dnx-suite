"use client";

import { Suspense } from "react";
import PanelLayout from "./PanelLayout";
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
    </Suspense>
  );
}
