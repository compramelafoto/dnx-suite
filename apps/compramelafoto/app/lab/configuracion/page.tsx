"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /lab/configuracion redirige a /lab/configuracion/datos.
 * Cada sección (datos, diseño, mercadopago, etc.) es ahora una página propia.
 */
export default function LabConfigPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lab/configuracion/datos");
  }, [router]);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-[#6b7280]">Redirigiendo...</p>
    </div>
  );
}
