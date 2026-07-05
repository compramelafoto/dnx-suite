"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy: `/dashboard/remociones` → workspace unificado en `/fotografo/remociones`. */
export default function DashboardRemocionesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fotografo/remociones");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Redirigiendo...</p>
    </div>
  );
}
