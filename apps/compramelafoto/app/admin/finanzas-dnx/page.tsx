"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { formatARS } from "@/lib/admin/helpers";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const AHORA = new Date();
const ANIOS = Array.from({ length: 5 }, (_, i) => AHORA.getFullYear() - 3 + i);

interface MonthlySummary {
  billedArsMinor: number;
  paidArsMinor: number;
  debtArsMinor: number;
}

interface VendorFaltante {
  id: number;
  key: string;
  name: string;
}

export default function FinanzasDnxResumenPage() {
  const [year, setYear] = useState(AHORA.getFullYear());
  const [month, setMonth] = useState(AHORA.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [accumulatedDebtArsMinor, setAccumulatedDebtArsMinor] = useState(0);
  const [faltantes, setFaltantes] = useState<VendorFaltante[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/finance-dnx/summary?year=${year}&month=${month}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el resumen.");
        setSummary(null);
        setAccumulatedDebtArsMinor(0);
        setFaltantes([]);
        return;
      }
      setSummary(data.summary);
      setAccumulatedDebtArsMinor(data.accumulatedDebtArsMinor || 0);
      setFaltantes(data.faltantes || []);
    } catch {
      setError("Error de conexión al cargar el resumen.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas DNX — Resumen</h1>
          <p className="text-gray-600 mt-1">
            Cuánto se facturó, cuánto se pagó y cuánto se debe por la infraestructura de la suite.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-auto"
          >
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>{nombre}</option>
            ))}
          </Select>
          <Select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-auto"
          >
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Cargando...</p>
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-6">
              <p className="text-sm text-gray-600">Facturado del mes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatARS(summary.billedArsMinor / 100)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lo que emitieron los proveedores.</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600">Pagado del mes</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatARS(summary.paidArsMinor / 100)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lo que efectivamente salió de la cuenta, neto de reembolsos.</p>
            </Card>

            <Card className={summary.debtArsMinor > 0 ? "p-6 border-red-300 bg-red-50" : "p-6"}>
              <p className={summary.debtArsMinor > 0 ? "text-sm text-red-700 font-medium" : "text-sm text-gray-600"}>
                Deuda del mes
              </p>
              <p className={summary.debtArsMinor > 0 ? "text-2xl font-bold text-red-700 mt-1" : "text-2xl font-bold text-gray-900 mt-1"}>
                {formatARS(summary.debtArsMinor / 100)}
              </p>
              <p className={summary.debtArsMinor > 0 ? "text-xs text-red-600 mt-1" : "text-xs text-gray-500 mt-1"}>
                Facturas rechazadas o impagas de {MESES[month - 1]} {year} únicamente.
              </p>
            </Card>

            <Card className={accumulatedDebtArsMinor > 0 ? "p-6 border-red-300 bg-red-50" : "p-6"}>
              <p className={accumulatedDebtArsMinor > 0 ? "text-sm text-red-700 font-medium" : "text-sm text-gray-600"}>
                Deuda acumulada (todos los meses)
              </p>
              <p className={accumulatedDebtArsMinor > 0 ? "text-2xl font-bold text-red-700 mt-1" : "text-2xl font-bold text-gray-900 mt-1"}>
                {formatARS(accumulatedDebtArsMinor / 100)}
              </p>
              <p className={accumulatedDebtArsMinor > 0 ? "text-xs text-red-600 mt-1" : "text-xs text-gray-500 mt-1"}>
                Todas las facturas rechazadas o impagas que siguen abiertas, sin importar el mes. Un servicio impago no es un ahorro: se corta.
              </p>
            </Card>
          </div>

          {faltantes.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-300 p-4">
              <p className="text-sm font-semibold text-red-800">
                Faltan cargar {faltantes.length === 1 ? "1 proveedor" : `${faltantes.length} proveedores`} de este mes
              </p>
              <p className="text-sm text-red-700 mt-1">
                Tuvieron un gasto el mes pasado y todavía no tienen ninguno cargado en {MESES[month - 1]} {year}:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                {faltantes.map((v) => (
                  <li key={v.id}>{v.name}</li>
                ))}
              </ul>
              <div className="mt-3">
                <Link href="/admin/finanzas-dnx/gastos">
                  <Button variant="secondary" size="sm">Ir a cargar gastos</Button>
                </Link>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
