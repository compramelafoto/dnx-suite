"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Stats = {
  objectCount: number;
  totalBytes: number;
  totalGb: number;
  estimatedCostPerMonthUsd: number;
  isTruncated: boolean;
  error: string | null;
};

type ListedObject = {
  Key: string;
  Size: number;
  LastModified?: string;
};

export default function AdminR2Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [objects, setObjects] = useState<ListedObject[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/r2/stats", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando estadísticas");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadList = useCallback(async (prefix: string) => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);
      const res = await fetch(`/api/admin/r2/list?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      setObjects(data.objects ?? []);
      setPrefixes(data.prefixes ?? []);
      setIsTruncated(data.isTruncated ?? false);
      setCurrentPrefix(data.currentPrefix ?? "/");
      setSelectedKeys(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error listando archivos");
      setObjects([]);
      setPrefixes([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadList(currentPrefix === "/" ? "" : currentPrefix.replace(/\/$/, ""));
  }, []);

  const navigateToPrefix = (prefix: string) => {
    const next = prefix || "";
    loadList(next);
  };

  const goUp = () => {
    const parts = currentPrefix.replace(/\/$/, "").split("/").filter(Boolean);
    parts.pop();
    const parent = parts.length ? parts.join("/") + "/" : "";
    loadList(parent);
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === objects.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(objects.map((o) => o.Key)));
    }
  };

  const handleDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedKeys.size} archivo(s) de R2? Esta acción no se puede deshacer.`)) return;
    setDeleteLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/r2/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keys: Array.from(selectedKeys) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      setSelectedKeys(new Set());
      loadStats();
      loadList(currentPrefix === "/" ? "" : currentPrefix.replace(/\/$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const breadcrumbs = currentPrefix === "/" || !currentPrefix
    ? [{ label: "Raíz", prefix: "" }]
    : [
        { label: "Raíz", prefix: "" },
        ...currentPrefix
          .replace(/\/$/, "")
          .split("/")
          .map((part, i, arr) => ({
            label: part,
            prefix: arr.slice(0, i + 1).join("/") + "/",
          })),
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">R2 / Almacenamiento</h1>
        <p className="text-gray-600 mt-1">
          Estado del bucket, explorador de archivos y optimizador de memoria
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas del bucket</h2>
        {statsLoading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Objetos</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.objectCount.toLocaleString()}
                {stats.isTruncated && " (parcial)"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tamaño total</p>
              <p className="text-xl font-bold text-gray-900">{formatBytes(stats.totalBytes)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">GB</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalGb.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Costo est. mensual (USD)</p>
              <p className="text-xl font-bold text-emerald-600">
                ${stats.estimatedCostPerMonthUsd.toFixed(3)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No se pudieron cargar las estadísticas</p>
        )}
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={loadStats} disabled={statsLoading}>
            Actualizar
          </Button>
        </div>
      </Card>

      {/* File Explorer */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Explorador de archivos</h2>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap gap-1 mb-4">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-400">/</span>}
              <button
                type="button"
                className="text-blue-600 hover:underline text-sm"
                onClick={() => navigateToPrefix(b.prefix)}
              >
                {b.label || "(raíz)"}
              </button>
            </span>
          ))}
        </div>

        {listLoading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : (
          <>
            {/* Subcarpetas */}
            {prefixes.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Carpetas</p>
                <div className="flex flex-wrap gap-2">
                  {prefixes.map((p) => {
                    const name = p.replace(currentPrefix, "").replace(/\/$/, "") || p;
                    return (
                      <button
                        key={p}
                        type="button"
                        className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm flex items-center gap-1"
                        onClick={() => navigateToPrefix(p)}
                      >
                        <span>📁</span>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Archivos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Archivos</p>
                {objects.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedKeys.size === objects.length && objects.length > 0}
                        onChange={toggleSelectAll}
                      />
                      Seleccionar todos
                    </label>
                    {selectedKeys.size > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? "Eliminando..." : `Eliminar (${selectedKeys.size})`}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {objects.length === 0 && prefixes.length === 0 ? (
                <p className="text-gray-500 py-4">Carpeta vacía</p>
              ) : objects.length === 0 ? (
                <p className="text-gray-500 py-2">Sin archivos en esta carpeta</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Tamaño</th>
                        <th className="px-3 py-2">Última modificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {objects.map((obj) => {
                        const name = obj.Key.split("/").pop() || obj.Key;
                        return (
                          <tr key={obj.Key} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(obj.Key)}
                                onChange={() => toggleSelect(obj.Key)}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-xs break-all">{name}</td>
                            <td className="px-3 py-2">{formatBytes(obj.Size)}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {obj.LastModified
                                ? new Date(obj.LastModified).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {isTruncated && (
                <p className="text-xs text-amber-600 mt-2">
                  Lista truncada. Hay más archivos en esta carpeta.
                </p>
              )}
            </div>

            {currentPrefix && currentPrefix !== "/" && (
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={goUp}>
                  ↑ Subir nivel
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
