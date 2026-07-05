"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    createdAtIso: o.createdAtIso ?? null,
    itemsCount: o.itemsCount,
    currency: o.currency,
    total: o.total,
    status: o.status,
    paymentStatus: o.paymentStatus ?? null,
    orderType: o.orderType,
    origin: o.origin ?? null,
    source: o.source,
    fulfillmentKind: o.fulfillmentKind,
    hasDigitalItems: o.hasDigitalItems,
    hasPrintItems: o.hasPrintItems,
    digitalItemsCount: o.digitalItemsCount,
    printItemsCount: o.printItemsCount,
    _dataProtected: o._dataProtected,
    downloadLinkViewedAt: o.downloadLinkViewedAt,
    photographerInstagram: o.photographerInstagram ?? null,
    photographerReceivedAmount: o.photographerReceivedAmount,
    clientPaidAmount: o.clientPaidAmount,
    eventOrganizerSale: o.eventOrganizerSale ?? null,
    albumEventId: o.albumEventId ?? null,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-5 w-full min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-1.5">Pedidos</h1>
          <p className="max-w-4xl text-gray-600 leading-relaxed text-balance ds-readable-text ds-readable-text--fluid">
            Todos tus pedidos en un solo lugar: digitales, impresión, videos y ventas de eventos. Si la entrega es a
            tu cargo, podés actualizar el estado de pedidos de impresión.
          </p>
        </header>

        <PhotographerOrdersTable orders={rows} photographerId={photographerId} />
      </div>
    </div>
  );
}
