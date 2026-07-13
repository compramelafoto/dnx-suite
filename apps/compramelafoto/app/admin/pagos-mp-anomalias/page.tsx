"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type OrderAuditLogRow = {
  id: number;
  createdAt: string;
  targetOrderType: string;
  targetOrderId: number;
  targetAlbumId: number | null;
  eventType: string;
  metadata: Record<string, unknown> | null;
};

const EVENT_LABELS: Record<string, string> = {
  REDEEM_BLOCKED_STALE_PAYMENT: "Canje bloqueado (pago ya no válido en MP)",
  PAYMENT_REVERSED_AFTER_REDEEM: "Pago revertido después del canje",
  MP_RECONCILIATION_ALBUM_PAID_CORRECTED: "Reconciliación: álbum PAID corregido",
  MP_RECONCILIATION_PRECOMPRA_INSPECTED: "Reconciliación: precompra revisada",
  MP_RECONCILIATION_ENTITLEMENT_VOIDED: "Reconciliación: entitlement anulado",
  MP_RECONCILIATION_PRECOMPRA_NO_MP_PAYMENT: "Precompra PAID_HELD sin pago MP (ventana)",
  MP_RECONCILIATION_ALBUM_FAILED_RECOVERED: "Reconciliación: pedido FAILED recuperado (MP approved)",
};

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return s;
  }
}

function metadataPreview(m: Record<string, unknown> | null): string {
  if (!m || typeof m !== "object") return "—";
  const msg = m.message;
  if (typeof msg === "string" && msg.length > 0) return msg;
  try {
    const s = JSON.stringify(m);
    return s.length > 220 ? `${s.slice(0, 217)}…` : s;
  } catch {
    return "—";
  }
}

export default function AdminPagosMpAnomaliasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<OrderAuditLogRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payment-anomalies?limit=100", {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Pagos Mercado Pago / anomalías
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Eventos recientes: canjes bloqueados, reversiones post-canje, reconciliación y
            desalineaciones de precompra/entitlements. La trazabilidad completa sigue en{" "}
            <a href="/admin/antifraude" className="text-blue-600 underline">
              Antifraude
            </a>
            .
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => load()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <p className="p-6 text-gray-600">Cargando…</p>
        ) : error ? (
          <p className="p-6 text-red-600">{error}</p>
        ) : logs.length === 0 ? (
          <p className="p-6 text-gray-600">
            No hay eventos en las últimas entradas filtradas. Si el sistema está estable, es
            normal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Evento</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Tipo / ID</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Álbum</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-800">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-gray-800">
                      <span className="font-medium">
                        {EVENT_LABELS[row.eventType] || row.eventType}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {row.targetOrderType} #{row.targetOrderId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {row.targetAlbumId ?? "—"}
                    </td>
                    <td className="max-w-md px-4 py-3 text-gray-600">
                      {metadataPreview(row.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
