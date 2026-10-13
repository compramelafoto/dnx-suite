"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import PanelLayout from "./PanelLayout";
import ClientSidebar, { ClientSidebarTopBar } from "./ClientSidebar";
import { esRutaClienteConBot } from "@/lib/bot/comprador/pagina";

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

export default function ClienteLayoutClient({ children, bot }: { children: React.ReactNode; bot?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Suspense fallback={fallback}>
      <PanelLayout topBar2={<ClientSidebarTopBar />} sidebar={<ClientSidebar showHeader={false} />}>
        {children}
      </PanelLayout>
      {bot && esRutaClienteConBot(pathname ?? "") ? bot : null}
    </Suspense>
  );
}
