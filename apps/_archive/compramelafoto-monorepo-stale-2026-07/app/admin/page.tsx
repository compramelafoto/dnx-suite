"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getStatusLabel } from "@/lib/admin/helpers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  salesTodayConfirmed?: number;
  salesTodayPending?: number;
  salesTodayFailed?: number;
  salesWeekConfirmed?: number;
  salesWeekPending?: number;
  salesWeekFailed?: number;
  salesMonthConfirmed?: number;
  salesMonthPending?: number;
  salesMonthFailed?: number;
  ordersToday: number;
  ordersPaidToday?: number;
  ordersPaid30d?: number;
  ordersCanceled30d?: number;
  ordersPending30d?: number;
  ordersPrint: number;
  ordersDigital: number;
  ordersAlbum: number;
  labsActive: number;
  labsPending: number;
  photographersActive: number;
  clientsActive: number;
  pendingPayments: number;
  stuckOrders: number;
  failedPayments: number;
  openTickets: number;
  totalPhotosUploaded: number;
  totalPhotosSold: number;
  salesConversionRate: number;
}

interface SalesData {
  date: string;
  amount: number;
}

interface OrdersByStatus {
  status: string;
  count: number;
}

interface OrdersByDay {
  date: string;
  count: number;
}

interface Alert {
  type: string;
  severity: "info" | "warning" | "error";
  message: string;
  count: number;
  link: string;
}

interface RankingItem {
  position: number;
  photographerId: number;
  name: string | null;
  email: string;
  total?: number;
  referralsCount?: number;
}

interface SalesByTypeByDay {
  date: string;
  printCount: number;
  digitalCount: number;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatus[]>([]);
  const [ordersByDay, setOrdersByDay] = useState<OrdersByDay[]>([]);
  const [salesByDay, setSalesByDay] = useState<SalesData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rankingTopBilling, setRankingTopBilling] = useState<RankingItem[]>([]);
  const [rankingTopReferrers, setRankingTopReferrers] = useState<RankingItem[]>([]);
  const [salesByTypeByDay, setSalesByTypeByDay] = useState<SalesByTypeByDay[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fixingRole, setFixingRole] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function fixAdminRole() {
    setFixingRole(true);
    try {
      const res = await fetch("/api/admin/set-admin-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cuart.daniel@gmail.com" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message + "\n\n" + (data.warning || ""));
        // Recargar la página después de 2 segundos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alert("Error: " + (data.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    } finally {
      setFixingRole(false);
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error || res.statusText || `Error ${res.status}`;
        const detail = errorData?.detail;
        if (res.status === 401) {
          setAuthError(message);
          return;
        }
        console.error("Error cargando dashboard:", res.status, message, detail ?? errorData);
        setAuthError(detail ? `${message}: ${detail}` : message);
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setSalesData(data.salesData || []);
      setOrdersByStatus(data.ordersByStatus || []);
      setOrdersByDay(data.ordersByDay || []);
      setSalesByDay(data.salesByDay || []);
      setAlerts(data.alerts || []);
      setRankingTopBilling(data.rankingTopBilling || []);
      setRankingTopReferrers(data.rankingTopReferrers || []);
      setSalesByTypeByDay(data.salesByTypeByDay || []);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
      setAuthError("Error de conexión al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  function formatARS(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando dashboard...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="space-y-6">
        <Card className="p-6 border-l-4 border-red-400">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error de Autenticación</h2>
          <p className="text-gray-700 mb-4">{authError}</p>
          <p className="text-sm text-gray-600 mb-4">
            Si sos el administrador y tu email es <strong>cuart.daniel@gmail.com</strong>, 
            podés hacer clic en el botón de abajo para actualizar tu rol automáticamente.
          </p>
          <Button
            variant="primary"
            onClick={fixAdminRole}
            disabled={fixingRole}
          >
            {fixingRole ? "Actualizando..." : "Actualizar mi rol a ADMIN"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Cards de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-600">Ventas Hoy</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats ? formatARS(stats.salesTodayConfirmed ?? stats.salesToday) : "$0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Confirmadas</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Pendientes: {formatARS(stats?.salesTodayPending ?? 0)}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Con error: {formatARS(stats?.salesTodayFailed ?? 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0 ml-2">
              <span className="text-green-600 text-xl">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-600">Ventas Semana</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats ? formatARS(stats.salesWeekConfirmed ?? stats.salesWeek) : "$0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Confirmadas</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Pendientes: {formatARS(stats?.salesWeekPending ?? 0)}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Con error: {formatARS(stats?.salesWeekFailed ?? 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0 ml-2">
              <span className="text-blue-600 text-xl">📊</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-600">Ventas Mes</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats ? formatARS(stats.salesMonthConfirmed ?? stats.salesMonth) : "$0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Confirmadas</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Pendientes: {formatARS(stats?.salesMonthPending ?? 0)}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Con error: {formatARS(stats?.salesMonthFailed ?? 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center shrink-0 ml-2">
              <span className="text-purple-600 text-xl">📈</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pedidos Hoy</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.ordersToday || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.ordersPaidToday ?? 0} efectivos
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 text-xl">📦</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Pedidos por estado (30 días) */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pedidos por estado (últimos 30 días)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/pedidos?paymentStatus=PAID"
            className="p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors block"
          >
            <p className="text-sm font-medium text-green-800">Pedidos efectivos (pagados)</p>
            <p className="text-2xl font-bold text-green-700 mt-1">
              {stats?.ordersPaid30d ?? 0}
            </p>
            <p className="text-xs text-green-600 mt-1">Pagos acreditados</p>
          </Link>
          <Link
            href="/admin/pedidos?paymentStatus=REFUNDED"
            className="p-4 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors block"
          >
            <p className="text-sm font-medium text-red-800">Cancelados / Reembolsados</p>
            <p className="text-2xl font-bold text-red-700 mt-1">
              {stats?.ordersCanceled30d ?? 0}
            </p>
            <p className="text-xs text-red-600 mt-1">Fallidos o devueltos</p>
          </Link>
          <Link
            href="/admin/pedidos?paymentStatus=PENDING"
            className="p-4 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors block"
          >
            <p className="text-sm font-medium text-amber-800">Pendientes</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {stats?.ordersPending30d ?? 0}
            </p>
            <p className="text-xs text-amber-600 mt-1">Sin finalizar pago</p>
          </Link>
        </div>
      </Card>

      {/* Cards de métricas secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-600">Pedidos Impresión (30d)</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.ordersPrint || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Pedidos Digitales (30d)</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.ordersDigital || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Pedidos Álbum (30d)</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.ordersAlbum || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Laboratorios Activos</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.labsActive || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Fotógrafos Activos</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.photographersActive || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Clientes Activos</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.clientsActive || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Pagos Pendientes (7d)</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.pendingPayments || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Labs Pendientes</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.labsPending || 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-gray-600">Pedidos Trabados</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats?.stuckOrders || 0}
          </p>
        </Card>
      </div>

      {/* Estadísticas de Fotos */}
      {stats && (stats.totalPhotosUploaded !== undefined || stats.totalPhotosSold !== undefined) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Fotos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Fotos Subidas (Total)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalPhotosUploaded?.toLocaleString("es-AR") || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fotos Vendidas (Total)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats.totalPhotosSold?.toLocaleString("es-AR") || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tasa de Conversión</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {stats.salesConversionRate?.toFixed(2) || "0.00"}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalPhotosUploaded > 0 
                  ? `${stats.totalPhotosSold} de ${stats.totalPhotosUploaded} fotos vendidas`
                  : "Sin fotos subidas"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card className="p-6 border-l-4 border-yellow-400">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas</h2>
          <div className="space-y-2">
            {alerts.map((alert, idx) => {
              const borderColor = 
                alert.severity === "error" ? "border-red-400" :
                alert.severity === "warning" ? "border-yellow-400" :
                "border-blue-400";
              const bgColor = 
                alert.severity === "error" ? "bg-red-50" :
                alert.severity === "warning" ? "bg-yellow-50" :
                "bg-blue-50";
              
              return (
                <div key={idx} className={`flex items-center justify-between p-3 ${bgColor} rounded-md border-l-4 ${borderColor}`}>
                  <span className="text-sm text-gray-700">
                    {alert.message}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.href = alert.link}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Rankings últimos 90 días */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top fotógrafos por facturación (últimos 90 días)
          </h2>
          {rankingTopBilling.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fotógrafo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (ARS)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rankingTopBilling.map((r) => (
                    <tr key={r.photographerId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.position}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{r.name || "—"}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatARS(r.total ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top fotógrafos por referidos (últimos 90 días)
          </h2>
          {rankingTopReferrers.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fotógrafo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Referidos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rankingTopReferrers.map((r) => (
                    <tr key={r.photographerId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.position}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{r.name || "—"}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {r.referralsCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Gráfico ventas diarias por tipo */}
      {salesByTypeByDay.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas diarias: impresiones físicas vs fotos digitales (últimos 30 días)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={salesByTypeByDay.map((d) => ({
                  ...d,
                  fecha: new Date(d.date).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                  }),
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => label}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="printCount"
                  name="Impresiones físicas"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: "#2563eb", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="digitalCount"
                  name="Fotos digitales"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: "#059669", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Gráficas y tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos últimos 14 días */}
        {ordersByDay.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pedidos últimos 14 días
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Cantidad
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordersByDay.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(item.date).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Ventas últimos 14 días */}
        {salesByDay.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Ventas últimos 14 días
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto (ARS)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesByDay.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(item.date).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatARS(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Ventas últimos 30 días */}
      {salesData.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas últimos 30 días
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto (ARS)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatARS(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pedidos por estado */}
      {ordersByStatus.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pedidos por estado
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ordersByStatus.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getStatusLabel(item.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
