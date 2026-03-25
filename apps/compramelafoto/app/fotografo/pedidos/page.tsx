"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PhotographerOrdersTable from "./orders-table";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function PhotographerPedidosPage() {
  const router = useRouter();
  const [photographerId, setPhotographerId] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number>(0);
  const [photographer, setPhotographer] = useState<any>(null);

  async function loadPendingRemovalCount(photographerId: number) {
    try {
      const params = new URLSearchParams({
        photographerId: photographerId.toString(),
        status: "PENDING",
      });
      const res = await fetch(`/api/dashboard/removal-requests?${params}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPendingRemovalCount(data.length);
      }
    } catch (err) {
      // Silenciar errores
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      setPhotographerId(session.photographerId);

      fetch("/api/fotografo/pedidos", { credentials: "include" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              sessionStorage.removeItem("photographer");
              sessionStorage.removeItem("photographerId");
              router.push("/fotografo/login");
              return;
            }
            console.error(data?.error || "Error cargando pedidos");
            setOrders([]);
            return;
          }
          // API devuelve array directo, o { rows, _debug } si ?debug=1
          const list = Array.isArray(data) ? data : (data?.rows ?? []);
          setOrders(list);
        })
        .catch((err) => {
          console.error("Error cargando pedidos:", err);
          setOrders([]);
        })
        .finally(() => setLoading(false));

      loadPendingRemovalCount(session.photographerId);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    // Escuchar eventos de actualización de solicitudes
    const handleUpdate = () => {
      if (photographerId) {
        loadPendingRemovalCount(photographerId);
      }
    };
    window.addEventListener('removalRequestUpdated', handleUpdate);
    return () => window.removeEventListener('removalRequestUpdated', handleUpdate);
  }, [photographerId]);

  if (!photographerId || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const rows = orders.map((o: any) => ({
    id: o.id,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    pickupBy: o.pickupBy,
    labName: o.labName,
    createdAtText: o.createdAtText,
    statusUpdatedAtText: o.statusUpdatedAtText,
    itemsCount: o.itemsCount,
    currency: o.currency,
    total: o.total,
    status: o.status,
    paymentStatus: o.paymentStatus ?? null,
    orderType: o.orderType,
    source: o.source,
    hasPrintItems: o.hasPrintItems,
    _dataProtected: o._dataProtected,
    downloadLinkViewedAt: o.downloadLinkViewedAt,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Mis Pedidos
            </h1>
            <p className="text-gray-600">
              Acá ves todos tus pedidos: de impresión (carpeta lista para imprimir, descargable) y ventas digitales. Si la entrega es a tu cargo, podés actualizar el estado del pedido de impresión.
            </p>
          </div>

          <PhotographerOrdersTable orders={rows} photographerId={photographerId} />
        </div>
      </div>
    </div>
  );
}
