"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type OrderAuditLog = {
  id: number;
  createdAt: string;
  actorUserId: number | null;
  actorRole: string | null;
  targetOrderType: string;
  targetOrderId: number;
  targetAlbumId: number | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  riskScoreSnapshot: number | null;
};

type FraudAlert = {
  id: number;
  createdAt: string;
  resolvedAt: string | null;
  userId: number | null;
  labId: number | null;
  ruleCode: string;
  severity: string;
  riskScore: number | null;
  metadata: Record<string, unknown> | null;
  status: string;
  user?: { id: number; email: string; name: string | null } | null;
  lab?: { id: number; name: string } | null;
};

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Pedido creado",
  ORDER_UPDATED: "Pedido actualizado",
  PAYMENT_INITIATED: "Pago iniciado",
  PAYMENT_PENDING: "Pago pendiente",
  PAYMENT_APPROVED: "Pago aprobado",
  PAYMENT_REJECTED: "Pago rechazado",
  PAYMENT_EXPIRED: "Pago expirado",
  CUSTOMER_DATA_RELEASED: "Datos cliente liberados",
  ORDER_ITEMS_RELEASED: "Items liberados",
  ORDER_SENT_TO_LAB: "Enviado a laboratorio",
  ORDER_VIEWED_PHOTOGRAPHER: "Visto por fotógrafo",
  ORDER_VIEWED_LAB: "Visto por laboratorio",
  ADMIN_OVERRIDE: "Override admin",
  ACCOUNT_RESTRICTED: "Cuenta restringida",
  FRAUD_ALERT_CREATED: "Alerta de fraude",
};

const RULE_LABELS: Record<string, string> = {
  PENDING_ORDERS_HIGH: "Muchos pedidos pendientes",
  VIEWS_NON_PAID: "Visualizaciones de no pagados",
  CONVERSION_TRUNCATED: "Conversiones truncas",
  MANUAL_CANCELS_HIGH: "Muchas cancelaciones manuales",
  BEHAVIOR_DEVIATION: "Desviación de comportamiento",
  OFF_HOURS_ACCESS: "Accesos fuera de horario",
  PRICE_CHANGE_NEAR_PURCHASE: "Cambio de precio cerca de compra",
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

export default function AdminAntifraudePage() {
  const [tab, setTab] = useState<"audit" | "alerts">("audit");
  const [auditLogs, setAuditLogs] = useState<OrderAuditLog[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [filterEventType, setFilterEventType] = useState("");
  const [filterOrderType, setFilterOrderType] = useState("");
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterAlertStatus, setFilterAlertStatus] = useState("OPEN");

  useEffect(() => {
    if (tab === "audit") loadAudit();
    else loadAlerts();
  }, [tab, auditPage, alertsPage, filterEventType, filterOrderType, filterOrderId, filterAlertStatus]);

  async function loadAudit() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(auditPage));
      params.set("pageSize", "30");
      if (filterEventType) params.set("eventType", filterEventType);
      if (filterOrderType) params.set("targetOrderType", filterOrderType);
      if (filterOrderId) params.set("targetOrderId", filterOrderId);

      const res = await fetch(`/api/admin/order-audit?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando auditoría");
      const data = await res.json();
      setAuditLogs(data.logs || []);
      setAuditTotal(data.pagination?.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAlerts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(alertsPage));
      params.set("pageSize", "30");
      if (filterAlertStatus && filterAlertStatus !== "ALL") params.set("status", filterAlertStatus);

      const res = await fetch(`/api/admin/fraud-alerts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando alertas");
      const data = await res.json();
      setAlerts(data.alerts || []);
      setAlertsTotal(data.pagination?.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Antifraude</h1>
        <p className="text-gray-600 mt-1">
          Auditoría de pedidos, liberación de datos y alertas de riesgo
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "audit"
              ? "border-[#c27b3d] text-[#c27b3d]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Auditoría de pedidos
        </button>
        <button
          type="button"
          onClick={() => setTab("alerts")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "alerts"
              ? "border-[#c27b3d] text-[#c27b3d]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Alertas de fraude
        </button>
      </div>

      {tab === "audit" && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">OrderAuditLog</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo evento</label>
              <Input
                type="text"
                placeholder="Ej: PAYMENT_APPROVED"
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo pedido</label>
              <select
                value={filterOrderType}
                onChange={(e) => setFilterOrderType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Todos</option>
                <option value="PRINT_ORDER">PrintOrder</option>
                <option value="ALBUM_ORDER">AlbumOrder</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ID Pedido</label>
              <Input
                type="text"
                placeholder="Ej: 123"
                value={filterOrderId}
                onChange={(e) => setFilterOrderId(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 py-8 text-center">Cargando...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Evento</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Pedido</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actor</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">IP</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No hay registros
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-600">{formatDate(log.createdAt)}</td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {EVENT_LABELS[log.eventType] || log.eventType}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {log.targetOrderType} #{log.targetOrderId}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {log.actorUserId ? `User ${log.actorUserId}` : "Sistema"}
                            {log.actorRole && ` (${log.actorRole})`}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">{log.ipAddress || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {auditTotal > 30 && (
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total: {auditTotal}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAuditPage((p) => p + 1)}
                      disabled={auditLogs.length < 30}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {tab === "alerts" && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Alertas de fraude</h2>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={filterAlertStatus}
              onChange={(e) => setFilterAlertStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="ALL">Todos</option>
              <option value="OPEN">Abiertas</option>
              <option value="ACKNOWLEDGED">Reconocidas</option>
              <option value="RESOLVED">Resueltas</option>
              <option value="FALSE_POSITIVE">Falso positivo</option>
            </select>
          </div>

          {loading ? (
            <p className="text-gray-500 py-8 text-center">Cargando...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Regla</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Severidad</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Riesgo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Usuario / Lab</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No hay alertas
                        </td>
                      </tr>
                    ) : (
                      alerts.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-600">{formatDate(a.createdAt)}</td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {RULE_LABELS[a.ruleCode] || a.ruleCode}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                a.severity === "CRITICAL"
                                  ? "bg-red-100 text-red-800"
                                  : a.severity === "WARNING"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {a.severity}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">{a.riskScore ?? "-"}</td>
                          <td className="px-4 py-2 text-sm">
                            {a.user ? `${a.user.email} (${a.user.name || "—"})` : a.lab ? a.lab.name : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">{a.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {alertsTotal > 30 && (
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total: {alertsTotal}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAlertsPage((p) => Math.max(1, p - 1))}
                      disabled={alertsPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAlertsPage((p) => p + 1)}
                      disabled={alerts.length < 30}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
