"use client";

import { useState, useMemo, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  firstOrderDate: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  lastOrderId: number;
  lastOrderStatus: string;
};

type ClientsTableProps = {
  clients: Client[];
  onSearch?: (search: string) => void;
  searchValue?: string;
  onClientUpdated?: () => void; // Callback para refrescar después de editar/eliminar
  photographerId?: number; // Para endpoints del fotógrafo
  labId?: number; // Para endpoints del laboratorio
};

export default function ClientsTable({ 
  clients, 
  onSearch, 
  searchValue = "", 
  onClientUpdated,
  photographerId,
  labId 
}: ClientsTableProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Sincronizar searchValue externo con localSearch
  useEffect(() => {
    if (searchValue !== undefined) {
      setLocalSearch(searchValue);
    }
  }, [searchValue]);

  // Filtrar clientes localmente - siempre filtra localmente para búsqueda en tiempo real
  const filteredClients = useMemo(() => {
    if (localSearch.trim().length < 3) {
      return clients;
    }

    const searchLower = localSearch.toLowerCase().trim();
    return clients.filter((c) => {
      // Buscar en todos los campos del cliente
      const nameMatch = c.name.toLowerCase().includes(searchLower);
      const emailMatch = c.email.toLowerCase().includes(searchLower);
      const phoneMatch = c.phone.toLowerCase().includes(searchLower);
      const totalOrdersMatch = c.totalOrders.toString().includes(searchLower);
      const totalSpentMatch = c.totalSpent.toFixed(2).includes(searchLower);
      const currencyMatch = c.currency.toLowerCase().includes(searchLower);
      const statusMatch = c.lastOrderStatus.toLowerCase().includes(searchLower);
      
      // Buscar en fechas formateadas
      const firstDateStr = new Date(c.firstOrderDate).toLocaleDateString("es-AR").toLowerCase();
      const lastDateStr = new Date(c.lastOrderDate).toLocaleDateString("es-AR").toLowerCase();
      const dateMatch = firstDateStr.includes(searchLower) || lastDateStr.includes(searchLower);

      return (
        nameMatch ||
        emailMatch ||
        phoneMatch ||
        totalOrdersMatch ||
        totalSpentMatch ||
        currencyMatch ||
        statusMatch ||
        dateMatch
      );
    });
  }, [clients, localSearch]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    // Si hay callback de búsqueda, llamarlo (para búsqueda en servidor si se necesita)
    if (onSearch) {
      onSearch(value);
    }
  }

  function handleExportCSV() {
    // Crear CSV
    const headers = [
      "Nombre",
      "Email",
      "Teléfono",
      "Primera compra",
      "Última compra",
      "Total de pedidos",
      "Total gastado",
      "Moneda",
      "Estado último pedido",
    ];

    const rows = filteredClients.map((c) => [
      c.name,
      c.email,
      c.phone,
      new Date(c.firstOrderDate).toLocaleDateString("es-AR"),
      new Date(c.lastOrderDate).toLocaleDateString("es-AR"),
      c.totalOrders.toString(),
      c.totalSpent.toFixed(2),
      c.currency,
      c.lastOrderStatus,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `clientes_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatCurrency(amount: number, currency: string) {
    const value = amount;
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
    }).format(value);
  }

  function handleWhatsAppClick(phone: string) {
    // Limpiar número de teléfono (quitar espacios, guiones, etc.)
    const cleanPhone = phone.replace(/\D/g, "");
    // Si no empieza con código de país, agregar 54 (Argentina)
    const phoneWithCountry = cleanPhone.startsWith("54") ? cleanPhone : `54${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
    window.open(whatsappUrl, "_blank");
  }

  function handleEditClick(client: Client) {
    setEditingClient(client);
    setEditName(client.name);
    setEditEmail(client.email); // Email no se puede editar (es la clave única)
    setEditPhone(client.phone);
  }

  function handleCancelEdit() {
    setEditingClient(null);
    setEditName("");
    setEditEmail("");
    setEditPhone("");
  }

  async function handleSaveEdit() {
    if (!editingClient) return;
    
    setEditLoading(true);
    try {
      const endpoint = photographerId 
        ? `/api/fotografo/clientes/${encodeURIComponent(editingClient.email)}`
        : `/api/lab/clientes/${encodeURIComponent(editingClient.email)}`;
      
      // No enviar email porque no se puede editar (es la clave única)
      const body = photographerId
        ? { photographerId, name: editName.trim(), phone: editPhone.trim() }
        : { labId, name: editName.trim(), phone: editPhone.trim() };

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al editar cliente");
      }

      setEditingClient(null);
      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err: any) {
      alert(err?.message || "Error al editar cliente");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(`¿Estás seguro de que querés eliminar a ${client.name}? Esta acción eliminará solo los registros de notificaciones, no los pedidos reales.`)) {
      return;
    }

    setDeleteLoading(client.email);
    try {
      const endpoint = photographerId
        ? `/api/fotografo/clientes/${encodeURIComponent(client.email)}`
        : `/api/lab/clientes/${encodeURIComponent(client.email)}`;
      
      const body = photographerId
        ? { photographerId }
        : { labId };

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar cliente");
      }

      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err: any) {
      alert(err?.message || "Error al eliminar cliente");
    } finally {
      setDeleteLoading(null);
    }
  }

  return (
    <Card className="space-y-4">
      {/* Barra de búsqueda y exportar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
            Buscar cliente
          </label>
          <Input
            type="text"
            placeholder="Buscar por nombre, email, teléfono, total, pedidos, fecha..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full text-base py-3 px-4"
            style={{
              minHeight: "48px",
              fontSize: "16px",
            }}
          />
          {localSearch.trim() && (
            <p className="text-xs text-[#6b7280] mt-2">
              Buscando en todos los datos del cliente...
            </p>
          )}
        </div>
        <div className="w-full sm:w-auto sm:self-end">
          <Button variant="secondary" onClick={handleExportCSV} className="whitespace-nowrap w-full sm:w-auto">
            📥 Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full border-collapse min-w-[800px] sm:min-w-0">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f8f9fa]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[#1a1a1a]">Nombre</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[#1a1a1a]">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[#1a1a1a]">Teléfono</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[#1a1a1a]">Primera compra</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[#1a1a1a]">Última compra</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-[#1a1a1a]">Pedidos</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-[#1a1a1a]">Total</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-[#1a1a1a]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#6b7280]">
                  {localSearch.trim() ? "No se encontraron clientes con ese criterio de búsqueda." : "No hay clientes registrados."}
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id} className="border-b border-[#e5e7eb] hover:bg-[#f8f9fa]">
                  {editingClient?.id === client.id ? (
                    <>
                      <td className="py-3 px-4">
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">
                        {editEmail}
                        <span className="text-xs text-[#9ca3af] ml-2">(no editable)</span>
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="text-sm"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">
                        {new Date(client.firstOrderDate).toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">
                        {new Date(client.lastOrderDate).toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#1a1a1a]">{client.totalOrders}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-[#1a1a1a]">
                        {formatCurrency(client.totalSpent, client.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={editLoading}
                            className="text-[#10b981] hover:text-[#059669] transition-colors disabled:opacity-50"
                            title="Guardar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={editLoading}
                            className="text-[#ef4444] hover:text-[#dc2626] transition-colors disabled:opacity-50"
                            title="Cancelar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-sm text-[#1a1a1a]">{client.name}</td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">{client.email}</td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">{client.phone}</td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">
                        {new Date(client.firstOrderDate).toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6b7280]">
                        {new Date(client.lastOrderDate).toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#1a1a1a]">{client.totalOrders}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-[#1a1a1a]">
                        {formatCurrency(client.totalSpent, client.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {client.phone && client.phone !== "Sin teléfono" && (
                            <button
                              onClick={() => handleWhatsAppClick(client.phone)}
                              className="text-[#25D366] hover:text-[#20BA5A] transition-colors"
                              title="Abrir WhatsApp"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(client)}
                            className="text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                            title="Editar cliente"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(client)}
                            disabled={deleteLoading === client.email}
                            className="text-[#ef4444] hover:text-[#dc2626] transition-colors disabled:opacity-50"
                            title="Eliminar cliente"
                          >
                            {deleteLoading === client.email ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredClients.length > 0 && (
        <div className="text-sm text-[#6b7280] text-center pt-2">
          Mostrando {filteredClients.length} {filteredClients.length === 1 ? "cliente" : "clientes"}
        </div>
      )}
    </Card>
  );
}
