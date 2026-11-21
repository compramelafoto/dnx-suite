"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PanelImpresiones from "@/components/fotografo/impresiones/PanelImpresiones";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function ImpresionesPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const session = await ensurePhotographerSession();
      if (!activo) return;
      if (!session) {
        router.push(`/fotografo/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      setListo(true);
    })();
    return () => {
      activo = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={null} />
      <DsPageShell className="py-8">
        <DsDashboardInner className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Impresiones</h1>
              <p className="ds-readable-text ds-readable-text--fluid text-gray-600">
                Las copias de tus pedidos, desde que el cliente paga hasta que las recibe. Tocá un paso para ver sus
                pedidos y lo que tenés que hacer.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Link
                href="/fotografo/impresiones/laboratorios"
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f2937] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
              >
                Mis laboratorios
              </Link>
              <Link href="/fotografo/escuelas/pedidos" className="text-[#c27b3d] hover:underline text-sm">
                Pedidos escolares →
              </Link>
            </div>
          </div>
          {listo ? <PanelImpresiones /> : <p className="text-gray-600">Cargando...</p>}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
