"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConversionKpiGrid from "@/components/conversion/ConversionKpiGrid";
import ConversionRecoveryReasons from "@/components/conversion/ConversionRecoveryReasons";
import type { AdminConversionAnalytics } from "@/lib/conversion-analytics/types";
import { UX_FUNNEL_EVENT_LABELS, formatConversionPct } from "@/lib/conversion-analytics";

const PERIOD_OPTIONS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "180 días" },
];

function RankTable({
  title,
  rows,
  nameKey,
  idKey,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  nameKey: string;
  idKey: string;
}) {
  return (
    <Card className="p-4 sm:p-5 min-w-0">
      <h3 className="text-sm font-semibold text-[#111827] mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[#6b7280]">Sin datos suficientes.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={String(row[idKey])}
              className="flex items-center justify-between gap-3 rounded-lg bg-[#f9fafb] px-3 py-2 min-w-0"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-xs text-[#9ca3af] w-4 shrink-0">{index + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#374151] truncate">{String(row[nameKey] ?? "—")}</p>
                  <p className="text-xs text-[#6b7280]">
                    {Number(row.attempts)} intentos · {Number(row.purchases)} compras
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-[#9a5f2e] shrink-0">
                {formatConversionPct(Number(row.conversionRatePct))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function AdminConversionAnalyticsPanel() {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminConversionAnalytics | null>(null);

  const load = useCallback(async (periodDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversion-analytics?days=${periodDays}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "No pudimos cargar la conversión.");
        setData(null);
        return;
      }
      setData(json.data as AdminConversionAnalytics);
    } catch {
      setError("No pudimos cargar la conversión.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Conversión de checkout</h1>
          <p className="text-sm text-gray-600 mt-1">
            Intento de compra → pago final (álbum + Mercado Pago, sin pedidos test).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              type="button"
              size="md"
              variant={days === opt.days ? "primary" : "secondary"}
              onClick={() => setDays(opt.days)}
              disabled={loading && days === opt.days}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card className="p-6"><p className="text-sm text-gray-600">Cargando…</p></Card>
      ) : error ? (
        <Card className="p-6 border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => void load(days)}>
            Reintentar
          </Button>
        </Card>
      ) : data ? (
        <>
          <ConversionKpiGrid summary={data.summary} recoveredRevenue={data.recoveredRevenue} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ConversionRecoveryReasons reasons={data.recoveryReasons} />
            <Card className="p-4 sm:p-6 min-w-0">
              <h3 className="text-base font-semibold text-[#111827] mb-1">Conversión por día</h3>
              <p className="text-sm text-[#6b7280] mb-4">Intentos, compras y recuperaciones</p>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Line type="monotone" dataKey="attempts" name="Intentos" stroke="#94a3b8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="purchases" name="Compras" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="recoveries" name="Recuperaciones" stroke="#c27b3d" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankTable
              title="Mejores álbumes por conversión"
              rows={data.topAlbums.map((r) => ({
                albumId: r.albumId,
                name: r.albumTitle ?? `Álbum #${r.albumId}`,
                attempts: r.attempts,
                purchases: r.purchases,
                conversionRatePct: r.conversionRatePct,
              }))}
              nameKey="name"
              idKey="albumId"
            />
            <RankTable
              title="Peores álbumes por conversión"
              rows={data.bottomAlbums.map((r) => ({
                albumId: r.albumId,
                name: r.albumTitle ?? `Álbum #${r.albumId}`,
                attempts: r.attempts,
                purchases: r.purchases,
                conversionRatePct: r.conversionRatePct,
              }))}
              nameKey="name"
              idKey="albumId"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankTable
              title="Mejores fotógrafos por conversión"
              rows={data.topPhotographers.map((r) => ({
                photographerId: r.photographerId,
                name: r.name ?? r.email,
                attempts: r.attempts,
                purchases: r.purchases,
                conversionRatePct: r.conversionRatePct,
              }))}
              nameKey="name"
              idKey="photographerId"
            />
            <RankTable
              title="Peores fotógrafos por conversión"
              rows={data.bottomPhotographers.map((r) => ({
                photographerId: r.photographerId,
                name: r.name ?? r.email,
                attempts: r.attempts,
                purchases: r.purchases,
                conversionRatePct: r.conversionRatePct,
              }))}
              nameKey="name"
              idKey="photographerId"
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-[#111827] mb-1">Eventos UX de recuperación</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              FunnelVisit — overlay, retry, banner (últimos {data.periodDays} días).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.uxFunnelEvents.map((ev) => (
                <div key={ev.event} className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3 min-w-0">
                  <p className="text-xs font-mono text-[#6b7280] break-all">{ev.event}</p>
                  <p className="text-sm font-medium text-[#374151] mt-1">
                    {UX_FUNNEL_EVENT_LABELS[ev.event] ?? ev.event}
                  </p>
                  <p className="text-lg font-semibold tabular-nums mt-1">{ev.visits}</p>
                  <p className="text-xs text-[#6b7280]">{ev.visitors} visitantes</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
