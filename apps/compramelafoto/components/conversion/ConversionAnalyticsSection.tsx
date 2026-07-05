"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConversionKpiGrid from "@/components/conversion/ConversionKpiGrid";
import ConversionRecoveryReasons from "@/components/conversion/ConversionRecoveryReasons";
import type { PhotographerConversionAnalytics } from "@/lib/conversion-analytics/types";

const PERIOD_OPTIONS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "180 días" },
];

type Props = {
  className?: string;
};

export default function ConversionAnalyticsSection({ className = "" }: Props) {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PhotographerConversionAnalytics | null>(null);

  const load = useCallback(async (periodDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fotografo/conversion-analytics?days=${periodDays}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "No pudimos cargar la conversión.");
        setData(null);
        return;
      }
      setData(json.data as PhotographerConversionAnalytics);
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
    <section className={`w-full min-w-0 space-y-4 sm:space-y-6 ${className}`} id="conversion">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">Conversión</h2>
          <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
            Qué pasa entre que un cliente confirma el pedido y Mercado Pago acredita el pago.
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
        <Card className="p-6">
          <p className="text-sm text-[#6b7280]">Cargando métricas de conversión…</p>
        </Card>
      ) : error ? (
        <Card className="p-6 border border-red-200 bg-red-50/60">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => void load(days)}>
            Reintentar
          </Button>
        </Card>
      ) : data ? (
        <>
          <ConversionKpiGrid summary={data.summary} recoveredRevenue={data.recoveredRevenue} />
          <ConversionRecoveryReasons reasons={data.recoveryReasons} />
          <Card className="p-4 sm:p-5 bg-[#f9fafb] border border-[#e5e7eb]">
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Período: últimos {data.periodDays} días. Solo checkout de álbum con Mercado Pago (sin pedidos de
              prueba). Abandono recuperado = comprador único con pago pendiente que después pagó. Ingresos
              recuperados = cada pago PAID cuenta una sola vez por comprador y álbum.
            </p>
          </Card>
        </>
      ) : null}
    </section>
  );
}
