"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Gestión de Negocio: redirige al dashboard.
 * Las solapas (Pedidos, Clientes, Interesados, Álbumes, Productos) fueron eliminadas.
 * Cada sección tiene su propia página en el menú lateral.
 */
export default function LabNegocioPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lab/dashboard");
  }, [router]);
  return (
    <div className="p-8">
      <p className="text-[#6b7280]">Redirigiendo al panel...</p>
    </div>
  );
}
