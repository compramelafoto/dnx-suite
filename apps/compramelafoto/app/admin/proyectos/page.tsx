"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatARS, formatDate, getStatusBadgeColor, getStatusLabel } from "@/lib/admin/helpers";

type Proyecto = {
  id: number;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  lab: { id: number; name: string } | null;
  photographer: { id: number; name: string | null; email: string } | null;
  items: { id: number; size: string; quantity: number }[];
};

export default function AdminProyectosPage() {
  const [loading, setLoading] = useState(true);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadProyectos();
  }, [pagination.page, statusFilter]);

  async function loadProyectos() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/admin/print-orders?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setProyectos(data.orders ?? []);
      setPagination((prev) => ({
        ...prev,
        ...(data.pagination ?? {}),
      }));
    } catch (err) {
      console.error("Error cargando proyectos:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">Proyectos</h1>
      <p className="text-sm text-[#6b7280] mb-6">
        Trabajos pendientes de enviar a imprimir a los laboratorios.
      </p>

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#374151]">Estado:</label>
            <select
              className="rounded border border-[#e5e7eb] px-2 py-1.5 text-sm bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CREATED">Creado</option>
              <option value="IN_PRODUCTION">En producción</option>
              <option value="READY">Listo</option>
              <option value="READY_TO_PICKUP">Listo para retiro</option>
              <option value="SHIPPED">Enviado</option>
              <option value="DELIVERED">Entregado</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </div>
          <Link href="/admin/pedidos">
            <Button variant="secondary" size="sm">
              Ver todos los pedidos
            </Button>
          </Link>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : proyectos.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#6b7280]">No hay proyectos con los filtros elegidos.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                <th className="pb-2 pr-2">ID</th>
                <th className="pb-2 pr-2">Cliente</th>
                <th className="pb-2 pr-2">Laboratorio</th>
                <th className="pb-2 pr-2">Fotógrafo</th>
                <th className="pb-2 pr-2">Estado</th>
                <th className="pb-2 pr-2">Total</th>
                <th className="pb-2 pr-2">Items</th>
                <th className="pb-2 pr-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id} className="border-b border-[#e5e7eb]">
                  <td className="py-2 pr-2 font-medium text-[#1a1a1a]">#{p.id}</td>
                  <td className="py-2 pr-2">
                    <div className="text-[#1a1a1a]">{p.customerName || p.customerEmail || "—"}</div>
                    {p.customerEmail && (
                      <div className="text-xs text-[#6b7280]">{p.customerEmail}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-[#6b7280]">{p.lab?.name ?? "—"}</td>
                  <td className="py-2 pr-2 text-[#6b7280]">
                    {p.photographer?.name || p.photographer?.email || "—"}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: getStatusBadgeColor(p.status) + "20",
                        color: getStatusBadgeColor(p.status),
                      }}
                    >
                      {getStatusLabel(p.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-[#1a1a1a]">{formatARS(p.total)}</td>
                  <td className="py-2 pr-2 text-[#6b7280]">
                    {p.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0} unidades
                  </td>
                  <td className="py-2 pr-2">
                    <Link href={`/admin/pedidos/${p.id}`}>
                      <Button variant="secondary" size="sm">
                        Ver detalle
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#6b7280]">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} proyectos)
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
