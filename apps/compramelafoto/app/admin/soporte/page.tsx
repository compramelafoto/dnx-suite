"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate, getStatusBadgeColor, getStatusLabel } from "@/lib/admin/helpers";

interface SupportTicket {
  id: number;
  createdAt: string;
  status: string;
  reason: string;
  description: string;
  printOrder: {
    id: number;
    customerName: string | null;
    customerEmail: string | null;
  } | null;
  assignedTo: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

export default function AdminSoportePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/support/tickets?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando tickets:", errorData);
        return;
      }

      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error("Error cargando tickets:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando tickets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Soporte / Incidencias</h1>
          <p className="text-gray-600 mt-1">Gestión de tickets de soporte</p>
        </div>
        <Button variant="primary" onClick={() => router.push("/admin/soporte/nuevo")}>
          Nuevo Ticket
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="OPEN">Abierto</option>
              <option value="IN_PROGRESS">En Proceso</option>
              <option value="RESOLVED">Resuelto</option>
              <option value="CLOSED">Cerrado</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla de tickets */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Motivo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Asignado a
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron tickets
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{ticket.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ticket.reason}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ticket.printOrder ? (
                        <div>
                          <div>Pedido #{ticket.printOrder.id}</div>
                          <div className="text-xs text-gray-500">
                            {ticket.printOrder.customerName || ticket.printOrder.customerEmail}
                          </div>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ticket.assignedTo ? ticket.assignedTo.name || ticket.assignedTo.email : "Sin asignar"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/admin/soporte/${ticket.id}`)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
