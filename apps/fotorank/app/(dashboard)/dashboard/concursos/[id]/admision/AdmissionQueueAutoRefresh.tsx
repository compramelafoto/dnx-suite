"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresco periódico de la cola (sin acción manual). */
export function AdmissionQueueAutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
