"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

type TalkRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  eventDate: string | null;
  eventTime: string | null;
  createdAt: string;
  _count: { leads: number };
  metrics?: { calendarClicks: number; whatsappClicks: number };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
  ARCHIVED: "Archivada",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  CLOSED: "bg-amber-100 text-amber-800",
  ARCHIVED: "bg-slate-100 text-slate-700",
};

export default function AdminTalksPage() {
  const [talks, setTalks] = useState<TalkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadTalks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function loadTalks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/talks?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setTalks(data.talks || []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return talks;
    const q = query.trim().toLowerCase();
    return talks.filter((t) => t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [talks, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charlas</h1>
          <p className="text-sm text-gray-500">Administra charlas, inscriptos y métricas.</p>
        </div>
        <Link href="/admin/marketing/charlas/new">
          <Button>Nueva charla</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por título o slug"
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          title="Desde"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          title="Hasta"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.keys(STATUS_LABELS).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={loadTalks}>
          Actualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando charlas...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-600 mb-4">No hay charlas todavía.</p>
          <Link href="/admin/marketing/charlas/new">
            <Button>Crear charla</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charla</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inscriptos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calendar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((talk) => (
                <tr key={talk.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{talk.title}</div>
                    <div className="text-xs text-gray-500">
                      {talk.eventTime ? `Hora: ${talk.eventTime}` : "Sin hora"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {talk.eventDate ? new Date(talk.eventDate).toLocaleDateString("es-AR") : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[talk.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[talk.status] ?? talk.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">/{talk.slug}</td>
                  <td className="px-6 py-4 text-gray-600">{talk._count?.leads ?? 0}</td>
                  <td className="px-6 py-4 text-gray-600">{talk.metrics?.calendarClicks ?? 0}</td>
                  <td className="px-6 py-4 text-gray-600">{talk.metrics?.whatsappClicks ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/marketing/charlas/${talk.id}`} className="text-[#c27b3d] hover:underline">
                        Ver
                      </Link>
                      <a href={`/charlas/${talk.slug}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">
                        Landing
                      </a>
                    </div>
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
