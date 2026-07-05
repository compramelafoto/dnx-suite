"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Helper para formatear moneda ARS
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

type Order = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  pickupBy: string;
  labName: string;
  createdAtText: string;
  statusUpdatedAtText: string;
  itemsCount: number;
  currency: string;
  total: number;
  status: string;
  paymentStatus: string;
};

export default function ClientPedidosPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si viene de Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData.role === "CLIENT" || userData.role === "CUSTOMER") {
          sessionStorage.setItem("client", JSON.stringify(userData));
          sessionStorage.setItem("clientId", userData.id.toString());
          // Limpiar URL
          window.history.replaceState({}, "", "/cliente/pedidos");
          setClient(userData);
        }
      } catch (e) {
        console.error("Error procesando datos de Google OAuth:", e);
      }
    }

    const saved = sessionStorage.getItem("client");
    if (!saved && !userParam) {
      router.push("/login");
      return;
    }

    const clientData = userParam ? JSON.parse(userParam) : JSON.parse(saved!);
    setClient(clientData);

    fetch(`/api/cliente/pedidos?clientId=${clientData.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error(data.error);
          setOrders([]);
        } else {
          setOrders(data);
        }
      })
      .catch((err) => {
        console.error("Error cargando pedidos:", err);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    // Limpiar sessionStorage
    sessionStorage.removeItem("client");
    sessionStorage.removeItem("clientId");
    
    // Llamar al endpoint de logout para limpiar cookies
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    
    // Redirigir a la página de login general
    router.push("/login?logout=success");
  }

  if (!client || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          <div className="flex justify-between items-center">
            <div style={{ wordBreak: "normal", overflowWrap: "normal", whiteSpace: "normal" }}>
              <h1
                style={{
                  fontSize: "clamp(24px, 5vw, 36px)",
                  fontWeight: "normal",
                  color: "#1a1a1a",
                  lineHeight: "1.3",
                  margin: 0,
                  padding: 0,
                  width: "100%",
                  maxWidth: "100%",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  whiteSpace: "normal",
                  wordSpacing: "normal",
                  letterSpacing: "normal",
                  textAlign: "left",
                  display: "block",
                }}
              >
                Mis Pedidos
              </h1>
              <p
                style={{
                  fontSize: "clamp(14px, 2vw, 16px)",
                  color: "#6b7280",
                  lineHeight: "1.5",
                  margin: 0,
                  marginTop: "8px",
                  padding: 0,
                  width: "100%",
                  maxWidth: "100%",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  whiteSpace: "normal",
                  wordSpacing: "normal",
                  letterSpacing: "normal",
                  textAlign: "left",
                  display: "block",
                }}
              >
                Revisá el estado de tus pedidos y tu historial de compras.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors group relative"
              title="Cerrar sesión"
            >
              <svg
                className="w-5 h-5 text-gray-600"
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
          </div>

          {orders.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[#6b7280] mb-4">
                Aún no tenés pedidos.{" "}
                <Link href="/imprimir" className="text-[#c27b3d] hover:underline">
                  Hacé tu primer pedido
                </Link>
              </p>
              <div className="mt-6">
                <Link href="/cliente/soporte">
                  <Button variant="secondary">Contactar Soporte</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="text-lg font-medium text-[#1a1a1a]">
                          Pedido #{order.id}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === "DELIVERED" || order.status === "RETIRED"
                              ? "bg-[#10b981]/10 text-[#10b981]"
                              : order.status === "CANCELED"
                              ? "bg-[#ef4444]/10 text-[#ef4444]"
                              : order.status === "READY_TO_PICKUP" || order.status === "SHIPPED"
                              ? "bg-[#3b82f6]/10 text-[#3b82f6]"
                              : "bg-[#f59e0b]/10 text-[#f59e0b]"
                          }`}
                        >
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-[#6b7280]">
                        <p>
                          <span className="font-medium">Laboratorio:</span> {order.labName}
                        </p>
                        <p>
                          <span className="font-medium">Fecha:</span> {order.createdAtText}
                        </p>
                        <p>
                          <span className="font-medium">Items:</span> {order.itemsCount} {order.itemsCount === 1 ? "foto" : "fotos"}
                        </p>
                        <p>
                          <span className="font-medium">Pago:</span>{" "}
                          {order.paymentStatus === "PAID" ? (
                            <span className="text-[#10b981]">Pagado</span>
                          ) : order.paymentStatus === "FAILED" ? (
                            <span className="text-[#ef4444]">Fallido</span>
                          ) : (
                            <span className="text-[#f59e0b]">Pendiente</span>
                          )}
                        </p>
                      </div>
                      <div className="mt-4">
                        <Link href={`/cliente/soporte?orderId=${order.id}`}>
                          <Button variant="secondary" size="sm">
                            Contactar sobre este pedido
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-medium text-[#1a1a1a]">
                        {formatARS(order.total)}
                      </p>
                      <p className="text-sm text-[#6b7280] mt-1">
                        {order.currency}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="text-center pt-6 space-y-4">
            <div className="flex gap-4 justify-center">
              <Link href="/imprimir">
                <Button variant="primary">Hacer nuevo pedido</Button>
              </Link>
              <Link href="/cliente/soporte">
                <Button variant="secondary">Contactar Soporte</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
