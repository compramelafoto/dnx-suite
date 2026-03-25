"use client";

import { useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "CREATED", label: "Creado" },
  { value: "IN_PRODUCTION", label: "En producción" },
  { value: "READY_TO_PICKUP", label: "Listo para retirar" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "RETIRED", label: "Retirado" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "CANCELED", label: "Cancelado" },
];
const STATUS_LABEL: Record<string, string> = {
  CREATED: "Creado",
  IN_PRODUCTION: "En producción",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "Enviado",
  RETIRED: "Retirado",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
};


export type OrderRow = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  photographerId: number | null;
  photographerName: string | null;
  photographerAddress: string | null;
  pickupBy: string;
  labAddress: string | null;
  labName: string | null;
  createdAtText: string;
  statusUpdatedAtText: string;
  itemsCount: number;
  currency: string;
  total: number;
  status: string;
  paymentStatus?: string | null;
  /** LAB_LANDING = cliente compró desde landing del lab; PHOTOGRAPHER_DEFAULT_LAB = pedido del fotógrafo */
  origin?: "LAB_LANDING" | "PHOTOGRAPHER_DEFAULT_LAB";
};

const ORIGIN_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "LAB_LANDING", label: "Público (Landing)" },
  { value: "PHOTOGRAPHER_DEFAULT_LAB", label: "Profesional (Fotógrafo)" },
];
const ORIGIN_LABEL: Record<string, string> = {
  LAB_LANDING: "Landing",
  PHOTOGRAPHER_DEFAULT_LAB: "Fotógrafo",
};

function generateWhatsAppLink(order: OrderRow): string {
  const customerName = order.customerName || "Cliente";
  let pickupAddress = "";
  
  if (order.pickupBy === "CLIENT") {
    pickupAddress = order.labAddress || "el laboratorio";
  } else if (order.pickupBy === "PHOTOGRAPHER") {
    pickupAddress = order.photographerAddress || "el fotógrafo";
  }
  
  const message = `${customerName}, buenos días! Tu pedido #${order.id} ya está listo! Podés retirarlo en ${pickupAddress}.`;
  const phone = order.customerPhone?.replace(/\D/g, "") || "";
  
  // WhatsApp Web link
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}



export default function OrdersTable({
  orders,
  showOrigin = false,
}: {
  orders: OrderRow[];
  showOrigin?: boolean;
}) {
  // ✅ filtros client-side (sin recargar)
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [originFilter, setOriginFilter] = useState<string>("ALL");
  const [q, setQ] = useState<string>("");

  // ✅ selección para acciones masivas
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState("IN_PRODUCTION");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orders.filter((o) => {
      const okStatus = statusFilter === "ALL" ? true : o.status === statusFilter;
      const okOrigin =
        !showOrigin || originFilter === "ALL" || o.origin === originFilter;

      if (!qq) return okStatus && okOrigin;

      const haystack = [
        o.customerName || "",
        o.customerEmail || "",
        o.customerPhone || "",
        o.createdAtText || "",
        o.status || "",
        String(o.total ?? ""),
        o.currency || "",
        String(o.itemsCount ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      const okQ = haystack.includes(qq);

      return okStatus && okOrigin && okQ;
    });
  }, [orders, statusFilter, originFilter, q, showOrigin]);

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selected]
  );

  function toggleAllVisible(checked: boolean) {
    const next = { ...selected };
    for (const o of filtered) next[o.id] = checked;
    setSelected(next);
  }

  function handleClearFilters() {
    setQ("");
    setStatusFilter("ALL");
    setOriginFilter("ALL");
    setSelected({});
  }

  async function applyBulkStatus() {
    if (selectedIds.length === 0) {
      alert("No seleccionaste pedidos.");
      return;
    }

    try {
      setBusy(true);
      const res = await fetch("/api/print-orders/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
       window.location.reload();

      // ✅ actualizamos la UI sin reload: marcamos localmente el estado
      // (simple y útil para no recargar)
      // Nota: como orders viene del server, este “cambio local” se pierde al refrescar,
      // pero para la operación diaria alcanza.
      // Si querés persistencia visual perfecta, lo hacemos con fetch de la lista.
      
    } catch (e) {
      console.error(e);
      console.error("No se pudo aplicar el estado masivo", e);

    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Barra filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#444" }}>Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 6 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {showOrigin && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#444" }}>Origen:</span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 6 }}
            >
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#444" }}>Buscar:</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, Email, Whatsapp.."
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              width: 260,
              maxWidth: "70vw",
            }}
          />
         <button
  type="button"
  onClick={() => {
    handleClearFilters();
  }}
  style={{
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "white",
    cursor: "pointer",
  }}
>
  Limpiar
</button>

        </div>

        <div style={{ marginLeft: "auto", fontSize: 13, color: "#444" }}>
          Mostrando: <strong>{filtered.length}</strong> / {orders.length}
        </div>
      </div>

      {/* Barra acciones masivas */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#444" }}>
          Seleccionados: <strong>{selectedIds.length}</strong>
        </div>

        <select
          value={bulkStatus}
          disabled={busy}
          onChange={(e) => setBulkStatus(e.target.value)}
          style={{ padding: "6px 8px", borderRadius: 6 }}
        >
          {STATUS_OPTIONS.filter((x) => x.value !== "ALL").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={applyBulkStatus}
          disabled={busy}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          Aplicar a seleccionados
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>
                <input
                  type="checkbox"
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                  aria-label="Seleccionar todos visibles"
                />
              </th>
              <th style={th}>ID</th>
              {showOrigin && <th style={th}>Origen</th>}
              <th style={th}>Cliente</th>
              <th style={th}>Email</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>Fotógrafo</th>
              <th style={th}>Retira</th>
              <th style={th}>Fecha</th>
              <th style={th}>Últ. cambio</th>
              <th style={th}>Items</th>
              <th style={th}>Total</th>
              <th style={th}>Estado</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={!!selected[o.id]}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [o.id]: e.target.checked }))}
                    aria-label={`Seleccionar pedido ${o.id}`}
                  />
                </td>
                <td style={td}>#{o.id}</td>
                {showOrigin && (
                  <td style={td}>
                    {o.origin ? ORIGIN_LABEL[o.origin] || o.origin : "-"}
                  </td>
                )}
                <td style={td}>{o.customerName || "-"}</td>
                <td style={td}>{o.customerEmail || "-"}</td>
                <td style={td}>{o.customerPhone || "-"}</td>
                <td style={td}>
                  {o.photographerName ? (
                    <span title={`ID: ${o.photographerId}`}>{o.photographerName}</span>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={td}>
                  {o.pickupBy === "PHOTOGRAPHER" ? (
                    <span style={{ color: "#c27b3d", fontWeight: "500" }}>Fotógrafo</span>
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
                <td style={td}>{STATUS_LABEL[o.status] || o.status}</td>

                <td style={td}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(o.status === "READY" || o.status === "READY_TO_PICKUP") && o.customerPhone && (
                      <a
                        href={generateWhatsAppLink(o)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          ...btn,
                          backgroundColor: "#25D366",
                          color: "white",
                          borderColor: "#25D366",
                        }}
                        title="Abrir WhatsApp Web"
                      >
                        📱 WhatsApp
                      </a>
                    )}
                    {o.paymentStatus === "PAID" ? (
                      <a
                        href={`/api/print-orders/${o.id}/export`}
                        target="_blank"
                        rel="noreferrer"
                        style={btn}
                      >
                        Descargar ZIP
                      </a>
                    ) : (
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>Pago pendiente</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={showOrigin ? 14 : 13}>
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
};

const btn: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 10px",
  border: "1px solid #111",
  borderRadius: 8,
  textDecoration: "none",
};
