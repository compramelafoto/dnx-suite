"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import ConversionAnalyticsSection from "@/components/conversion/ConversionAnalyticsSection";
import OrdersAnalyticsWorkspace from "@/components/fotografo/orders/OrdersAnalyticsWorkspace";
import PhotographerWorkspacePageHeader from "@/components/photographer/workspace/PhotographerWorkspacePageHeader";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import type { PhotographerOrderRow } from "@/components/fotografo/orders/photographer-order-types";

export default function FotografoAnalyticsPage() {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<any>(null);
  const [orders, setOrders] = useState<PhotographerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }

      fetch(`/api/fotografo/${session.photographerId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data) setPhotographer(data);
        })
        .catch(() => {});

      fetch("/api/fotografo/pedidos", { credentials: "include" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 401) router.push("/fotografo/login");
            return [];
          }
          return Array.isArray(data) ? data : (data?.rows ?? []);
        })
        .then((list) => {
          if (!active) return;
          const rows: PhotographerOrderRow[] = list.map((o: any) => ({
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
          setOrders(rows);
        })
        .catch(() => setOrders([]))
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-6 md:py-8">
        <DsDashboardInner>
          <PhotographerWorkspacePageHeader
            title="Analytics"
            subtitle="Conversión de checkout y métricas de ventas de tus pedidos."
            actions={
              <Link href="/fotografo/pedidos">
                <Button variant="secondary" size="sm">
                  Ir a pedidos
                </Button>
              </Link>
            }
          />
          <ConversionAnalyticsSection className="mb-8" />
          <OrdersAnalyticsWorkspace orders={orders} />
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
