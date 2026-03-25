"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ruta legacy: "Mi negocio" fue eliminado del menú.
 * Pedidos, Clientes, Álbumes y Solicitudes de baja tienen pantallas propias.
 * Redirigir a Pedidos como destino por defecto.
 */
export default function FotografoNegocioRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fotografo/pedidos");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Redirigiendo...</p>
    </div>
  );
}
