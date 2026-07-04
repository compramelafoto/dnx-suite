"use client";

import { useState, useEffect } from "react";
import FotografoLayoutClient from "@/components/panels/FotografoLayoutClient";

/**
 * Layout para rutas /dashboard/*.
 * Si el usuario es fotógrafo, muestra el mismo panel que /fotografo (sidebar + barra superior).
 * No asumimos panel hasta conocer el rol: si cerró sesión o no está logueado, no mostramos el menú lateral.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [panelMode, setPanelMode] = useState<"unknown" | "panel" | "bare">("unknown");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const r = data?.user?.role ?? null;
        setPanelMode(r === "PHOTOGRAPHER" ? "panel" : "bare");
      })
      .catch(() => setPanelMode("bare"));
    return () => {
      active = false;
    };
  }, []);

  if (panelMode === "unknown") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  if (panelMode === "panel") {
    return <FotografoLayoutClient>{children}</FotografoLayoutClient>;
  }

  return <>{children}</>;
}
