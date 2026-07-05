"use client";

import { useState, useEffect } from "react";
import FotografoLayoutClient from "@/components/panels/FotografoLayoutClient";

/**
 * Layout para rutas /dashboard/*.
 * Si el usuario es fotógrafo, muestra el mismo panel que /fotografo (sidebar + barra superior siempre visibles).
 * Renderizamos el panel de fotógrafo de entrada para evitar "recarga" al navegar desde /fotografo/*.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const r = data?.user?.role ?? null;
        setShowPanel(r === "PHOTOGRAPHER");
      })
      .catch(() => setShowPanel(false));
    return () => {
      active = false;
    };
  }, []);

  if (showPanel) {
    return <FotografoLayoutClient>{children}</FotografoLayoutClient>;
  }

  return <>{children}</>;
}
