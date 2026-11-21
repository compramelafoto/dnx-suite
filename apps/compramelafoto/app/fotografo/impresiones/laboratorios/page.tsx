"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="max-w-5xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-5">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-1.5">Mis laboratorios</h1>
        </header>
        {listo ? <MisLaboratorios /> : <p className="text-gray-600">Cargando...</p>}
      </div>
    </div>
  );
}
