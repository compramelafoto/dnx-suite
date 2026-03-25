"use client";

import { useMemo, useState } from "react";

const TYPE_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PRINT", label: "Impresión" },
  { value: "DIGITAL", label: "Digital" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendiente de pago" },
  { value: "PAID", label: "Pagado" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "CREATED", label: "Creado" },
  { value: "IN_PRODUCTION", label: "En producción" },
  { value: "READY", label: "Listo" },
  { value: "READY_TO_PICKUP", label: "Listo para retirar" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "RETIRED", label: "Retirado" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "CANCELED", label: "Cancelado" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de pago",
  CREATED: "Creado",
  IN_PRODUCTION: "En producción",
  READY: "Listo",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "Enviado",
  RETIRED: "Retirado",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reintegrado",
};

const ALLOWED_STATUSES = ["CREATED", "IN_PRODUCTION", "READY", "READY_TO_PICKUP", "SHIPPED", "RETIRED", "DELIVERED", "CANCELED"];

type OrderRow = {
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
  paymentStatus?: string | null;
  orderType?: string;
  source?: "PRINT_ORDER" | "ALBUM_ORDER";
  hasPrintItems?: boolean;
  downloadLinkViewedAt?: string | null;
  _dataProtected?: boolean;
};

function isOrderPaid(o: OrderRow): boolean {
  if (o.source === "PRINT_ORDER") return o.paymentStatus === "PAID";
  if (o.source === "ALBUM_ORDER") return o.status === "PAID";
  return false;
}

/** Pedidos con datos protegidos no permiten descarga ni cambio de estado hasta el pago */
function isDataProtected(o: OrderRow): boolean {
  return Boolean(o._dataProtected);
}

type PhotographerOrdersTableProps = {
  orders: OrderRow[];
  photographerId: number;
};

export default function PhotographerOrdersTable({ orders, photographerId }: PhotographerOrdersTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [q, setQ] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState<Record<number, boolean>>({});
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orders.filter((o) => {
      const okType = typeFilter === "ALL" ? true : (o.orderType || "") === typeFilter;
      const okStatus = statusFilter === "ALL" ? true : o.status === statusFilter;

      if (!qq) return okType && okStatus;

      const haystack = [
        o.customerName || "",
        o.customerEmail || "",
        o.customerPhone || "",
        o.createdAtText || "",
        o.status || "",
        String(o.total ?? ""),
        o.currency || "",
        String(o.itemsCount ?? ""),
        o.labName || "",
        o.orderType || "",
      ]
        .join(" ")
        .toLowerCase();

      const okQ = haystack.includes(qq);

      return okType && okStatus && okQ;
    });
  }, [orders, typeFilter, statusFilter, q]);

  async function handleStatusChange(orderId: number, newStatus: string) {
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
        alert(`Error: ${error.error || "No se pudo actualizar el estado"}`);
        return;
      }

      // Recargar la página para reflejar el cambio
      window.location.reload();
    } catch (err: any) {
      console.error("Error actualizando estado:", err);
      alert(`Error: ${err?.message || "No se pudo actualizar el estado"}`);
    } finally {
      setUpdatingStatus((prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      }));
    }
  }

  return (
    <div>
      {/* Barra filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 p-3 border border-[#eee] rounded-[10px]">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <span className="text-xs sm:text-sm text-[#444]">Tipo:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#ddd] text-sm bg-white"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <span className="text-xs sm:text-sm text-[#444]">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#ddd] text-sm bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
          <span className="text-xs sm:text-sm text-[#444]">Buscar:</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, Email, Laboratorio..."
            className="px-3 py-2 rounded-md border border-[#ccc] text-sm w-full sm:w-[260px]"
          />
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTypeFilter("ALL");
              setStatusFilter("ALL");
            }}
            className="px-3 py-2 rounded-md border border-[#111] bg-white text-sm"
          >
            Limpiar
          </button>
        </div>

        <div className="text-xs sm:text-sm text-[#444] sm:ml-auto">
          Mostrando: <strong>{filtered.length}</strong> / {orders.length}
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full border-collapse min-w-[900px] sm:min-w-0">
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Tipo</th>
              <th style={th}>Cliente</th>
              <th style={th}>Email</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>Laboratorio</th>
              <th style={th}>Retira</th>
              <th style={th}>Fecha</th>
              <th style={th}>Últ. cambio</th>
              <th style={th}>Items</th>
              <th style={th}>Total</th>
              <th style={th}>Estado</th>
              <th style={th} title="¿El cliente ya abrió el link o descargó?">Descargó</th>
              <th style={th}>Carpeta / Descarga</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td style={td}>#{o.id}</td>
                <td style={td}>
                  {o.orderType === "DIGITAL" ? "Digital" : "Impresión"}
                </td>
                <td style={td}>{o.customerName || "-"}</td>
                <td style={td}>{o.customerEmail || "-"}</td>
                <td style={td}>{o.customerPhone || "-"}</td>
                <td style={td}>{o.labName}</td>
                <td style={td}>
                  {o.pickupBy === "PHOTOGRAPHER" ? (
                    <span style={{ color: "#c27b3d", fontWeight: "500" }}>Fotógrafo</span>
                  ) : o.pickupBy === "DIGITAL" ? (
                    <span style={{ color: "#6b7280" }}>Digital</span>
                  ) : (
                    <span style={{ color: "#6b7280" }}>Cliente</span>
                  )}
                </td>
                <td style={td}>{o.createdAtText}</td>
                <td style={td}>{o.statusUpdatedAtText}</td>
                <td style={td}>{o.itemsCount}</td>
                <td style={td}>
                  {o.currency} {o.total}
                </td>
                <td style={td}>
                  <span>
                    {o.paymentStatus === "REFUNDED" || o.status === "REFUNDED"
                      ? "Reembolsado"
                      : STATUS_LABEL[o.status] || o.status}
                  </span>
                  {o._dataProtected && (
                    <span
                      title="Los datos del cliente y la selección de fotos se liberan cuando el pago esté acreditado"
                      style={{
                        display: "inline-block",
                        marginLeft: 6,
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      Protegido
                    </span>
                  )}
                </td>
                <td style={td} title={o.source === "ALBUM_ORDER" ? (o.downloadLinkViewedAt ? "El cliente ya abrió el link o descargó" : "Aún no abrió el link") : "—"}>
                  {o.source === "ALBUM_ORDER" ? (
                    o.downloadLinkViewedAt ? (
                      <span style={{ color: "#10b981" }} title="Descargó o abrió el link">✓</span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>—</span>
                    )
                  ) : (
                    <span style={{ color: "#9ca3af" }}>—</span>
                  )}
                </td>
                <td style={td}>
                  {!isOrderPaid(o) ? (
                    <span style={{ color: "#9ca3af", fontSize: 12 }}>Pago pendiente</span>
                  ) : o.source === "PRINT_ORDER" ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={downloading[o.id]}
                        onClick={async () => {
                          setDownloading((prev) => ({ ...prev, [o.id]: true }));
                          try {
                            const res = await fetch(`/api/fotografo/pedidos/${o.id}/download`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderType: "PRINT" }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              throw new Error(data?.error || "No se pudo generar la descarga");
                            }
                            if (data?.downloadUrl) {
                              window.open(data.downloadUrl, "_blank");
                            } else {
                              alert("No se pudo obtener el link de descarga.");
                            }
                          } catch (err: any) {
                            console.error("Error generando descarga:", err);
                            alert(err?.message || "Error generando descarga");
                          } finally {
                            setDownloading((prev) => {
                              const next = { ...prev };
                              delete next[o.id];
                              return next;
                            });
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #10b981",
                          background: downloading[o.id] ? "#ecfdf5" : "#10b981",
                          color: downloading[o.id] ? "#10b981" : "#ffffff",
                          cursor: downloading[o.id] ? "not-allowed" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        {downloading[o.id] ? "..." : "Carpeta impresión"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/print-orders/${o.id}/export`;
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopiedLinkId(o.id);
                            setTimeout(() => setCopiedLinkId(null), 2000);
                          } catch (e) {
                            alert("No se pudo copiar el link");
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #6366f1",
                          background: copiedLinkId === o.id ? "#e0e7ff" : "#6366f1",
                          color: copiedLinkId === o.id ? "#4338ca" : "#ffffff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {copiedLinkId === o.id ? "Copiado" : "Copiar link"}
                      </button>
                    </div>
                  ) : o.source === "ALBUM_ORDER" && o.hasPrintItems ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={downloading[o.id]}
                        onClick={() => {
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/fotografo/pedidos/${o.id}/export-print`;
                          window.open(url, "_blank");
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #10b981",
                          background: "#10b981",
                          color: "#ffffff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Carpeta impresión
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/fotografo/pedidos/${o.id}/export-print`;
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopiedLinkId(o.id);
                            setTimeout(() => setCopiedLinkId(null), 2000);
                          } catch (e) {
                            alert("No se pudo copiar el link");
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #6366f1",
                          background: copiedLinkId === o.id ? "#e0e7ff" : "#6366f1",
                          color: copiedLinkId === o.id ? "#4338ca" : "#ffffff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {copiedLinkId === o.id ? "Copiado" : "Copiar link carpeta"}
                      </button>
                      <button
                        type="button"
                        disabled={downloading[o.id]}
                        onClick={async () => {
                          setDownloading((prev) => ({ ...prev, [o.id]: true }));
                          try {
                            const res = await fetch(`/api/fotografo/pedidos/${o.id}/download`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderType: "DIGITAL" }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              throw new Error(data?.error || "No se pudo generar la descarga");
                            }
                            if (data?.downloadUrl) {
                              window.open(data.downloadUrl, "_blank");
                            } else {
                              alert("No se pudo obtener el link de descarga.");
                            }
                          } catch (err: any) {
                            console.error("Error generando descarga:", err);
                            alert(err?.message || "Error generando descarga");
                          } finally {
                            setDownloading((prev) => {
                              const next = { ...prev };
                              delete next[o.id];
                              return next;
                            });
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #6366f1",
                          background: downloading[o.id] ? "#e0e7ff" : "#6366f1",
                          color: downloading[o.id] ? "#4338ca" : "#ffffff",
                          cursor: downloading[o.id] ? "not-allowed" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        {downloading[o.id] ? "Generando..." : "Descargas digitales"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={downloading[o.id]}
                      onClick={async () => {
                        setDownloading((prev) => ({ ...prev, [o.id]: true }));
                        try {
                          const res = await fetch(`/api/fotografo/pedidos/${o.id}/download`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderType: o.orderType }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            throw new Error(data?.error || "No se pudo generar la descarga");
                          }
                          if (data?.downloadUrl) {
                            window.open(data.downloadUrl, "_blank");
                          } else {
                            alert("No se pudo obtener el link de descarga.");
                          }
                        } catch (err: any) {
                          console.error("Error generando descarga:", err);
                          alert(err?.message || "Error generando descarga");
                        } finally {
                          setDownloading((prev) => {
                            const next = { ...prev };
                            delete next[o.id];
                            return next;
                          });
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #10b981",
                        background: downloading[o.id] ? "#ecfdf5" : "#10b981",
                        color: downloading[o.id] ? "#10b981" : "#ffffff",
                        cursor: downloading[o.id] ? "not-allowed" : "pointer",
                        fontSize: 12,
                      }}
                    >
                      {downloading[o.id] ? "Generando..." : "Descargar"}
                    </button>
                  )}
                </td>
                <td style={td}>
                  {o.source === "PRINT_ORDER" && o.pickupBy === "PHOTOGRAPHER" ? (
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      disabled={updatingStatus[o.id]}
                      title="Sos el encargado de la entrega: podés actualizar el estado del pedido"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #c27b3d",
                        background: "#fff",
                        fontSize: 13,
                        cursor: updatingStatus[o.id] ? "not-allowed" : "pointer",
                        opacity: updatingStatus[o.id] ? 0.6 : 1,
                      }}
                    >
                      {ALLOWED_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s] || s}
                        </option>
                      ))}
                    </select>
                  ) : o.source === "PRINT_ORDER" ? (
                    <span style={{ color: "#9ca3af", fontSize: 12 }} title="Solo el fotógrafo puede cambiar el estado cuando retira él">
                      Retira cliente/lab
                    </span>
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: 12 }}>
                      Solo lectura
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={14}>
                  No hay pedidos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "10px 8px",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "10px 8px",
  verticalAlign: "top",
  fontSize: 14,
};
