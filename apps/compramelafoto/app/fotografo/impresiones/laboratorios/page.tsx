"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import MisLaboratorios from "@/components/fotografo/impresiones/MisLaboratorios";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function MisLaboratoriosPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const session = await ensurePhotographerSession();
      if (!activo) return;
      if (!session) {
        router.push(`/fotografo/login?redirect=${encodeURIComponent(window.location.pathname)}`);
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
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Mis laboratorios</h1>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Link href="/fotografo/impresiones" className="text-[#c27b3d] hover:underline text-sm">
                ← Volver a Impresiones
              </Link>
            </div>
          </div>
          {listo ? <MisLaboratorios /> : <p className="text-gray-600">Cargando...</p>}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
