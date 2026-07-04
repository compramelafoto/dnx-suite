"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export default function LabDashboardHeader({ lab }: { lab: Lab | null }) {
  const router = useRouter();
  const [isPublicPageEnabled, setIsPublicPageEnabled] = useState(false);
  const [publicPageHandler, setPublicPageHandler] = useState<string | null>(null);

  useEffect(() => {
    if (lab?.id) {
      // Cargar información de la página pública si está disponible
      fetch(`/api/lab/${lab.id}`)
        .then((res) => res.json())
        .then((data) => {
          setIsPublicPageEnabled(data.isPublicPageEnabled || false);
          setPublicPageHandler(data.publicPageHandler || null);
        })
        .catch(() => {});
    }
  }, [lab]);

  async function handleLogout() {
    // Limpiar sessionStorage
    sessionStorage.removeItem("labId");
    sessionStorage.removeItem("lab");
    sessionStorage.removeItem("labStatus");
    
    // Llamar al endpoint de logout para limpiar cookies
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    
    // Redirigir a la página de login general
    router.push("/login?logout=success");
  }

  const bgColor = lab?.secondaryColor || "#2d2d2d";

  return (
    <header
      className="text-white sticky top-0 z-50 shadow-lg"
      style={{ backgroundColor: bgColor }}
    >
      <div className="container-custom py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {lab?.logoUrl ? (
              <img
                src={lab.logoUrl}
                alt={lab.name || "Laboratorio"}
                className="h-16 w-auto max-w-[200px] object-contain"
              />
            ) : lab?.name ? (
              <span className="text-lg font-semibold">{lab.name}</span>
            ) : null}
          </div>

          {/* Navegación con iconos */}
          <nav className="flex items-center gap-2">
            {/* Panel */}
            <Link
              href="/lab/dashboard"
              className="p-2.5 rounded-lg hover:bg-white/10 transition-colors group relative"
              title="Mi Panel"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                Mi Panel
              </span>
            </Link>

            {/* Configuración */}
            <Link
              href="/lab/configuracion?tab=datos"
              className="p-2.5 rounded-lg hover:bg-white/10 transition-colors group relative"
              title="Configuración"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                Configuración
              </span>
            </Link>

            {/* Soporte */}
            <Link
              href="/lab/soporte"
              className="p-2.5 rounded-lg hover:bg-white/10 transition-colors group relative"
              title="Soporte"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                Soporte
              </span>
            </Link>

            {/* Términos */}
            <Link
              href="/terminos#laboratorio"
              className="p-2.5 rounded-lg hover:bg-white/10 transition-colors group relative"
              title="Términos y condiciones"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                Términos
              </span>
            </Link>

            {/* Ver página pública (si no está habilitada, lleva a configuración) */}
            <a
              href={isPublicPageEnabled && publicPageHandler ? `/l/${publicPageHandler}` : "/lab/configuracion?tab=diseno"}
              target={isPublicPageEnabled && publicPageHandler ? "_blank" : undefined}
              rel={isPublicPageEnabled && publicPageHandler ? "noopener noreferrer" : undefined}
              className={`p-2.5 rounded-lg transition-colors group relative ${isPublicPageEnabled && publicPageHandler ? "hover:bg-white/10" : "opacity-70 hover:bg-white/10"}`}
              title={isPublicPageEnabled && publicPageHandler ? "Ver mi página pública" : "Configurar página pública"}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                {isPublicPageEnabled && publicPageHandler ? "Ver mi página" : "Configurar página"}
              </span>
            </a>

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg hover:bg-white/10 transition-colors group relative"
              title="Cerrar sesión"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                Cerrar sesión
              </span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
