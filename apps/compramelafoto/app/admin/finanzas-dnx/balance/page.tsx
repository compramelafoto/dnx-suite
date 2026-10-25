"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PLATAFORMAS: Record<string, string> = {
  clf: "CompraMeLaFoto",
  subilafoto: "SubiLaFoto",
  fotoffice: "FOTOFFICE",
  fotorank: "FotoRank",
  clickaton: "Clickatón",
  infospot: "InfoSpot",
  suite: "Suite (compartido)",
};

type PlatformResult = { revenueArs: number; expensesArs: number; resultArs: number };
type Row = {
  periodYear: number;
  periodMonth: number;
  revenueArs: number;
  expensesArs: number;
  resultArs: number;
  accumulatedArs: number;
  byPlatform: Record<string, PlatformResult>;
};
type Detail = {
  platformKey: string;
  periodMonth: number;
  grossArs: number;
  processorFeeArs: number;
  payoutToThirdPartiesArs: number;
  netArs: number;
  operationsCount: number;
};
type Data = {
  year: number;
  rows: Row[];
  totals: { revenueArs: number; expensesArs: number; resultArs: number; byPlatform: Record<string, PlatformResult> };
  detail: Detail[];
  sources: { platformKey: string; computedAt: string; note: string | null }[];
};

const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const color = (n: number) => (n < 0 ? "text-red-700" : "text-green-700");
const fechaAR = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export default function BalancePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [mesDetalle, setMesDetalle] = useState<number | "todo">("todo");

  const cargar = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/finance-dnx/balance?year=${year}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "No se pudo cargar el balance.");
    else setData(json);
  }, [year]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function recalcular() {
    setRecalculando(true);
    try {
      const res = await fetch("/api/admin/finance-dnx/balance/recompute", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      const fallas = (json.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (!res.ok) setError(json.error ?? "No se pudo recalcular.");
      else if (fallas.length) setError(`No se pudo leer: ${fallas.map((f: { platformKey: string; error: string }) => `${PLATAFORMAS[f.platformKey] ?? f.platformKey} (${f.error})`).join(", ")}`);
      await cargar();
    } finally {
      setRecalculando(false);
    }
  }

  const plataformas = data
    ? Object.keys(data.totals.byPlatform).sort((a, b) => Object.keys(PLATAFORMAS).indexOf(a) - Object.keys(PLATAFORMAS).indexOf(b))
    : [];
  const porPlataforma =
    mesDetalle === "todo" ? data?.totals.byPlatform : data?.rows.find((r) => r.periodMonth === mesDetalle)?.byPlatform;
  const detalle = (data?.detail ?? []).filter((d) => (mesDetalle === "todo" ? true : d.periodMonth === mesDetalle));
  const detallePorPlataforma = Object.values(
    detalle.reduce<Record<string, Detail>>((acc, d) => {
      const a = acc[d.platformKey] ?? { ...d, grossArs: 0, processorFeeArs: 0, payoutToThirdPartiesArs: 0, netArs: 0, operationsCount: 0 };
      a.grossArs += d.grossArs;
      a.processorFeeArs += d.processorFeeArs;
      a.payoutToThirdPartiesArs += d.payoutToThirdPartiesArs;
      a.netArs += d.netArs;
      a.operationsCount += d.operationsCount;
      acc[d.platformKey] = a;
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas DNX — Balance</h1>
          <p className="text-gray-600 mt-1">Lo que le queda a DNX de cada venta, contra lo que se paga en servicios.</p>
          <Link href="/admin/finanzas-dnx" className="text-sm text-gray-700 underline">Volver al resumen</Link>
        </div>
        <div className="flex gap-2">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
            {[2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Button onClick={recalcular} disabled={recalculando}>{recalculando ? "Recalculando..." : "Recalcular ahora"}</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <p className="text-sm text-gray-600">Ingresos netos {data.year}</p>
              <p className="text-2xl font-bold text-gray-900">{pesos(data.totals.revenueArs)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-gray-600">Gastos pagados {data.year}</p>
              <p className="text-2xl font-bold text-gray-900">{pesos(data.totals.expensesArs)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-gray-600">Resultado {data.year}</p>
              <p className={`text-2xl font-bold ${color(data.totals.resultArs)}`}>{pesos(data.totals.resultArs)}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Mes</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-right">Gastos</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                  <th className="px-4 py-3 text-right">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.periodMonth} className="hover:bg-gray-50 cursor-pointer" onClick={() => setMesDetalle(r.periodMonth)}>
                    <td className="px-4 py-2 font-medium text-gray-900">{MESES[r.periodMonth - 1]} {r.periodYear}</td>
                    <td className="px-4 py-2 text-right">{pesos(r.revenueArs)}</td>
                    <td className="px-4 py-2 text-right">{pesos(r.expensesArs)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${color(r.resultArs)}`}>{pesos(r.resultArs)}</td>
                    <td className={`px-4 py-2 text-right ${color(r.accumulatedArs)}`}>{pesos(r.accumulatedArs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Por plataforma</h2>
              <Select
                value={mesDetalle}
                onChange={(e) => setMesDetalle(e.target.value === "todo" ? "todo" : Number(e.target.value))}
                className="w-auto"
              >
                <option value="todo">Todo {data.year}</option>
                {data.rows.map((r) => (
                  <option key={r.periodMonth} value={r.periodMonth}>{MESES[r.periodMonth - 1]} {r.periodYear}</option>
                ))}
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Plataforma</th>
                    <th className="px-3 py-2 text-right">Ingresos</th>
                    <th className="px-3 py-2 text-right">Gastos asignados</th>
                    <th className="px-3 py-2 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plataformas.map((k) => {
                    const p = porPlataforma?.[k] ?? { revenueArs: 0, expensesArs: 0, resultArs: 0 };
                    return (
                      <tr key={k}>
                        <td className="px-3 py-2 font-medium text-gray-900">{PLATAFORMAS[k] ?? k}</td>
                        <td className="px-3 py-2 text-right">{pesos(p.revenueArs)}</td>
                        <td className="px-3 py-2 text-right">{pesos(p.expensesArs)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${color(p.resultArs)}`}>{pesos(p.resultArs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Detalle de ingresos</h2>
            <p className="text-sm text-gray-600 mb-4">De lo cobrado a los clientes, qué fue a terceros y qué le quedó a DNX.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Plataforma</th>
                    <th className="px-3 py-2 text-right">Ventas</th>
                    <th className="px-3 py-2 text-right">Cobrado</th>
                    <th className="px-3 py-2 text-right">A terceros</th>
                    <th className="px-3 py-2 text-right">Mercado Pago</th>
                    <th className="px-3 py-2 text-right">Le queda a DNX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detallePorPlataforma.map((d) => (
                    <tr key={d.platformKey}>
                      <td className="px-3 py-2 font-medium text-gray-900">{PLATAFORMAS[d.platformKey] ?? d.platformKey}</td>
                      <td className="px-3 py-2 text-right">{d.operationsCount}</td>
                      <td className="px-3 py-2 text-right">{pesos(d.grossArs)}</td>
                      <td className="px-3 py-2 text-right">{pesos(d.payoutToThirdPartiesArs)}</td>
                      <td className="px-3 py-2 text-right">
                        {pesos(d.processorFeeArs)}
                        {d.platformKey === "fotorank" && d.processorFeeArs > 0 && <span className="block text-xs text-gray-500">estimado</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{pesos(d.netArs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-gray-500">
              {data.sources.map((s) => (
                <li key={s.platformKey}>
                  <span className="font-medium">{PLATAFORMAS[s.platformKey] ?? s.platformKey}</span> · calculado {fechaAR(s.computedAt)}
                  {s.note ? ` · ${s.note}` : ""}
                </li>
              ))}
              {data.sources.length === 0 && <li>Todavía no hay cálculo de ingresos: tocá "Recalcular ahora".</li>}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
