"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Card from "@/components/ui/Card";
import { isGlobalProductsCatalogPhase1EnabledClient } from "@/lib/catalog-products/feature-flag";

export default function CatalogProductsGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(
    isGlobalProductsCatalogPhase1EnabledClient() ? true : null
  );

  useEffect(() => {
    if (isGlobalProductsCatalogPhase1EnabledClient()) {
      setEnabled(true);
      return;
    }
    let cancelled = false;
    fetch("/api/dashboard/catalog-products-phase1-enabled", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled === null) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 bg-white min-h-screen">
          <div className="container-custom">
            <p className="text-[#6b7280]">Cargando productos…</p>
          </div>
        </section>
      </>
    );
  }

  if (!enabled) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 bg-white min-h-screen w-full min-w-0">
          <div className="container-custom ds-page-shell">
            <Card className="max-w-lg p-6">
              <p className="text-[#1a1a1a] font-medium m-0">Mis Packs y Combos no disponible</p>
              <p className="text-sm text-[#6b7280] mt-2 m-0">
                Esta función está en activación gradual. Volvé a intentar más tarde o contactá
                soporte si creés que deberías tener acceso.
              </p>
              <Link href="/dashboard/sales-settings" className="inline-block mt-4 text-sm text-[#c27b3d] hover:underline">
                Ir a Ventas → Configuración de ventas
              </Link>
            </Card>
          </div>
        </section>
      </>
    );
  }

  return <>{children}</>;
}
