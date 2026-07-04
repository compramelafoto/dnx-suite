"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";

type StatRow = {
  referrerId: number;
  name: string;
  whatsapp: string | null;
  referredTotal: number;
  referredWhoBought: number;
  totalCents: number;
};

export default function AdminReferralStatsPage() {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "referrals" | "amount">("amount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
  }, [fromDate, toDate, sortBy, sortOrder]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      const res = await fetch(`/api/admin/referral-stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando estadísticas");
      const data = await res.json();
      setStats(data.stats ?? []);
    } catch {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }

  function formatPesos(amount: number) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function toggleSort(field: "name" | "referrals" | "amount") {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  }

  const sortIcon = (field: "name" | "referrals" | "amount") => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estadísticas de referidos</h1>
          <p className="text-sm text-gray-600 mt-1">Ranking de referidores por usuarios referidos y dinero facturado</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al dashboard
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="text-sm text-gray-500">
            {fromDate || toDate ? "Filtrando por rango de fechas (según fecha del earning)" : "Mostrando todos los períodos"}
          </div>
        </div>
      </Card>

      <Card className="p-6 overflow-hidden">
        {loading ? (
          <p className="text-gray-500">Cargando estadísticas...</p>
        ) : stats.length === 0 ? (
          <p className="text-gray-500">No hay datos de referidos en el período seleccionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="font-medium hover:text-gray-700"
                    >
                      Nombre completo{sortIcon("name")}
                    </button>
                  </th>
                  <th className="py-3 pr-4">WhatsApp</th>
                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("referrals")}
                      className="font-medium hover:text-gray-700"
                    >
                      Personas referidas{sortIcon("referrals")}
                    </button>
                  </th>
                  <th className="py-3 pr-4">Personas que compraron</th>
                  <th className="py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="font-medium hover:text-gray-700"
                    >
                      Monto ganado{sortIcon("amount")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.referrerId} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/usuarios?id=${row.referrerId}`}
                        className="text-gray-900 font-medium hover:text-[#c27b3d] hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{row.whatsapp || "—"}</td>
                    <td className="py-3 pr-4 font-medium" title="Usuarios que se registraron gracias a la recomendación">
                      {row.referredTotal}
                    </td>
                    <td className="py-3 pr-4 font-medium">{row.referredWhoBought}</td>
                    <td className="py-3 font-medium text-green-700">{formatPesos(row.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400">
        Personas referidas: usuarios que se registraron gracias al link del referidor. Personas que compraron: las que generaron comisión. Los montos están en pesos.
      </p>
    </div>
  );
}
