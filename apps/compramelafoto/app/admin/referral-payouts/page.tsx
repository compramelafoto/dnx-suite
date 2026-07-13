"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";

type PayoutRequest = {
  id: number;
  amountCents: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
  referrer: { id: number; name: string | null; email: string; cbu: string | null; cbuTitular: string | null } | null;
};

export default function AdminReferralPayoutsPage() {
  const [list, setList] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/admin/referral-payouts?status=${encodeURIComponent(statusFilter)}` : "/api/admin/referral-payouts";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando");
      const data = await res.json();
      setList(data.payoutRequests ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(id: number) {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/admin/referral-payouts/${id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error");
      load();
    } catch (e: any) {
      alert(e?.message || "Error al marcar como pagada");
    } finally {
      setMarkingId(null);
    }
  }

  // Los campos *Cents en referidos almacenan PESOS
  const formatPesos = (amount: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(amount);
  const pending = list.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Cobros de referidos</h1>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al dashboard
        </Link>
      </div>

      <p className="text-sm text-gray-600">
        Los referidores solicitan cobro desde su panel (Referidos → Solicitar cobro). Acá podés ver las solicitudes y marcarlas como pagadas una vez que les hayas enviado el dinero por Mercado Pago o transferencia.
      </p>

      <div className="flex gap-2 items-center">
        <label className="text-sm text-gray-600">Estado:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="PAID">Pagados</option>
          <option value="CANCELLED">Cancelados</option>
        </select>
      </div>

      {pending.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <p className="text-sm font-medium text-amber-800">
            {pending.length} solicitud{pending.length !== 1 ? "es" : ""} pendiente{pending.length !== 1 ? "s" : ""} de pago
          </p>
        </Card>
      )}

      <Card className="p-6">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">No hay solicitudes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Referidor</th>
                  <th className="py-2 pr-4">CBU / Alias</th>
                  <th className="py-2 pr-4">Titular</th>
                  <th className="py-2 pr-4">Monto</th>
                  <th className="py-2 pr-4">Fecha solicitud</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">#{r.id}</td>
                    <td className="py-2 pr-4">
                      {r.referrer ? (
                        <span>
                          {r.referrer.name || r.referrer.email}
                          <span className="text-gray-400 block text-xs">{r.referrer.email}</span>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 font-mono text-xs">
                      {r.referrer?.cbu ? r.referrer.cbu : "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-sm">
                      {r.referrer?.cbuTitular ? r.referrer.cbuTitular : "—"}
                    </td>
                    <td className="py-2 pr-4 font-medium">{formatPesos(r.amountCents)}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(r.requestedAt).toLocaleString("es-AR")}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          r.status === "PAID"
                            ? "text-green-600"
                            : r.status === "PENDING"
                              ? "text-amber-600"
                              : "text-gray-500"
                        }
                      >
                        {r.status === "PAID" ? "Pagado" : r.status === "PENDING" ? "Pendiente" : "Cancelado"}
                      </span>
                      {r.paidAt && (
                        <span className="text-gray-400 block text-xs">
                          {new Date(r.paidAt).toLocaleDateString("es-AR")}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {r.status === "PENDING" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => markPaid(r.id)}
                          disabled={markingId === r.id}
                        >
                          {markingId === r.id ? "..." : "Marcar como pagada"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
