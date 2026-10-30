"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Mientras el programa trabaja, la página se actualiza sola (sólo con la pestaña a la vista). */
export function RefrescoAutomatico({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
