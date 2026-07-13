"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CommunityAltaLinks from "@/components/admin/CommunityAltaLinks";

type Category = { name: string; slug: string };
type WorkRef = { id: number; label: string };
type Profile = {
  id: string;
  name: string;
  slug: string;
  status: string;
  province: string | null;
  city: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  contactName: string | null;
  isFeatured: boolean;
  categories: { category: Category }[];
  workReferences: WorkRef[];
};

export default function AdminProveedoresPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ type: "EVENT_VENDOR" });
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/admin/community-profiles?${params}`)
      .then((r) => r.json())
      .then((data) => setProfiles(Array.isArray(data.profiles) ? data.profiles : []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-500">
          Directorio de proveedores de eventos (makeup, DJ, catering, vestidos, etc.).
        </p>
      </div>

      <CommunityAltaLinks />
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, email, WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="ACTIVE">Activo</option>
          <option value="DISABLED">Deshabilitado</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : profiles.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          No hay proveedores cargados. Ejecutá <code className="bg-gray-200 px-1 rounded">npm run import:proveedores</code> para importar desde CSV.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Eventos</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900">
                      {p.name && p.name.trim() !== "" && p.name !== "Sin nombre"
                        ? p.name
                        : p.contactName || p.whatsapp || "Sin nombre"}
                    </span>
                    {p.contactName && p.name !== p.contactName && (
                      <span className="block text-xs text-gray-500">{p.contactName}</span>
                    )}
                    {p.isFeatured && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Destacado</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {[p.city, p.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {p.categories.map((c) => c.category.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {p.whatsapp && <span>WA: {p.whatsapp}</span>}
                    {p.email && <span className="block text-gray-600">{p.email}</span>}
                    {!p.whatsapp && !p.email && "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 max-w-[180px] truncate">
                    {p.workReferences.length > 0
                      ? p.workReferences.map((r) => r.label).join("; ")
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs rounded ${
                        p.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : p.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/comunidad/proveedores/${p.id}/edit`}
                      className="text-sm text-[#c27b3d] hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Listado público: <Link href="/fotografo/comunidad" className="text-blue-600 hover:underline">Comunidad</Link> (sección Proveedores).
      </p>
    </div>
  );
}
