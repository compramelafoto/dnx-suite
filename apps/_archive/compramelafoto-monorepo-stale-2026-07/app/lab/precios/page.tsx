"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Precios LAB: redirige a Configuración → Descuentos.
 * El ítem "Precios" fue eliminado del menú principal y pasó a Configuración → Descuentos.
 */
export default function LabPreciosPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lab/configuracion?tab=descuentos");
  }, [router]);
  return (
    <div className="p-8">
      <p className="text-[#6b7280]">Redirigiendo a Descuentos...</p>
    </div>
  );
}
