"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";

interface LabLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", path: "/lab/dashboard", icon: "📊" },
  { id: "pedidos", label: "Pedidos", path: "/lab/pedidos", icon: "📦" },
  { id: "catalogo", label: "Catálogo", path: "/lab/catalogo", icon: "📋" },
  { id: "configuracion", label: "Configuración", path: "/lab/configuracion", icon: "⚙️" },
  { id: "mensajes", label: "Mensajes", path: "/lab/mensajes", icon: "💬" },
  { id: "soporte", label: "Soporte", path: "/lab/soporte", icon: "🎫" },
  { id: "reportes", label: "Reportes", path: "/lab/reportes", icon: "📈" },
];

// Menús adicionales si soy_fotografo = true
const photographerMenuItems = [
  { id: "albums", label: "Álbumes", path: "/dashboard/albums", icon: "📷" },
  { id: "remociones", label: "Solicitudes de baja", path: "/fotografo/remociones", icon: "🗑️" },
];

export default function LabLayout({ children }: LabLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [lab, setLab] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerType, setBannerType] = useState<"warning" | "error" | "info">("warning");

  useEffect(() => {
    if (authChecked) return;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/lab/login");
            return;
          }
          throw new Error("Error de autenticación");
        }

        const userData = await res.json();
        
        // Verificar que sea LAB o LAB_PHOTOGRAPHER
        if (userData.user?.role !== "LAB" && userData.user?.role !== "LAB_PHOTOGRAPHER") {
          router.push("/lab/login");
          return;
        }

        setUser(userData.user);

        // Cargar datos del lab
        const labRes = await fetch("/api/lab/by-user", {
          credentials: "include",
        });
        
        if (labRes.ok) {
          const labData = await labRes.json();
          setLab(labData.lab);
          
          // Verificar estado y MP para mostrar banner
          const needsApproval = labData.lab?.approvalStatus !== "APPROVED";
          const needsMP = !labData.lab?.mpUserId || !labData.lab?.mpAccessToken;
          
          if (needsApproval || needsMP) {
            setShowBanner(true);
            if (needsApproval && needsMP) {
              setBannerMessage("Tu cuenta está pendiente de aprobación y necesitás conectar Mercado Pago para recibir pedidos.");
              setBannerType("error");
            } else if (needsApproval) {
              setBannerMessage("Tu cuenta está pendiente de aprobación. Podés completar tu perfil y catálogo mientras esperás.");
              setBannerType("warning");
            } else if (needsMP) {
              setBannerMessage("Necesitás conectar Mercado Pago para recibir pedidos y cobrar comisiones.");
              setBannerType("warning");
            }
          }
        }

        setAuthChecked(true);
      } catch (err) {
        console.error("Error verificando autenticación:", err);
        router.push("/lab/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, authChecked]);

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[#6b7280]">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isPhotographer = lab?.soyFotografo === true || user.role === "LAB_PHOTOGRAPHER";
  const allMenuItems = isPhotographer 
    ? [...menuItems, ...photographerMenuItems]
    : menuItems;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Banner de alertas */}
      {showBanner && (
        <div className={`${
          bannerType === "error" ? "bg-red-50 border-red-200 text-red-800" :
          bannerType === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
          "bg-blue-50 border-blue-200 text-blue-800"
        } border-b px-4 py-3`}>
          <div className="container-custom max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm font-medium">{bannerMessage}</p>
            <button
              onClick={() => setShowBanner(false)}
              className="text-current opacity-70 hover:opacity-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-30">
        <div className="container-custom max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/lab/dashboard" className="flex items-center gap-3">
              {lab?.logoUrl ? (
                <Image
                  src={lab.logoUrl}
                  alt={lab.name}
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span className="text-xl font-bold text-[#1a1a1a]">{lab?.name || "Laboratorio"}</span>
              )}
              <span className="text-white text-xs font-semibold px-2 py-1 rounded bg-[#3b82f6] border border-[#2563eb]">
                Lab
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Estado MP */}
              {lab?.mpUserId && lab?.mpAccessToken ? (
                <span className="text-xs text-[#10b981] font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  MP Conectado
                </span>
              ) : (
                <span className="text-xs text-[#ef4444] font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  MP Sin conectar
                </span>
              )}

              {/* Estado de aprobación */}
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                lab?.approvalStatus === "APPROVED" 
                  ? "bg-[#10b981]/10 text-[#10b981]" 
                  : lab?.approvalStatus === "PENDING"
                  ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                  : "bg-[#ef4444]/10 text-[#ef4444]"
              }`}>
                {lab?.approvalStatus === "APPROVED" ? "Aprobado" :
                 lab?.approvalStatus === "PENDING" ? "Pendiente" :
                 lab?.approvalStatus === "REJECTED" ? "Rechazado" :
                 lab?.approvalStatus === "SUSPENDED" ? "Suspendido" :
                 "Borrador"}
              </span>

              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  router.push("/lab/login");
                }}
                className="text-sm text-[#6b7280] hover:text-[#1a1a1a]"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar y contenido */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-[#e5e7eb] min-h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4 space-y-1">
            {allMenuItems.map((item) => {
              const isActive = pathname?.startsWith(item.path);
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#3b82f6]/10 text-[#3b82f6] font-medium"
                      : "text-[#6b7280] hover:bg-[#f8f9fa] hover:text-[#1a1a1a]"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
