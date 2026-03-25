"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate } from "@/lib/admin/helpers";

interface Customer {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  createdAt: string;
  isBlocked: boolean;
  isGuest: boolean;
  clientOrders: Array<{
    id: number;
    createdAt: string;
    total: number;
    status: string;
    paymentStatus: string;
    photographer: {
      id: number;
      name: string | null;
      email: string;
    } | null;
  }>;
  photographers: Array<{
    id: number;
    name: string | null;
    email: string;
    orderCount: number;
  }>;
}

export default function AdminClientesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadCustomers();
  }, [pagination.page, searchQuery]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando clientes:", errorData);
        return;
      }

      const data = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSelectedCustomers(new Set());
      setPagination(data.pagination || pagination);
    } catch (err) {
      console.error("Error cargando clientes:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const selectable = customers.filter((c) => !c.isGuest).map((c) => c.id);
      setSelectedCustomers(new Set(selectable));
    } else {
      setSelectedCustomers(new Set());
    }
  }

  function toggleSelectOne(customerId: number) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer || customer.isGuest) {
      return;
    }
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  async function deleteSelectedCustomers() {
    const ids = Array.from(selectedCustomers);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} cliente(s)? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando clientes");
      }
      await loadCustomers();
    } catch (err: any) {
      alert(err?.message || "Error eliminando clientes");
    }
  }

  async function deleteCustomer(customerId: number, email: string) {
    if (!confirm(`¿Eliminar al cliente ${email}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${customerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando cliente");
      }
      await loadCustomers();
    } catch (err: any) {
      alert(err?.message || "Error eliminando cliente");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-600 mt-1">
          Total: {pagination.total} clientes
        </p>
      </div>

      {selectedCustomers.size > 0 && (
        <Card className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">{selectedCustomers.size} cliente(s) seleccionado(s)</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedCustomers(new Set())}>
              Limpiar selección
            </Button>
            <Button variant="secondary" size="sm" onClick={deleteSelectedCustomers}>
              Eliminar seleccionados
            </Button>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Búsqueda
          </label>
          <Input
            type="text"
            placeholder="Email, nombre, teléfono..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination({ ...pagination, page: 1 });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                loadCustomers();
              }
            }}
          />
        </div>
      </Card>

      {/* Tabla de clientes */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={
                      customers.filter((c) => !c.isGuest).length > 0 &&
                      selectedCustomers.size === customers.filter((c) => !c.isGuest).length
                    }
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ubicación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pedidos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fotógrafos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha Registro
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const totalOrders = customer.clientOrders.length;
                  const totalSpent = customer.clientOrders.reduce(
                    (sum, order) => sum + (order.total || 0),
                    0
                  );
                  
                  // Calcular total de pedidos (puede ser más que los mostrados)
                  const allOrdersCount = customer.photographers.reduce(
                    (sum, p) => sum + p.orderCount,
                    0
                  );

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.has(customer.id)}
                          onChange={() => toggleSelectOne(customer.id)}
                          disabled={customer.isGuest}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        #{customer.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {customer.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {customer.name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {customer.phone || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {[customer.city, customer.province, customer.country]
                          .filter(Boolean)
                          .join(", ") || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{allOrdersCount || totalOrders} pedido(s)</div>
                          {totalSpent > 0 && (
                            <div className="text-xs text-gray-500">
                              Total: {formatARS(totalSpent)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {customer.photographers && customer.photographers.length > 0 ? (
                          <div className="space-y-1 max-w-xs">
                            {customer.photographers.slice(0, 3).map((photographer) => (
                              <div key={photographer.id} className="text-xs flex items-center gap-1">
                                <span className="font-medium truncate">
                                  {photographer.name || photographer.email.split("@")[0]}
                                </span>
                                <span className="text-gray-500 whitespace-nowrap">
                                  ({photographer.orderCount})
                                </span>
                              </div>
                            ))}
                            {customer.photographers.length > 3 && (
                              <div className="text-xs text-gray-500 italic">
                                +{customer.photographers.length - 3} fotógrafo{customer.photographers.length - 3 > 1 ? 's' : ''} más
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              Total: {customer.photographers.length} fotógrafo{customer.photographers.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin compras registradas</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            customer.isBlocked
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {customer.isBlocked ? "Bloqueado" : "Activo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => deleteCustomer(customer.id, customer.email)}
                            className="text-red-600 hover:text-red-700"
                            disabled={customer.isGuest}
                          >
                            Eliminar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/admin/usuarios/${customer.id}`)}
                            disabled={customer.isGuest}
                          >
                            Ver Detalle
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(pagination.page - 1) * pagination.pageSize + 1} a{" "}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{" "}
              {pagination.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
              >
                Anterior
              </Button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
