"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate } from "@/lib/admin/helpers";

interface AuditLog {
  id: number;
  createdAt: string;
  action: string;
  entity: string;
  entityId: number | null;
  description: string | null;
  actor: {
    id: number;
    name: string | null;
    email: string;
  };
  beforeData: any;
  afterData: any;
}

export default function AdminAuditoriaPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterActorId, setFilterActorId] = useState("");
  const [applied, setApplied] = useState({ search: "", action: "", entity: "", fromDate: "", toDate: "", actorId: "" });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      if (applied.search) params.set("search", applied.search);
      if (applied.action) params.set("action", applied.action);
      if (applied.entity) params.set("entityType", applied.entity);
      if (applied.fromDate) params.set("fromDate", applied.fromDate);
      if (applied.toDate) params.set("toDate", applied.toDate);
      if (applied.actorId) params.set("actorId", applied.actorId);

      const res = await fetch(`/api/admin/audit?${params}`, { credentials: "include" });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando auditoría:", errorData);
        return;
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setPagination((prev) => ({ ...prev, ...(data.pagination || {}) }));
    } catch (err) {
      console.error("Error cargando auditoría:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, applied]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function applyFilters() {
    setApplied({
      search: search.trim(),
      action: filterAction.trim(),
      entity: filterEntity.trim(),
      fromDate: filterFromDate,
      toDate: filterToDate,
      actorId: filterActorId.trim(),
    });
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function clearFilters() {
    setSearch("");
    setFilterAction("");
    setFilterEntity("");
    setFilterFromDate("");
    setFilterToDate("");
    setFilterActorId("");
    setApplied({ search: "", action: "", entity: "", fromDate: "", toDate: "", actorId: "" });
    setPagination((p) => ({ ...p, page: 1 }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando auditoría...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-gray-600 mt-1">Registro de acciones administrativas</p>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Buscar y filtrar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <Input
              type="text"
              placeholder="Descripción, acción, entidad, actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Acción</label>
            <Input
              type="text"
              placeholder="Ej: SCREENSHOT_ATTEMPT"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entidad</label>
            <Input
              type="text"
              placeholder="Ej: Album, PrintOrder"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde fecha</label>
            <Input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta fecha</label>
            <Input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ID Actor</label>
            <Input
              type="text"
              placeholder="ID del usuario"
              value={filterActorId}
              onChange={(e) => setFilterActorId(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="primary" size="sm" onClick={applyFilters}>
            Buscar
          </Button>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entidad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron registros de auditoría
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.entity}
                      {log.entityId && ` #${log.entityId}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.actor.name || log.actor.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {(log.beforeData || log.afterData) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            alert(
                              `Antes: ${JSON.stringify(log.beforeData, null, 2)}\n\nDespués: ${JSON.stringify(log.afterData, null, 2)}`
                            );
                          }}
                        >
                          Ver Detalles
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(pagination.page - 1) * pagination.pageSize + 1} a{" "}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
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
