"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Catálogo LAB: redirige a Productos.
 * "Catálogo" fue eliminado del menú; los productos se gestionan en Productos.
 */
export default function LabCatalogoRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lab/productos");
  }, [router]);
  return (
    <div className="p-8">
      <p className="text-[#6b7280]">Redirigiendo a Productos...</p>
    </div>
  );
}
