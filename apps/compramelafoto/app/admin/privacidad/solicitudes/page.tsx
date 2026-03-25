"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recibida",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};

const TYPE_LABELS: Record<string, string> = {
  ACCESO: "Acceso",
  RECTIFICACION: "Rectificación",
  SUPRESION: "Supresión",
  OCULTAR_FOTO: "Ocultar foto",
  BAJA_MARKETING: "Baja marketing",
  DESACTIVAR_BIOMETRIA: "Desactivar biometría",
};

export default function AdminPrivacySolicitudesPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    load();
  }, [statusFilter, typeFilter]);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (typeFilter) q.set("type", typeFilter);
      const res = await fetch(`/api/admin/privacy-requests?${q}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Solicitudes ARCO</h1>

      <div className="flex gap-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-600">No hay solicitudes.</p>
          <Link href="/privacidad/solicitud" target="_blank" className="text-[#c27b3d] hover:underline text-sm mt-2 inline-block">
            Ver formulario público →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">#{r.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{TYPE_LABELS[r.type] ?? r.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{r.fullName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      r.status === "RESOLVED" ? "bg-green-100 text-green-800" :
                      r.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      r.status === "IN_REVIEW" ? "bg-amber-100 text-amber-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/privacidad/solicitudes/${r.id}`}
                      className="text-[#c27b3d] hover:underline text-sm font-medium"
                    >
                      Ver
                    </Link>
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
