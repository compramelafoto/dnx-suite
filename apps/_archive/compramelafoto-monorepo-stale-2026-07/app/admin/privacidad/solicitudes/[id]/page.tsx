"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";

const STATUS_OPTIONS = ["RECEIVED", "IN_REVIEW", "RESOLVED", "REJECTED"];
const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recibida",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};

export default function AdminPrivacyRequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [internalNote, setInternalNote] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequest(data.request);
      setInternalNote(data.request.internalNote || "");
      setStatus(data.request.status);
    } catch (e) {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, internalNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequest(data.request);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-600">Cargando...</p>;
  if (!request) return <p className="text-gray-600">Solicitud no encontrada.</p>;

  const meta = request.metadata as Record<string, string> | null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/admin/privacidad/solicitudes" className="text-[#c27b3d] hover:underline text-sm mb-2 inline-block">
          ← Volver a solicitudes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Solicitud #{request.id}</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Datos del solicitante</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">Nombre</dt><dd className="font-medium">{request.fullName}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{request.email}</dd></div>
            <div><dt className="text-gray-500">Teléfono</dt><dd className="font-medium">{request.phone || "-"}</dd></div>
            <div><dt className="text-gray-500">Relación</dt><dd className="font-medium">{request.relationship}</dd></div>
            <div><dt className="text-gray-500">Tipo</dt><dd className="font-medium">{request.type}</dd></div>
            <div><dt className="text-gray-500">Álbum</dt><dd className="font-medium">{request.albumId ?? "-"}</dd></div>
            <div><dt className="text-gray-500">Foto</dt><dd className="font-medium">{request.photoId ?? "-"}</dd></div>
            <div><dt className="text-gray-500">Fecha</dt><dd className="font-medium">{new Date(request.createdAt).toLocaleString("es-AR")}</dd></div>
          </dl>
        </div>

        {request.description && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Descripción</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
          </div>
        )}

        {meta && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Metadata</h2>
            <p className="text-xs text-gray-600">IP: {meta.ip || "-"} | User-Agent: {(meta.userAgent || "").slice(0, 80)}...</p>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Estado</h2>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nota interna</label>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Notas para el equipo..."
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        {saved && <span className="text-green-600 text-sm ml-2">Guardado</span>}
      </div>
    </div>
  );
}
