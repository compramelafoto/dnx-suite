"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { STATUS_LABELS, type RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

type Row = {
  id: string;
  title: string;
  kind: string;
  status: RaffleStatus;
  salesFrom: string;
  salesTo: string;
  minSales: number;
  drawsAt: string;
  entrantsCount: number | null;
  _count: { prizes: number; awards: number };
};

const COLORES: Record<RaffleStatus, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ANUNCIADO: "bg-blue-100 text-blue-700",
  PADRON_SELLADO: "bg-amber-100 text-amber-800",
  SORTEADO: "bg-green-100 text-green-700",
  CERRADO: "bg-slate-100 text-slate-700",
  CANCELADO: "bg-red-100 text-red-700",
};

export default function AdminSorteosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sorteos")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudieron cargar los sorteos.");
        setRows(d.raffles || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sorteos para fotógrafos</h1>
          <p className="text-sm text-gray-500">
            Regalos para los fotógrafos que venden en CompraMeLaFoto. Mismo motor verificable que los sorteos de
            FOTOFFICE: la lista de participantes se cierra y se publica antes de que exista el número que decide.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/marketing/sorteos/mensual">
            <Button variant="secondary">Sorteo mensual automático</Button>
          </Link>
          <Link href="/admin/marketing/sorteos/nuevo">
            <Button>Nuevo sorteo manual</Button>
          </Link>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Cargando sorteos…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-600">
          Todavía no hay sorteos. Encendé el sorteo mensual automático o armá uno manual.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Sorteo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ventas que cuentan</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Sorteo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Premios</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Participantes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/marketing/sorteos/${r.id}`} className="font-medium text-gray-900 hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.kind === "MENSUAL" ? "Automático" : "Manual"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatArgentina(new Date(r.salesFrom), false)} al{" "}
                    {formatArgentina(new Date(new Date(r.salesTo).getTime() - 1), false)}
                    {r.minSales > 1 ? ` · mínimo ${r.minSales} ventas` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatArgentina(new Date(r.drawsAt))}</td>
                  <td className="px-4 py-3 text-gray-600">{r._count.prizes}</td>
                  <td className="px-4 py-3 text-gray-600">{r.entrantsCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${COLORES[r.status] ?? ""}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
