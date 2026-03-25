"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export const dynamic = 'force-dynamic';

interface AlbumRow {
  id: number;
  title: string;
  publicSlug: string | null;
  createdAt: string;
  firstPhotoDate: string | null;
  isHidden: boolean;
  isPublic: boolean;
  expirationExtensionDays: number;
  photosCount: number;
  interestsCount: number;
  ordersCount: number;
  revenueCents: number;
  visibleUntil: string | null;
  availableUntil: string | null;
  status: "ACTIVE" | "INACTIVE";
  user: {
    id: number;
    name: string | null;
    email: string | null;
  };
}

function AdminAlbumsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibilityFromUrl = searchParams?.get("visibility") || "public";
  const visibilityFilter = visibilityFromUrl === "private" ? "private" : "public";

  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  function setVisibilityFilter(value: "public" | "private") {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("visibility", value);
    router.replace(`/admin/albums?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    loadAlbums();
  }, [statusFilter, visibilityFilter, searchQuery]);

  async function loadAlbums() {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (visibilityFilter) params.set("visibility", visibilityFilter);
      if (searchQuery.trim().length >= 3) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/admin/albums?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error || res.statusText || `Error ${res.status}`;
        const detail = errorData?.detail;
        const fullMessage = detail ? `${message}: ${detail}` : message;
        console.error("Error cargando álbumes:", res.status, fullMessage, errorData);
        setLoadError(fullMessage);
        return;
      }

      const data = await res.json();
      setAlbums(data.albums || []);
      setSelected(new Set());
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error("Error cargando álbumes:", err);
      setLoadError(msg || "Error de conexión");
    } finally {
      setLoading(false);
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

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(albums.map((a) => a.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleSelectOne(albumId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} álbum(es)? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/albums", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando álbumes");
      }
      await loadAlbums();
    } catch (err: any) {
      alert(err?.message || "Error eliminando álbumes");
    }
  }

  async function deleteOne(albumId: number) {
    if (!confirm(`¿Eliminar el álbum #${albumId}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/albums", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: [albumId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando álbum");
      }
      await loadAlbums();
    } catch (err: any) {
      alert(err?.message || "Error eliminando álbum");
    }
  }

  async function updateAlbumsStatus(ids: number[], action: "activate" | "deactivate") {
    if (ids.length === 0) return;
    const confirmText =
      action === "activate"
        ? `¿Activar ${ids.length} álbum(es)?`
        : `¿Desactivar ${ids.length} álbum(es)?`;
    if (!confirm(confirmText)) return;

    let daysToAdd: number | undefined;
    if (action === "activate") {
      const daysRaw = prompt("¿Cuántos días extra querés otorgar? (ej: 30)", "30");
      if (!daysRaw) return;
      const parsed = Number(daysRaw);
      if (!Number.isFinite(parsed)) {
        alert("Días inválidos");
        return;
      }
      daysToAdd = parsed;
    }

    try {
      const res = await fetch("/api/admin/albums", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, action, daysToAdd }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error actualizando álbumes");
      }
      await loadAlbums();
    } catch (err: any) {
      alert(err?.message || "Error actualizando álbumes");
    }
  }

  const allSelected = useMemo(
    () => albums.length > 0 && selected.size === albums.length,
    [albums, selected]
  );

  if (loading && albums.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando álbumes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-800">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoadError(null); loadAlbums(); }}>
            Reintentar
          </Button>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Álbumes</h1>
        <p className="text-gray-600 mt-1">Total: {albums.length} álbumes</p>
      </div>

      {/* Agrupación: Álbumes públicos / Álbumes privados */}
      <Card className="p-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setVisibilityFilter("public")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              visibilityFilter === "public"
                ? "bg-gray-200 text-gray-900"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Álbumes públicos
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter("private")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              visibilityFilter === "private"
                ? "bg-gray-200 text-gray-900"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Álbumes privados
          </button>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">{selected.size} seleccionado(s)</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Limpiar selección
            </Button>
            <Button variant="secondary" size="sm" onClick={() => updateAlbumsStatus(Array.from(selected), "activate")}>
              Activar seleccionados
            </Button>
            <Button variant="secondary" size="sm" onClick={() => updateAlbumsStatus(Array.from(selected), "deactivate")}>
              Desactivar seleccionados
            </Button>
            <Button variant="secondary" size="sm" onClick={deleteSelected}>
              Eliminar seleccionados
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
            <Input
              type="text"
              placeholder="ID, título, slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fotógrafo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visible hasta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ventas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fotos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interesados</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {albums.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron álbumes
                  </td>
                </tr>
              ) : (
                albums.map((album) => (
                  <tr key={album.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(album.id)}
                        onChange={() => toggleSelectOne(album.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">#{album.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{album.title}</div>
                      {album.publicSlug && (
                        <div className="text-xs text-gray-500">/{album.publicSlug}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{album.user?.name || "N/A"}</div>
                      <div className="text-xs text-gray-500">{album.user?.email || "N/A"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${album.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {album.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </span>
                      {album.isHidden && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Oculto
                        </span>
                      )}
                      {!album.isPublic && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Privado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {album.visibleUntil ? new Date(album.visibleUntil).toLocaleDateString("es-AR") : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{album.ordersCount} pedido(s)</div>
                      <div className="text-xs text-gray-500">Total: {formatARS(album.revenueCents)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{album.photosCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{album.interestsCount}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        {album.publicSlug && (
                          <a
                            href={`/a/${album.publicSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
                          >
                            Ver
                          </a>
                        )}
                        {album.status === "INACTIVE" ? (
                          <Button variant="secondary" size="sm" onClick={() => updateAlbumsStatus([album.id], "activate")}>
                            Activar
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => updateAlbumsStatus([album.id], "deactivate")}>
                            Desactivar
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => deleteOne(album.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </Button>
                      </div>
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

export default function AdminAlbumsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando álbumes...</p>
      </div>
    }>
      <AdminAlbumsContent />
    </Suspense>
  );
}
