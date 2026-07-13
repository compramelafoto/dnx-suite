"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { getStatusLabel } from "@/lib/admin/helpers";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  activePhotosInDb?: number;
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

interface SalesDailyAvgMonthRow {
  monthKey: string;
  monthLabel: string;
  daysInMonth: number;
  calendarDaysInMonth?: number;
  isCurrentMonth?: boolean;
  digitalDailyAvg: number;
  printDailyAvg: number;
  totalDailyAvg: number;
}

interface SalesPeakHoursStudy {
  periodDays: number;
  rangeStartLabel: string;
  rangeEndLabel: string;
  totalOrders: number;
  totalRevenue: number;
  byDayOfWeek: Array<{
    dayIndex: number;
    label: string;
    orderCount: number;
    revenue: number;
  }>;
  byHour: Array<{
    hour: number;
    label: string;
    orderCount: number;
    revenue: number;
  }>;
  peakDay: { label: string; orderCount: number; revenue: number };
  quietDay: { label: string; orderCount: number; revenue: number };
  peakHour: { label: string; hour: number; orderCount: number; revenue: number };
  quietHour: { label: string; hour: number; orderCount: number; revenue: number };
}

interface Alert {
  id?: string;
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
  printAmount: number;
  digitalAmount: number;
  totalAmount: number;
}

interface PhotographerFirstAlbumOnboardingRow {
  photographerId: number;
  name: string | null;
  email: string;
  firstAlbumId: number;
  firstAlbumTitle: string;
  firstAlbumUploadedAt: string;
  albumCount: number;
  hasSaleThisWeek: boolean;
  salesThisWeekAmount: number;
}

interface AlbumWeeklyEffectivenessRow {
  weekStart: string;
  weekLabel: string;
  albumsSelling: number;
  albumsNotSelling: number;
  albumsWithPhotos: number;
}

interface PhotographerSalesRankingRow {
  rank: number;
  photographerId: number;
  name: string | null;
  email: string;
  totalAmount: number;
}

interface PhotographerWeeklySalesRow {
  weekStart: string;
  weekLabel: string;
  albumAmount: number;
  printAmount: number;
  totalAmount: number;
}

interface AlbumUploadDelaySalesStudy {
  monthsBack: number;
  albumsAnalyzed: number;
  albumsWithSales: number;
  avgDelayDaysAll: number;
  avgDelayDaysWithSales: number;
  fastUploadAvgSales: number;
  slowUploadAvgSales: number;
  salesLiftFastVsSlowPercent: number | null;
  correlationDelaySales: number | null;
  buckets: Array<{
    bucketKey: string;
    bucketLabel: string;
    albumCount: number;
    albumsWithSales: number;
    totalSalesArs: number;
    avgSalesPerAlbum: number;
    avgDelayDays: number;
  }>;
  topAlbumsBySales: Array<{
    albumId: number;
    title: string;
    eventDate: string;
    firstUploadAt: string;
    uploadDelayDays: number;
    salesArs: number;
    ordersCount: number;
  }>;
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
  const [funnelDaily, setFunnelDaily] = useState<
    Array<{
      id: string;
      occurredAt: string;
      event: string;
      albumId: number | null;
      albumTitle: string | null;
      photographerName: string | null;
      userName: string | null;
    }>
  >([]);
  const [funnelTodayByEvent, setFunnelTodayByEvent] = useState<
    Record<string, { visits: number; visitors: number }>
  >({});
  const [albumWeeklyEffectiveness, setAlbumWeeklyEffectiveness] = useState<
    AlbumWeeklyEffectivenessRow[]
  >([]);
  const [photographerSalesRanking, setPhotographerSalesRanking] = useState<
    PhotographerSalesRankingRow[]
  >([]);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<number | null>(null);
  const [photographerWeeklySales, setPhotographerWeeklySales] = useState<
    PhotographerWeeklySalesRow[]
  >([]);
  const [weeklySalesLoading, setWeeklySalesLoading] = useState(false);
  const [salesDailyAvgByMonth, setSalesDailyAvgByMonth] = useState<SalesDailyAvgMonthRow[]>([]);
  const [salesPeakHoursStudy, setSalesPeakHoursStudy] = useState<SalesPeakHoursStudy | null>(null);
  const [albumUploadDelaySales, setAlbumUploadDelaySales] =
    useState<AlbumUploadDelaySalesStudy | null>(null);
  const [photographerFirstAlbumOnboarding, setPhotographerFirstAlbumOnboarding] = useState<
    PhotographerFirstAlbumOnboardingRow[]
  >([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fixingRole, setFixingRole] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!selectedPhotographerId) {
      setPhotographerWeeklySales([]);
      return;
    }

    let cancelled = false;
    async function loadWeeklySales() {
      setWeeklySalesLoading(true);
      try {
        const res = await fetch(
          `/api/admin/photographer-weekly-sales?photographerId=${selectedPhotographerId}`,
          { credentials: "include" }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setPhotographerWeeklySales(data.weeklySales || []);
        }
      } catch (err) {
        console.error("Error cargando ventas semanales del fotógrafo:", err);
        if (!cancelled) setPhotographerWeeklySales([]);
      } finally {
        if (!cancelled) setWeeklySalesLoading(false);
      }
    }

    void loadWeeklySales();
    return () => {
      cancelled = true;
    };
  }, [selectedPhotographerId]);

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
      setSalesDailyAvgByMonth(data.salesDailyAvgByMonth || []);
      setSalesPeakHoursStudy(data.salesPeakHoursStudy ?? null);
      setFunnelDaily(data.funnelDaily || []);
      setFunnelTodayByEvent(data.funnelTodayByEvent || {});
      setAlbumWeeklyEffectiveness(data.albumWeeklyEffectiveness || []);
      setAlbumUploadDelaySales(data.albumUploadDelaySales ?? null);
      setPhotographerFirstAlbumOnboarding(data.photographerFirstAlbumOnboarding || []);
      const ranking: PhotographerSalesRankingRow[] = data.photographerSalesRanking || [];
      setPhotographerSalesRanking(ranking);
      if (ranking.length > 0) {
        setSelectedPhotographerId((prev) => prev ?? ranking[0].photographerId);
      }
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

  function tooltipNumericValue(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  function formatFunnelDateTime(iso: string): string {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "short",
        timeStyle: "medium",
      });
    } catch {
      return iso;
    }
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

      <Card className="p-6" id="funnel-compra">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Funnel compra álbum (hoy, Argentina)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Conteo de vistas y visitantes distintos (cookie httpOnly anónima). Incluye usuarios no logueados.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {[
            "ORDER_CONFIG_VIEW",
            "ORDER_FINAL_VIEW",
            "ORDER_CREATED",
            "PAYMENT_START",
            "PAYMENT_SUCCESS",
          ].map((ev) => {
            const row = funnelTodayByEvent[ev];
            return (
              <div key={ev} className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="font-mono text-xs text-gray-500 break-all">{ev}</p>
                <p className="text-lg font-semibold mt-1">{row?.visits ?? 0} vistas</p>
                <p className="text-gray-600">{row?.visitors ?? 0} visitantes distintos</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Efectividad de álbumes (semanal, últimos 90 días)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Álbumes con al menos una foto publicada en cada semana (Argentina).{" "}
          <span className="text-green-700 font-medium">Con ventas</span>: al menos un pago confirmado
          (`PAYMENT_SUCCESS` o pedido PAID).{" "}
          <span className="text-slate-600 font-medium">Sin ventas</span>: tenían fotos pero no
          vendieron en esa semana.
        </p>
        {albumWeeklyEffectiveness.length === 0 ? (
          <p className="text-sm text-gray-500">Sin datos suficientes para el gráfico.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={albumWeeklyEffectiveness}
                margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [tooltipNumericValue(value), String(name ?? "")]}
                  labelFormatter={(label) => `Semana ${label}`}
                />
                <Legend />
                <Bar
                  dataKey="albumsSelling"
                  name="Con ventas"
                  fill="#16a34a"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="albumsNotSelling"
                  name="Sin ventas"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Fotógrafos que arrancan (primer álbum con fotos)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Fotógrafos cuya <strong>primera carga de fotos</strong> en un álbum fue en los últimos 90
          días. Útil para seguimiento de onboarding. La columna{" "}
          <span className="text-green-700 font-medium">Venta esta semana</span> indica si tuvieron
          al menos un pedido PAID (álbum o impresión) en la semana calendario actual (Argentina).
        </p>
        {photographerFirstAlbumOnboarding.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ningún fotógrafo subió su primer álbum con fotos en los últimos 90 días.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fotógrafo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Primer álbum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Primera carga
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Álbumes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Venta esta semana
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {photographerFirstAlbumOnboarding.map((row) => (
                  <tr key={row.photographerId}>
                    <td className="px-4 py-3 text-gray-900">
                      <Link
                        href={`/admin/usuarios/${row.photographerId}`}
                        className="font-medium text-[#c27b3d] hover:underline"
                      >
                        {row.name?.trim() || "Sin nombre"}
                      </Link>
                      <div className="text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{row.firstAlbumTitle}</div>
                      <div className="text-xs text-gray-500">#{row.firstAlbumId}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {new Date(row.firstAlbumUploadedAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 tabular-nums">
                      {row.albumCount}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasSaleThisWeek ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Sí · {formatARS(row.salesThisWeekAmount)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Demora de subida vs ventas del álbum
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Compara la <strong>fecha del evento</strong> del álbum con la <strong>primera foto publicada</strong>{" "}
          (`firstPhotoDate` o primera subida) y las ventas digitales confirmadas (pedidos PAID, sin
          test). Sirve para ver si los fotógrafos que tardan en subir venden menos. Período: eventos
          de los últimos {albumUploadDelaySales?.monthsBack ?? 18} meses.
        </p>
        {!albumUploadDelaySales || albumUploadDelaySales.albumsAnalyzed === 0 ? (
          <p className="text-sm text-gray-500">
            Sin álbumes con fecha de evento y fotos publicadas en el período.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Demora promedio (con ventas)
                </p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {albumUploadDelaySales.avgDelayDaysWithSales} días
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {albumUploadDelaySales.albumsWithSales} álbumes con ventas de{" "}
                  {albumUploadDelaySales.albumsAnalyzed} analizados
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide">
                  Venta prom. subida rápida
                </p>
                <p className="text-2xl font-semibold text-emerald-900 mt-1">
                  {formatARS(albumUploadDelaySales.fastUploadAvgSales)}
                </p>
                <p className="text-xs text-emerald-700 mt-1">Mismo día o al día siguiente del evento</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-xs font-medium text-amber-900 uppercase tracking-wide">
                  Venta prom. subida tardía
                </p>
                <p className="text-2xl font-semibold text-amber-950 mt-1">
                  {formatARS(albumUploadDelaySales.slowUploadAvgSales)}
                </p>
                <p className="text-xs text-amber-800 mt-1">Primera foto más de 7 días después del evento</p>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3">
                <p className="text-xs font-medium text-violet-800 uppercase tracking-wide">
                  Correlación demora ↔ ventas
                </p>
                <p className="text-2xl font-semibold text-violet-900 mt-1">
                  {albumUploadDelaySales.correlationDelaySales != null
                    ? albumUploadDelaySales.correlationDelaySales.toFixed(2)
                    : "—"}
                </p>
                <p className="text-xs text-violet-700 mt-1">
                  {albumUploadDelaySales.salesLiftFastVsSlowPercent != null
                    ? `Rápidos vs lentos: ${albumUploadDelaySales.salesLiftFastVsSlowPercent > 0 ? "+" : ""}${albumUploadDelaySales.salesLiftFastVsSlowPercent}% ventas prom.`
                    : "Pearson entre días de demora y $ vendidos"}
                </p>
              </div>
            </div>

            {albumUploadDelaySales.buckets.length > 0 ? (
              <div className="h-72 w-full mb-6">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Venta promedio por álbum según demora de publicación
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={albumUploadDelaySales.buckets}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="bucketLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("es-AR", {
                          notation: "compact",
                          maximumFractionDigits: 0,
                        }).format(Number(v))
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = tooltipNumericValue(value);
                        const label = String(name ?? "");
                        if (label === "Venta prom. por álbum") return [formatARS(n), label];
                        return [n, label];
                      }}
                      labelFormatter={(label) => `Demora: ${label}`}
                    />
                    <Legend />
                    <Bar
                      dataKey="avgSalesPerAlbum"
                      name="Venta prom. por álbum"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {albumUploadDelaySales.topAlbumsBySales.length > 0 ? (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Álbumes que más vendieron (y su demora de subida)
                </p>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-2 pr-4 font-medium">Álbum</th>
                      <th className="py-2 pr-4 font-medium">Evento</th>
                      <th className="py-2 pr-4 font-medium">1.ª foto</th>
                      <th className="py-2 pr-4 font-medium text-right">Demora</th>
                      <th className="py-2 pr-4 font-medium text-right">Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {albumUploadDelaySales.topAlbumsBySales.map((row) => (
                      <tr key={row.albumId} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 font-medium text-gray-900 max-w-[14rem]">
                          <span className="line-clamp-2">{row.title}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">
                          {new Date(row.eventDate).toLocaleDateString("es-AR")}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">
                          {new Date(row.firstUploadAt).toLocaleDateString("es-AR")}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-800 whitespace-nowrap">
                          {row.uploadDelayDays} d
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatARS(row.salesArs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Ventas por fotógrafo (semanal, últimos 90 días)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Elegí un fotógrafo del listado (ordenado por facturación total en el período). Montos en
          pesos de pedidos pagados: álbumes + impresiones.
        </p>
        {photographerSalesRanking.length === 0 ? (
          <p className="text-sm text-gray-500">Sin ventas de fotógrafos en los últimos 90 días.</p>
        ) : (
          <>
            <div className="ds-input-wrapper mb-4 max-w-2xl">
              <label htmlFor="photographer-sales-select" className="block text-sm font-medium text-gray-700 mb-1">
                Fotógrafo
              </label>
              <Select
                id="photographer-sales-select"
                value={selectedPhotographerId ?? ""}
                onChange={(e) => setSelectedPhotographerId(Number(e.target.value))}
              >
                {photographerSalesRanking.map((row) => {
                  const label = row.name?.trim() || row.email;
                  return (
                    <option key={row.photographerId} value={row.photographerId}>
                      {label} (#{row.rank}) — {formatARS(row.totalAmount)}
                    </option>
                  );
                })}
              </Select>
            </div>
            {weeklySalesLoading ? (
              <p className="text-sm text-gray-500">Cargando gráfico…</p>
            ) : photographerWeeklySales.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos semanales para este fotógrafo.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={photographerWeeklySales}
                    margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      height={70}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("es-AR", {
                          notation: "compact",
                          maximumFractionDigits: 0,
                        }).format(Number(v))
                      }
                    />
                    <Tooltip
                      labelFormatter={(label) => `Semana ${label}`}
                      formatter={(value, name) => [
                        formatARS(tooltipNumericValue(value)),
                        String(name ?? ""),
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalAmount"
                      name="Total ($)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ fill: "#7c3aed", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="albumAmount"
                      name="Álbumes ($)"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ fill: "#059669", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="printAmount"
                      name="Impresiones ($)"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ fill: "#2563eb", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="p-6 overflow-x-auto">
        <details className="group">
          <summary className="cursor-pointer list-none select-none flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Funnel — eventos (últimos 30 días)
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {funnelDaily.length === 0
                  ? "Sin registros"
                  : `${funnelDaily.length} registros — clic para desplegar`}
              </p>
            </div>
            <span
              className="text-gray-500 text-sm shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-4">
              Hasta 1000 registros más recientes. Fecha y hora en Argentina. Usuario: solo si el
              visitante estaba logueado en ComprameLaFoto al disparar el evento.
            </p>
            {funnelDaily.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos aún (o migración FunnelVisit pendiente).</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="p-2 whitespace-nowrap">Fecha y hora (AR)</th>
                    <th className="p-2">Evento</th>
                    <th className="p-2 min-w-[10rem]">Álbum</th>
                    <th className="p-2 min-w-[8rem]">Fotógrafo</th>
                    <th className="p-2 min-w-[8rem]">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelDaily.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="p-2 whitespace-nowrap text-gray-800">
                        {formatFunnelDateTime(r.occurredAt)}
                      </td>
                      <td className="p-2 font-mono text-xs">{r.event}</td>
                      <td className="p-2 text-gray-800 max-w-[14rem]">
                        {r.albumTitle?.trim() || (r.albumId != null ? `Álbum #${r.albumId}` : "—")}
                      </td>
                      <td className="p-2 text-gray-800 max-w-[12rem]">
                        {r.photographerName?.trim() || "—"}
                      </td>
                      <td className="p-2 text-gray-800 max-w-[12rem]">
                        {r.userName?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </Card>

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

      {/* Promedio diario de ventas por mes */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Promedio diario de ventas por mes (últimos 12 meses)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Ingreso confirmado (pedidos pagados) atribuido a digital vs impreso, y total. Cada punto es el total del
          mes en ARS dividido por los días del mes calendario (zona Argentina). En el mes en curso el divisor
          suma los días completos anteriores más la fracción del día según las horas transcurridas, así el
          promedio no cae al empezar un día en $0.
        </p>
        <div className="h-80 w-full min-w-0">
          {salesDailyAvgByMonth.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos en el período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={salesDailyAvgByMonth.map((d) => ({
                  mes: d.monthLabel.charAt(0).toUpperCase() + d.monthLabel.slice(1),
                  digitalDailyAvg: d.digitalDailyAvg,
                  printDailyAvg: d.printDailyAvg,
                  totalDailyAvg: d.totalDailyAvg,
                  _daysNote: d.isCurrentMonth
                    ? `${d.daysInMonth.toFixed(1)} días equiv. (proporcional al día en curso)`
                    : `${d.daysInMonth} días`,
                }))}
                margin={{ top: 5, right: 20, left: 8, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("es-AR", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(Number(v))
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { _daysNote?: string } | undefined;
                    return row?._daysNote ? `${label} (${row._daysNote})` : String(label);
                  }}
                  formatter={(value) => {
                    const raw = Array.isArray(value) ? value[0] : value;
                    const n =
                      raw !== undefined && raw !== null && raw !== ""
                        ? Number(raw)
                        : 0;
                    return formatARS(Number.isFinite(n) ? n : 0);
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="digitalDailyAvg"
                  name="Prom. diario digital"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: "#059669", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="printDailyAvg"
                  name="Prom. diario impreso"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: "#2563eb", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalDailyAvg"
                  name="Prom. diario total"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ fill: "#7c3aed", r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Estudio horarios y días de venta (90 días) */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Estudio de horarios de venta (últimos 90 días)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Pedidos pagados (digital e impreso) agrupados por día de la semana y hora en zona horaria Argentina.
          {salesPeakHoursStudy ? (
            <>
              {" "}
              Período: {salesPeakHoursStudy.rangeStartLabel} — {salesPeakHoursStudy.rangeEndLabel}. Total:{" "}
              {salesPeakHoursStudy.totalOrders.toLocaleString("es-AR")} pedidos (
              {formatARS(salesPeakHoursStudy.totalRevenue)}).
            </>
          ) : null}
        </p>
        {!salesPeakHoursStudy || salesPeakHoursStudy.totalOrders === 0 ? (
          <p className="text-sm text-gray-500">Sin pedidos pagados en el período.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide">Día con más ventas</p>
                <p className="text-lg font-semibold text-emerald-900 mt-1">{salesPeakHoursStudy.peakDay.label}</p>
                <p className="text-sm text-emerald-700">
                  {salesPeakHoursStudy.peakDay.orderCount} pedidos · {formatARS(salesPeakHoursStudy.peakDay.revenue)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Día con menos ventas</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{salesPeakHoursStudy.quietDay.label}</p>
                <p className="text-sm text-slate-600">
                  {salesPeakHoursStudy.quietDay.orderCount} pedidos ·{" "}
                  {formatARS(salesPeakHoursStudy.quietDay.revenue)}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3">
                <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Hora pico</p>
                <p className="text-lg font-semibold text-blue-900 mt-1">{salesPeakHoursStudy.peakHour.label} hs</p>
                <p className="text-sm text-blue-700">
                  {salesPeakHoursStudy.peakHour.orderCount} pedidos ·{" "}
                  {formatARS(salesPeakHoursStudy.peakHour.revenue)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">Hora más baja</p>
                <p className="text-lg font-semibold text-amber-900 mt-1">{salesPeakHoursStudy.quietHour.label} hs</p>
                <p className="text-sm text-amber-700">
                  {salesPeakHoursStudy.quietHour.orderCount} pedidos ·{" "}
                  {formatARS(salesPeakHoursStudy.quietHour.revenue)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-medium text-gray-800 mb-2">Ventas por día de la semana</h3>
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesPeakHoursStudy.byDayOfWeek.map((d) => ({
                        dia: d.label,
                        pedidos: d.orderCount,
                        ingreso: d.revenue,
                      }))}
                      margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => {
                          const raw = Array.isArray(value) ? value[0] : value;
                          const n = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : 0;
                          return [Number.isFinite(n) ? n : 0, "Pedidos"];
                        }}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload as { ingreso?: number } | undefined;
                          const ing = row?.ingreso ?? 0;
                          return `${label} · ${formatARS(ing)}`;
                        }}
                      />
                      <Bar dataKey="pedidos" name="Pedidos pagados" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800 mb-2">Ventas por hora del día (0–23 hs AR)</h3>
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesPeakHoursStudy.byHour.map((h) => ({
                        hora: h.label,
                        pedidos: h.orderCount,
                        ingreso: h.revenue,
                      }))}
                      margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis
                        dataKey="hora"
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        interval={2}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => {
                          const raw = Array.isArray(value) ? value[0] : value;
                          const n = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : 0;
                          return [Number.isFinite(n) ? n : 0, "Pedidos"];
                        }}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload as { ingreso?: number } | undefined;
                          const ing = row?.ingreso ?? 0;
                          return `${label} hs · ${formatARS(ing)}`;
                        }}
                      />
                      <Bar dataKey="pedidos" name="Pedidos pagados" fill="#2563eb" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Estadísticas de Fotos */}
      {stats && (stats.totalPhotosUploaded !== undefined || stats.totalPhotosSold !== undefined) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Fotos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Fotos Subidas (Total)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalPhotosUploaded?.toLocaleString("es-AR") || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Histórico acumulado (incluye fotos ya purgadas o eliminadas)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fotos activas en BD</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {stats.activePhotosInDb?.toLocaleString("es-AR") ?? "—"}
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
            {alerts.map((alert) => {
              const borderColor = 
                alert.severity === "error" ? "border-red-400" :
                alert.severity === "warning" ? "border-yellow-400" :
                "border-blue-400";
              const bgColor = 
                alert.severity === "error" ? "bg-red-50" :
                alert.severity === "warning" ? "bg-yellow-50" :
                "bg-blue-50";
              
              return (
                <div
                  key={alert.id ?? `${alert.type}-${alert.link}`}
                  className={`flex items-center justify-between p-3 ${bgColor} rounded-md border-l-4 ${borderColor}`}
                >
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

      {/* Gráfico ventas diarias por tipo (ARS) */}
      {salesByTypeByDay.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Ventas diarias en $: impresiones vs digitales (últimos 30 días)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Montos confirmados (pedidos pagados) en pesos argentinos. Pasá el cursor sobre un día para ver
            también la cantidad de ítems.
          </p>
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
                margin={{ top: 5, right: 20, left: 8, bottom: 5 }}
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
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("es-AR", {
                      notation: "compact",
                      maximumFractionDigits: 0,
                    }).format(Number(v))
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => `Día ${label}`}
                  formatter={(value, name, item) => {
                    const n = tooltipNumericValue(value);
                    const label = String(name ?? "");
                    const row = item?.payload as SalesByTypeByDay & { fecha: string };
                    if (label === "Impresiones ($)") {
                      return [
                        `${formatARS(n)} · ${row?.printCount ?? 0} ítems`,
                        label,
                      ];
                    }
                    if (label === "Digitales ($)") {
                      return [
                        `${formatARS(n)} · ${row?.digitalCount ?? 0} ítems`,
                        label,
                      ];
                    }
                    if (label === "Total ($)") {
                      const items = (row?.printCount ?? 0) + (row?.digitalCount ?? 0);
                      return [`${formatARS(n)} · ${items} ítems`, label];
                    }
                    return [formatARS(n), label];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="printAmount"
                  name="Impresiones ($)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: "#2563eb", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="digitalAmount"
                  name="Digitales ($)"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: "#059669", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  name="Total ($)"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ fill: "#7c3aed", r: 3 }}
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
