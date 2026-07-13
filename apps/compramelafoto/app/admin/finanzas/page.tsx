"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatARS, formatDate, getStatusBadgeColor, getStatusLabel } from "@/lib/admin/helpers";

const POLL_INTERVAL_MS = 15000; // Actualizar cada 15 segundos

interface Summary {
  salesTotal: number;
  platformCommission: number;
  labCommission: number;
  photographerCommission: number;
  ordersCount: number;
  netPlatform: number;
}

interface Payment {
  id: number;
  createdAt: string;
  total: number;
  paymentStatus: string;
  mpPaymentId: string | null;
  platformCommission: number | null;
  labCommission: number | null;
  photographerCommission: number | null;
  lab: { id: number; name: string };
  photographer: { id: number; name: string | null; email: string } | null;
}

export default function AdminFinanzasPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "payments">("summary");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (activeTab === "summary") {
        const res = await fetch("/api/admin/finance/summary", {
          credentials: "include",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        }
      } else {
        const res = await fetch("/api/admin/finance/payments?page=1&pageSize=50", {
          credentials: "include",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments || []);
        }
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Actualización en tiempo real: polling cada 15 segundos (silencioso)
  useEffect(() => {
    const interval = setInterval(() => loadData(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  // Refrescar al volver a la pestaña del navegador (silencioso)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadData(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="text-gray-600 mt-1">Control de dinero, comisiones y split. Se actualiza cada 15 segundos.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => loadData(false)}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? "Actualizando..." : "Actualizar ahora"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "summary"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payments"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Pagos MercadoPago
          </button>
        </nav>
      </div>

      {/* Contenido de tabs */}
      {activeTab === "summary" && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600">Ventas Totales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatARS(summary.salesTotal)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Comisión Plataforma</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatARS(summary.platformCommission)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Comisión Laboratorios</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatARS(summary.labCommission)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Comisión Fotógrafos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatARS(summary.photographerCommission)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Pedidos Pagados</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary.ordersCount}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Neto Plataforma</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatARS(summary.netPlatform)}
            </p>
          </Card>
        </div>
      )}

      {activeTab === "payments" && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID Pedido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID MP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Comisiones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron pagos
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        #{payment.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {formatARS(payment.total)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(payment.paymentStatus)}`}>
                          {getStatusLabel(payment.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">
                        {payment.mpPaymentId || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        <div className="text-xs">
                          {payment.platformCommission !== null && (
                            <div>Plataforma: {formatARS(payment.platformCommission)}</div>
                          )}
                          {payment.labCommission !== null && (
                            <div>Lab: {formatARS(payment.labCommission)}</div>
                          )}
                          {payment.photographerCommission !== null && (
                            <div>Fotógrafo: {formatARS(payment.photographerCommission)}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
