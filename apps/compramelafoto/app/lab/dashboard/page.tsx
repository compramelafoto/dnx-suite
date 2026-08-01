"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LabHeader from "@/components/lab/LabDashboardHeader";
import { ensureLabSession } from "@/lib/lab-session-client";

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Creado",
  IN_PRODUCTION: "En producción",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "Enviado",
  RETIRED: "Retirado",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
};

const STATUS_OPTIONS = [
  { value: "CREATED", label: "Creado" },
  { value: "IN_PRODUCTION", label: "En producción" },
  { value: "READY_TO_PICKUP", label: "Listo para retirar" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "RETIRED", label: "Retirado" },
];

type PendingOrder = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  photographerId: number | null;
  photographerName: string | null;
  createdAt: string;
  statusUpdatedAt: string;
  status: string;
  total: number;
  currency: string;
  itemsCount: number;
  pickupBy: string;
};

export default function LabDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<Record<number, boolean>>({});
  const [lab, setLab] = useState<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData.role === "LAB" || userData.role === "LAB_PHOTOGRAPHER") {
          if (Number.isFinite(Number(userData.id))) {
            sessionStorage.setItem("labId", userData.id.toString());
          }
          sessionStorage.setItem("lab", JSON.stringify(userData));
          window.history.replaceState({}, "", "/lab/dashboard");
        }
      } catch (e) {
        console.error("Error procesando datos de Google OAuth:", e);
      }
    }
    loadDashboard();
    loadLab();
  }, []);

  async function loadLab() {
    try {
      const session = await ensureLabSession();
      if (!session) {
        router.push("/lab/login");
        return;
      }
      const res = await fetch(`/api/lab/${session.labId}`);
      if (res.ok) {
        const data = await res.json();
        setLab({
          id: data.id,
          name: data.name,
          logoUrl: data.logoUrl,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
        });
      }
    } catch (error) {
      console.error("Error cargando laboratorio:", error);
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch("/api/lab/dashboard");
      if (!res.ok) {
        router.push("/lab/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setPendingOrders(data.pendingOrders || []);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId: number, newStatus: string) {
    setUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));

    try {
      const res = await fetch(`/api/print-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          requesterType: "LAB",
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Error desconocido" }));
        alert(`Error: ${error.error || "No se pudo actualizar el estado"}`);
        return;
      }

      // Recargar dashboard para reflejar cambios
      await loadDashboard();
    } catch (err: any) {
      console.error("Error actualizando estado:", err);
      alert(`Error: ${err?.message || "No se pudo actualizar el estado"}`);
    } finally {
      setUpdatingStatus((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  }

  function generateWhatsAppLink(order: PendingOrder): string {
    const customerName = order.customerName || "Cliente";
    const message = `${customerName}, buenos días! Tu pedido #${order.id} ya está listo!`;
    const phone = order.customerPhone?.replace(/\D/g, "") || "";
    return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      
      <section className="py-8 md:py-12">
        <div className="container-custom">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Título y bienvenida */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1a1a1a] mb-2">
                    Panel de Producción
                  </h1>
                  <p className="text-[#6b7280] text-lg">
                    Gestioná tus pedidos y estadísticas en tiempo real
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/lab/negocio"
                    className="flex items-center gap-2 px-6 py-3 bg-[#c27b3d] hover:bg-[#a0662f] text-white rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span>Ir a Negocio</span>
                  </Link>
                  <Link
                    href="/lab/soporte"
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-[#e5e7eb] text-[#1a1a1a] rounded-lg font-medium transition-colors hover:bg-[#f9fafb]"
                  >
                    <span>Soporte técnico</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Estadísticas principales */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-1">Pedidos del Mes</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {stats.monthlyOrders}
                  </p>
                </Card>
                
                <Card className="p-5 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">En Producción</p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {stats.ordersInProduction}
                  </p>
                </Card>
                
                <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <p className="text-sm text-green-700 font-medium mb-1">Listos</p>
                  <p className="text-3xl font-bold text-green-900">
                    {stats.ordersReady}
                  </p>
                </Card>
                
                <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <p className="text-sm text-purple-700 font-medium mb-1">Entregados</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {stats.ordersDelivered}
                  </p>
                </Card>
                
                <Card className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                  <p className="text-sm text-indigo-700 font-medium mb-1">Ingresos del Mes</p>
                  <p className="text-2xl font-bold text-indigo-900">
                    {formatARS(stats.monthlyRevenue || 0)}
                  </p>
                </Card>
                
                <Card className="p-5 bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                  <p className="text-sm text-pink-700 font-medium mb-1">SLA Promedio</p>
                  <p className="text-3xl font-bold text-pink-900">
                    {stats.averageSlaDays} días
                  </p>
                </Card>
              </div>
            )}

            {/* Pedidos pendientes de producción */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a] mb-1">
                    Pedidos Pendientes de Producción
                  </h2>
                  <p className="text-[#6b7280]">
                    {pendingOrders.length} pedido{pendingOrders.length !== 1 ? "s" : ""} pendiente{pendingOrders.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-[#6b7280] text-lg">
                    ¡No hay pedidos pendientes! Todos los pedidos están finalizados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-[#1a1a1a]">
                              Pedido #{order.id}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                order.status === "CREATED"
                                  ? "bg-gray-100 text-gray-700"
                                  : order.status === "IN_PRODUCTION"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : order.status === "READY_TO_PICKUP"
                                  ? "bg-green-100 text-green-700"
                                  : order.status === "SHIPPED" || order.status === "RETIRED"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {STATUS_LABEL[order.status] || order.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-[#6b7280]">
                            <div>
                              <span className="font-medium">Cliente:</span> {order.customerName || "Sin nombre"}
                            </div>
                            {order.customerEmail && (
                              <div>
                                <span className="font-medium">Email:</span> {order.customerEmail}
                              </div>
                            )}
                            {order.customerPhone && (
                              <div>
                                <span className="font-medium">Teléfono:</span> {order.customerPhone}
                              </div>
                            )}
                            {order.photographerName && (
                              <div>
                                <span className="font-medium">Fotógrafo:</span> {order.photographerName}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Retira:</span>{" "}
                              {order.pickupBy === "CLIENT" ? (
                                <span className="text-blue-600">Cliente</span>
                              ) : (
                                <span className="text-orange-600">Fotógrafo</span>
                              )}
                            </div>
                            <div>
                              <span className="font-medium">Items:</span> {order.itemsCount}
                            </div>
                            <div>
                              <span className="font-medium">Total:</span>{" "}
                              <span className="font-semibold text-[#1a1a1a]">
                                {order.currency} {order.total.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Creado:</span>{" "}
                              {new Date(order.createdAt).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 md:min-w-[280px]">
                          <div className="flex gap-2">
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                              disabled={updatingStatus[order.id]}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="flex gap-2 flex-wrap">
                            {(order.status === "READY_TO_PICKUP" || order.status === "SHIPPED") && order.customerPhone && (
                              <a
                                href={generateWhatsAppLink(order)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium text-center transition-colors"
                              >
                                📱 WhatsApp
                              </a>
                            )}
                            <Link
                              href={`/api/print-orders/${order.id}/export`}
                              target="_blank"
                              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium text-center transition-colors"
                            >
                              ⬇️ Descargar ZIP
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
