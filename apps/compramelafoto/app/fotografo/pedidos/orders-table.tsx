"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OrderVisualProvider } from "@/components/fotografo/orders/OrderVisualContext";
import OrdersNeedsAttention from "@/components/fotografo/orders/OrdersNeedsAttention";
import OrdersActivityFeed from "@/components/fotografo/orders/OrdersActivityFeed";
import OrdersOperationalInsights from "@/components/fotografo/orders/OrdersOperationalInsights";
import OrdersAnalyticsWorkspace from "@/components/fotografo/orders/OrdersAnalyticsWorkspace";
import OrdersWorkspaceHeader from "@/components/fotografo/orders/OrdersWorkspaceHeader";
import OrdersDesktopList from "@/components/fotografo/orders/OrdersDesktopList";
import OrderCompactRow from "@/components/fotografo/orders/OrderCompactRow";
import OrderDetailDrawer from "@/components/fotografo/orders/OrderDetailDrawer";
import OrdersBulkActionBar, {
  buildDefaultBulkActions,
} from "@/components/fotografo/orders/OrdersBulkActionBar";
import {
  openOrderExport,
  type OrdersQuickAutomationHandlers,
} from "@/components/fotografo/orders/orders-quick-automation-helpers";
import { pollOrderZipDownloadUrl } from "@/lib/digital-download/poll-order-zip-download";
import {
  getBulkDeliverableOrders,
  getBulkDownloadableOrders,
  getBulkExportableOrders,
  getBulkWhatsappOrder,
  getBulkWhatsappUrl,
  resolveSelectedOrders,
} from "@/components/fotografo/orders/orders-bulk-helpers";
import {
  filterOrders,
  getOrderFulfillmentKind,
  rowKey,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "@/components/fotografo/orders/photographer-order-types";

export type { PhotographerOrderRow };

type PhotographerOrdersTableProps = {
  orders: PhotographerOrderRow[];
  photographerId: number;
};

type BulkLoadingState = {
  download: boolean;
  export: boolean;
  delivered: boolean;
};

export default function PhotographerOrdersTable({ orders, photographerId }: PhotographerOrdersTableProps) {
  const [quickFilter, setQuickFilter] = useState<OrdersQuickFilter>("ALL");
  const [q, setQ] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState<Record<number, boolean>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [bulkSelectedKeys, setBulkSelectedKeys] = useState<Set<string>>(() => new Set());
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<BulkLoadingState>({
    download: false,
    export: false,
    delivered: false,
  });
  const listAnchorRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterOrders(orders, quickFilter, q),
    [orders, quickFilter, q]
  );

  const visibleKeys = useMemo(() => filtered.map(rowKey), [filtered]);

  const selectedOrder = useMemo(
    () => filtered.find((o) => rowKey(o) === selectedOrderKey) ?? null,
    [filtered, selectedOrderKey]
  );

  const bulkSelectedOrders = useMemo(
    () => resolveSelectedOrders(orders, bulkSelectedKeys),
    [orders, bulkSelectedKeys]
  );

  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => bulkSelectedKeys.has(key));
  const someVisibleSelected = visibleKeys.some((key) => bulkSelectedKeys.has(key));
  const hasBulkSelection = bulkSelectedKeys.size > 0;

  const toggleBulkKey = useCallback((key: string) => {
    setBulkSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setBulkSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const key of visibleKeys) next.delete(key);
      } else {
        for (const key of visibleKeys) next.add(key);
      }
      return next;
    });
  }, [allVisibleSelected, visibleKeys]);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedKeys(new Set());
    setMobileSelectionMode(false);
  }, []);

  const scrollToOrdersList = useCallback(() => {
    listAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleActivityFilter = useCallback(
    (filter: OrdersQuickFilter) => {
      setQuickFilter(filter);
      scrollToOrdersList();
    },
    [scrollToOrdersList]
  );

  const handleActivitySelectOrder = useCallback(
    (key: string) => {
      setSelectedOrderKey(key);
      scrollToOrdersList();
    },
    [scrollToOrdersList]
  );

  async function patchOrderStatus(orderId: number, newStatus: string): Promise<boolean> {
    setUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));

    try {
      const res = await fetch(`/api/print-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          requesterType: "PHOTOGRAPHER",
          photographerId,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(error.error || "No se pudo actualizar el estado");
      }

      return true;
    } catch (err: unknown) {
      console.error("Error actualizando estado:", err);
      return false;
    } finally {
      setUpdatingStatus((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  }

  async function handleStatusChange(orderId: number, newStatus: string, reload = true) {
    const ok = await patchOrderStatus(orderId, newStatus);
    if (!ok) {
      alert("No se pudo actualizar el estado");
      return false;
    }
    if (reload) window.location.reload();
    return true;
  }

  function setDl(key: string, v: boolean) {
    setDownloading((prev) => {
      const next = { ...prev };
      if (v) next[key] = true;
      else delete next[key];
      return next;
    });
  }

  async function fetchDigitalDownloadPayload(orderId: number) {
    const res = await fetch(`/api/fotografo/pedidos/${orderId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderType: "DIGITAL" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No se pudo generar la descarga");
    if (!data?.downloadUrl) throw new Error("No se pudo obtener el link de descarga.");
    return data as {
      downloadUrl: string;
      downloadCenterUrl?: string | null;
      primaryClientUrl?: string;
      downloadCenterRolloutActive?: boolean;
      digitalPhotoCount?: number;
    };
  }

  async function handleDownload(key: string, orderId: number, orderType: "PRINT" | "DIGITAL") {
    setDl(key, true);
    try {
      if (orderType === "PRINT") {
        const res = await fetch(`/api/fotografo/pedidos/${orderId}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo generar la descarga");
        if (data?.downloadUrl) window.open(data.downloadUrl, "_blank");
        else alert("No se pudo obtener el link de descarga.");
        return;
      }

      const data = await fetchDigitalDownloadPayload(orderId);
      const digitalCount = data.digitalPhotoCount ?? 1;

      if (digitalCount > 1) {
        const zipUrl = await pollOrderZipDownloadUrl(orderId, data.downloadUrl);
        if (zipUrl) {
          window.open(zipUrl, "_blank");
        } else {
          alert(
            "El ZIP se está generando. Esperá unos minutos y volvé a intentar, o usá el centro de descargas."
          );
        }
        return;
      }

      window.open(data.downloadUrl, "_blank");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error generando descarga");
    } finally {
      setDl(key, false);
    }
  }

  async function handleOpenDownloadCenter(key: string, orderId: number) {
    setDl(key, true);
    try {
      const data = await fetchDigitalDownloadPayload(orderId);
      const url = data.downloadCenterUrl;
      if (!url) {
        alert("El centro de descargas no está disponible para este pedido. Usá Descargar ZIP.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error abriendo centro de descargas");
    } finally {
      setDl(key, false);
    }
  }

  async function handleCopyLink(linkKey: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(linkKey);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      alert("No se pudo copiar el link");
    }
  }

  async function handleCopyDigitalLink(linkKey: string, orderId: number) {
    setDl(linkKey, true);
    try {
      const data = await fetchDigitalDownloadPayload(orderId);
      const url = data.primaryClientUrl ?? data.downloadCenterUrl ?? data.downloadUrl;
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(linkKey);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error copiando link");
    } finally {
      setDl(linkKey, false);
    }
  }

  async function handleBulkDownload() {
    const eligible = getBulkDownloadableOrders(bulkSelectedOrders);
    if (eligible.length === 0) return;

    setBulkLoading((prev) => ({ ...prev, download: true }));
    try {
      for (const order of eligible) {
        if (order.source === "PRINT_ORDER") {
          await handleDownload(`bulk-p-${order.id}`, order.id, "PRINT");
          continue;
        }
        const fk = getOrderFulfillmentKind(order);
        const hasDigital =
          order.hasDigitalItems ?? (fk === "DIGITAL" || fk === "MIXED");
        if (hasDigital) {
          await handleDownload(`bulk-d-${order.id}`, order.id, "DIGITAL");
        }
      }
    } finally {
      setBulkLoading((prev) => ({ ...prev, download: false }));
    }
  }

  function handleBulkExport() {
    const eligible = getBulkExportableOrders(bulkSelectedOrders);
    if (eligible.length === 0) return;

    setBulkLoading((prev) => ({ ...prev, export: true }));
    const origin = window.location.origin;
    try {
      for (const order of eligible) {
        if (order.source === "PRINT_ORDER") {
          window.open(`${origin}/api/print-orders/${order.id}/export`, "_blank");
        } else {
          window.open(`${origin}/api/fotografo/pedidos/${order.id}/export-print`, "_blank");
        }
      }
    } finally {
      setTimeout(() => setBulkLoading((prev) => ({ ...prev, export: false })), 400);
    }
  }

  async function handleBulkMarkDelivered() {
    const eligible = getBulkDeliverableOrders(bulkSelectedOrders);
    if (eligible.length === 0) return;

    const confirmed = window.confirm(
      `¿Marcar ${eligible.length} pedido${eligible.length === 1 ? "" : "s"} como entregado${eligible.length === 1 ? "" : "s"}?`
    );
    if (!confirmed) return;

    setBulkLoading((prev) => ({ ...prev, delivered: true }));
    let failures = 0;

    try {
      for (const order of eligible) {
        const ok = await patchOrderStatus(order.id, "DELIVERED");
        if (!ok) failures++;
      }

      if (failures > 0) {
        alert(`Se actualizaron ${eligible.length - failures} pedidos. ${failures} fallaron.`);
        window.location.reload();
      } else {
        window.location.reload();
      }
    } finally {
      setBulkLoading((prev) => ({ ...prev, delivered: false }));
    }
  }

  function handleBulkWhatsApp() {
    const order = getBulkWhatsappOrder(bulkSelectedOrders);
    if (!order) return;
    const url = getBulkWhatsappUrl(order);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  const bulkActions = buildDefaultBulkActions({
    canDownload: getBulkDownloadableOrders(bulkSelectedOrders).length > 0,
    canExport: getBulkExportableOrders(bulkSelectedOrders).length > 0,
    canMarkDelivered: getBulkDeliverableOrders(bulkSelectedOrders).length > 0,
    canWhatsApp: getBulkWhatsappOrder(bulkSelectedOrders) !== null,
    onDownload: handleBulkDownload,
    onExport: handleBulkExport,
    onMarkDelivered: handleBulkMarkDelivered,
    onWhatsApp: handleBulkWhatsApp,
    loading: bulkLoading,
  });

  const actionHandlers = {
    onDownload: handleDownload,
    onCopyLink: handleCopyLink,
    onCopyDigitalLink: handleCopyDigitalLink,
  };

  const automationHandlers = useMemo<OrdersQuickAutomationHandlers>(
    () => ({
      onFilter: handleActivityFilter,
      onSelectOrder: handleActivitySelectOrder,
      onExportOrder: openOrderExport,
      onMarkDelivered: (orderId) => {
        void handleStatusChange(orderId, "DELIVERED");
      },
      onDownloadOrder: (order, type) => {
        const key = type === "PRINT" ? `qa-p-${order.id}` : `qa-d-${order.id}`;
        void handleDownload(key, order.id, type);
      },
      onCopyDigitalLink: (order) => {
        void handleCopyDigitalLink(`qa-cd-${order.id}`, order.id);
      },
    }),
    [handleActivityFilter, handleActivitySelectOrder]
  );

  return (
    <OrderVisualProvider>
    <div className={cn("flex flex-col gap-5 w-full min-w-0", hasBulkSelection && "pb-24")}>
      <OrdersNeedsAttention
        orders={orders}
        automationHandlers={automationHandlers}
        onViewOrders={() => {
          setQuickFilter("ALL");
          setQ("");
          scrollToOrdersList();
        }}
      />

      <OrdersOperationalInsights orders={orders} automationHandlers={automationHandlers} />

      <OrdersAnalyticsWorkspace orders={orders} />

      <div ref={listAnchorRef} className="scroll-mt-4 w-full min-w-0 space-y-3 border-t border-gray-100 pt-5">
      <OrdersWorkspaceHeader
        orders={orders}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
        q={q}
        onSearchChange={setQ}
        onClearSearch={() => setQ("")}
        shownCount={filtered.length}
      />

      <OrdersDesktopList
        orders={filtered}
        selectedOrderKey={selectedOrderKey}
        bulkSelectedKeys={bulkSelectedKeys}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        onToggleBulkKey={toggleBulkKey}
        onToggleAllVisible={toggleAllVisible}
        downloading={downloading}
        copiedLinkId={copiedLinkId}
        onSelectOrder={setSelectedOrderKey}
        {...actionHandlers}
      />

      <div className="md:hidden flex flex-col gap-2">
        {filtered.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
            <p className="text-xs text-gray-500">
              {mobileSelectionMode
                ? `${bulkSelectedKeys.size} seleccionado${bulkSelectedKeys.size === 1 ? "" : "s"}`
                : "Modo selección"}
            </p>
            <button
              type="button"
              onClick={() => {
                if (mobileSelectionMode) {
                  clearBulkSelection();
                } else {
                  setMobileSelectionMode(true);
                }
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                mobileSelectionMode
                  ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  : "bg-[#c27b3d] text-white hover:bg-[#b06a2f]"
              )}
            >
              {mobileSelectionMode ? "Cancelar" : "Seleccionar"}
            </button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
            No hay pedidos con ese filtro.
          </div>
        ) : (
          filtered.map((o) => {
            const key = rowKey(o);
            return (
              <OrderCompactRow
                key={key}
                order={o}
                selected={selectedOrderKey === key}
                bulkSelected={bulkSelectedKeys.has(key)}
                showBulkCheckbox={mobileSelectionMode}
                onToggleBulk={() => toggleBulkKey(key)}
                downloading={downloading}
                copiedLinkId={copiedLinkId}
                onSelect={() => setSelectedOrderKey(key)}
                mobileSelectionMode={mobileSelectionMode}
                {...actionHandlers}
                layout="mobile"
              />
            );
          })
        )}
      </div>
      </div>

      <OrdersActivityFeed
        orders={orders}
        automationHandlers={automationHandlers}
        variant="compact"
      />

      <OrderDetailDrawer
        order={selectedOrder}
        open={selectedOrderKey !== null && selectedOrder !== null}
        onClose={() => setSelectedOrderKey(null)}
        downloading={downloading}
        copiedLinkId={copiedLinkId}
        updatingStatus={updatingStatus}
        onDownload={handleDownload}
        onOpenDownloadCenter={handleOpenDownloadCenter}
        onCopyLink={handleCopyLink}
        onCopyDigitalLink={handleCopyDigitalLink}
        onStatusChange={(orderId, status) => handleStatusChange(orderId, status)}
        automationHandlers={automationHandlers}
      />

      <OrdersBulkActionBar
        selectedCount={bulkSelectedKeys.size}
        onClear={clearBulkSelection}
        actions={bulkActions}
      />
    </div>
    </OrderVisualProvider>
  );
}
