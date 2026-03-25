"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatARS, formatDate, getStatusBadgeColor, getStatusLabel, getOrderTypeLabel } from "@/lib/admin/helpers";

interface AdminOrder {
  id: number;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  paymentStatus: string;
  orderType: string;
  total: number;
  currency: string;
  lab: {
    id: number;
    name: string;
  } | null;
  photographer: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  album: {
    id: number;
    title: string;
  } | null;
  source: "PRINT_ORDER" | "ALBUM_ORDER";
  downloadLinkViewedAt?: string | null;
}

export default function PedidosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<{ totalFacturado: number; totalFotosVendidas: number } | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || "");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(searchParams?.get("paymentStatus") || "");
  const [orderTypeFilter, setOrderTypeFilter] = useState(searchParams?.get("orderType") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "");
  const [albumFilter, setAlbumFilter] = useState(searchParams?.get("album") || "");
  const [photographerFilter, setPhotographerFilter] = useState(searchParams?.get("photographer") || "");
  const [testPhotoIds, setTestPhotoIds] = useState("1,2,3");
  const [testEmail, setTestEmail] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testDownloadUrl, setTestDownloadUrl] = useState<string | null>(null);

  // Debounce para búsqueda: permite escribir sin que cada tecla dispare una carga
  useEffect(() => {
    const t = setTimeout(() => loadOrders(), 300);
    return () => clearTimeout(t);
  }, [pagination.page, statusFilter, paymentStatusFilter, orderTypeFilter, searchQuery, albumFilter, photographerFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter);
      if (orderTypeFilter) params.set("orderType", orderTypeFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (albumFilter.trim()) params.set("album", albumFilter.trim());
      if (photographerFilter.trim()) params.set("photographer", photographerFilter.trim());
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando pedidos:", errorData);
        return;
      }

      const data = await res.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || pagination);
      setSummary(data.summary ?? null);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const selectable = orders.filter((o) => o.source === "PRINT_ORDER").map((o) => o.id);
      setSelectedOrders(new Set(selectable));
    } else {
      setSelectedOrders(new Set());
    }
  }

  function toggleSelectOne(orderId: number) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.source !== "PRINT_ORDER") {
      return;
    }
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  async function deleteOrder(orderId: number, source: AdminOrder["source"]) {
    if (!confirm(`¿Eliminar pedido #${orderId}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const endpoint =
        source === "PRINT_ORDER"
          ? `/api/admin/print-orders/${orderId}`
          : `/api/admin/orders/${orderId}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando pedido");
      }
      await loadOrders();
    } catch (err: any) {
      alert(err?.message || "Error eliminando pedido");
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedOrders);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} pedidos seleccionados? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/print-orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando pedidos");
      }
      await loadOrders();
    } catch (err: any) {
      alert(err?.message || "Error eliminando pedidos");
    }
  }

  function handleFilterChange() {
    setPagination({ ...pagination, page: 1 });
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter);
    if (orderTypeFilter) params.set("orderType", orderTypeFilter);
    if (searchQuery) params.set("q", searchQuery);
    if (albumFilter) params.set("album", albumFilter);
    if (photographerFilter) params.set("photographer", photographerFilter);
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  function clearFilters() {
    setStatusFilter("");
    setPaymentStatusFilter("");
    setOrderTypeFilter("");
    setSearchQuery("");
    setAlbumFilter("");
    setPhotographerFilter("");
    setPagination({ ...pagination, page: 1 });
    router.push("/admin/pedidos");
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-blue-50 border border-blue-100">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-blue-900">Test ZIP Job</p>
            <p className="text-sm text-blue-700">
              Generá un job custom para validar pipeline completo (create, process y status).
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={testPhotoIds}
              onChange={(e) => setTestPhotoIds(e.target.value)}
              className="flex-1"
              placeholder="IDs de fotos separados por comas (ej: 12,34,78)"
            />
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
              placeholder="Email donde enviar el ZIP (opcional)"
            />
            <Button
              onClick={async () => {
                setTestRunning(true);
                setTestMessage(null);
                setTestDownloadUrl(null);
                try {
                  const response = await fetch("/api/admin/test-zip-job", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      photoIds: testPhotoIds
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter((num) => Number.isFinite(num)),
                      email: testEmail?.trim(),
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data?.error || "Error al testear zip job");
                  }
                  setTestMessage(
                    `Job ${data.job?.id} resultó en ${data.job?.status}.`
                  );
                  setTestDownloadUrl(data.job?.zipUrl || null);
                } catch (err: any) {
                  setTestMessage(err?.message || "Error desconocido al testear zip job");
                  setTestDownloadUrl(null);
                } finally {
                  setTestRunning(false);
                }
              }}
              disabled={testRunning}
            >
              {testRunning ? "Procesando..." : "Ejecutar test"}
            </Button>
          </div>
          {testMessage && (
            <p className="text-sm text-blue-800">{testMessage}</p>
          )}
          {testDownloadUrl && (
            <a
              href={testDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline"
            >
              Descargar ZIP generado
            </a>
          )}
        </div>
      </Card>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-600 mt-1">
            Total: {pagination.total} pedidos
          </p>
        </div>
      </div>

      {selectedOrders.size > 0 && (
        <Card className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            {selectedOrders.size} pedido(s) seleccionado(s)
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedOrders(new Set())}>
              Limpiar selección
            </Button>
            <Button variant="secondary" size="sm" onClick={deleteSelected}>
              Eliminar seleccionados
            </Button>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Búsqueda
            </label>
            <Input
              type="text"
              placeholder="ID, nombre, email, teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFilterChange();
              }}
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Álbum
            </label>
            <Input
              type="text"
              placeholder="ID o nombre del álbum"
              value={albumFilter}
              onChange={(e) => setAlbumFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFilterChange();
              }}
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fotógrafo (ID)
            </label>
            <Input
              type="text"
              placeholder="ID del fotógrafo"
              value={photographerFilter}
              onChange={(e) => setPhotographerFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFilterChange();
              }}
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CREATED">Creado</option>
              <option value="IN_PRODUCTION">En Producción</option>
              <option value="READY">Listo</option>
              <option value="READY_TO_PICKUP">Listo para Retirar</option>
              <option value="SHIPPED">Enviado</option>
              <option value="DELIVERED">Entregado</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado de Pago
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="FAILED">Fallido</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="DIGITAL">Digital</option>
              <option value="PRINT">Impresión</option>
              <option value="COMBO">Mixto</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="primary" onClick={handleFilterChange} size="sm">
            Aplicar Filtros
          </Button>
          <Button variant="secondary" onClick={clearFilters} size="sm">
            Limpiar
          </Button>
        </div>
      </Card>

      {/* Tabla de pedidos */}
      <Card className={`p-0 overflow-hidden relative ${loading ? "opacity-70 pointer-events-none" : ""}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
            <span className="text-gray-600 font-medium">Cargando...</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={
                      orders.filter((o) => o.source === "PRINT_ORDER").length > 0 &&
                      selectedOrders.size === orders.filter((o) => o.source === "PRINT_ORDER").length
                    }
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Álbum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fotógrafo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Laboratorio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pago
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="¿El cliente ya abrió el link o descargó? (pedidos digitales)">
                  Descargó
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron pedidos
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => toggleSelectOne(order.id)}
                        disabled={order.source !== "PRINT_ORDER"}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getOrderTypeLabel(order.orderType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {order.album?.title || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {order.photographer?.name || order.photographer?.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">
                          {order.customerName || order.customerEmail || "N/A"}
                        </div>
                        {order.customerEmail && (
                          <div className="text-xs text-gray-500">{order.customerEmail}</div>
                        )}
                        {order.customerPhone && (
                          <div className="text-xs text-gray-500">{order.customerPhone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {order.lab?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.paymentStatus)}`}>
                        {getStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" title={order.source === "ALBUM_ORDER" ? (order.downloadLinkViewedAt ? "El cliente ya abrió el link o descargó" : "Aún no abrió el link") : "—"}>
                      {order.source === "ALBUM_ORDER" ? (
                        order.downloadLinkViewedAt ? (
                          <span className="text-green-600" title="Descargó o abrió el link">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatARS(order.total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                        onClick={() => deleteOrder(order.id, order.source)}
                          className="text-red-600 hover:text-red-700"
                        disabled={false}
                        >
                          Eliminar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                        onClick={() => router.push(`/admin/pedidos/${order.id}?source=${order.source}`)}
                        disabled={false}
                        >
                          Ver
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(pagination.page - 1) * pagination.pageSize + 1} a{" "}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
              >
                Anterior
              </Button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Resumen: suma facturado y fotos vendidas (solo pedidos pagados del filtro) */}
        {summary && (
          <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-gray-600">Total facturado (pedidos pagados):</span>{" "}
                <span className="font-semibold text-gray-900">{formatARS(summary.totalFacturado)}</span>
              </div>
              <div>
                <span className="text-gray-600">Fotos vendidas:</span>{" "}
                <span className="font-semibold text-gray-900">{summary.totalFotosVendidas.toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
